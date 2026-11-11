# Setup

## What you need

- Node, in the version in `.node-version`, with npm.
- For the local database: Docker. The Supabase CLI comes with `npm install` (`supabase` in `devDependencies`).
- For the browser smoke tests: Chrome (`google-chrome` on `PATH`, or the `CHROME` setting).

## The demo, in five minutes

```bash
npm install
npm run dev         # http://127.0.0.1:8040, demo data in the browser
npx astro dev stop  # the Astro dev server keeps running in the background
```

Without Supabase settings the app runs on example data in the browser. The parent switcher at the top lets you
act as either parent, so the whole flow can be tried alone.

## With a local database

```bash
npm run baza        # local Supabase in Docker (the first run pulls the images)
npm run dev:baza    # the app with real accounts; it reads the address and key from the running database
npm run baza:stop
```

- Studio (the tables) is on port 8043 and Mailpit, the local inbox for confirmation e-mails, on 8044. All ports
  are in [reference/configuration.md](../reference/configuration.md).
- With the database on, `?demo=1` turns the demo on in that tab and `?demo=0` turns it off.
- `npm run baza` leaves out the Realtime and Edge runtime services, so live updates and the sender do not run
  locally. To run the sender, start Supabase without `-x edge-runtime` and follow
  `supabase/functions/obavestenja/README.md`.

## Local Google sign-in (optional)

1. Make an OAuth client in the Google Cloud Console with the redirect URI
   `http://127.0.0.1:8041/auth/v1/callback`.
2. Put its id and secret in `supabase/.env` as `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. The file is never committed.
3. Set `enabled = true` under `[auth.external.google]` in `supabase/config.toml`.

Next: [development.md](development.md). Your own hosted copy: [operations/deployment.md](../operations/deployment.md).
