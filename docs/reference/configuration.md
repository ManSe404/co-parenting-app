# Configuration

Every setting by name, where it is set and what reads it. No value belongs in the repository except the ones
that are public by design, and even those are set per copy. The repository has no `.env.example`; the build
needs only the two public settings.

## Build of the site

| Setting | Set in | Read by | Meaning |
|---|---|---|---|
| `PUBLIC_SUPABASE_URL` | the host's build variables (Cloudflare Pages), repository variables (GitHub Actions), or taken from the running local Supabase by `npm run dev:baza` | `src/lib/supabase.ts`, `src/layouts/App.astro` | the project's API address; without it, and the key, the build is the demo only |
| `PUBLIC_SUPABASE_KEY` | as above | as above | the project's publishable key, made to be public |
| `BASE_PATH` | the build environment; the Pages workflow sets `/<repository name>` | `astro.config.mjs`, `src/lib/putanje.ts` (as `BASE_URL`) | the sub-path the site is served under; `/` when unset |
| `BAZA` | `npm run dev:baza` sets `lokalno` | `astro.config.mjs` | take `API_URL` and `PUBLISHABLE_KEY` from `npx supabase status -o env` |
| `OBJAVI_PAGES` | repository variable (GitHub Actions) | `.github/workflows/pages.yml` | `da` turns the GitHub Pages deploy on |

## Edge Function `obavestenja`

| Setting | Set with | Meaning |
|---|---|---|
| `RESEND_API_KEY` | `npx supabase secrets set` | the Resend API key |
| `OBAVESTENJA_FROM` | `npx supabase secrets set` | the sender address, on a domain verified in Resend |
| `APP_URL` | `npx supabase secrets set` | the address of the copy; links in the e-mail point there |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | provided by Supabase | the project's API and the key the caller must present |

Locally the function reads them from `supabase/.env` (`npx supabase functions serve obavestenja --env-file
supabase/.env`). That file is never committed.

## Database

| Setting | Where | Meaning |
|---|---|---|
| `obavestenja_url`, `obavestenja_kljuc` | Vault secrets of the hosted project | the Edge Function's address and the service-role key the schedule sends |
| extensions `pg_cron`, `pg_net` | Database, Extensions, in the hosted project | without them the schedules are not created and no e-mail goes out |
| `dozvoljeni_osnivac` | a table, edited in the dashboard or with SQL | who may open a family space on this copy; empty means anyone |

## Supabase Auth

| Setting | Where | Meaning |
|---|---|---|
| Site URL, Redirect URLs | hosted: Authentication, URL Configuration; local: `site_url`, `additional_redirect_urls` in `supabase/config.toml` | where e-mail links and Google send the parent back |
| e-mail confirmation, password rules | hosted: Authentication, Providers, Email; local: `[auth.email]`, `minimum_password_length = 10`, `password_requirements = "letters_digits"` | as above |
| SMTP | hosted: Authentication, Emails, SMTP | the server for sign-up and reset e-mails; the built-in sender mails only the project's own team |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | `supabase/.env`, read by `[auth.external.google]` in `supabase/config.toml` (`enabled = false` until set) | local Google sign-in; a hosted project sets Google under Authentication, Providers |
| `max_rows` | `[api]` in `supabase/config.toml` (1000) | the most rows one request returns |

Local ports, all in `supabase/config.toml` and `package.json`: the app 8040, API 8041, Postgres 8042, Studio 8043,
Mailpit 8044 (the local inbox for confirmation e-mails), 8045 to 8048 internal.

## Tests

| Setting | Read by | Meaning |
|---|---|---|
| `CHROME` | `scripts/smoke-demo.mjs`, `scripts/smoke-nalog.mjs` | the Chrome binary; `google-chrome` on `PATH` when unset |
