-- Documents: who sees and uploads files, that files never change, and that
-- "deleting" only marks a document and leaves a trail.
-- Run: npx supabase test db
begin;
select plan(30);

-- tata and mama share a family; stranac (outsider) has a family of his own.
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'mama@primer.rs', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs', 'authenticated', 'authenticated');

create function pg_temp.kao(korisnik uuid, email text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', korisnik, 'role', 'authenticated', 'email', email, 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.kao_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end $$;

-- Runs a statement as the current role; returns how many rows it changed
-- (0 also when the database refuses it outright).
create function pg_temp.izmenjeno(upit text) returns int language plpgsql as $$
declare
  n int;
begin
  execute upit;
  get diagnostics n = row_count;
  return n;
exception when others then
  return 0;
end $$;

create temp table p (tata uuid, stranac uuid) on commit drop;
grant all on p to authenticated, anon;

select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
insert into p (tata) values (public.kreiraj_porodicu('Dete', 'tata'));
select pg_temp.kao_postgres();
select public.dodaj_roditelja((select tata from p), '22222222-2222-2222-2222-222222222222', 'mama');
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
update p set stranac = public.kreiraj_porodicu('Mila', 'mama');

select pg_temp.kao_postgres();
select is((select public from storage.buckets where id = 'dokumenti'), false, 'kanta za dokumente je privatna');

-- ---- Upload ---------------------------------------------------------------
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('dokumenti', (select tata from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf', '11111111-1111-1111-1111-111111111111',
            '{"mimetype": "application/pdf", "size": 1234}')$$,
  'roditelj otprema fajl u folder svoje porodice');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('dokumenti', (select stranac from p)::text || '/aaaaaaaa-0000-4000-8000-000000000009.pdf', '11111111-1111-1111-1111-111111111111',
            '{"mimetype": "application/pdf", "size": 1}')$$,
  '42501', null, 'ne može da otpremi u tuđi folder');

select is(
  public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000001', (select tata from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf',
                        '  Potvrda o upisu ', 'skola', '2026-09-01', ''),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'otpremljen fajl dobija opis');
select results_eq($$select naziv, tip, velicina, otpremio from public.dokument$$,
                  $$values ('Potvrda o upisu'::text, 'application/pdf'::text, 1234::bigint, '11111111-1111-1111-1111-111111111111'::uuid)$$,
                  'tip i veličina dolaze iz samog fajla, a ne od aplikacije');
select throws_ok(
  $$select public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000002', (select tata from p)::text || '/aaaaaaaa-0000-4000-8000-000000000002.pdf', 'X', 'skola', null, '')$$,
  'P0002', 'Fajl nije otpremljen.', 'nema opisa bez otpremljenog fajla');
select throws_ok(
  $$select public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000009', (select stranac from p)::text || '/aaaaaaaa-0000-4000-8000-000000000009.pdf', 'X', 'skola', null, '')$$,
  '42501', 'Fajl nije u prostoru tvoje porodice.', 'ne može da opiše fajl iz tuđeg foldera');
select throws_ok(
  $$select public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000001', (select tata from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf', 'X', 'nesto', null, '')$$,
  '22023', 'Nepoznata kategorija.', 'kategorija mora biti poznata');
select throws_ok(
  $$insert into public.dokument (id, porodica_id, putanja, naziv, kategorija, tip, velicina, otpremio)
    values (gen_random_uuid(), (select tata from p), 'x', 'x', 'skola', 'application/pdf', 1, '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'niko ne upisuje direktno u tabelu');

-- ---- The other parent sees it; the outsider and anon do not ---------------
select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select is((select count(*)::int from public.dokument), 1, 'mama vidi dokument');
select is((select count(*)::int from storage.objects where bucket_id = 'dokumenti'), 1, 'mama može da otvori fajl');

select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select is((select count(*)::int from public.dokument), 0, 'stranac ne vidi tuđe dokumente');
select is((select count(*)::int from storage.objects where bucket_id = 'dokumenti'), 0, 'stranac ne može da otvori tuđe fajlove');
select throws_ok($$select public.obrisi_dokument('aaaaaaaa-0000-4000-8000-000000000001')$$, 'P0002', 'Dokument ne postoji.', 'stranac ne može da briše tuđe dokumente');

select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('role', 'anon', true);
select is((select count(*)::int from public.dokument), 0, 'bez prijave nema dokumenata');
select is((select count(*)::int from storage.objects where bucket_id = 'dokumenti'), 0, 'bez prijave nema fajlova');

-- ---- A file never changes -------------------------------------------------
select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select is(pg_temp.izmenjeno($$update storage.objects set metadata = '{}' where bucket_id = 'dokumenti'$$), 0, 'niko ne menja otpremljen fajl');
select is(pg_temp.izmenjeno($$delete from storage.objects where bucket_id = 'dokumenti'$$), 0, 'niko ne briše otpremljen fajl');

-- ---- Delete marks, restore brings back, the trail keeps everything --------
select lives_ok($$select public.obrisi_dokument('aaaaaaaa-0000-4000-8000-000000000001')$$, 'mama briše dokument');
select results_eq($$select obrisan is not null, obrisao from public.dokument$$,
                  $$values (true, '22222222-2222-2222-2222-222222222222'::uuid)$$, 'zapisano je ko je obrisao');
select throws_ok($$select public.obrisi_dokument('aaaaaaaa-0000-4000-8000-000000000001')$$, '22023', 'Dokument je već obrisan.', 'ne briše se dvaput');
select throws_ok($$select public.izmeni_dokument('aaaaaaaa-0000-4000-8000-000000000001', 'Novo', 'skola', null, '')$$,
                 '22023', 'Obrisan dokument se ne menja. Prvo ga vrati.', 'obrisan dokument se ne menja');

select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
select lives_ok($$select public.vrati_dokument('aaaaaaaa-0000-4000-8000-000000000001')$$, 'tata vraća obrisan dokument');
select lives_ok($$select public.izmeni_dokument('aaaaaaaa-0000-4000-8000-000000000001', 'Potvrda o upisu u treći razred', 'skola', '2026-09-01', 'original je kod mame')$$,
                'tata menja naziv i napomenu');
select results_eq($$select vrsta, ko from public.dokument_trag order by id$$,
                  $$values ('otpremljen'::text, '11111111-1111-1111-1111-111111111111'::uuid),
                           ('obrisan', '22222222-2222-2222-2222-222222222222'::uuid),
                           ('vracen', '11111111-1111-1111-1111-111111111111'::uuid),
                           ('izmenjen', '11111111-1111-1111-1111-111111111111'::uuid)$$,
                  'trag beleži ko je šta uradio');

select pg_temp.kao_postgres();
select is((select count(*)::int from storage.objects
           where bucket_id = 'dokumenti' and name = (select tata from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf'),
          1, 'fajl je sve vreme na mestu');

-- ---- MFA: with a verified factor, documents wait for the code -------------
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'test', 'totp', 'verified', now(), now());
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'aal1');
select is((select count(*)::int from public.dokument), 0, 'sa MFA, bez koda dokumenti se ne vide');
select is((select count(*)::int from storage.objects where bucket_id = 'dokumenti'), 0, 'sa MFA, bez koda fajlovi se ne otvaraju');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('dokumenti', (select tata from p)::text || '/aaaaaaaa-0000-4000-8000-000000000003.pdf', '11111111-1111-1111-1111-111111111111',
            '{"mimetype": "application/pdf", "size": 1}')$$,
  '42501', null, 'sa MFA, bez koda nema otpremanja');
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'aal2');
select is((select count(*)::int from public.dokument), 1, 'sa kodom (aal2) dokumenti se vide');

select * from finish();
rollback;
