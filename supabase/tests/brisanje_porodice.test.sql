-- Deleting a family space: only when both parents ask, files first, then
-- every row; the other family is untouched; then one's own account.
-- Run: npx supabase test db
begin;
select plan(21);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'mama@primer.rs', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'niko@primer.rs', 'authenticated', 'authenticated');

create function pg_temp.kao(korisnik uuid, email text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', korisnik, 'role', 'authenticated', 'email', email, 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.kao_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end $$;
create function pg_temp.tata() returns void language sql as $$ select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs') $$;
create function pg_temp.mama() returns void language sql as $$ select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs') $$;
create function pg_temp.stranac() returns void language sql as $$ select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs') $$;

-- Deletes the way the Storage API does (lifts the guard against plain SQL
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

-- Rows of one family across every shared table.
create function pg_temp.redova(porodica uuid) returns int language sql as $$
  select (select count(*) from public.roditelj where porodica_id = porodica)
       + (select count(*) from public.dete where porodica_id = porodica)
       + (select count(*) from public.stavka where porodica_id = porodica)
       + (select count(*) from public.unos where porodica_id = porodica)
       + (select count(*) from public.boravak where porodica_id = porodica)
       + (select count(*) from public.zahtev_kalendara where porodica_id = porodica)
       + (select count(*) from public.karton_unos where porodica_id = porodica)
       + (select count(*) from public.karton_izmena where porodica_id = porodica)
       + (select count(*) from public.raspored_casova where porodica_id = porodica)
       + (select count(*) from public.dokument where porodica_id = porodica)
       + (select count(*) from public.dokument_trag where porodica_id = porodica)
       + (select count(*) from public.obavestenje where porodica_id = porodica)
       + (select count(*) from storage.objects where bucket_id = 'dokumenti' and name like porodica::text || '/%')
$$;

create temp table p (porodica uuid, stranac uuid, z uuid, put text) on commit drop;
grant all on p to authenticated;

-- A family with items, a stay, karton, a timetable and a document.
select pg_temp.tata();
insert into p (porodica) values (public.kreiraj_porodicu('Dete', 'tata'));
select pg_temp.kao_postgres();
select public.dodaj_roditelja((select porodica from p), '22222222-2222-2222-2222-222222222222', 'mama');
select pg_temp.tata();
select public.nova_stavka('Izlet', 'Saglasnost', 'skola', false, true, null);
update p set z = public.predlozi_kalendar('dodaj', null, '[{"vrsta": "redovno", "kod": "tata", "od": "2026-11-20T18:00", "do": "2026-11-22T18:00", "napomena": ""}]', '');
select public.sacuvaj_karton(null, 'zdravlje', 'Alergije', 'Polen', null);
select public.sacuvaj_raspored('["1."]', '[["Srpski"]]', null, '');
update p set put = (select porodica from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf';
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('dokumenti', (select put from p), '11111111-1111-1111-1111-111111111111', '{"mimetype": "application/pdf", "size": 10}');
select public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000001', (select put from p), 'Nalaz', 'zdravlje', null, '');
select pg_temp.mama();
select public.prihvati_zahtev((select z from p));
select pg_temp.stranac();
update p set stranac = public.kreiraj_porodicu('Dete', 'mama');
select public.nova_stavka('Tuđa stavka', '', 'ostalo', false, false, null);

select pg_temp.kao_postgres();
select cmp_ok(pg_temp.redova((select porodica from p)), '>=', 12, 'porodica ima podatke u svim tabelama');

-- ---- Who may ask ------------------------------------------------------------
select pg_temp.kao('44444444-4444-4444-4444-444444444444', 'niko@primer.rs');
select throws_ok($$select public.obrisi_porodicu()$$, '42501', 'Nisi u porodičnom prostoru.', 'bez porodice nema šta da se briše');

-- ---- One parent asks: nothing happens yet ------------------------------------
select pg_temp.tata();
select is(public.obrisi_porodicu(), '{"stanje": "ceka"}'::jsonb, 'prvi zahtev čeka drugog roditelja');
select is(public.obrisi_porodicu(), '{"stanje": "ceka"}'::jsonb, 'ponovljen zahtev istog roditelja i dalje čeka');
select pg_temp.kao_postgres();
select cmp_ok(pg_temp.redova((select porodica from p)), '>=', 12, 'posle jednog zahteva ništa nije obrisano');
select pg_temp.mama();
select is(pg_temp.obrisi_fajl((select put from p)), 0, 'dok oba ne zatraže, fajl ne može da se obriše');
select pg_temp.tata();
select lives_ok($$select public.odustani_od_brisanja()$$, 'ko je zatražio može da odustane');
select is((select brisanje_zatrazeno from public.roditelj where uloga = 'tata'), null, 'odustajanje briše zahtev');
select public.obrisi_porodicu();

-- ---- The other parent asks: files first, then everything ----------------------
select pg_temp.mama();
select is(public.obrisi_porodicu(), jsonb_build_object('stanje', 'fajlovi', 'putanje', jsonb_build_array((select put from p))), 'drugi zahtev vraća fajlove koje treba obrisati');
select throws_ok($$select public.odustani_od_brisanja()$$, '22023', 'Oba roditelja su potvrdila brisanje; više ne može da se odustane.', 'posle oba zahteva nema odustajanja');
select pg_temp.stranac();
select is(pg_temp.obrisi_fajl((select put from p)), 0, 'stranac ne briše tuđe fajlove ni tada');
select pg_temp.mama();
select is(pg_temp.obrisi_fajl((select put from p)), 1, 'roditelj briše fajl kad su oba zatražila');
select is(public.obrisi_porodicu(), '{"stanje": "obrisano"}'::jsonb, 'kad fajlova nema, prostor se briše');

select pg_temp.kao_postgres();
select is(pg_temp.redova((select porodica from p)), 0, 'ni jedan red porodice nije ostao');
select is((select count(*)::int from public.porodica where id = (select porodica from p)), 0, 'ni sama porodica');
select is((select count(*)::int from public.stavka where porodica_id = (select stranac from p)), 1, 'druga porodica je netaknuta');
select is((select count(*)::int from auth.users where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, 'nalozi ostaju dok ih roditelj sam ne obriše');

-- ---- Then the account ------------------------------------------------------------
select pg_temp.stranac();
select throws_ok($$select public.obrisi_nalog()$$, '42501', 'Prvo obriši porodični prostor (Podešavanja → Brisanje).', 'nalog u porodici se ne briše');
select pg_temp.tata();
select lives_ok($$select public.obrisi_nalog()$$, 'posle brisanja prostora roditelj briše svoj nalog');
select pg_temp.kao_postgres();
select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0, 'nalog je obrisan');

-- ---- A family with one parent --------------------------------------------------------
select pg_temp.stranac();
select is(public.obrisi_porodicu(), '{"stanje": "obrisano"}'::jsonb, 'sam roditelj briše svoj prostor odmah');

select * from finish();
rollback;
