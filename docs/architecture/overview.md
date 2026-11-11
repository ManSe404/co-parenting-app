# Architecture overview

## Context

Two parents use the app in a browser, on a phone or a computer. The app is a static site: the browser talks
straight to a Supabase project, which holds the accounts, the data, the files and the rules. An Edge Function in
the same project, called on a schedule, sends e-mail through Resend. The app has no server of its own.

Diagrams: [context](../diagrams/context.md) and [containers](../diagrams/container.md).

## Goals and constraints

- The consent rules hold even against a changed client: every write goes through a database function that checks
  who is asking, and no table has a write policy for clients.
- One family's data is readable only by its two parents, and with MFA on only after the second step.
- Free to run: a static host and a free Supabase project; no server to look after.
- The same build runs as a demo with no backend at all.
- Public code: no secret in the repository; the browser gets only the publishable key.

## Building blocks

| Block | What it does | Where |
|---|---|---|
| Pages | one static Astro page per screen; each mounts one Svelte screen in the browser | `src/pages/`, `src/layouts/` |
| Screens | Svelte 5 components | `src/components/` |
| Rules | pure TypeScript rules for items, calendar, activities, record, documents and profiles, unit-tested; the database repeats them | `src/lib/domen.ts`, `kalendar.ts`, `dogadjaji.ts`, `karton.ts`, `dokumenti.ts`, `profil.ts` |
| Data source | one interface (`Izvor`) with two implementations: demo data in the browser, or the database | `src/lib/izvor.ts`, `src/lib/mock/`, `src/lib/izvor-supabase.ts`, `dokumenti-izvor.ts`, `profil-izvor.ts` |
| Accounts | sign-in, MFA, family space and invitation; the guard that sends a visitor to the right screen | `src/lib/nalog.ts`, `src/lib/usmeri.ts`, `src/components/Cuvar.svelte` |
| Database | schema, row-level security, `security definer` functions, triggers, the Realtime publication, schedules | `supabase/migrations/` |
| Storage | the private bucket `dokumenti` and its policies | `supabase/migrations/20261104020000_dokumenti.sql` and later |
| Sender | the Edge Function `obavestenja` (Deno, no npm SDK) | `supabase/functions/obavestenja/` |
| Hosting | the static files from `npm run build` (`dist/`) on Cloudflare Pages or GitHub Pages | `astro.config.mjs`, `.github/workflows/pages.yml` |

The full map of the code: [reference/codebase.md](../reference/codebase.md).

## Two modes

`src/lib/supabase.ts` decides the mode before any screen reads data, and `src/layouts/App.astro` makes the same
decision before the page paints.

- **Demo**: a build without `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY`, or `?demo=1`. The data lives in the
  browser (localStorage; documents in IndexedDB), and a switcher lets one person act as either parent. The demo
  flag lives in the tab's sessionStorage, so it never sticks to the browser; `?demo=0` ends it, and a real
  sign-in ends it too.
- **Database** (baza): real accounts on Supabase.

## Runtime flows

1. **Sign-in and access.** `Cuvar.svelte` asks `pristup()` in `src/lib/nalog.ts` where the visitor stands: signed
   out (to `/prijava/`), waiting for the MFA code (`/mfa/`), signed in without a family (`/dobrodosli/`, or an
   invitation at `/poziv/`), or ready. Screens read data only once the guard has resolved
   (`src/lib/pristup-spreman.ts`).
2. **A change that needs consent.** A screen calls the data source, which calls a database function through
   `rpc`, for example `predlozi_kalendar`. The function checks the caller and writes a request; a trigger queues
   a notification for the other parent. The other parent accepts with `prihvati_zahtev`, which checks again and
   only then writes the calendar. See [diagrams/proposal-flow.md](../diagrams/proposal-flow.md).
3. **A live update.** The shared tables are in the `supabase_realtime` publication. The browser keeps one channel
   per family; Realtime checks each change against the subscriber's select policies, and the screen re-reads
   500 ms after the last signal (`src/lib/osvezavanje.ts`).
4. **A notification e-mail.** Triggers fill the queue `obavestenje`. `pg_cron` calls `pozovi_obavestenja`, which
   reads the function's address and the service-role key from Vault and POSTs to the Edge Function through
   `pg_net`. The function reads what is due with `obavestenja_za_slanje`, sends one e-mail per recipient through
   the Resend HTTP API, and marks the rows with `oznaci_poslato`. See
   [diagrams/notification-flow.md](../diagrams/notification-flow.md).
5. **A document.** The browser redraws a photo, uploads the file to the bucket as `<family>/<uuid>.<ext>`, then
   registers it with `dodaj_dokument`, which takes the size from the stored file and checks that the type
   matches the extension. A file opens through a signed link valid for 10 minutes.

## Data

All data is in the Supabase Postgres database. A family is one `porodica` row, and every table of a family's
data carries `porodica_id`. Row-level security is on for every table: clients may only read, and only their own
family's rows (a parent reads only the notifications addressed to them); `pozivnica` and `dozvoljeni_osnivac`
cannot be read by clients at all. With MFA on, a restrictive policy on every table also requires `aal2`.

Tables, functions, triggers and schedules: [reference/data-model.md](../reference/data-model.md). Migrations are
applied in order and never changed once applied; a change adds a new migration (`supabase/README.md`).

## Deployment

- **The site.** `npm run build` writes static files to `dist/`. `BASE_PATH` lets the same build run under a
  sub-path (a GitHub Pages project site) or at the root (Cloudflare Pages, local). GitHub Pages deploys through
  `.github/workflows/pages.yml` on a push to `main`, only when the repository variable `OBJAVI_PAGES` is `da`.
- **The database.** Migrations reach a hosted project through the Supabase GitHub integration on a push to
  `main`, or by hand with `npx supabase db push` (`supabase/README.md`).
- **The sender.** `npx supabase functions deploy obavestenja`, with its secrets and the schedule's Vault entries
  (`supabase/functions/obavestenja/README.md`).

Setting up a copy step by step: [operations/deployment.md](../operations/deployment.md). Security, privacy and
errors: [crosscutting.md](crosscutting.md).

## Open

- **Which host serves the owner's copy.** The plan chooses Cloudflare Pages, so that the app does not share the
  `github.io` origin, and the sign-in kept in the browser, with the owner's other GitHub Pages sites. The workflow
  `.github/workflows/pages.yml`, however, falls back to the owner's Supabase project when it runs in the owner's
  repository, and the README links the demo on GitHub Pages. Which one is meant is not decided in the code.
- **Row limit.** Supabase returns at most 1000 rows per request (`max_rows` in `supabase/config.toml`); stays are
  not yet limited to a period.
- **Realtime and the sender locally.** `npm run baza` starts the local Supabase without the Realtime and Edge
  runtime services, so live updates and the sender do not run locally by default.
