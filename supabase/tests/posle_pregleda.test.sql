-- The tightening after the 2026-11-04 security review: no silent edits,
-- calendar requests carry only what the other parent sees, real dates, size
-- limits, document ownership, invitation preview.
-- Run: npx supabase test db
begin;
select plan(27);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'mama@primer.rs', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'sam@primer.rs', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'pozvana@primer.rs', 'authenticated', 'authenticated');

create function pg_temp.kao(korisnik uuid, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', korisnik, 'role', 'authenticated', 'email', email, 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.tata() returns void language sql as $$ select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs') $$;
create function pg_temp.mama() returns void language sql as $$ select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs') $$;

create temp table p (porodica uuid, s uuid, d uuid, z uuid, k uuid, token text) on commit drop;
grant all on p to authenticated, anon;

select pg_temp.tata();
insert into p (porodica) values (public.kreiraj_porodicu('Dete', 'tata'));
select set_config('role', 'postgres', true);
select public.dodaj_roditelja((select porodica from p), '22222222-2222-2222-2222-222222222222', 'mama');

-- ===========================================================================
-- Items: edits are logged; closed or closing items are not edited
-- ===========================================================================
select pg_temp.tata();
update p set s = public.nova_stavka('Izlet', 'Saglasnost', 'skola', false, false, '2026-11-10');
select public.izmeni_stavku((select s from p), '{"naslov": "Izlet na Avalu", "datum": "2026-11-12", "oblast": "ostalo"}');
select is((select tekst from public.unos where vrsta = 'izmenjeno'),
          E'Naslov: „Izlet“ → „Izlet na Avalu“\nOblast: Škola → Ostalo\nRok: 10. 11. 2026. → 12. 11. 2026.',
          'izmena se upisuje u tok stavke: šta je bilo i šta je sada');
select public.izmeni_stavku((select s from p), '{"naslov": "Izlet na Avalu"}');
select is((select count(*)::int from public.unos where vrsta = 'izmenjeno'), 1, 'izmena bez promene se ne beleži');
select throws_ok($$select public.izmeni_stavku((select s from p), '{"datum": "2026-02-31"}')$$, '22023', 'Neispravan datum.', 'nepostojeći datum se odbija');

select pg_temp.mama();
select public.odgovori_na_stavku((select s from p), 'Može');
select public.predlozi_zatvaranje((select s from p), 'Mama potpisuje');
select pg_temp.tata();
select throws_ok($$select public.izmeni_stavku((select s from p), '{"naslov": "Nešto drugo"}')$$, '22023',
                 'Zatvaranje čeka potvrdu. Povuci ili odbij predlog, pa izmeni.', 'dok zatvaranje čeka potvrdu, stavka se ne menja');
select public.potvrdi_zatvaranje((select s from p));
select throws_ok($$select public.izmeni_stavku((select s from p), '{"opis": "Zimovanje"}')$$, '22023',
                 'Rešena stavka se ne menja. Ako treba, ponovo je otvori.', 'rešena stavka se ne menja');
select is((select naslov from public.stavka), 'Izlet na Avalu', 'naslov rešene stavke ostaje');

-- ===========================================================================
-- Calendar requests
-- ===========================================================================
select pg_temp.tata();
update p set z = public.predlozi_dogadjaj('dodaj', null,
  '{"naziv": "Plivanje", "vrsta": "trening", "datum": "2026-11-03", "ceoDan": false, "od": "17:00", "do": "18:00",
    "ponavljanje": {"tip": "nedeljno", "svakih": 1, "dani": [1, 1], "do": null}, "vodi": "tata", "mesto": "Bazen", "napomena": "",
    "izuzeti": ["2026-11-10"], "skriveno": "x"}', '', null);
select is((select dogadjaj ? 'izuzeti' or dogadjaj ? 'skriveno' from public.zahtev_kalendara where id = (select z from p)), false,
          'predlog čuva samo poznata polja; preskočeni dani ne idu kroz predlog');
select is((select dogadjaj -> 'ponavljanje' -> 'dani' from public.zahtev_kalendara where id = (select z from p)), '[1]'::jsonb,
          'dani u nedelji se čuvaju jednom, po redu');
select pg_temp.mama();
select public.prihvati_zahtev((select z from p));
update p set d = (select id from public.dogadjaj where naziv = 'Plivanje');
select is((select izuzeti from public.dogadjaj where id = (select d from p)), '{}'::date[], 'nova aktivnost nema preskočene dane');

-- Moved just this once, then the series is changed: the skipped day stays.
select pg_temp.tata();
update p set z = public.predlozi_dogadjaj('izmeni', (select d from p),
  '{"naziv": "Plivanje", "vrsta": "trening", "datum": "2026-11-11", "ceoDan": false, "od": "17:00", "do": "18:00",
    "ponavljanje": {"tip": "ne"}, "vodi": "tata", "mesto": "Bazen", "napomena": ""}', '', '2026-11-10');
select pg_temp.mama();
select public.prihvati_zahtev((select z from p));
select pg_temp.tata();
update p set z = public.predlozi_dogadjaj('izmeni', (select d from p),
  '{"naziv": "Plivanje", "vrsta": "trening", "datum": "2026-11-03", "ceoDan": false, "od": "17:30", "do": "18:30",
    "ponavljanje": {"tip": "nedeljno", "svakih": 1, "dani": [1], "do": null}, "vodi": "tata", "mesto": "Bazen", "napomena": "", "izuzeti": []}', '', null);
select pg_temp.mama();
select public.prihvati_zahtev((select z from p));
select is((select izuzeti from public.dogadjaj where id = (select d from p)), '{2026-11-10}'::date[],
          'izmena serije ne briše dan pomeren samo jednom');
select is((select pocetak collate "default" from public.dogadjaj where id = (select d from p)), '17:30', 'izmena serije je primenjena');

select pg_temp.tata();
select throws_ok($$select public.predlozi_dogadjaj('dodaj', null,
  '{"naziv": "X", "vrsta": "ostalo", "datum": "2026-11-03", "ceoDan": false, "od": "25:00", "do": "26:00", "ponavljanje": {"tip": "ne"}}', '', null)$$,
  '22023', 'Upiši vreme početka i kraja.', 'nepostojeće vreme se odbija');
select throws_ok($$select public.predlozi_dogadjaj('dodaj', null,
  '{"naziv": "X", "vrsta": "ostalo", "datum": "2026-11-03", "ceoDan": true, "ponavljanje": {"tip": "nedeljno", "svakih": 1, "dani": [7]}}', '', null)$$,
  '22023', 'Neispravni dani u nedelji.', 'dan u nedelji je od 0 do 6');
select throws_ok($$select public.predlozi_kalendar('dodaj', null,
  '[{"vrsta": "izuzetak", "kod": "tata", "od": "2026-13-45T10:00", "do": "2026-13-46T10:00"}]', '')$$,
  '22023', 'Upiši datum i vreme početka i kraja.', 'nepostojeći datum boravka se odbija');
select throws_ok($$select public.predlozi_kalendar('dodaj', null,
  '[{"vrsta": "izuzetak", "kod": "tata", "od": "٢٠٢٦-11-20T10:00", "do": "٢٠٢٦-11-21T10:00"}]', '')$$,
  '22023', 'Upiši datum i vreme početka i kraja.', 'samo obične cifre');
select throws_ok($$select public.predlozi_kalendar('dodaj', null,
  '[{"vrsta": "redovno", "kod": "tata", "od": "2026-11-20T10:00", "do": "2026-11-21T10:00"},
    {"vrsta": "izuzetak", "kod": "mama", "od": "2026-11-22T10:00", "do": "2026-11-23T10:00"}]', '')$$,
  '22023', 'Redovan raspored i jednokratne promene predlažu se posebno.', 'jedan predlog je jedan sloj kalendara');
update p set z = public.predlozi_kalendar('dodaj', null,
  '[{"vrsta": "izuzetak", "kod": "mama", "od": "2026-11-22T10:00", "do": "2026-11-23T10:00", "skriveno": "x"}]', '');
select is((select boravci -> 0 ? 'skriveno' from public.zahtev_kalendara where id = (select z from p)), false, 'boravak u predlogu ima samo poznata polja');
select pg_temp.mama();
select throws_ok($$select public.odbij_zahtev((select z from p), repeat('a', 1001))$$, '22023',
                 'Razlog je predug (najviše 1000 znakova).', 'razlog odbijanja ima granicu');

-- ===========================================================================
-- Karton
-- ===========================================================================
select pg_temp.tata();
update p set k = public.sacuvaj_karton(null, 'zdravlje', 'Alergije', 'Polen', null);
select public.sacuvaj_karton((select k from p), 'kontakti', 'Alergije', 'Polen i prašina', '{"telefon": "1"}');
select results_eq($$select grupa, vrednost, detalji is null from public.karton_unos where id = (select k from p)$$,
                  $$values ('zdravlje'::text, 'Polen i prašina'::text, true)$$, 'izmena ne menja vrstu polja');
select throws_ok($$select public.sacuvaj_karton(null, 'kontakti', 'Doktor', '', jsonb_build_object('napomena', repeat('a', 30000)))$$,
                 '22023', 'Detalji su neispravni ili predugi.', 'detalji imaju granicu');

-- ===========================================================================
-- Documents
-- ===========================================================================
select pg_temp.tata();
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('dokumenti', (select porodica from p)::text || '/smece/x.bin', '11111111-1111-1111-1111-111111111111', '{"mimetype": "application/pdf", "size": 1}')$$,
  '42501', null, 'u kantu ide samo <porodica>/<id>.<ekstenzija>');
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('dokumenti', (select porodica from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf', '11111111-1111-1111-1111-111111111111', '{"mimetype": "application/pdf", "size": 10}'),
  ('dokumenti', (select porodica from p)::text || '/aaaaaaaa-0000-4000-8000-000000000002.pdf', '11111111-1111-1111-1111-111111111111', '{"mimetype": "image/png", "size": 10}');
select pg_temp.mama();
select throws_ok($$select public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000001', (select porodica from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf', 'Moj', 'ostalo', null, '')$$,
                 'P0002', 'Fajl nije otpremljen.', 'tuđi otpremljen fajl ne može da se prijavi kao svoj');
select pg_temp.tata();
select throws_ok($$select public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000002', (select porodica from p)::text || '/aaaaaaaa-0000-4000-8000-000000000002.pdf', 'Nalaz', 'zdravlje', null, '')$$,
                 '22023', 'Vrsta fajla se ne slaže sa njegovim nazivom.', 'vrsta fajla mora da odgovara nazivu');
select lives_ok($$select public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000001', (select porodica from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf', 'Nalaz', 'zdravlje', null, '')$$,
                'ko otpremi fajl, taj ga i prijavljuje');

-- ===========================================================================
-- Invitations
-- ===========================================================================
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'sam@primer.rs');
select public.kreiraj_porodicu('Dete', 'tata');
select throws_ok($$select * from public.napravi_pozivnicu('nije mejl')$$, '22023', 'Mejl nije ispravan.', 'mejl za poziv mora biti ispravan');
update p set token = (select token from public.napravi_pozivnicu('pozvana@primer.rs'));
select set_config('role', 'anon', true);
select is((select dete is not null and pozvao is not null from public.pogledaj_pozivnicu((select token from p))), true, 'važeći link pokazuje ko poziva');
select pg_temp.kao('44444444-4444-4444-4444-444444444444', 'pozvana@primer.rs');
select public.prihvati_pozivnicu((select token from p));
select set_config('role', 'anon', true);
select results_eq($$select dete, pozvao, vazi from public.pogledaj_pozivnicu((select token from p))$$,
                  $$values (null::text, null::text, false)$$, 'iskorišćen link ne pokazuje ništa o porodici');

select * from finish();
rollback;
