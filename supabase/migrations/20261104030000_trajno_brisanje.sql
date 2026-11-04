-- Permanent deletion of a document: only from the trash ("Obrisani"), and only
-- when both parents agree. One parent proposes, the other confirms; only then
-- may the file be removed from storage, for good. A short record stays: what
-- was deleted, who proposed it and who confirmed it.
--
-- Steps (the app does them in this order):
--   1. predlozi_trajno_brisanje   parent A, document must be in the trash
--   2. potvrdi_trajno_brisanje    parent B (never A); the request is approved
--   3. Storage API remove         allowed by the bucket policy below only for
--                                 a document with an approved request
--   4. zavrsi_trajno_brisanje     either parent; removes the row once the file
--                                 is really gone (safe to repeat if 3 failed)

create table public.dokument_brisanje (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  -- Null once the document is gone; naziv and kategorija keep the record readable.
  dokument_id uuid references public.dokument (id) on delete set null,
  naziv text not null,
  kategorija text not null,
  predlozio uuid not null references auth.users (id) on delete restrict,
  predlozeno timestamptz not null default now(),
  stanje text not null default 'ceka' check (stanje in ('ceka', 'odobreno', 'odbijeno', 'povuceno', 'obrisano')),
  odgovorio uuid references auth.users (id) on delete set null,
  odgovoreno timestamptz,
  zavrseno timestamptz
);

-- At most one open request per document.
create unique index dokument_brisanje_otvoren on public.dokument_brisanje (dokument_id) where stanje in ('ceka', 'odobreno');
create index dokument_brisanje_porodica on public.dokument_brisanje (porodica_id, predlozeno desc);

alter table public.dokument_brisanje enable row level security;
revoke insert, update, delete, truncate on public.dokument_brisanje from anon, authenticated;

create policy "clan cita brisanja" on public.dokument_brisanje
  for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa dokument_brisanje" on public.dokument_brisanje
  as restrictive for all to authenticated using ((select public.mfa_ispunjen()));

-- ---------------------------------------------------------------------------
-- The only way a file can leave the bucket
-- ---------------------------------------------------------------------------

create function public.sme_trajno_obrisati(p_putanja text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dokument d
    join public.dokument_brisanje b on b.dokument_id = d.id and b.stanje = 'odobreno'
    where d.putanja = p_putanja and d.porodica_id = public.moja_porodica()
  )
$$;

revoke execute on function public.sme_trajno_obrisati(text) from public, anon;
grant execute on function public.sme_trajno_obrisati(text) to authenticated;

create policy "dokumenti: brisanje kad se oba roditelja slože" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'dokumenti'
    and (select public.mfa_ispunjen())
    and public.sme_trajno_obrisati(name)
  );

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- A request of your own family, locked for the change that follows.
create function public.moje_brisanje(p_id uuid)
returns public.dokument_brisanje
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.dokument_brisanje;
begin
  select * into z from public.dokument_brisanje where id = p_id and porodica_id = public.moja_porodica() for update;
  if not found then
    raise exception 'Predlog ne postoji.' using errcode = 'P0002';
  end if;
  return z;
end
$$;

revoke execute on function public.moje_brisanje(uuid) from public, anon, authenticated;

create function public.predlozi_trajno_brisanje(p_dokument uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  d public.dokument := public.moj_dokument(p_dokument);
  novi uuid;
begin
  if d.obrisan is null then
    raise exception 'Trajno se briše samo dokument iz obrisanih.' using errcode = '22023';
  end if;
  if (select count(*) from public.roditelj where porodica_id = d.porodica_id) < 2 then
    raise exception 'Trajno brisanje mora da potvrdi i drugi roditelj, a još niste povezani.' using errcode = '22023';
  end if;
  if exists (select 1 from public.dokument_brisanje where dokument_id = p_dokument and stanje in ('ceka', 'odobreno')) then
    raise exception 'Trajno brisanje je već predloženo.' using errcode = '23505';
  end if;
  insert into public.dokument_brisanje (porodica_id, dokument_id, naziv, kategorija, predlozio)
  values (d.porodica_id, d.id, d.naziv, d.kategorija, ja)
  returning id into novi;
  return novi;
end
$$;

-- The other parent agrees; returns the file's path for the Storage API.
create function public.potvrdi_trajno_brisanje(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  z public.dokument_brisanje := public.moje_brisanje(p_id);
begin
  if z.stanje <> 'ceka' then
    raise exception 'Ovaj predlog više ne čeka potvrdu.' using errcode = '22023';
  end if;
  if z.predlozio = ja then
    raise exception 'Trajno brisanje mora da potvrdi drugi roditelj.' using errcode = '42501';
  end if;
  update public.dokument_brisanje set stanje = 'odobreno', odgovorio = ja, odgovoreno = now() where id = p_id;
  return (select putanja from public.dokument where id = z.dokument_id);
end
$$;

create function public.odbij_trajno_brisanje(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  z public.dokument_brisanje := public.moje_brisanje(p_id);
begin
  if z.stanje <> 'ceka' then
    raise exception 'Ovaj predlog više ne čeka potvrdu.' using errcode = '22023';
  end if;
  if z.predlozio = ja then
    raise exception 'Svoj predlog možeš da povučeš, a odbija ga drugi roditelj.' using errcode = '42501';
  end if;
  update public.dokument_brisanje set stanje = 'odbijeno', odgovorio = ja, odgovoreno = now() where id = p_id;
end
$$;

create function public.povuci_trajno_brisanje(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  z public.dokument_brisanje := public.moje_brisanje(p_id);
begin
  if z.stanje <> 'ceka' then
    raise exception 'Ovaj predlog više ne čeka potvrdu.' using errcode = '22023';
  end if;
  if z.predlozio <> ja then
    raise exception 'Povući može samo onaj ko je predložio.' using errcode = '42501';
  end if;
  update public.dokument_brisanje set stanje = 'povuceno', odgovorio = ja, odgovoreno = now() where id = p_id;
end
$$;

-- After the file is gone from storage: remove the row (and its trail), keep
-- the request as the record. Repeating it is harmless.
create function public.zavrsi_trajno_brisanje(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  z public.dokument_brisanje := public.moje_brisanje(p_id);
  put text;
begin
  if z.stanje = 'obrisano' then
    return;
  end if;
  if z.stanje <> 'odobreno' then
    raise exception 'Trajno brisanje nije potvrdio drugi roditelj.' using errcode = '42501';
  end if;
  select putanja into put from public.dokument where id = z.dokument_id;
  if exists (select 1 from storage.objects where bucket_id = 'dokumenti' and name = put) then
    raise exception 'Fajl još nije obrisan iz skladišta.' using errcode = '55000';
  end if;
  delete from public.dokument where id = z.dokument_id;
  update public.dokument_brisanje set stanje = 'obrisano', zavrseno = now() where id = p_id;
end
$$;

-- Restoring a document answers an open request: the proposer withdraws it,
-- the other parent declines it. Once both agreed, it can not be restored.
create or replace function public.vrati_dokument(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  d public.dokument := public.moj_dokument(p_id);
  z public.dokument_brisanje;
begin
  if d.obrisan is null then
    raise exception 'Dokument nije obrisan.' using errcode = '22023';
  end if;
  select * into z from public.dokument_brisanje where dokument_id = p_id and stanje in ('ceka', 'odobreno') for update;
  if found and z.stanje = 'odobreno' then
    raise exception 'Oboje ste potvrdili trajno brisanje; dokument više ne može da se vrati.' using errcode = '22023';
  end if;
  if found then
    update public.dokument_brisanje
    set stanje = case when z.predlozio = ja then 'povuceno' else 'odbijeno' end, odgovorio = ja, odgovoreno = now()
    where id = z.id;
  end if;
  update public.dokument set obrisan = null, obrisao = null where id = p_id;
  insert into public.dokument_trag (dokument_id, porodica_id, vrsta, ko) values (p_id, d.porodica_id, 'vracen', ja);
end
$$;

revoke execute on function public.predlozi_trajno_brisanje(uuid) from public, anon;
revoke execute on function public.potvrdi_trajno_brisanje(uuid) from public, anon;
revoke execute on function public.odbij_trajno_brisanje(uuid) from public, anon;
revoke execute on function public.povuci_trajno_brisanje(uuid) from public, anon;
revoke execute on function public.zavrsi_trajno_brisanje(uuid) from public, anon;
grant execute on function public.predlozi_trajno_brisanje(uuid) to authenticated;
grant execute on function public.potvrdi_trajno_brisanje(uuid) to authenticated;
grant execute on function public.odbij_trajno_brisanje(uuid) to authenticated;
grant execute on function public.povuci_trajno_brisanje(uuid) to authenticated;
grant execute on function public.zavrsi_trajno_brisanje(uuid) to authenticated;
