# Features

Everything the app offers, with its status checked against `src/` and `supabase/`. The interface is in Serbian;
a screen's label is given in quotes with an English gloss.

Status: **shipped** (built and wired to both the demo and the database), **partial** (built, with a gap named in
the row), **planned** (not built). Every shipped feature works the same in the demo and with real accounts, except
where a row says otherwise.

| Feature | What you can do | Status | Where in code | Doc |
|---|---|---|---|---|
| Home | see what is urgent and important, what waits for you and for the other parent, what needs your answer ("Na tebi je"), the board as a strip, the areas, the next 14 days, what is new since your last visit, and who has the child | shipped | `src/pages/index.astro`, `Pocetna.svelte`; `napraviPregled` in `src/lib/domen.ts` | [home.md](home.md) |
| Items | open an item (area, flags, date), reply, activate, edit while open, propose closing with a decision, confirm, decline with a reason, withdraw, reopen | shipped | `/nova/`, `/stavka/`; `NovaStavka.svelte`, `StavkaDetalj.svelte`; `src/lib/domen.ts`; functions `nova_stavka` … `ponovo_otvori_stavku` | [items.md](items.md) |
| Board | drag cards between "Stavke", "Aktivno" and "Rešeno" with a mouse or a finger; only moves the rules allow | shipped | `/stavke/`; `Tabla.svelte`, `src/lib/prevlacenje.ts`, `potezZaKolonu` in `domen.ts` | [items.md](items.md#screens) |
| List and CSV export | filter by state, area, flag and "Čeka mene" (waits for me), search, export to CSV | shipped | `Stavke.svelte`, `ListaStavki.svelte`, `src/lib/izvoz.ts` | [items.md](items.md#screens) |
| History of agreements | read every closed item with its decision, by month, filter, search, export to CSV | shipped | `IstorijaDogovora.svelte`, `src/lib/istorija.ts` | [items.md](items.md#screens) |
| Stays | propose who has the child when, as a regular schedule or a one-off change; the other parent accepts or declines | shipped | `/kalendar/`; `Kalendar.svelte`, `PredlogKalendara.svelte`, `src/lib/kalendar.ts`; `predlozi_kalendar`, `prihvati_zahtev` | [calendar.md](calendar.md#stays) |
| Activities | propose an activity once or repeating, move one by dragging ("Samo ovaj put" or "Svaki put"); the other parent accepts | shipped | `PredlogAktivnosti.svelte`, `PomeriDijalog.svelte`, `src/lib/dogadjaji.ts`; `predlozi_dogadjaj` | [calendar.md](calendar.md#activities) |
| Calendar views | day, week (three days on a phone), month and schedule; drag a handover to propose another time | shipped | `Kalendar.svelte`, `NedeljaPrikaz.svelte`, `RasporedPrikaz.svelte`, `src/lib/kalendar-prikaz.ts` | [calendar.md](calendar.md#views) |
| Record | keep the child's standing facts and lists (teachers, activities, contacts, friends); edit directly, every change logged with the old and the new value | shipped | `/karton/`; `Karton.svelte`, `src/lib/karton.ts`; `sacuvaj_karton`, `obrisi_karton`, trigger `karton_unos_istorija` | [record.md](record.md) |
| School timetable | type it in, import it from CSV or `.xlsx`, or keep a photo | shipped | `RasporedCasova.svelte`, `src/lib/raspored-casova.ts`; `sacuvaj_raspored` | [record.md](record.md) |
| Documents | add a PDF or a photo (photos redrawn, location data dropped), sort by category, open through a 10-minute signed link, edit the description, delete to the trash and restore | shipped | `/dokumenti/`; `Dokumenti.svelte`, `DokumentDodaj.svelte`, `DokumentPregled.svelte`, `src/lib/dokumenti.ts`, `dokumenti-supabase.ts`, `slike.ts` | [documents.md](documents.md) |
| Deleting a document for good | propose it from the trash; the other parent confirms or declines; the proposer can withdraw | shipped | `ObrisaniDokumenti.svelte`; `predlozi_trajno_brisanje` … `zavrsi_trajno_brisanje` | [documents.md](documents.md) |
| Sign-in | make an account with e-mail and password, confirm the e-mail, reset a forgotten password | shipped (database only) | `/prijava/`; `Prijava.svelte`, `src/lib/nalog.ts` | [accounts.md](accounts.md) |
| Google sign-in | continue with a Google account | partial: off until a copy sets up an OAuth client, and the button shows even when it is off | `prijavaGoogle` in `src/lib/nalog.ts`, `[auth.external.google]` in `supabase/config.toml` | [accounts.md](accounts.md) |
| MFA | turn on a code from an authenticator app; the database then serves data only after the second step | shipped (database only) | `/mfa/`; `Mfa.svelte`, `MfaPodesavanje.svelte`; `mfa_ispunjen` and the restrictive `mfa …` policies | [accounts.md](accounts.md) |
| Family space and invitation | open a space as tata or mama, send the other parent a one-time link valid for 7 days, accept it | shipped (database only) | `/dobrodosli/`, `/poziv/`; `Dobrodosli.svelte`, `Poziv.svelte`, `PozoviRoditelja.svelte`; `kreiraj_porodicu`, `napravi_pozivnicu`, `prihvati_pozivnicu` | [accounts.md](accounts.md) |
| Who may open a space | the owner of a copy lists the e-mails allowed to open a space; an empty list lets anyone | shipped (database only) | table `dozvoljeni_osnivac`, `mogu_da_otvorim_prostor`; `Dobrodosli.svelte` | [accounts.md](accounts.md) |
| Parent profile | keep your name, phone, handover address, contact e-mail and a note; see the other parent's with call, map and mail links | shipped | `/podesavanja/`; `ProfilRoditelja.svelte`, `src/lib/profil.ts`, `profil-izvor.ts`; `sacuvaj_profil` | [accounts.md](accounts.md) |
| E-mail notifications | choose "odmah" (at once), "dnevno" (a daily digest, urgent at once) or "nikad" (never) for the other parent's changes | shipped; each copy must set up Resend, the function and the schedules | `ObavestenjaPodesavanje.svelte`, `src/lib/obavestenja.ts`; `supabase/migrations/20261111010000_obavestenja.sql`, `supabase/functions/obavestenja/` | [notifications.md](notifications.md) |
| Live updates | see the other parent's changes without reloading | shipped (database only; the local database starts without Realtime) | `naPromenu` in `src/lib/izvor-supabase.ts`, `src/lib/osvezavanje.ts`; `20261111030000_realtime.sql` | [notifications.md](notifications.md#live-updates) |
| Privacy page | read what is kept, who sees it, what goes out by e-mail and how to delete | shipped | `src/pages/privatnost.astro` | [privacy.md](privacy.md) |
| Deleting the family space and the account | ask to delete the space (both parents must ask; the first can take it back), then delete your own account | shipped (database only) | `BrisanjePorodice.svelte`; `obrisi_porodicu`, `odustani_od_brisanja`, `obrisi_nalog` | [privacy.md](privacy.md) |
| Demo | try the whole app on example data in the browser and switch between the two parents | shipped | `?demo=1` or a build without Supabase settings; `jeDemo` in `src/lib/supabase.ts`, `src/lib/mock/`, `DemoBiracRoditelja.svelte` | [architecture/overview.md](../../architecture/overview.md#two-modes) |
| Your own copy | deploy the site and a free Supabase project for your family | shipped | `.github/workflows/pages.yml`, `supabase/migrations/`, `astro.config.mjs` (`BASE_PATH`) | [operations/deployment.md](../../operations/deployment.md) |
| Install as a phone app (PWA) | install the site on a phone's home screen | planned (no web app manifest, no service worker) | | [roadmap.md](../../roadmap.md#later-or-not-built) |
| XLSX export and a weekly automatic export | export to Excel; a scheduled export that is also a backup | planned | | [roadmap.md](../../roadmap.md#later-or-not-built) |
| Link a document to an item or the record | attach a finding to the item it belongs to | planned | | [roadmap.md](../../roadmap.md#later-or-not-built) |
| Shared expenses (F3) | track shared costs | planned, optional: only if both parents want it | | [roadmap.md](../../roadmap.md#phases) |

"Database only" means the feature needs real accounts: the demo has no sign-in, MFA, invitation, live updates or
deletion. The demo does show the profile and the notification choice, kept in the browser.

## Deciding together

Home, items, the board, the list and the history of agreements are one flow: a question becomes an item, the other
parent answers in its thread, and it closes only with a written decision the other parent confirms. Whose turn it
is, is computed from the state (`naPotezu`, `cekaDrugog` in `src/lib/domen.ts`), and the database functions apply
the same transitions.

## Calendar

Stays and activities share one rule: nothing in the calendar changes until the other parent accepts a request.
`boravak` and `dogadjaj` have no write policy; only `prihvati_zahtev` writes them, after checking overlaps again.

## The child's record and documents

The record is the deliberate exception to consent: either parent edits it, and a trigger logs every change.
Documents are files in a private bucket that nobody can replace; deleting one for good needs both parents.

## Accounts and the family space

A space holds two parents and one child, and one account belongs to one space. MFA is optional, but once a parent
turns it on, the database itself waits for the second step.

## Staying informed

Database triggers queue an e-mail for the other parent, and the Edge Function `obavestenja` sends it through Resend
on a `pg_cron` schedule. Open screens re-read their data through one Realtime channel per family.

## Privacy, the demo and your own copy

The privacy page, CSV export and deleting the space are what a parent needs to see, take and remove their data.
The same build runs as a demo without any backend, and the code is public so another family can run its own copy.
