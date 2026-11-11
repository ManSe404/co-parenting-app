-- Realtime: the other parent sees a change without refreshing the page.
--
-- The app subscribes (src/lib/izvor-supabase.ts) to postgres_changes on the
-- shared tables, through one channel per family. Supabase Realtime streams
-- only rows from tables in the `supabase_realtime` publication, and before
-- it delivers a change to a subscriber it evaluates that table's SELECT
-- policies with the subscriber's own JWT: every shared table has RLS on with
-- a "clan cita …" policy (porodica_id = moja_porodica()) and the restrictive
-- MFA policy, so a parent receives only their family's rows, and with MFA
-- only after the second step; a stranger receives nothing. Rows with no
-- select policy for the caller are simply not sent.
--
-- Idempotent: the publication is created if missing (hosted projects have
-- it), and each table is added only once.

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'roditelj',
    'stavka', 'unos',
    'boravak', 'dogadjaj', 'zahtev_kalendara',
    'karton_unos', 'karton_izmena', 'raspored_casova',
    'dokument', 'dokument_trag', 'dokument_brisanje'
  ] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
