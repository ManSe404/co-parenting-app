# Database

The schema, rules and functions that a Supabase project runs for the app. Supabase hosts Postgres, Auth, Storage
and Realtime; this repository supplies what runs inside them.

## What it does

Holds every family's data and enforces the rules: row-level security for who reads what, `security definer`
functions for every write, triggers for the record's change log and the notification queue, the private bucket
`dokumenti` with its policies, the Realtime publication and the `pg_cron` schedules for the sender. Everything is
in `supabase/migrations/`, applied in file-name order.

Tables, functions, triggers, storage and schedules: [data-model.md](../data-model.md).

## How to run it

```bash
npm run baza        # local Supabase in Docker, without Realtime, Edge runtime and a few other services
npm run test:baza   # pgTAP tests in supabase/tests/
npm run baza:stop
```

`supabase/config.toml` sets the local ports (8041 to 8048), the auth settings and `max_rows`. A local start
applies every migration to an empty database.

## Configuration

Local: `supabase/config.toml`, and `supabase/.env` (never committed) for Google sign-in. Hosted: the dashboard
(Auth URLs, password rules, SMTP), the extensions `pg_cron` and `pg_net`, the Vault entries `obavestenja_url` and
`obavestenja_kljuc`, and the table `dozvoljeni_osnivac`. Details: [configuration.md](../configuration.md#database).

## Contracts

- **Clients** (the site) may only `select` their own family's rows and call the functions granted to
  `authenticated`; `pogledaj_pozivnicu` is also granted to `anon`.
- **The sender** (the Edge Function `obavestenja`) calls `obavestenja_za_slanje` and `oznaci_poslato` with the
  service role; see [obavestenja.md](obavestenja.md).
- **The schedule** calls `pozovi_obavestenja`, which POSTs to the sender through `pg_net`.
- Migrations are never edited once applied; a change is a new migration with a pgTAP test
  ([guides/development.md](../../guides/development.md)).

## Deployment

`npx supabase db push` after `npx supabase link`, or the Supabase GitHub integration, which applies the migrations
on a push to `main`. Nothing runs the pgTAP tests before that happens: run `npm run test:baza` before merging a
migration. Steps: [operations/deployment.md](../../operations/deployment.md).
