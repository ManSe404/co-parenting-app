-- Documents: scans, certificates, findings, PDFs and photos about the child.
--
-- The file lives in the private storage bucket `dokumenti` under
-- `<family id>/<document id>.<ext>`; the row in `dokument` describes it.
--
-- Rules:
-- - Only the family's two parents can read or upload; for an account with MFA
--   turned on, only after the second factor (aal2), as everywhere else.
-- - A file never changes after upload: the bucket has no UPDATE or DELETE
--   policy, so nobody can replace or destroy a document from the app.
-- - "Deleting" marks the row (obrisan, obrisao). Both parents see who did it
--   and either of them can bring the document back.
-- - Every step is kept in `dokument_trag`.
-- - Nobody writes the tables directly; the functions below check who is asking.

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumenti', 'dokumenti', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.dokument (
  id uuid primary key,
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  putanja text not null unique,
  naziv text not null check (length(btrim(naziv)) between 1 and 120),
  kategorija text not null check (kategorija in ('skola', 'zdravlje', 'vanskolske', 'licna', 'pravno', 'troskovi', 'ostalo')),
  -- The date written on the document, e.g. the day of the exam.
  datum date,
  napomena text not null default '' check (length(napomena) <= 500),
  tip text not null check (tip in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  velicina bigint not null check (velicina > 0),
  otpremio uuid not null references auth.users (id) on delete restrict,
  otpremljeno timestamptz not null default now(),
  obrisan timestamptz,
  obrisao uuid references auth.users (id) on delete set null,
  check ((obrisan is null) = (obrisao is null))
);

create index dokument_porodica on public.dokument (porodica_id, otpremljeno desc);

create table public.dokument_trag (
  id bigint generated always as identity primary key,
  dokument_id uuid not null references public.dokument (id) on delete cascade,
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  vrsta text not null check (vrsta in ('otpremljen', 'izmenjen', 'obrisan', 'vracen')),
  ko uuid references auth.users (id) on delete set null,
  kada timestamptz not null default now()
);

create index dokument_trag_dokument on public.dokument_trag (dokument_id);

alter table public.dokument enable row level security;
alter table public.dokument_trag enable row level security;

revoke insert, update, delete, truncate on public.dokument, public.dokument_trag from anon, authenticated;

create policy "clan cita dokumente" on public.dokument
  for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa dokument" on public.dokument
  as restrictive for all to authenticated using ((select public.mfa_ispunjen()));

create policy "clan cita trag dokumenata" on public.dokument_trag
  for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa dokument_trag" on public.dokument_trag
  as restrictive for all to authenticated using ((select public.mfa_ispunjen()));

-- ---------------------------------------------------------------------------
-- Bucket policies: read and upload in your own family's folder; nothing else
-- ---------------------------------------------------------------------------

create policy "dokumenti: roditelji citaju" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dokumenti'
    and (storage.foldername(name))[1] = (select public.moja_porodica())::text
    and (select public.mfa_ispunjen())
  );

create policy "dokumenti: roditelji otpremaju" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dokumenti'
    and (storage.foldername(name))[1] = (select public.moja_porodica())::text
    and (select public.mfa_ispunjen())
  );

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Shared checks for the editable fields.
create function public.proveri_dokument(p_naziv text, p_kategorija text, p_napomena text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if length(btrim(coalesce(p_naziv, ''))) not between 1 and 120 then
    raise exception 'Naziv mora imati od 1 do 120 znakova.' using errcode = '22023';
  end if;
  if p_kategorija is null or p_kategorija not in ('skola', 'zdravlje', 'vanskolske', 'licna', 'pravno', 'troskovi', 'ostalo') then
    raise exception 'Nepoznata kategorija.' using errcode = '22023';
  end if;
  if length(coalesce(p_napomena, '')) > 500 then
    raise exception 'Napomena je preduga (najviše 500 znakova).' using errcode = '22023';
  end if;
end
$$;

revoke execute on function public.proveri_dokument(text, text, text) from public, anon, authenticated;

-- After the file is uploaded: describe it. Type and size come from the stored
-- file itself, not from the client.
create function public.dodaj_dokument(
  p_id uuid,
  p_putanja text,
  p_naziv text,
  p_kategorija text,
  p_datum date,
  p_napomena text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  moja uuid := public.moja_porodica();
  fajl record;
begin
  if moja is null then
    raise exception 'Nisi u porodičnom prostoru.' using errcode = '42501';
  end if;
  perform public.proveri_dokument(p_naziv, p_kategorija, p_napomena);
  if p_id is null or p_putanja is null or p_putanja !~ ('^' || moja::text || '/' || p_id::text || '\.(jpg|png|webp|pdf)$') then
    raise exception 'Fajl nije u prostoru tvoje porodice.' using errcode = '42501';
  end if;

  select o.name, o.metadata into fajl
  from storage.objects o
  where o.bucket_id = 'dokumenti' and o.name = p_putanja;
  if not found then
    raise exception 'Fajl nije otpremljen.' using errcode = 'P0002';
  end if;

  insert into public.dokument (id, porodica_id, putanja, naziv, kategorija, datum, napomena, tip, velicina, otpremio)
  values (
    p_id,
    moja,
    p_putanja,
    btrim(p_naziv),
    p_kategorija,
    p_datum,
    btrim(coalesce(p_napomena, '')),
    fajl.metadata ->> 'mimetype',
    (fajl.metadata ->> 'size')::bigint,
    ja
  );
  insert into public.dokument_trag (dokument_id, porodica_id, vrsta, ko) values (p_id, moja, 'otpremljen', ja);
  return p_id;
end
$$;

-- Find a document of your own family, locked for the change that follows.
create function public.moj_dokument(p_id uuid)
returns public.dokument
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.dokument;
begin
  select * into d from public.dokument where id = p_id and porodica_id = public.moja_porodica() for update;
  if not found then
    raise exception 'Dokument ne postoji.' using errcode = 'P0002';
  end if;
  return d;
end
$$;

revoke execute on function public.moj_dokument(uuid) from public, anon, authenticated;

create function public.izmeni_dokument(p_id uuid, p_naziv text, p_kategorija text, p_datum date, p_napomena text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  d public.dokument := public.moj_dokument(p_id);
begin
  if d.obrisan is not null then
    raise exception 'Obrisan dokument se ne menja. Prvo ga vrati.' using errcode = '22023';
  end if;
  perform public.proveri_dokument(p_naziv, p_kategorija, p_napomena);
  update public.dokument
  set naziv = btrim(p_naziv), kategorija = p_kategorija, datum = p_datum, napomena = btrim(coalesce(p_napomena, ''))
  where id = p_id;
  insert into public.dokument_trag (dokument_id, porodica_id, vrsta, ko) values (p_id, d.porodica_id, 'izmenjen', ja);
end
$$;

create function public.obrisi_dokument(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  d public.dokument := public.moj_dokument(p_id);
begin
  if d.obrisan is not null then
    raise exception 'Dokument je već obrisan.' using errcode = '22023';
  end if;
  update public.dokument set obrisan = now(), obrisao = ja where id = p_id;
  insert into public.dokument_trag (dokument_id, porodica_id, vrsta, ko) values (p_id, d.porodica_id, 'obrisan', ja);
end
$$;

create function public.vrati_dokument(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  d public.dokument := public.moj_dokument(p_id);
begin
  if d.obrisan is null then
    raise exception 'Dokument nije obrisan.' using errcode = '22023';
  end if;
  update public.dokument set obrisan = null, obrisao = null where id = p_id;
  insert into public.dokument_trag (dokument_id, porodica_id, vrsta, ko) values (p_id, d.porodica_id, 'vracen', ja);
end
$$;

revoke execute on function public.dodaj_dokument(uuid, text, text, text, date, text) from public, anon;
revoke execute on function public.izmeni_dokument(uuid, text, text, date, text) from public, anon;
revoke execute on function public.obrisi_dokument(uuid) from public, anon;
revoke execute on function public.vrati_dokument(uuid) from public, anon;
grant execute on function public.dodaj_dokument(uuid, text, text, text, date, text) to authenticated;
grant execute on function public.izmeni_dokument(uuid, text, text, date, text) to authenticated;
grant execute on function public.obrisi_dokument(uuid) to authenticated;
grant execute on function public.vrati_dokument(uuid) to authenticated;
