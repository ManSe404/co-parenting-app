-- Parent profile: each parent edits only their own; both see both; nobody else.
-- Run: npx supabase test db
begin;
select plan(11);

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

create temp table p (tata uuid) on commit drop;
grant all on p to authenticated;

select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
insert into p values (public.kreiraj_porodicu('Dete', 'tata'));
select pg_temp.kao_postgres();
select public.dodaj_roditelja((select tata from p), '22222222-2222-2222-2222-222222222222', 'mama');
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select public.kreiraj_porodicu('Dete', 'mama');

-- ---- Own profile ------------------------------------------------------------
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs');
select lives_ok($$select public.sacuvaj_profil(' Petar Petrović ', '+381 64 123 4567', 'Bulevar 1, Beograd', 'Petar@Primer.rs', 'Radim do 17h')$$,
                'tata čuva svoj profil');
select results_eq($$select ime, telefon, kontakt_email, profil_izmenjen is not null from public.roditelj where uloga = 'tata'$$,
                  $$values ('Petar Petrović'::text, '+381 64 123 4567'::text, 'petar@primer.rs'::text, true)$$,
                  'profil je očišćen (razmaci, mala slova u mejlu) i zna se kad je menjan');
select is((select ime from public.roditelj where uloga = 'mama'), '', 'tuđi profil se ne dira');
select throws_ok($$select public.sacuvaj_profil('', 'zovi me', '', '', '')$$, '22023', null, 'telefon samo sa ciframa i znakovima');
select throws_ok($$select public.sacuvaj_profil('', '', '', 'nije-mejl', '')$$, '22023', 'Mejl nije ispravan.', 'mejl mora biti ispravan');
select throws_ok($$update public.roditelj set telefon = '1' where uloga = 'mama'$$, '42501', null, 'niko ne menja tabelu direktno');

-- ---- Who sees it --------------------------------------------------------------
select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'mama@primer.rs');
select results_eq($$select ime, adresa from public.roditelj where uloga = 'tata'$$,
                  $$values ('Petar Petrović'::text, 'Bulevar 1, Beograd'::text)$$, 'mama vidi tatin profil');
select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'stranac@primer.rs');
select is((select count(*)::int from public.roditelj where ime = 'Petar Petrović'), 0, 'stranac ne vidi tuđe profile');

-- ---- MFA ------------------------------------------------------------------------
select pg_temp.kao_postgres();
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'test', 'totp', 'verified', now(), now());
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'aal1');
select throws_ok($$select public.sacuvaj_profil('X', '', '', '', '')$$, '28000', null, 'sa MFA, bez koda profil se ne menja');
select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'tata@primer.rs', 'aal2');
select lives_ok($$select public.sacuvaj_profil('Petar', '', '', '', '')$$, 'sa kodom radi');
select is((select telefon from public.roditelj where uloga = 'tata'), '', 'prazno polje briše staru vrednost');

select * from finish();
rollback;
