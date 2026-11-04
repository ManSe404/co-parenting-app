-- Who may open a new family space on this copy of the app.
--
-- Empty list (the default, e.g. for anyone who sets up their own copy): every
-- signed-in account may. With at least one e-mail in the list, only those
-- accounts may; everyone else can still join a family through an invitation
-- from a parent who is already in it.
--
-- The list is managed by the owner in the Supabase dashboard (Table editor)
-- or with SQL:
--   insert into public.dozvoljeni_osnivac (email) values ('ti@primer.rs');

create table public.dozvoljeni_osnivac (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  dodato timestamptz not null default now()
);

alter table public.dozvoljeni_osnivac enable row level security;
revoke all on public.dozvoljeni_osnivac from anon, authenticated;

create function public.mogu_da_otvorim_prostor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.dozvoljeni_osnivac)
      or exists (
        select 1
        from public.dozvoljeni_osnivac d
        join auth.users u on lower(u.email) = d.email
        where u.id = (select auth.uid())
      )
$$;

revoke execute on function public.mogu_da_otvorim_prostor() from public, anon;
grant execute on function public.mogu_da_otvorim_prostor() to authenticated;

-- Same as before, plus the check above.
create or replace function public.kreiraj_porodicu(p_ime_deteta text, p_uloga text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  nova uuid;
begin
  if not public.mogu_da_otvorim_prostor() then
    raise exception 'Na ovom sajtu nove porodične prostore otvara samo vlasnik. Ako imaš link za poziv, otvori ga.' using errcode = '42501';
  end if;
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
