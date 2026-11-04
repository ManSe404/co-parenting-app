-- Family space, invitation and MFA rules, checked inside Postgres.
-- Run: npx supabase test db
begin;
select plan(24);

-- Three accounts: tata (creates the family), mama (invited), stranac (outsider).
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

-- ---- First parent creates the family ------------------------------------
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
select isnt(public.kreiraj_porodicu('Dete', 'tata'), null, 'tata pravi porodični prostor');
select results_eq($$select uloga, oznaka from public.roditelj$$, $$values ('tata'::text, 'Tata'::text)$$, 'tata je upisan kao Tata');
select results_eq($$select ime from public.dete$$, $$values ('Dete'::text)$$, 'dete je upisano');
select throws_ok($$select public.kreiraj_porodicu('Neko', 'tata')$$, '23505', 'Već si u porodičnom prostoru.', 'ne može dve porodice');
select throws_ok($$insert into public.roditelj (porodica_id, korisnik, uloga, oznaka, oznaka_akuzativ, oznaka_genitiv, boja)
                  select porodica_id, '33333333-3333-3333-3333-333333333333', 'mama', 'Mama', 'mamu', 'mame', 'ai' from public.roditelj$$,
                 '42501', null, 'niko ne upisuje direktno u tabele');

-- ---- Invitation -------------------------------------------------------------
create temp table poziv (token text) on commit drop;
grant all on poziv to authenticated;
insert into poziv select token from public.napravi_pozivnicu(null);
select is((select length(token) from poziv), 64, 'link nosi dug, slučajan token');
select throws_ok($$select * from public.pozivnica$$, '42501', null, 'tabela pozivnica nije čitljiva klijentu');

select pg_temp.kao_postgres();
select is((select count(*)::int from public.pozivnica where token_hash = (select token from poziv)), 0, 'token se ne čuva, samo njegov otisak');

-- The outsider has no family and sees nothing.
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select is((select count(*)::int from public.porodica), 0, 'stranac ne vidi tuđu porodicu');
select is((select count(*)::int from public.dete), 0, 'stranac ne vidi dete');
select throws_ok($$select public.prihvati_pozivnicu('pogresan')$$, 'P0002', null, 'pogrešan link ne radi');

-- Mama previews and accepts.
select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select results_eq($$select dete, pozvao, uloga, vazi from public.pogledaj_pozivnicu((select token from poziv))$$,
                  $$values ('Dete'::text, 'Tata'::text, 'mama'::text, true)$$, 'pozvani vidi ko ga poziva i za koje dete');
select isnt(public.prihvati_pozivnicu((select token from poziv)), null, 'mama prihvata');
select results_eq($$select uloga from public.roditelj order by uloga$$, $$values ('mama'::text), ('tata'::text)$$, 'mama vidi oba roditelja');

-- Used, full.
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select throws_ok($$select public.prihvati_pozivnicu((select token from poziv))$$, '23505', 'Link je već iskorišćen.', 'link se koristi samo jednom');
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
select throws_ok($$select * from public.napravi_pozivnicu(null)$$, '23505', 'Oba roditelja su već povezana.', 'u prostoru mogu biti samo dvoje');

-- ---- Expired and e-mail-bound links (a second family) ------------------------
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select isnt(public.kreiraj_porodicu('Mila', 'mama'), null, 'stranac pravi svoju porodicu');
delete from poziv;
insert into poziv select token from public.napravi_pozivnicu('neko.drugi@primer.rs');
select pg_temp.kao_postgres();
insert into auth.users (id, email, aud, role) values ('44444444-4444-4444-4444-444444444444', 'cetvrti@primer.rs', 'authenticated', 'authenticated');
select pg_temp.kao('44444444-4444-4444-4444-444444444444', 'cetvrti@primer.rs');
select throws_ok($$select public.prihvati_pozivnicu((select token from poziv))$$, '42501', 'Ovaj link je namenjen drugoj mejl adresi.', 'link vezan za mejl prihvata samo taj mejl');
select pg_temp.kao_postgres();
update public.pozivnica set istice = now() - interval '1 minute', email = null;
select pg_temp.kao('44444444-4444-4444-4444-444444444444', 'cetvrti@primer.rs');
select throws_ok($$select public.prihvati_pozivnicu((select token from poziv))$$, '22023', 'Link je istekao. Zatraži novi.', 'istekao link ne radi');
select results_eq($$select vazi, razlog from public.pogledaj_pozivnicu((select token from poziv))$$,
                  $$values (false, 'Link je istekao. Zatraži novi.'::text)$$, 'pregled kaže da je link istekao');

-- ---- MFA: with a verified factor, data waits for the second step ------------
select pg_temp.kao_postgres();
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'test', 'totp', 'verified', now(), now());
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'aal1');
select is((select count(*)::int from public.dete), 0, 'sa MFA, bez koda (aal1) podaci se ne vide');
select throws_ok($$select public.oznaci_posetu()$$, '28000', null, 'sa MFA, bez koda funkcije odbijaju');
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'aal2');
select is((select count(*)::int from public.dete), 1, 'sa kodom (aal2) podaci se vide');
select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs', 'aal1');
select is((select count(*)::int from public.dete), 1, 'roditelj bez MFA i dalje vidi podatke');

select * from finish();
rollback;
