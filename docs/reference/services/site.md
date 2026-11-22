# Site

The static Astro site that both parents open in a browser. It is the only part with a user interface.

## What it does

Every page in `src/pages/` is a static shell that mounts one Svelte screen in the browser (`client:only`). After the
page loads, the screen reads and writes data through the data source (`src/lib/izvor.ts`): example data in the
browser in the demo, or the Supabase project through `supabase-js` with real accounts. There is no server-side
code; `npm run build` writes plain files to `dist/`.

Pages and the screens they mount: [codebase.md](../codebase.md#srcpages-and-srclayouts).

## How to run it

```bash
npm install
npm run dev         # demo data, http://localhost:8040
npm run dev:baza    # with the local database (after npm run baza)
npm run build       # static files in dist/
npm run preview     # serve dist/ on port 8040
```

Checks: `npm test`, `npm run check`, `npm run smoke`, `npm run smoke:nalog` ([guides/development.md](../../guides/development.md)).
CI (`.github/workflows/checks.yml`) runs all but `smoke:nalog` on every pull request.

## Configuration

Read at build time: `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY` (without both, the build is the demo only),
`BASE_PATH` (the sub-path the site is served under) and, for local development, `BAZA`. Details:
[configuration.md](../configuration.md#build-of-the-site).

## Contracts

- **With the database:** reads with `select` on the tables in [data-model.md](../data-model.md), writes only
  through the functions listed there, called with `rpc`. The calls live in `src/lib/izvor-supabase.ts`,
  `dokumenti-supabase.ts`, `profil-izvor.ts`, `obavestenja.ts` and `nalog.ts`. The row shapes are cast by hand in
  those files; there are no generated database types.
- **With Storage:** uploads to the private bucket `dokumenti` as `<family>/<uuid>.<ext>` and opens files through
  signed links (`src/lib/dokumenti-supabase.ts`).
- **With Realtime:** one channel per family, `postgres_changes` on the shared tables, filtered by `porodica_id`
  (`naPromenu` in `src/lib/izvor-supabase.ts`).
- **With Auth:** e-mail and password, TOTP MFA, optional Google, PKCE flow; e-mail links come back to
  `/prijava/` (`src/lib/nalog.ts`).

## Deployment

Any static host. The repository has an optional GitHub Pages workflow (`.github/workflows/pages.yml`, on a push to
`main` when `OBJAVI_PAGES` is `da`); Cloudflare Pages builds it with `npm run build` and serves `dist/`. Steps:
[operations/deployment.md](../../operations/deployment.md).
