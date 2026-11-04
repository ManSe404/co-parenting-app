-- Items, calendar and karton: the same rules as in the app, enforced in the
-- database. Run: npx supabase test db
begin;
select plan(48);

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

create function pg_temp.tata() returns void language sql as $$ select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs') $$;
create function pg_temp.mama() returns void language sql as $$ select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs') $$;
create function pg_temp.stranac() returns void language sql as $$ select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs') $$;

create temp table p (porodica uuid, s uuid, z uuid, b uuid, d uuid, k uuid) on commit drop;
grant all on p to authenticated;

select pg_temp.tata();
insert into p (porodica) values (public.kreiraj_porodicu('Dete', 'tata'));
select pg_temp.kao_postgres();
select public.dodaj_roditelja((select porodica from p), '22222222-2222-2222-2222-222222222222', 'mama');
select pg_temp.stranac();
select public.kreiraj_porodicu('Dete', 'mama');

-- ===========================================================================
-- Items
-- ===========================================================================
select pg_temp.tata();
update p set s = public.nova_stavka('  Izlet na Avalu ', 'Saglasnost do petka', 'skola', false, true, '2026-11-10');
select results_eq($$select naslov, stanje, hitno from public.stavka$$, $$values ('Izlet na Avalu'::text, 'neodgovoreno'::text, true)$$,
                  'tata otvara stavku; čeka odgovor');
select throws_ok($$select public.nova_stavka(' ', '', 'skola', false, false, null)$$, '22023', 'Naslov je obavezan.', 'naslov je obavezan');
select throws_ok($$insert into public.stavka (porodica_id, naslov, oblast, otvorio) values ((select porodica from p), 'x', 'skola', '11111111-1111-1111-1111-111111111111')$$,
                 '42501', null, 'niko ne piše direktno u stavke');

select public.odgovori_na_stavku((select s from p), 'Moja poruka');
select is((select stanje from public.stavka), 'neodgovoreno', 'odgovor onoga ko je pitao ne menja stanje');

select pg_temp.mama();
select public.odgovori_na_stavku((select s from p), 'Može, potpisaću');
select is((select stanje from public.stavka), 'otvoreno', 'odgovor drugog roditelja otvara stavku');
select lives_ok($$select public.izmeni_stavku((select s from p), '{"vazno": true, "datum": null}')$$, 'oba roditelja menjaju polja');
select results_eq($$select vazno, datum is null, naslov from public.stavka$$, $$values (true, true, 'Izlet na Avalu'::text)$$, 'menja se samo ono što je poslato');

select public.predlozi_zatvaranje((select s from p), 'Mama potpisuje saglasnost');
select throws_ok($$select public.potvrdi_zatvaranje((select s from p))$$, '42501', 'Zatvaranje potvrđuje drugi roditelj.', 'ko predloži zatvaranje, ne potvrđuje ga');
select throws_ok($$select public.predlozi_zatvaranje((select s from p), 'opet')$$, '22023', 'Zatvaranje je već predloženo.', 'jedan predlog u isto vreme');

select pg_temp.tata();
select throws_ok($$select public.odbij_zatvaranje((select s from p), ' ')$$, '22023', 'Napiši zašto se ne slažeš.', 'odbijanje traži razlog');
select lives_ok($$select public.potvrdi_zatvaranje((select s from p))$$, 'tata potvrđuje zatvaranje');
select results_eq($$select stanje, odluka, zatvaranje_predlozio is null, zatvoreno is not null from public.stavka$$,
                  $$values ('zatvoreno'::text, 'Mama potpisuje saglasnost'::text, true, true)$$, 'stavka je zatvorena sa odlukom');
select throws_ok($$select public.odgovori_na_stavku((select s from p), 'još nešto')$$, '22023', 'Zatvorena stavka se prvo ponovo otvara.', 'zatvorena stavka se ne dopisuje');
select lives_ok($$select public.ponovo_otvori_stavku((select s from p), 'Promenio se datum')$$, 'ponovno otvaranje sa razlogom');
-- (In this test everything is one transaction, so the times are equal: compare as a bag.)
select bag_eq($$select vrsta from public.unos$$,
              $$select unnest(array['odgovor', 'odgovor', 'predlog_zatvaranja', 'zatvoreno', 'ponovo_otvoreno'])$$,
              'tok stavke beleži svaki korak');
select is((select count(distinct autor)::int from public.unos), 2, 'svaki unos ima pravog autora');

-- ===========================================================================
-- Calendar
-- ===========================================================================
select pg_temp.tata();
select throws_ok($$insert into public.boravak (porodica_id, vrsta, kod, pocetak, kraj) values ((select porodica from p), 'redovno', 'tata', '2026-11-06T18:00', '2026-11-08T18:00')$$,
                 '42501', null, 'niko ne upisuje boravak direktno');
update p set z = public.predlozi_kalendar('dodaj', null,
  '[{"vrsta": "redovno", "kod": "tata", "od": "2026-11-06T18:00", "do": "2026-11-08T18:00", "napomena": " vikend "},
    {"vrsta": "redovno", "kod": "mama", "od": "2026-11-08T18:00", "do": "2026-11-13T18:00", "napomena": ""}]', 'Predlog rasporeda');
select is((select count(*)::int from public.boravak), 0, 'predlog ne menja kalendar');
select throws_ok($$select public.prihvati_zahtev((select z from p))$$, '42501', 'Zahtev prihvata drugi roditelj.', 'predlagač ne prihvata svoj predlog');
select throws_ok($$select public.predlozi_kalendar('dodaj', null, '[{"vrsta": "redovno", "kod": "mama", "od": "2026-11-07T10:00", "do": "2026-11-07T09:00", "napomena": ""}]', '')$$,
                 '22023', 'Kraj mora biti posle početka.', 'kraj posle početka');
select throws_ok($$select public.predlozi_kalendar('dodaj', null, '[{"vrsta": "redovno", "kod": "deda", "od": "2026-11-07T10:00", "do": "2026-11-07T12:00", "napomena": ""}]', '')$$,
                 '22023', 'Izaberi kod koga je dete.', 'dete je kod tate ili mame');
select throws_ok($$select public.predlozi_kalendar('dodaj', null,
                   '[{"vrsta": "redovno", "kod": "tata", "od": "2026-11-20T10:00", "do": "2026-11-20T14:00", "napomena": ""},
                     {"vrsta": "redovno", "kod": "mama", "od": "2026-11-20T12:00", "do": "2026-11-20T16:00", "napomena": ""}]', '')$$,
                 '22023', null, 'novi boravci se ne preklapaju međusobno');

select pg_temp.mama();
select lives_ok($$select public.prihvati_zahtev((select z from p))$$, 'mama prihvata');
select results_eq($$select kod, pocetak collate "default", kraj collate "default", napomena from public.boravak order by pocetak$$,
                  $$values ('tata'::text, '2026-11-06T18:00'::text, '2026-11-08T18:00'::text, 'vikend'::text),
                           ('mama', '2026-11-08T18:00', '2026-11-13T18:00', '')$$,
                  'prihvaćen predlog upisuje boravke (dodir na primopredaji je dozvoljen)');
select results_eq($$select stanje, resio from public.zahtev_kalendara where id = (select z from p)$$,
                  $$values ('prihvacen'::text, '22222222-2222-2222-2222-222222222222'::uuid)$$, 'zna se ko je prihvatio');
select throws_ok($$select public.prihvati_zahtev((select z from p))$$, '22023', 'Zahtev je već rešen.', 'prihvata se samo jednom');
select throws_ok($$select public.predlozi_kalendar('dodaj', null, '[{"vrsta": "redovno", "kod": "mama", "od": "2026-11-07T10:00", "do": "2026-11-07T12:00", "napomena": ""}]', '')$$,
                 '22023', null, 'preklapanje sa postojećim rasporedom se odbija');

-- A one-off change sits on top of the regular schedule.
update p set b = (select id from public.boravak where kod = 'tata');
update p set z = public.predlozi_kalendar('dodaj', null, '[{"vrsta": "izuzetak", "kod": "mama", "od": "2026-11-07T10:00", "do": "2026-11-07T12:00", "napomena": "rođendan"}]', '');
select pg_temp.tata();
select throws_ok($$select public.odbij_zahtev((select z from p), '')$$, '22023', 'Napiši zašto ne prihvataš.', 'odbijanje traži razlog');
select lives_ok($$select public.odbij_zahtev((select z from p), 'Tad smo na izletu')$$, 'tata odbija sa razlogom');
select is((select count(*)::int from public.boravak where vrsta = 'izuzetak'), 0, 'odbijen predlog ne menja ništa');

-- Delete a period, then the other parent accepts.
update p set z = public.predlozi_kalendar('obrisi', (select b from p), '[]', 'Ne treba');
select pg_temp.mama();
select lives_ok($$select public.prihvati_zahtev((select z from p))$$, 'brisanje boravka uz pristanak');
select is((select count(*)::int from public.boravak), 1, 'boravak je obrisan');

-- Activities: add, then move one occurrence just this once.
select pg_temp.tata();
update p set z = public.predlozi_dogadjaj('dodaj', null,
  '{"naziv": " Fudbal ", "vrsta": "trening", "datum": "2026-11-03", "ceoDan": false, "od": "17:00", "do": "18:00",
    "ponavljanje": {"tip": "nedeljno", "svakih": 1, "dani": [1, 3], "do": null}, "vodi": "tata", "mesto": "Sala", "napomena": ""}', '', null);
select throws_ok($$select public.predlozi_dogadjaj('dodaj', null, '{"naziv": "", "vrsta": "trening", "datum": "2026-11-03", "ceoDan": true, "od": "", "do": "", "ponavljanje": {"tip": "ne"}, "vodi": null, "mesto": "", "napomena": ""}', '', null)$$,
                 '22023', 'Upiši naziv aktivnosti.', 'aktivnost mora imati naziv');
select pg_temp.mama();
select public.prihvati_zahtev((select z from p));
update p set d = (select id from public.dogadjaj);
select results_eq($$select naziv, pocetak collate "default", kraj collate "default", vodi from public.dogadjaj$$, $$values ('Fudbal'::text, '17:00'::text, '18:00'::text, 'tata'::text)$$, 'aktivnost je upisana');
update p set z = public.predlozi_dogadjaj('izmeni', (select d from p),
  '{"naziv": "Fudbal", "vrsta": "trening", "datum": "2026-11-05", "ceoDan": false, "od": "18:00", "do": "19:00", "ponavljanje": {"tip": "ne"}, "vodi": "tata", "mesto": "Sala", "napomena": ""}',
  'Samo ovaj četvrtak kasnije', '2026-11-05');
select pg_temp.tata();
select lives_ok($$select public.prihvati_zahtev((select z from p))$$, 'tata prihvata pomeranje samo jednom');
select results_eq($$select izuzeti from public.dogadjaj where id = (select d from p)$$, $$values (array['2026-11-05'::date])$$, 'serija preskače taj dan');
select is((select count(*)::int from public.dogadjaj), 2, 'a jednokratna aktivnost zauzima njegovo mesto');

-- ===========================================================================
-- Karton
-- ===========================================================================
select pg_temp.tata();
update p set k = public.sacuvaj_karton(null, 'zdravlje', 'Alergije', 'Polen breze', null);
select pg_temp.mama();
select public.sacuvaj_karton((select k from p), 'zdravlje', 'Alergije', 'Polen breze i ambrozije', null);
select public.sacuvaj_karton((select k from p), 'zdravlje', 'Alergije', 'Polen breze i ambrozije', null);
select public.sacuvaj_karton(null, 'drugari', 'Lena', '', '{"roditelj": "Ana", "telefon": "064 1"}');
select throws_ok($$select public.sacuvaj_karton(null, 'zdravlje', 'Krvna grupa', '  ', null)$$, '22023', 'Upiši vrednost; prazno polje se briše.', 'polje mora imati vrednost');
select throws_ok($$insert into public.karton_unos (porodica_id, grupa, naziv, vrednost) values ((select porodica from p), 'zdravlje', 'x', 'y')$$,
                 '42501', null, 'niko ne piše direktno u karton');
select bag_eq($$select naziv, staro ->> 'vrednost' as staro, novo ->> 'vrednost' as novo, autor from public.karton_izmena where unos_id = (select k from p)::text$$,
                  $$values ('Alergije'::text, null::text, 'Polen breze'::text, '11111111-1111-1111-1111-111111111111'::uuid),
                           ('Alergije', 'Polen breze', 'Polen breze i ambrozije', '22222222-2222-2222-2222-222222222222'::uuid)$$,
                  'istorija kartona: staro, novo i ko; ista vrednost se ne beleži');
select lives_ok($$select public.obrisi_karton((select k from p))$$, 'brisanje polja');
select is((select count(*)::int from public.karton_izmena where unos_id = (select k from p)::text and novo is null), 1, 'brisanje ostaje u istoriji');
select lives_ok($$select public.sacuvaj_raspored('["1.", "2."]', '[["Srpski", "", "", "", ""], ["", "", "", "", ""]]', null, 'pre podne')$$, 'raspored časova se čuva');
select is((select count(*)::int from public.karton_izmena where unos_id = 'raspored-casova'), 1, 'i raspored ulazi u istoriju kartona');

-- ===========================================================================
-- Who sees it
-- ===========================================================================
select pg_temp.stranac();
select is((select count(*)::int from public.stavka) + (select count(*)::int from public.boravak) + (select count(*)::int from public.dogadjaj)
          + (select count(*)::int from public.zahtev_kalendara) + (select count(*)::int from public.karton_unos) + (select count(*)::int from public.karton_izmena),
          0, 'stranac ne vidi ništa od tuđe porodice');
select throws_ok($$select public.prihvati_zahtev((select z from p))$$, 'P0002', 'Zahtev ne postoji.', 'stranac ne dira tuđe zahteve');

select pg_temp.kao_postgres();
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'test', 'totp', 'verified', now(), now());
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'aal1');
select is((select count(*)::int from public.stavka) + (select count(*)::int from public.boravak), 0, 'sa MFA, bez koda podaci se ne vide');
select throws_ok($$select public.nova_stavka('x', '', 'skola', false, false, null)$$, '28000', null, 'sa MFA, bez koda nema upisa');

select * from finish();
rollback;
