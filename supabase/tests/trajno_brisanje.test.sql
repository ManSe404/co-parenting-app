-- Permanent deletion of a document: only from the trash, only when both
-- parents agree, and only then may the file leave the bucket.
-- Run: npx supabase test db
begin;
select plan(26);

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

-- Deletes the way the Storage API does (it lifts the guard against plain SQL
-- deletes; the bucket's policies still apply); returns how many files went.
create function pg_temp.obrisi_fajl(putanja text) returns int language plpgsql as $$
declare
  n int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'dokumenti' and name = putanja;
  get diagnostics n = row_count;
  perform set_config('storage.allow_delete_query', 'false', true);
  return n;
end $$;

create function pg_temp.dokument(id uuid, porodica uuid, korisnik uuid) returns text language plpgsql as $$
declare
  put text := porodica::text || '/' || id::text || '.pdf';
begin
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('dokumenti', put, korisnik::text, '{"mimetype": "application/pdf", "size": 100}');
  perform public.dodaj_dokument(id, put, 'Stari račun', 'troskovi', null, '');
  return put;
end $$;

create temp table p (tata uuid, stranac uuid, put text, z uuid) on commit drop;
grant all on p to authenticated;

select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
insert into p (tata) values (public.kreiraj_porodicu('Dete', 'tata'));
select pg_temp.kao_postgres();
select public.dodaj_roditelja((select tata from p), '22222222-2222-2222-2222-222222222222', 'mama');
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
update p set stranac = public.kreiraj_porodicu('Dete', 'mama');

select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
update p set put = pg_temp.dokument('bbbbbbbb-0000-4000-8000-000000000001', (select tata from p), '11111111-1111-1111-1111-111111111111');

-- ---- Only from the trash ----------------------------------------------------
select throws_ok($$select public.predlozi_trajno_brisanje('bbbbbbbb-0000-4000-8000-000000000001')$$,
                 '22023', 'Trajno se briše samo dokument iz obrisanih.', 'dokument van obrisanih se ne briše trajno');
select is(pg_temp.obrisi_fajl((select put from p)), 0, 'bez dogovora fajl ne može da se obriše');

select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select public.obrisi_dokument('bbbbbbbb-0000-4000-8000-000000000001');

-- ---- A proposal, declined ---------------------------------------------------
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
update p set z = public.predlozi_trajno_brisanje('bbbbbbbb-0000-4000-8000-000000000001');
select isnt((select z from p), null, 'tata predlaže trajno brisanje obrisanog dokumenta');
select throws_ok($$select public.predlozi_trajno_brisanje('bbbbbbbb-0000-4000-8000-000000000001')$$,
                 '23505', 'Trajno brisanje je već predloženo.', 'jedan otvoren predlog po dokumentu');
select throws_ok($$select public.potvrdi_trajno_brisanje((select z from p))$$,
                 '42501', 'Trajno brisanje mora da potvrdi drugi roditelj.', 'predlagač ne potvrđuje sam sebi');
select throws_ok($$select public.odbij_trajno_brisanje((select z from p))$$,
                 '42501', null, 'predlagač ne odbija svoj predlog (može da ga povuče)');
select is(pg_temp.obrisi_fajl((select put from p)), 0, 'dok drugi ne potvrdi, fajl ne može da se obriše');

select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select throws_ok($$select public.potvrdi_trajno_brisanje((select z from p))$$, 'P0002', 'Predlog ne postoji.', 'stranac ne potvrđuje tuđe brisanje');
select is((select count(*)::int from public.dokument_brisanje), 0, 'stranac ne vidi tuđe predloge');

select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select lives_ok($$select public.odbij_trajno_brisanje((select z from p))$$, 'mama odbija');
select results_eq($$select stanje, odgovorio from public.dokument_brisanje where id = (select z from p)$$,
                  $$values ('odbijeno'::text, '22222222-2222-2222-2222-222222222222'::uuid)$$, 'zapisano je ko je odbio');
select is((select count(*)::int from public.dokument where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 1, 'posle odbijanja dokument je i dalje u obrisanima');

-- ---- Restoring answers an open proposal -------------------------------------
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
update p set z = public.predlozi_trajno_brisanje('bbbbbbbb-0000-4000-8000-000000000001');
select lives_ok($$select public.povuci_trajno_brisanje((select z from p))$$, 'tata povlači svoj predlog');
update p set z = public.predlozi_trajno_brisanje('bbbbbbbb-0000-4000-8000-000000000001');
select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select throws_ok($$select public.povuci_trajno_brisanje((select z from p))$$, '42501', null, 'tuđi predlog se ne povlači');
select lives_ok($$select public.vrati_dokument('bbbbbbbb-0000-4000-8000-000000000001')$$, 'mama umesto potvrde vraća dokument');
select is((select stanje from public.dokument_brisanje where id = (select z from p)), 'odbijeno', 'vraćanje odbija otvoren predlog');

-- ---- Both agree: the file goes, a record stays ------------------------------
select public.obrisi_dokument('bbbbbbbb-0000-4000-8000-000000000001');
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
update p set z = public.predlozi_trajno_brisanje('bbbbbbbb-0000-4000-8000-000000000001');
select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select is(public.potvrdi_trajno_brisanje((select z from p)), (select put from p), 'mama potvrđuje i dobija putanju fajla');
select throws_ok($$select public.vrati_dokument('bbbbbbbb-0000-4000-8000-000000000001')$$,
                 '22023', 'Oboje ste potvrdili trajno brisanje; dokument više ne može da se vrati.', 'posle potvrde nema vraćanja');
select throws_ok($$select public.zavrsi_trajno_brisanje((select z from p))$$,
                 '55000', 'Fajl još nije obrisan iz skladišta.', 'red se ne briše dok fajl postoji');

select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select is(pg_temp.obrisi_fajl((select put from p)), 0, 'stranac ne briše ni odobren fajl');

select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select is(pg_temp.obrisi_fajl((select put from p)), 1, 'posle saglasnosti oba roditelja fajl se briše');
select lives_ok($$select public.zavrsi_trajno_brisanje((select z from p))$$, 'brisanje se završava');
select lives_ok($$select public.zavrsi_trajno_brisanje((select z from p))$$, 'ponovljeno završavanje ne smeta');
select is((select count(*)::int from public.dokument where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 0, 'dokument je trajno obrisan');
select results_eq($$select naziv, stanje, dokument_id is null, predlozio, odgovorio from public.dokument_brisanje where id = (select z from p)$$,
                  $$values ('Stari račun'::text, 'obrisano'::text, true, '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid)$$,
                  'ostaje zapis: šta je obrisano, ko je predložio i ko je potvrdio');

-- ---- A family with one parent can't delete for good -------------------------
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select pg_temp.dokument('bbbbbbbb-0000-4000-8000-000000000002', (select stranac from p), '33333333-3333-3333-3333-333333333333');
select public.obrisi_dokument('bbbbbbbb-0000-4000-8000-000000000002');
select throws_ok($$select public.predlozi_trajno_brisanje('bbbbbbbb-0000-4000-8000-000000000002')$$,
                 '22023', 'Trajno brisanje mora da potvrdi i drugi roditelj, a još niste povezani.', 'sam roditelj ne briše trajno');

select * from finish();
rollback;
