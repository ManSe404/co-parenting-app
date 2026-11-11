# Development

## Checks

```bash
npm test             # the app's rules (Vitest, src/lib/*.test.ts)
npm run check        # astro check and svelte-check, no errors and no warnings
npm run test:baza    # the database's rules (pgTAP, supabase/tests); needs npm run baza
npm run smoke        # the demo in headless Chrome: items, board, calendar, record, documents, profile; needs npm run dev
npm run smoke:nalog  # two real accounts in separate browsers; needs npm run baza and npm run dev:baza
npm run build        # the static site in dist/
npm run preview      # serve dist/ on port 8040
```

No CI runs these: the only workflow is the optional GitHub Pages deploy. Run them before a commit.

The local database has no Realtime service, so live updates are covered by reading the policies and by the RLS
tests, not by a live run.

## How the code is organised

- A rule lives twice on purpose: once in a pure module in `src/lib/` (no I/O, unit-tested next to it) and once in
  the database, which enforces it. A change to a rule changes both, with a test on each side.
- Screens never touch Supabase directly. They go through the data source (`src/lib/izvor.ts`), which has a demo
  and a database implementation. A new action needs both.
- Clients never write tables. A new write is a `security definer` function with `set search_path = ''`, which
  checks the caller (`prijavljen_sa_mfa`, `moj_prostor`), with `execute` revoked from `public` and `anon` and
  granted to `authenticated`. A new table gets RLS, a `clan cita …` select policy, the restrictive `mfa …` policy
  and, if the other parent should see it live, a place in the `supabase_realtime` publication.
- Migrations are never edited once applied. A change is a new file in `supabase/migrations/` named
  `<YYYYMMDDHHMMSS>_<topic>.sql`, with a pgTAP test in `supabase/tests/`.
- Names follow the Serbian interface ([glossary](../product/glossary.md)); comments are in English.
- The Edge Function runs on Deno and is left out of `tsconfig.json`; it uses plain `fetch`, each call with a
  timeout.
- Commit messages follow the `type: subject` form seen in the history (`feat:`, `fix:`, `docs:`, `ci:`, `build:`).

## Documents

A change updates the documents it makes wrong in the same commit: [reference/](../reference/) and
[architecture/](../architecture/) above all, and [diagrams/](../diagrams/) whenever a part or a flow changes. The
index is [docs/README.md](../README.md).
