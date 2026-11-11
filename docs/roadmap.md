# Roadmap

Goals and phases with their status. The plan behind them was written in Serbian; it is kept, translated, at the end
of this page with its reasoning, its tests and its decisions, and its first five sections now live with their
topic.

## Goal

One place where two separated parents decide together, with the consent rule enforced by the database, and open
code that any family can run as its own copy on free services. See [product/vision.md](product/vision.md).

## Phases

| Phase | What | Status | Described in |
|---|---|---|---|
| F0, setup | Astro project, Supabase schema with RLS and functions, the local database, accounts, MFA, the family space and the invitation; items, calendar and record moved into the database | done | [accounts](product/features/accounts.md), [architecture](architecture/overview.md) |
| F1, MVP | home, items (board, list, one item, new item, every state change), calendar with stays and activities, record, history of agreements, CSV export | done, except installing on a phone as an app (PWA) | [home](product/features/home.md), [items](product/features/items.md), [calendar](product/features/calendar.md), [record](product/features/record.md) |
| Documents | private storage, trash, deleting for good when both parents agree | done | [documents](product/features/documents.md) |
| F2 | e-mail notifications, live updates (Realtime), the privacy page and deleting a family space | done; e-mail needs the setup in [operations/deployment.md](operations/deployment.md) | [notifications](product/features/notifications.md), [privacy](product/features/privacy.md) |
| F3, optional | shared expenses, only if both parents want them | not started | |

## Later, or not built

- Installing on a phone as an app (PWA), planned for F1.
- Export to XLSX, and a weekly automatic export through a GitHub Action that would also be a backup and keep a
  free Supabase project from pausing after a week without activity. Only CSV export from the screens exists.
- Linking a document to an item or to the record.
- Limiting stays to a period: Supabase returns at most 1000 rows per request (`max_rows`).
- A one-way copy from Supabase to a Google Sheet, only if a sheet for reading is ever needed. The sheet would
  never be a source of data.

## Where the plan and the code differ

- **Sign-in.** Section 5 and decision 3 describe Google sign-in with an e-mail link and no password. The code
  signs in with e-mail and password, with Google as an option, and has no e-mail link sign-in; the later decision
  in section 9 matches the code.
- **PWA.** Sections 2 and 7 plan installing as an app. There is no web app manifest and no service worker.
- **Export.** Section 6 plans CSV and XLSX export and a weekly export through a GitHub Action. The code exports CSV
  only, and the only workflow is the GitHub Pages one.
- **Timetable photo.** Section 5 says the photo goes to the private storage, like the documents. The code keeps it
  as a data URL in `raspored_casova.slika`.
- **Schema.** The first draft in section 6 has the tables `oblast` and `izmena`. Neither exists: the areas are a
  fixed list (a check on `stavka.oblast`, and `src/lib/osnova.ts`), and an edit of an item is a thread entry of
  kind `izmenjeno` in `unos`.
- **Hosting.** Section 6 chooses Cloudflare Pages for the owner's copy, so it does not share the `github.io` origin
  with the owner's other sites; decision 6 in section 9 still says GitHub Pages. The workflow
  `.github/workflows/pages.yml` falls back to the owner's Supabase project when it runs in the owner's repository,
  and the README links the demo on GitHub Pages. See [architecture/overview.md](architecture/overview.md#open).
- **The child's name.** Section 4 greets with the child's name. The decision in section 9 removed the name
  everywhere, and the code follows the decision.
- **Activities.** Section 6 lists "Later: `dogadjaj` (appointments)". Activities are built (table `dogadjaj`).
- **Deleting documents for good.** Section 6 first plans deletion after 30 days by an Edge Function, then
  describes deletion when both parents agree. The code does the second.

## Where the plan text lives

| Section | Topic | Now in |
|---|---|---|
| 1, 2 | What we are building, Principles | [product/vision.md](product/vision.md#original-plan-text) |
| 3 | Terms | [product/glossary.md](product/glossary.md#original-plan-text) |
| 4, 5 | Home, Screens | [design/screens.md](design/screens.md#original-plan-text) |
| 6 to 9 | Data and technology, Phases, Tests, Decisions | [below](#original-plan-text) |

## Open

- Whether to build the PWA and the automatic export, or drop them from the plan.
- Which host serves the owner's copy (above).

## Original plan text

Sections 6 to 9 of the original plan, translated from Serbian. Name: `co-parenting-app`; the decisions are in
section 9. A date in brackets is the day a decision was added to the plan. Where the plan and the code differ, the
code is right; the differences are listed [above](#where-the-plan-and-the-code-differ).

### 6. Data and technology (recommendation)

**Database: Supabase (Postgres) in the EU region (Frankfurt), free plan.**

- **Sign-in** (2026-11-04): with Google, or with e-mail and password (at least 10 characters, letters and digits;
  the e-mail is confirmed by a link; there is a "forgotten password" flow). The username is the e-mail. A separate
  username was not introduced: without an e-mail there is no password reset, and signing in with a username would
  mean revealing somewhere which e-mail it belongs to.
- **MFA**: a code from an authenticator app (TOTP: Google Authenticator, Authy, 1Password). It is turned on in the
  settings or at the first sign-in (recommended, not required). When it is on, the database also requires the
  second step: a restrictive RLS policy lets data through only at level `aal2`.
- **A family space and an invitation** instead of a list of two allowed addresses:
  - the first parent creates the space (the child's name, dad or mum) and gets an invitation link, which they send
    by Viber, WhatsApp or e-mail, or by copying it;
  - the link is valid for 7 days and is used once; optionally it is bound to one e-mail. The database stores only
    the SHA-256 fingerprint of the token, and a new link cancels the old one;
  - the second parent opens the link and sees "Dad invites you to a shared space for your child", creates an
    account or signs in, then accepts;
  - a space can hold only two people, and one account is in only one space;
  - signing up is open, but without a space an account sees nothing. This way the app can also serve other
    families, each in its own space.
- The tables `porodica`, `roditelj`, `dete` and `pozivnica` have no write policies; everything goes through
  database functions (`kreiraj_porodicu`, `napravi_pozivnicu`, `pogledaj_pozivnicu`, `prihvati_pozivnicu`,
  `oznaci_posetu`), which check who is asking. Tests: `supabase/tests/porodica.test.sql` (24 checks).
- **Google** is set up in `supabase/config.toml`, but stays off until the owner creates an OAuth client in the
  Google Cloud Console (instructions in the README).
- Row Level Security: everything is forbidden except for those two accounts.
- The change history is filled by a trigger in the database, so it does not depend on the app.
- A free project is paused after a week without activity. The weekly automatic export (below) keeps it active.

**Frontend: Astro + TypeScript**, like the website. The CSS tokens are copied from the website. The browser talks
to the database directly through `supabase-js`, so there is no separate server.

**No backend of our own.** Supabase plays the part of the backend:

- access rules: RLS policies;
- business rules: constraints and triggers in the database (state transitions, history, confirmation of closing);
- notifications in F2: a Supabase Edge Function. It also runs at Supabase, so even then we run no server of our
  own.

All the logic is in SQL migrations in the repository (`supabase/migrations`).

**Hosting: Cloudflare Pages** (2026-11-04; GitHub Pages before that), at the address `<name>.pages.dev`. The
reason: on `manse404.github.io` all of the owner's GitHub Pages sites share the same origin, so any of them could
read the sign-in kept in the browser; an app with health data and documents gets an address of its own. Build:
`npm run build`, output `dist`, Node from `.node-version`. The GitHub Pages workflow (`.github/workflows/pages.yml`)
stays for forks and is turned on with the variable `OBJAVI_PAGES=da` (GitHub does not allow names that start with
`GITHUB_`).

**Open code, private copy** (2026-11-04): the repository is public under the MIT licence, so that anyone can set up
their own copy (instructions in the README). The owner's copy is only for his family: the table
`dozvoljeni_osnivac` (migration `20261104060000_ko_otvara_prostor.sql`) lets only the listed e-mails open a space;
an empty table means anyone may, so other people's copies work without any setup. The second parent always comes
in through the invitation. Someone who may not open a space sees an explanation on the welcome screen and a link to
the repository.

- The page itself is public on both hosts. The data is protected by the sign-in and by RLS in the database, not by
  a hidden address.
- **GitHub Pages** is free only from a public repository. Then the source code must hold no personal data. Before
  publishing:
  - the demo data (`src/lib/mock/seed.ts`) gets a neutral name for the child;
  - this plan is cleaned of names or moved out of the repository;
  - the real name and the names of the areas live only in the database, and the app already reads them from
    there.
- **Cloudflare** (Workers static assets or Pages) works from a private repository, so no such cleaning is needed.
  It is also free.

**How GitHub Pages connects to Supabase.** GitHub Pages serves only files. The app loads in the browser and from
there talks to Supabase directly over HTTPS, through `supabase-js`. There is no server between them. When
publishing:

- in Supabase (Auth → URL Configuration), set the Site URL and the Redirect URLs to
  `https://manse404.github.io/co-parenting-app/`, plus the local address for development;
- in the Google OAuth client, set the Supabase callback address as the redirect URI
  (`https://<project>.supabase.co/auth/v1/callback`);
- put the Supabase URL and the publishable key into GitHub Actions variables, from which they go into the build.
  These values are public by design, because every browser sees them. The Supabase documentation explicitly allows
  this, since RLS protects the data;
- deploy through GitHub Actions, the same as the website.

Note: the app shares the domain `manse404.github.io` with the website, so the sign-in session in the browser
belongs to the same domain. That is fine as long as the website has no third-party scripts. If it ever gets them,
the app moves to a subdomain of its own.

**What is needed (all free):**

| What | Who | Note |
|---|---|---|
| A Supabase account and project, region Frankfurt | the owner creates it | |
| A Google Cloud project with an OAuth client | the owner creates it | only for "Login with Google"; the basic data (e-mail, name) needs no verification by Google |
| A Cloudflare account linked to GitHub | the owner | |
| A private GitHub repository | the owner | |
| Node 20+, Supabase CLI, Docker | locally | a local database for development and migrations |
| A domain | not needed for v1 | the address `*.workers.dev` / `*.pages.dev` is enough; in F2 one may be needed for sending e-mail |

**"Sheet":** an "Izvezi" (export) button (CSV/XLSX) on the list, and a weekly automatic export through a GitHub
Action. That export is also the backup.

Schema, first draft:

```
roditelj   id (auth user), oznaka ('Tata' | 'Mama' or a name),
           oznaka_akuzativ ('tatu' | 'mamu'), mejl, poslednja_poseta
dete       ime
oblast     kljuc, naziv, redosled   (the name "Detetove potrebe" lives only here)
stavka     id, naslov, opis, oblast, stanje, vazno, hitno, datum,
           otvorio, odluka, zatvaranje_predlozio,
           kreirano, izmenjeno, zatvoreno
unos       id, stavka_id, autor, vrsta, tekst, kreirano
           vrsta: odgovor | aktivirano | predlog_zatvaranja | povucen_predlog |
                  odbijeno_zatvaranje | zatvoreno | ponovo_otvoreno
izmena     id, tabela, red_id, autor, staro (jsonb), novo (jsonb), vreme
```

Who waits for whom is not stored separately: it is computed from the state, the field `otvorio` and the closing
proposal (`src/lib/domen.ts`). The same holds for the automatic urgent flag. `datum` is a single date, whether it
is a deadline or an appointment.

Calendar:

```
boravak            id, vrsta (redovno | izuzetak), kod (roditelj), od, do,
                   napomena, kreirano          — local time, no time zone
zahtev_kalendara   id, vrsta (dodaj | izmeni | obrisi), boravak_id,
                   boravci (jsonb: the new stays), poruka, predlozio,
                   stanje (ceka | prihvacen | odbijen | povucen), razlog,
                   kreirano, reseno, resio
```

```
dogadjaj           id, naziv, vrsta, datum, ceo_dan, od, do,
                   ponavljanje (jsonb: tip, svakih, dani, do), izuzeti (date[]),
                   vodi, mesto, napomena, kreirano
```

`zahtev_kalendara` gets `predmet` (boravak | dogadjaj), `dogadjaj_id`, `dogadjaj` (jsonb) and `jednom` (the date
of the occurrence that moves just once).

The "nobody alone" rule is enforced by the database, not only by the app:

- `boravak` and `dogadjaj` have no INSERT, UPDATE or DELETE policy for any user;
- a parent may only insert a `zahtev_kalendara` with `predlozio = auth.uid()` and `stanje = 'ceka'`;
- the only door to the table `boravak` is the function `prihvati_zahtev(id)` (security definer). It checks that
  the other parent is the one accepting, checks overlaps again and applies the change in one transaction.
  `odbij_zahtev` and `povuci_zahtev` do the same for their cases.

The rules are the same as in `src/lib/kalendar.ts` and `src/lib/dogadjaji.ts`, with tests in `kalendar.test.ts`
and `dogadjaji.test.ts`.

Record:

```
karton_unos        id, grupa, naziv, vrednost, detalji (jsonb, for lists),
                   izmenio, izmenjeno
                   groups: osnovno, zdravlje, skola, nastavnici, mere,
                           kontakti, drugari, aktivnosti
raspored_casova    casovi (text[]), tabela (jsonb), slika (a path in
                   storage), napomena, izmenio, izmenjeno
karton_izmena      id, unos_id, grupa, naziv, staro, novo, autor, kada
                   — filled by a trigger in the database, not by the app
```

**Documents (migration `20261104020000_dokumenti.sql`).** The first part of the app that, in database mode, really
shares data between the two of you:

- Supabase Storage, a **private** bucket `dokumenti`, each file under `<porodica>/<dokument>.<ext>`. There are no
  public links; a picture or a PDF opens through a signed link valid for 10 minutes.
- Rules on the bucket: only the two parents of that family read and upload (with MFA, as everywhere). The bucket
  has no rule for updating or deleting, so **nobody can replace or destroy an uploaded file**. The bucket accepts
  only PDF, JPG, PNG and WebP, 10 MB at most.
- Tables:

  ```
  dokument        id, porodica_id, putanja, naziv, kategorija, datum,
                  napomena, tip, velicina, otpremio, otpremljeno,
                  obrisan, obrisao
  dokument_trag   dokument_id, vrsta (otpremljen | izmenjen | obrisan |
                  vracen), ko, kada
  ```

  Nothing is written to the tables directly, only through the functions `dodaj_dokument`, `izmeni_dokument`,
  `obrisi_dokument` and `vrati_dokument`. `dodaj_dokument` takes the type and the size from the uploaded file
  itself, not from the app.
- Deleting is "soft": it marks the document and writes down who and when, and either of you restores it. For now
  there is no time limit on restoring; deleting for good (after 30 days, with an Edge Function that also removes
  the file) is left for later.
- Pictures larger than 1.5 MB are shrunk in the browser before upload (the longer edge to at most 2400 px, JPEG).
  HEIC from an iPhone is turned into JPEG where the browser can open it; Safari on an iPhone sends JPEG anyway.
- In demo mode the documents live in the browser's IndexedDB, with four examples drawn in the browser (there are no
  real scans in the repository).
- **Deleting for good** (2026-11-04; migration `20261104030000_trajno_brisanje.sql`): only from "Obrisani" (the
  trash) and only when both parents agree. One proposes, the other confirms or declines; the proposer cannot
  confirm their own proposal and can withdraw it. Restoring the document answers an open proposal (for the
  proposer it withdraws it, for the other parent it declines it); after confirmation there is no way back. Only
  then does the bucket allow the file to be removed (the DELETE rule requires an approved proposal), the app
  removes it through the Storage API, and `zavrsi_trajno_brisanje` removes the row only once the file is really
  gone (it can be repeated if the connection drops). A record stays in `dokument_brisanje`: the name, who
  proposed, who confirmed, when. A proposal that waits for you also shows on the home screen under "Na tebi je"
  (your turn). A family with one parent cannot delete for good.
- For later: linking a document to an item (for example a medical finding to the item "Allergist check-up") and to
  the record. It waits until the items move to the database as well; otherwise the link would point to data that
  exists on one device only.

Later: `dogadjaj` (appointments), `trosak` (expenses).

**Alternative: Google Sheet + Apps Script.** The advantage is that the sheet opens directly. The disadvantages:
edits in the sheet bypass the app's rules (states, history, confirmation of closing), the app is slower, and it is
hard to make it look like the website. That is why the recommendation is Supabase, with an export to a sheet.

### 7. Phases

The status of each phase is in [Phases](#phases) above.

- **F0, setup:** an Astro project with the website's tokens, the Supabase project, schema, RLS, the history
  trigger, two accounts, Cloudflare Pages.
- **F1, MVP:** home, list, item, new item, state transitions, "Predstojeće" (upcoming), "Novo od poslednje posete"
  (new since the last visit), PWA, CSV export.
- **F2:** e-mail notifications (urgent ones at once, the rest once a day), Realtime, privacy and deletion;
  documents (section 6).
- **F3 (optional):** expenses.

Note: without notifications an app like this is easily forgotten. If after F1 it turns out that the other parent
does not open it regularly, notifications come next.

### 8. Tests

- RLS: a third account and a signed-out user see nothing.
- Board: dragging with the mouse and with a finger (press and hold, then drag); a quick swipe of the finger does
  not move the card; a forbidden move changes nothing (`npm run smoke`).
- State transitions: the other parent's reply moves the item to open; closing without a decision is refused; the
  confirmation of closing must come from the other parent.
- History: every edit has an author and a time.
- Record: an edit remembers the old and the new value, the same value is not logged, deleting leaves a trace;
  activities and contacts take any number of entries; an open draft locks the rest. The history of agreements
  holds only closed items.
- Calendar: a proposal does not change the calendar; the proposer cannot accept their own request; accepting
  checks overlaps again; repetition does not "slide" across the change between summer and winter time; the
  occurrences of activities (weekly, every other week, until a date, skipped days); the layout of overlapping
  blocks; moving just once and every time; a moved handover as a one-off change; after a drag exactly one dialog
  opens, in the middle; in the database: a user cannot write directly to `boravak` and `dogadjaj` (the RLS test in
  F0).
- Notifications (`supabase/tests/obavestenja.test.sql`, 37 checks): only the other parent gets a row; an item
  flagged "Hitno" (urgent) and a proposal within 48 h are urgent; record changes go without values; a parent sees
  only their own rows, another family nothing, and nobody writes directly; `nikad` schedules nothing and drops what
  was waiting; the queue for sending is read only by the service role, `odmah` and `dnevno` return the right sets,
  what was sent is not repeated, and what failed is tried again. The Edge Function was run through Node with a fake
  `fetch` (401 without the key, grouping by recipient, subjects, a Resend error goes into `oznaci_poslato`). The
  screen refresh (`src/lib/osvezavanje.test.ts`): one refresh per burst of signals, no overlap, stopping
  unsubscribes.
- Deleting a space (`supabase/tests/brisanje_porodice.test.sql`, 21 checks): the first request waits and can be
  withdrawn, the second approves it, a file is deleted only then and only from its own family, and then every row;
  another family stays; an account is deleted only once it is out of a space; a parent who is alone deletes at
  once.
- Documents (`supabase/tests/dokumenti.test.sql`, 30 checks): uploads only into the folder of one's own family; a
  description only for a file that exists, with the type and the size taken from the file; the other parent sees
  and opens, a stranger and a signed-out user do not; a file does not change and is not deleted; deleting marks it
  and writes down who, restoring works, the trail logs everything; with MFA on but without the code there is
  neither reading nor uploading. In the browser (`npm run smoke:nalog`): dad adds, mum sees the thumbnail and opens
  it through the signed link and deletes it, and dad restores it.

### 9. Decisions

**The child's name is not shown** (2026-11-04): everywhere it says "dete" (the child): "Detetove potrebe" (the
child's needs), "Kod koga je dete" (who the child is with), "Karton deteta" (the child's record). The welcome
screen no longer asks for the name; the database still has the field `dete.ime` and stores "Dete" in it. The name
can be written down only as a fact in the record ("Puno ime", full name), if the parents add it themselves.

Decided on 2026-11-03:

1. The states unanswered / open / closed mean what section 3 says.
2. One parent proposes closing, and the other confirms it.
3. The database is Supabase. Sign-in with a Google account, with an e-mail link as a fallback.
4. Additions: 1–3 in v1, 4 in v2, and 5–6 only if both parents want them.
5. The labels in the app are "Tata" (dad) and "Mama" (mum). That is a field in the database and easy to change.
6. Hosting is GitHub Pages (section 6). The repository becomes public only after it is cleaned of personal data.

Decided later, on 2026-11-04: sign-in (Google, e-mail and password), MFA and joining through an invitation. The
list of allowed addresses was dropped, so the other parent's e-mail is no longer needed in advance.

Left open:

- The Google OAuth client (Google Cloud Console). The owner creates it.
- Google Sheet: a sheet would do as well. If a sheet for reading is ever needed, a one-way copy Supabase → Sheet is
  added later. The sheet is never a source of data.
