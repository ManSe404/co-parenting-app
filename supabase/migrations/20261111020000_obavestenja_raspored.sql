-- Schedules for the sender (supabase/functions/obavestenja).
--
-- pg_cron calls public.pozovi_obavestenja(rezim), which asks pg_net to POST
-- to the Edge Function with the service_role key as the bearer token. The
-- function's address and the key are read from Vault at call time, so nothing
-- secret is written here:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/obavestenja', 'obavestenja_url');
--   select vault.create_secret('<service_role key>', 'obavestenja_kljuc');
-- (supabase/functions/obavestenja/README.md has the whole setup.)
--
-- pg_cron runs in UTC and has no per-job time zone, so "08:00 in Belgrade"
-- is scheduled at both 06:00 and 07:00 UTC and the function sends only when
-- the Belgrade hour is 8 (one of the two runs, depending on summer time).
--
-- The schedules are created only where pg_cron and pg_net exist (the hosted
-- project, once the owner turns them on under Database → Extensions). Locally
-- and in tests they do not, and this migration then changes nothing but the
-- function below, which is harmless without them.

create function public.pozovi_obavestenja(p_rezim text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  adresa text;
  kljuc text;
begin
  if p_rezim not in ('odmah', 'dnevno') then
    raise exception 'Nepoznat režim: %', p_rezim;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') or not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    raise notice 'obavestenja: pg_net ili Vault nije uključen, ništa nije poslato';
    return;
  end if;
  -- The daily digest: 08:00 Europe/Belgrade, whichever UTC run that is today.
  if p_rezim = 'dnevno' and extract(hour from now() at time zone 'Europe/Belgrade') <> 8 then
    return;
  end if;
  execute $q$ select decrypted_secret from vault.decrypted_secrets where name = 'obavestenja_url' $q$ into adresa;
  execute $q$ select decrypted_secret from vault.decrypted_secrets where name = 'obavestenja_kljuc' $q$ into kljuc;
  if adresa is null or kljuc is null then
    raise notice 'obavestenja: u Vault-u nema obavestenja_url ili obavestenja_kljuc, ništa nije poslato';
    return;
  end if;
  execute $q$
    select net.http_post(
      url := $1 || '?rezim=' || $2,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || $3),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )
  $q$ using adresa, p_rezim, kljuc;
end
$$;

revoke execute on function public.pozovi_obavestenja(text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    -- cron.schedule with a job name replaces an existing job of that name.
    perform cron.schedule('obavestenja-odmah', '*/5 * * * *', $c$ select public.pozovi_obavestenja('odmah') $c$);
    perform cron.schedule('obavestenja-dnevno', '0 6,7 * * *', $c$ select public.pozovi_obavestenja('dnevno') $c$);
  else
    raise notice 'obavestenja: pg_cron/pg_net nisu uključeni, rasporedi nisu napravljeni (vidi supabase/functions/obavestenja/README.md)';
  end if;
end
$$;
