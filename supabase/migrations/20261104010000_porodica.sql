-- Family space ("porodični prostor"): the two parents and the child, and the
-- invitation that links the second parent.
--
-- Nobody writes these tables directly. There are no INSERT/UPDATE/DELETE
-- policies; every change goes through the security-definer functions below,
-- which check who is asking. Reading is limited to one's own family, and for
-- an account with MFA turned on, only after the second factor (aal2).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.porodica (
  id uuid primary key default gen_random_uuid(),
  kreirao uuid not null references auth.users (id) on delete restrict,
  kreirano timestamptz not null default now()
);

create table public.roditelj (
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  korisnik uuid not null references auth.users (id) on delete cascade,
  uloga text not null check (uloga in ('tata', 'mama')),
  oznaka text not null,
  oznaka_akuzativ text not null,
  oznaka_genitiv text not null,
  boja text not null check (boja in ('bio', 'ai')),
  poslednja_poseta timestamptz,
  pridruzen timestamptz not null default now(),
  primary key (porodica_id, korisnik),
  unique (porodica_id, uloga),
  -- One account belongs to one family.
  unique (korisnik)
);

create table public.dete (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  ime text not null check (length(btrim(ime)) between 1 and 60),
  kreirano timestamptz not null default now()
);

create index dete_porodica on public.dete (porodica_id);

create table public.pozivnica (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  -- Only the SHA-256 of the link's token is stored; the token itself is shown
  -- once to the inviting parent and never kept.
  token_hash text not null unique,
  uloga text not null check (uloga in ('tata', 'mama')),
  -- Optional: only this e-mail address may accept.
  email text,
  pozvao uuid not null references auth.users (id) on delete cascade,
  istice timestamptz not null default now() + interval '7 days',
  iskoriscena timestamptz,
  iskoristio uuid references auth.users (id) on delete set null,
  kreirano timestamptz not null default now()
);

create index pozivnica_porodica on public.pozivnica (porodica_id);

alter table public.porodica enable row level security;
alter table public.roditelj enable row level security;
alter table public.dete enable row level security;
alter table public.pozivnica enable row level security;

-- Clients may only read; writes happen inside the functions.
revoke insert, update, delete, truncate on public.porodica, public.roditelj, public.dete, public.pozivnica from anon, authenticated;
revoke all on public.pozivnica from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.moja_porodica()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select porodica_id from public.roditelj where korisnik = (select auth.uid())
$$;

-- MFA: once an account has a verified factor, it must have used it (aal2).
create function public.mfa_ispunjen()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select array[(select auth.jwt() ->> 'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  )
$$;

create function public.hes(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

revoke execute on function public.hes(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: read your own family only
-- ---------------------------------------------------------------------------

create policy "clan cita porodicu" on public.porodica
  for select to authenticated using (id = (select public.moja_porodica()));
create policy "mfa porodica" on public.porodica
  as restrictive for all to authenticated using ((select public.mfa_ispunjen()));

create policy "clan cita roditelje" on public.roditelj
  for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa roditelj" on public.roditelj
  as restrictive for all to authenticated using ((select public.mfa_ispunjen()));

create policy "clan cita dete" on public.dete
  for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa dete" on public.dete
  as restrictive for all to authenticated using ((select public.mfa_ispunjen()));

-- ---------------------------------------------------------------------------
-- Functions: the only way in
-- ---------------------------------------------------------------------------

create function public.prijavljen_sa_mfa()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ja uuid := (select auth.uid());
begin
  if ja is null then
    raise exception 'Nisi prijavljen.' using errcode = '28000';
  end if;
  if not (select public.mfa_ispunjen()) then
    raise exception 'Potreban je i kod iz aplikacije za prijavu (MFA).' using errcode = '28000';
  end if;
  return ja;
end
$$;

revoke execute on function public.prijavljen_sa_mfa() from public, anon;

create function public.dodaj_roditelja(p_porodica uuid, p_korisnik uuid, p_uloga text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.roditelj (porodica_id, korisnik, uloga, oznaka, oznaka_akuzativ, oznaka_genitiv, boja)
  values (
    p_porodica,
    p_korisnik,
    p_uloga,
    case p_uloga when 'tata' then 'Tata' else 'Mama' end,
    case p_uloga when 'tata' then 'tatu' else 'mamu' end,
    case p_uloga when 'tata' then 'tate' else 'mame' end,
    case p_uloga when 'tata' then 'bio' else 'ai' end
  );
end
$$;

revoke execute on function public.dodaj_roditelja(uuid, uuid, text) from public, anon, authenticated;

-- First parent: creates the family space with the child.
create function public.kreiraj_porodicu(p_ime_deteta text, p_uloga text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  nova uuid;
begin
  if p_uloga not in ('tata', 'mama') then
    raise exception 'Izaberi: tata ili mama.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_ime_deteta, ''))) not between 1 and 60 then
    raise exception 'Upiši ime deteta.' using errcode = '22023';
  end if;
  if exists (select 1 from public.roditelj where korisnik = ja) then
    raise exception 'Već si u porodičnom prostoru.' using errcode = '23505';
  end if;

  insert into public.porodica (kreirao) values (ja) returning id into nova;
  perform public.dodaj_roditelja(nova, ja, p_uloga);
  insert into public.dete (porodica_id, ime) values (nova, btrim(p_ime_deteta));
  return nova;
end
$$;

-- Invitation for the other parent. Returns the token once; only its hash is kept.
-- A new invitation replaces any earlier unused one.
create function public.napravi_pozivnicu(p_email text default null)
returns table (token text, istice timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  moja uuid;
  moja_uloga text;
  t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  do_kada timestamptz := now() + interval '7 days';
begin
  select porodica_id, uloga into moja, moja_uloga from public.roditelj where korisnik = ja;
  if moja is null then
    raise exception 'Prvo napravi porodični prostor.' using errcode = '42501';
  end if;
  if (select count(*) from public.roditelj where porodica_id = moja) >= 2 then
    raise exception 'Oba roditelja su već povezana.' using errcode = '23505';
  end if;

  delete from public.pozivnica p where p.porodica_id = moja and p.iskoriscena is null;
  insert into public.pozivnica (porodica_id, token_hash, uloga, email, pozvao, istice)
  values (
    moja,
    public.hes(t),
    case moja_uloga when 'tata' then 'mama' else 'tata' end,
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    ja,
    do_kada
  );
  return query select t, do_kada;
end
$$;

-- What a link holder may see before accepting: child's first name, who
-- invites, which role they would take, and whether the link still works.
create function public.pogledaj_pozivnicu(p_token text)
returns table (dete text, pozvao text, uloga text, vazi boolean, razlog text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.pozivnica;
begin
  select * into p from public.pozivnica where token_hash = public.hes(coalesce(p_token, ''));
  if p.id is null then
    return query select null::text, null::text, null::text, false, 'Link ne postoji ili je zamenjen novim.';
    return;
  end if;
  return query
    select
      (select d.ime from public.dete d where d.porodica_id = p.porodica_id order by d.kreirano limit 1),
      (select r.oznaka from public.roditelj r where r.korisnik = p.pozvao),
      p.uloga,
      p.iskoriscena is null and p.istice > now(),
      case
        when p.iskoriscena is not null then 'Link je već iskorišćen.'
        when p.istice <= now() then 'Link je istekao. Zatraži novi.'
        else null
      end;
end
$$;

grant execute on function public.pogledaj_pozivnicu(text) to anon, authenticated;

-- Second parent accepts: joins the family in the role the inviter chose.
create function public.prihvati_pozivnicu(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  moj_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  p public.pozivnica;
begin
  if exists (select 1 from public.roditelj where korisnik = ja) then
    raise exception 'Već si u porodičnom prostoru.' using errcode = '23505';
  end if;

  select * into p from public.pozivnica where token_hash = public.hes(coalesce(p_token, '')) for update;
  if p.id is null then
    raise exception 'Link ne postoji ili je zamenjen novim.' using errcode = 'P0002';
  end if;
  if p.iskoriscena is not null then
    raise exception 'Link je već iskorišćen.' using errcode = '23505';
  end if;
  if p.istice <= now() then
    raise exception 'Link je istekao. Zatraži novi.' using errcode = '22023';
  end if;
  if p.email is not null and p.email <> moj_email then
    raise exception 'Ovaj link je namenjen drugoj mejl adresi.' using errcode = '42501';
  end if;
  if (select count(*) from public.roditelj where porodica_id = p.porodica_id) >= 2 then
    raise exception 'Oba roditelja su već povezana.' using errcode = '23505';
  end if;

  perform public.dodaj_roditelja(p.porodica_id, ja, p.uloga);
  update public.pozivnica set iskoriscena = now(), iskoristio = ja where id = p.id;
  return p.porodica_id;
end
$$;

-- For the settings screen: the current invitation of my family, if any.
create function public.moja_pozivnica()
returns table (email text, istice timestamptz, iskoriscena timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.email, p.istice, p.iskoriscena
  from public.pozivnica p
  where p.porodica_id = (select public.moja_porodica()) and (select public.mfa_ispunjen())
  order by p.kreirano desc
  limit 1
$$;

create function public.oznaci_posetu()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  pre timestamptz;
begin
  select poslednja_poseta into pre from public.roditelj where korisnik = ja;
  update public.roditelj set poslednja_poseta = now() where korisnik = ja;
  return pre;
end
$$;

revoke execute on function public.kreiraj_porodicu(text, text) from public, anon;
revoke execute on function public.napravi_pozivnicu(text) from public, anon;
revoke execute on function public.prihvati_pozivnicu(text) from public, anon;
revoke execute on function public.moja_pozivnica() from public, anon;
revoke execute on function public.oznaci_posetu() from public, anon;
grant execute on function public.kreiraj_porodicu(text, text) to authenticated;
grant execute on function public.napravi_pozivnicu(text) to authenticated;
grant execute on function public.prihvati_pozivnicu(text) to authenticated;
grant execute on function public.moja_pozivnica() to authenticated;
grant execute on function public.oznaci_posetu() to authenticated;
grant execute on function public.moja_porodica() to authenticated;
grant execute on function public.mfa_ispunjen() to authenticated;
grant execute on function public.prijavljen_sa_mfa() to authenticated;
