# Codebase

Entry points: `npm run dev` and `npm run build` run Astro with `astro.config.mjs`; every page in `src/pages/`
mounts one Svelte screen. The database is `supabase/migrations/`, and the sender is
`supabase/functions/obavestenja/index.ts`. Names follow the Serbian interface ([glossary](../product/glossary.md));
comments are in English.

## Top level

| Path | What it is |
|---|---|
| `astro.config.mjs` | static output, `BASE_PATH`, Svelte; with `BAZA=lokalno` it takes the local Supabase address and key from the CLI |
| `svelte.config.js`, `tsconfig.json` | Svelte preprocessing; strict TypeScript, which leaves out `supabase/functions` (Deno) |
| `package.json`, `.node-version` | scripts and dependencies; the Node version for builds |
| `public/` | `favicon.svg` |
| `scripts/` | browser smoke tests over the Chrome DevTools protocol, with `fixtures/` (a timetable as CSV and as a picture) |
| `src/` | the app |
| `supabase/` | migrations, database tests, the Edge Function and the local configuration |
| `.github/workflows/pages.yml` | the optional GitHub Pages deploy |
| `docs/` | these documents |

## src/pages and src/layouts

| Page | Screen | Layout |
|---|---|---|
| `index.astro` (`/`) | `Pocetna` | `App.astro` |
| `stavke/` | `Stavke` (board, list, history) | `App.astro` |
| `stavka/` | `StavkaDetalj` | `App.astro` |
| `nova/` | `NovaStavka` | `App.astro` |
| `kalendar/` | `Kalendar` | `App.astro` |
| `karton/` | `Karton` | `App.astro` |
| `dokumenti/` | `Dokumenti` | `App.astro` |
| `podesavanja/` | `Podesavanja` | `App.astro` |
| `prijava/` | `Prijava` | `Ulaz.astro` |
| `mfa/` | `Mfa` | `Ulaz.astro` |
| `dobrodosli/` | `Dobrodosli` | `Ulaz.astro` |
| `poziv/` | `Poziv` | `Ulaz.astro` |
| `privatnost.astro` | the public privacy notice | `Ulaz.astro` |

`App.astro` is the app's frame: fonts, styles, navigation, the guard (`Cuvar`), the demo parent switcher, and the
mode decided before the page paints. `Ulaz.astro` frames the screens before the app.

## src/components

| Group | Components |
|---|---|
| Home | `Pocetna` |
| Items | `Stavke`, `Tabla`, `ListaStavki`, `IstorijaDogovora`, `StavkaDetalj`, `StavkaForma`, `NovaStavka`, `OznakeStavke`, `PotezDijalog`, `RazlogDijalog` |
| Calendar | `Kalendar`, `NedeljaPrikaz`, `RasporedPrikaz`, `PredlogKalendara`, `PredlogAktivnosti`, `PomeriDijalog` |
| Record | `Karton`, `RasporedCasova` |
| Documents | `Dokumenti`, `DokumentDodaj`, `DokumentPolja`, `DokumentPregled`, `ObrisaniDokumenti` |
| Accounts and settings | `Prijava`, `Mfa`, `MfaPodesavanje`, `Dobrodosli`, `Poziv`, `PozoviRoditelja`, `Podesavanja`, `ProfilRoditelja`, `ObavestenjaPodesavanje`, `BrisanjePorodice`, `NalogMeni` |
| Frame | `Cuvar` (the guard), `DemoBiracRoditelja` (demo only), `Ikona` (line icons) |

## src/lib

| Module | What it holds |
|---|---|
| `tipovi.ts` | the domain types |
| `osnova.ts` | fixed labels: the areas, the two parent roles, the repository address |
| `domen.ts` | item rules: whose turn, urgent, state changes, the home summary, the board columns |
| `kalendar.ts`, `kalendar-opis.ts`, `kalendar-prikaz.ts` | stays and calendar requests; their wording; what the views draw |
| `dogadjaji.ts` | activities: repetition, layout of overlapping blocks, a drag as a proposal |
| `karton.ts`, `raspored-casova.ts` | the record and its change log; the school timetable (by hand, CSV, `.xlsx`, a picture) |
| `istorija.ts` | the history of agreements |
| `dokumenti.ts`, `slike.ts` | document rules; getting a photo ready for upload |
| `profil.ts` | parent profile checks |
| `obavestenja.ts` | the notification choice |
| `osvezavanje.ts` | one refresh per burst of change signals |
| `prevlacenje.ts` | dragging board cards with mouse or finger, without a library |
| `izvoz.ts` | CSV export |
| `format.ts` | Serbian dates, deadlines, greetings and counts for display |
| `putanje.ts`, `usmeri.ts` | app paths under `BASE_PATH`, safe redirects, where to go after sign-in |
| `supabase.ts` | the Supabase client and the mode (demo or database) |
| `izvor.ts` | the data source interface, and the choice between the demo and the database |
| `izvor-supabase.ts` | items, calendar and record in the database, with the Realtime channel |
| `dokumenti-izvor.ts`, `dokumenti-supabase.ts` | documents: the choice of source, and the database and bucket side |
| `profil-izvor.ts` | parent profiles, in the browser for the demo or in `roditelj` |
| `mock/` | the demo: example data (`seed.ts`), the browser data source, example documents drawn in the browser |
| `nalog.ts`, `pristup-spreman.ts` | sign-in, MFA, family space, invitation; the signal that the guard is done |
| `*.test.ts` | Vitest tests next to the module they test |

`src/styles/global.css` holds the design tokens and the light and dark themes.

## supabase

| Path | What it is |
|---|---|
| `migrations/` | schema, RLS, functions, triggers, Realtime, schedules; see [data-model.md](data-model.md) |
| `tests/` | pgTAP tests, `npm run test:baza` |
| `functions/obavestenja/` | the Edge Function that sends notification e-mails, with its setup guide |
| `config.toml` | the local Supabase: ports 8040 to 8048, auth settings, `max_rows` |
| `README.md` | what is in the folder and how migrations reach a hosted project |
