-- E-mail notifications: queued for the other parent only, urgent when it
-- matters, nothing for 'nikad', visible only to the addressee, and handed to
-- the sender (service role) in the right batches.
-- Run: npx supabase test db
begin;
select plan(37);

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
create function pg_temp.kao_sender() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.tata() returns void language sql as $$ select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs') $$;
create function pg_temp.mama() returns void language sql as $$ select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs') $$;
create function pg_temp.stranac() returns void language sql as $$ select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs') $$;

-- Local wall-clock time, as the calendar stores it.
create function pg_temp.za(dana int) returns text language sql as $$
  select to_char((now() at time zone 'Europe/Belgrade') + make_interval(days => dana), 'YYYY-MM-DD"T"HH24:MI')
$$;

create temp table p (porodica uuid, s1 uuid, s2 uuid, z uuid, k uuid, ids uuid[]) on commit drop;
grant all on p to authenticated, service_role;

select pg_temp.tata();
insert into p (porodica) values (public.kreiraj_porodicu('Dete', 'tata'));
select pg_temp.kao_postgres();
select public.dodaj_roditelja((select porodica from p), '22222222-2222-2222-2222-222222222222', 'mama');
select pg_temp.stranac();
select public.kreiraj_porodicu('Dete', 'mama');

-- ===========================================================================
-- Items: the other parent is told; Hitno makes it urgent
-- ===========================================================================
select pg_temp.tata();
update p set s1 = public.nova_stavka('Kontrola kod alergologa', 'Termin u utorak', 'zdravlje', false, true, null);
update p set s2 = public.nova_stavka('Zimovanje', '', 'ostalo', false, false, null);
select pg_temp.kao_postgres();
select results_eq($$select za_roditelja, vrsta, hitno, putanja from public.obavestenje where vrsta = 'nova_stavka' order by kreirano, hitno desc$$,
                  $$values ('22222222-2222-2222-2222-222222222222'::uuid, 'nova_stavka'::text, true, '/stavka/?id=' || (select s1 from p)::text),
                           ('22222222-2222-2222-2222-222222222222'::uuid, 'nova_stavka'::text, false, '/stavka/?id=' || (select s2 from p)::text)$$,
                  'nova stavka ide drugom roditelju, hitna kad nosi Hitno');
select is((select count(*)::int from public.obavestenje where za_roditelja = '11111111-1111-1111-1111-111111111111'), 0, 'onaj ko piše ne dobija obaveštenje');
select alike((select tekst from public.obavestenje where vrsta = 'nova_stavka' and hitno), 'Tata je otvorio stavku (Zdravlje, rok: bez roka).%Termin u utorak',
            'tekst kaže ko, šta i gde');

select pg_temp.mama();
select public.odgovori_na_stavku((select s1 from p), 'Može, idem ja s njim.');
select public.predlozi_zatvaranje((select s1 from p), 'Ide mama u utorak u 9.');
select pg_temp.tata();
select public.potvrdi_zatvaranje((select s1 from p));
select pg_temp.kao_postgres();
select results_eq($$select vrsta, za_roditelja, hitno from public.obavestenje where vrsta in ('odgovor', 'predlog_zatvaranja', 'zatvoreno') order by kreirano, vrsta$$,
                  $$values ('odgovor'::text, '11111111-1111-1111-1111-111111111111'::uuid, true),
                           ('predlog_zatvaranja', '11111111-1111-1111-1111-111111111111'::uuid, true),
                           ('zatvoreno', '22222222-2222-2222-2222-222222222222'::uuid, true)$$,
                  'odgovor i predlog zatvaranja idu tati, potvrda zatvaranja mami; hitna stavka ostaje hitna');
select alike((select tekst from public.obavestenje where vrsta = 'zatvoreno'), 'Tata je potvrdio zatvaranje. Odluka: Ide mama u utorak u 9.', 'potvrda nosi odluku');

-- ===========================================================================
-- Calendar: proposal within 48 h is urgent; the answer goes back to the proposer
-- ===========================================================================
select pg_temp.tata();
update p set z = public.predlozi_kalendar('dodaj', null,
  format('[{"vrsta": "izuzetak", "kod": "tata", "od": "%s", "do": "%s", "napomena": ""}]', pg_temp.za(1), pg_temp.za(2))::jsonb, 'Sutra idemo na more');
select pg_temp.kao_postgres();
select results_eq($$select za_roditelja, hitno, naslov, putanja from public.obavestenje where vrsta = 'predlog_kalendara'$$,
                  $$values ('22222222-2222-2222-2222-222222222222'::uuid, true,
                            ('Predlog za kalendar: jednokratna promena: dete kod tate od ' || replace(pg_temp.za(1), 'T', ' ') || ' do ' || replace(pg_temp.za(2), 'T', ' '))::text,
                            '/kalendar/'::text)$$,
                  'predlog boravka u naredna 48 h je hitan i opisan');
select pg_temp.mama();
select public.prihvati_zahtev((select z from p));
select pg_temp.kao_postgres();
select results_eq($$select za_roditelja, hitno, tekst like 'Mama je prihvatila tvoj predlog%' from public.obavestenje where vrsta = 'prihvacen_zahtev'$$,
                  $$values ('11111111-1111-1111-1111-111111111111'::uuid, true, true)$$, 'prihvatanje javlja predlagaču');

select pg_temp.tata();
update p set z = public.predlozi_dogadjaj('dodaj', null,
  format('{"naziv": "Fudbal", "vrsta": "trening", "datum": "%s", "ceoDan": false, "od": "17:00", "do": "18:00", "ponavljanje": {"tip": "ne"}, "vodi": "tata", "mesto": "", "napomena": ""}',
         left(pg_temp.za(30), 10))::jsonb, '', null);
select pg_temp.kao_postgres();
select is((select hitno from public.obavestenje where vrsta = 'predlog_kalendara' and naslov like '%Fudbal%'), false, 'aktivnost za mesec dana nije hitna');
select pg_temp.mama();
select public.odbij_zahtev((select z from p), 'Tad smo kod bake');
select pg_temp.kao_postgres();
select results_eq($$select za_roditelja, hitno, tekst from public.obavestenje where vrsta = 'odbijen_zahtev'$$,
                  $$values ('11111111-1111-1111-1111-111111111111'::uuid, false,
                            ('Mama nije prihvatila tvoj predlog za kalendar (nova aktivnost „Fudbal“, ' || public.rok_tekst(left(pg_temp.za(30), 10)::date) || ' 17:00–18:00): Tad smo kod bake')::text)$$,
                  'odbijanje nosi razlog');

-- ===========================================================================
-- Documents and karton
-- ===========================================================================
select pg_temp.tata();
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('dokumenti', (select porodica from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf', '11111111-1111-1111-1111-111111111111', '{"mimetype": "application/pdf", "size": 10}');
select public.dodaj_dokument('aaaaaaaa-0000-4000-8000-000000000001', (select porodica from p)::text || '/aaaaaaaa-0000-4000-8000-000000000001.pdf', 'Nalaz alergologa', 'zdravlje', '2026-11-10', '');
update p set k = public.sacuvaj_karton(null, 'zdravlje', 'Alergije', 'Polen breze', null);
select pg_temp.kao_postgres();
select results_eq($$select za_roditelja, naslov, putanja from public.obavestenje where vrsta = 'dokument'$$,
                  $$values ('22222222-2222-2222-2222-222222222222'::uuid, 'Nov dokument: „Nalaz alergologa“'::text, '/dokumenti/?d=aaaaaaaa-0000-4000-8000-000000000001'::text)$$,
                  'nov dokument javlja drugom roditelju');
select results_eq($$select za_roditelja, naslov, tekst from public.obavestenje where vrsta = 'karton'$$,
                  $$values ('22222222-2222-2222-2222-222222222222'::uuid, 'Karton: Alergije'::text, 'Tata je dodao „Alergije“ u kartonu (zdravlje).'::text)$$,
                  'promena kartona imenuje polje, ne vrednost');
select is((select count(*)::int from public.obavestenje where tekst like '%Polen breze%'), 0, 'vrednost iz kartona ne ide u mejl');

-- ===========================================================================
-- Who sees the queue
-- ===========================================================================
select pg_temp.tata();
select is((select count(*)::int from public.obavestenje), (select count(*)::int from public.obavestenje where za_roditelja = '11111111-1111-1111-1111-111111111111'),
          'tata vidi samo obaveštenja za sebe');
select is((select count(*)::int from public.obavestenje where za_roditelja <> '11111111-1111-1111-1111-111111111111'), 0, 'mamina obaveštenja tata ne vidi');
select throws_ok($$insert into public.obavestenje (porodica_id, za_roditelja, vrsta, naslov) values ((select porodica from p), '22222222-2222-2222-2222-222222222222', 'odgovor', 'x')$$,
                 '42501', null, 'niko ne piše u red direktno');
select throws_ok($$update public.obavestenje set poslato = now()$$, '42501', null, 'niko ne označava poslato direktno');
select pg_temp.stranac();
select is((select count(*)::int from public.obavestenje), 0, 'druga porodica ne vidi ništa');

-- ===========================================================================
-- The preference
-- ===========================================================================
select pg_temp.kao('44444444-4444-4444-4444-444444444444', 'niko@primer.rs');
select throws_ok($$select public.postavi_obavestenja('odmah')$$, '42501', 'Nisi u porodičnom prostoru.', 'bez porodice nema podešavanja');
select pg_temp.mama();
select throws_ok($$select public.postavi_obavestenja('ponekad')$$, '22023', null, 'samo odmah, dnevno ili nikad');
select is((select obavestenja from public.roditelj where uloga = 'mama'), 'dnevno', 'podrazumevano je jednom dnevno');
select lives_ok($$select public.postavi_obavestenja('nikad')$$, 'mama isključuje obaveštenja');
select is((select count(*)::int from public.obavestenje), 0, 'isključivanje briše što je čekalo na slanje');
select pg_temp.tata();
select public.nova_stavka('Roditeljski', '', 'skola', false, true, null);
select pg_temp.kao_postgres();
select is((select count(*)::int from public.obavestenje where za_roditelja = '22222222-2222-2222-2222-222222222222'), 0, 'sa „nikad“ se ništa ne zakazuje, ni hitno');
select pg_temp.mama();
select public.postavi_obavestenja('dnevno');
select public.odgovori_na_stavku((select s2 from p), 'Februar?');
select public.nova_stavka('Vakcina', '', 'zdravlje', false, true, null);

-- ===========================================================================
-- The sender: service role only, right batches, marking
-- ===========================================================================
select pg_temp.tata();
select throws_ok($$select * from public.obavestenja_za_slanje('odmah')$$, '42501', null, 'prijavljen roditelj ne može da čita red za slanje');
select throws_ok($$select public.oznaci_poslato(array[gen_random_uuid()], null)$$, '42501', null, 'ni da označava poslato');

select pg_temp.kao_sender();
-- Tata (dnevno) has: odgovor (hitno), predlog_zatvaranja (hitno), prihvacen (hitno), odbijen (not), odgovor na s2 (not), nova stavka Vakcina (hitno).
-- (One transaction, so every row has the same kreirano: compare as bags.)
select bag_eq($$select vrsta, email from public.obavestenja_za_slanje('odmah')$$,
              $$values ('odgovor'::text, 'tata@primer.rs'::text), ('predlog_zatvaranja', 'tata@primer.rs'), ('prihvacen_zahtev', 'tata@primer.rs'), ('nova_stavka', 'tata@primer.rs')$$,
              '„odmah“ vraća samo hitno kad roditelj hoće dnevni pregled');
select bag_eq($$select vrsta, hitno from public.obavestenja_za_slanje('dnevno') where za_roditelja = '11111111-1111-1111-1111-111111111111'$$,
              $$values ('odgovor'::text, true), ('predlog_zatvaranja', true), ('prihvacen_zahtev', true), ('odbijen_zahtev', false), ('odgovor', false), ('nova_stavka', true)$$,
              '„dnevno“ vraća sve što čeka, uključujući hitno koje još nije poslato');
select is((select count(*)::int from public.obavestenja_za_slanje('dnevno') where za_roditelja = '22222222-2222-2222-2222-222222222222'), 0,
          'mama ima prazan red (obrisan uz „nikad“)');
select is((select count(*)::int from public.obavestenja_za_slanje('nesto')), 0, 'nepoznat režim ne vraća ništa');

update p set ids = (select array_agg(id) from public.obavestenja_za_slanje('odmah'));
select is(public.oznaci_poslato((select ids from p), null), 4, 'poslato se označava');
select is((select count(*)::int from public.obavestenja_za_slanje('odmah')), 0, 'poslato se ne šalje ponovo');
select is((select count(*)::int from public.obavestenja_za_slanje('dnevno')), 2, 'dnevni pregled dobija samo ono što nije otišlo odmah');

update p set ids = (select array_agg(id) from public.obavestenja_za_slanje('dnevno'));
select is(public.oznaci_poslato((select ids from p), 'Resend: 429 Too Many Requests'), 2, 'greška se upisuje');
select results_eq($$select distinct poslato is null, greska from public.obavestenje where id = any (array(select unnest(ids) from p))$$,
                  $$values (true, 'Resend: 429 Too Many Requests'::text)$$, 'neuspelo ostaje neposlato, sa greškom');
select is((select count(*)::int from public.obavestenja_za_slanje('dnevno')), 2, 'neuspelo se pokušava ponovo');

select pg_temp.kao_postgres();
select pg_temp.tata();
select lives_ok($$select public.postavi_obavestenja('odmah')$$, 'tata bira „odmah“');
select pg_temp.kao_sender();
select is((select count(*)::int from public.obavestenja_za_slanje('odmah')), 2, 'sa „odmah“ i nehitno ide odmah');

select * from finish();
rollback;
