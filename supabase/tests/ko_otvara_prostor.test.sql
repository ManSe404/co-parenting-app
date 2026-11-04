-- Who may open a new family space: anyone while the list is empty, only the
-- listed accounts once it is not; invitations work either way.
-- Run: npx supabase test db
begin;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'vlasnik@primer.rs', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'pozvana@primer.rs', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'neko@primer.rs', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'prvi@primer.rs', 'authenticated', 'authenticated');

create function pg_temp.kao(korisnik uuid, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', korisnik, 'role', 'authenticated', 'email', email, 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create temp table poziv (token text) on commit drop;
grant all on poziv to authenticated;

-- Empty list: a self-hosted copy works without any setup.
select pg_temp.kao('44444444-4444-4444-4444-444444444444', 'prvi@primer.rs');
select is(public.mogu_da_otvorim_prostor(), true, 'prazna lista: svako može da otvori prostor');
select isnt(public.kreiraj_porodicu('Dete', 'mama'), null, 'prazna lista: prostor se otvara bez podešavanja');

-- The owner lists their e-mail (as the database owner, e.g. in the dashboard).
select set_config('role', 'postgres', true);
insert into public.dozvoljeni_osnivac (email) values ('vlasnik@primer.rs');

select pg_temp.kao('33333333-3333-3333-3333-333333333333', 'neko@primer.rs');
select is(public.mogu_da_otvorim_prostor(), false, 'sa listom: neko ko nije na njoj ne može');
select throws_ok($$select public.kreiraj_porodicu('Dete', 'tata')$$, '42501', null, 'sa listom: kreiranje se odbija');
select throws_ok($$select * from public.dozvoljeni_osnivac$$, '42501', null, 'lista nije vidljiva korisnicima');

select pg_temp.kao('11111111-1111-1111-1111-111111111111', 'vlasnik@primer.rs');
select isnt(public.kreiraj_porodicu('Dete', 'tata'), null, 'vlasnik sa liste otvara prostor');
insert into poziv select token from public.napravi_pozivnicu(null);

select pg_temp.kao('22222222-2222-2222-2222-222222222222', 'pozvana@primer.rs');
select isnt(public.prihvati_pozivnicu((select token from poziv)), null, 'pozvani roditelj ulazi preko poziva iako nije na listi');

select * from finish();
rollback;
