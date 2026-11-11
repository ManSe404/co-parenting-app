# Data model

Everything below is defined in `supabase/migrations/`, applied in file-name order. The words are explained in the
[glossary](../product/glossary.md).

## Rules that hold for every table

- Row-level security is on. Clients have no insert, update or delete rights; every write goes through a
  `security definer` function (below) that checks who is asking.
- A member reads their own family's rows (`porodica_id = moja_porodica()`), through a policy named
  `clan cita …`. A restrictive policy `mfa …` adds that an account with MFA on must be at `aal2`
  (`mfa_ispunjen()`).
- Rows reference accounts in `auth.users` (Supabase Auth) and their family in `porodica`, with `on delete
  cascade` from the family.

## Tables

| Table | What a row is | Written by | Migration |
|---|---|---|---|
| `porodica` | a family space; `brisanje_odobreno` once both parents asked to delete it | `kreiraj_porodicu`, `obrisi_porodicu` | `20261104010000_porodica.sql` |
| `roditelj` | a parent in a family: role (`tata`, `mama`), labels, colour, last visit, profile fields, notification choice, deletion request; one account is in one family, one role per family | `kreiraj_porodicu`, `prihvati_pozivnicu`, `oznaci_posetu`, `sacuvaj_profil`, `postavi_obavestenja`, `obrisi_porodicu` | `…010000_porodica`, `…040000_profil_roditelja`, `20261111010000_obavestenja`, `20261111040000_brisanje_porodice` |
| `dete` | the child of a family; the name is stored as "Dete" | `kreiraj_porodicu` | `…010000_porodica` |
| `pozivnica` | an invitation link: SHA-256 of the token, role, optional e-mail, expiry (7 days), use; not readable by clients | `napravi_pozivnicu`, `prihvati_pozivnicu` | `…010000_porodica`, `…070000_posle_pregleda` |
| `dozvoljeni_osnivac` | an e-mail allowed to open a family space; empty means everyone; not readable by clients | the owner, in the dashboard or SQL | `…060000_ko_otvara_prostor` |
| `stavka` | an item: title, description, area, state, flags, date, who opened it, decision, closing proposal | the item functions below | `…050000_stavke_kalendar_karton` |
| `unos` | an entry in an item's thread; kinds `odgovor`, `aktivirano`, `predlog_zatvaranja`, `povucen_predlog`, `odbijeno_zatvaranje`, `zatvoreno`, `ponovo_otvoreno`, `izmenjeno` | the item functions | `…050000`, `…070000_posle_pregleda` |
| `boravak` | a stay: layer (`redovno`, `izuzetak`), parent role, start and end as wall-clock text | only `prihvati_zahtev` | `…050000` |
| `dogadjaj` | an activity: name, kind, day, all day or times, repetition (JSON), skipped days, who takes the child, place, note | only `prihvati_zahtev` | `…050000` |
| `zahtev_kalendara` | a calendar request for a stay or an activity: kind (`dodaj`, `izmeni`, `obrisi`), the proposed values, message, proposer, state, reason | `predlozi_kalendar`, `predlozi_dogadjaj`, `prihvati_zahtev`, `odbij_zahtev`, `povuci_zahtev` | `…050000`, `…070000` |
| `karton_unos` | a record entry: group, name, value, details (JSON) for list groups | `sacuvaj_karton`, `obrisi_karton` | `…050000` |
| `raspored_casova` | the school timetable, one per family: lessons, table, optional photo as a data URL, note | `sacuvaj_raspored` | `…050000` |
| `karton_izmena` | the record's change log: old and new snapshot, author, time | triggers `karton_unos_istorija`, `raspored_casova_istorija` | `…050000` |
| `dokument` | a document: path in the bucket, name, category, date, note, type, size, uploader, soft delete | `dodaj_dokument`, `izmeni_dokument`, `obrisi_dokument`, `vrati_dokument`, `zavrsi_trajno_brisanje` | `20261104020000_dokumenti.sql` |
| `dokument_trag` | a document's trail: uploaded, edited, deleted, restored | the document functions | `…020000_dokumenti` |
| `dokument_brisanje` | a request to delete a document for good, and the record left after it | `predlozi_trajno_brisanje`, `potvrdi_trajno_brisanje`, `odbij_trajno_brisanje`, `povuci_trajno_brisanje`, `zavrsi_trajno_brisanje` | `20261104030000_trajno_brisanje.sql` |
| `obavestenje` | a notification queued for one parent: kind, urgent, subject, text, link path, sent, error; a parent reads only their own | triggers below; `oznaci_poslato`, `postavi_obavestenja` | `20261111010000_obavestenja.sql` |

## Functions clients call

| Area | Functions |
|---|---|
| Family and invitation | `kreiraj_porodicu`, `mogu_da_otvorim_prostor`, `napravi_pozivnicu`, `pogledaj_pozivnicu` (also without an account), `prihvati_pozivnicu`, `moja_pozivnica`, `oznaci_posetu` |
| Profile and notifications | `sacuvaj_profil`, `postavi_obavestenja` |
| Items | `nova_stavka`, `izmeni_stavku`, `odgovori_na_stavku`, `aktiviraj_stavku`, `predlozi_zatvaranje`, `potvrdi_zatvaranje`, `odbij_zatvaranje`, `povuci_predlog_zatvaranja`, `ponovo_otvori_stavku` |
| Calendar | `predlozi_kalendar`, `predlozi_dogadjaj`, `prihvati_zahtev`, `odbij_zahtev`, `povuci_zahtev` |
| Record | `sacuvaj_karton`, `obrisi_karton`, `sacuvaj_raspored` |
| Documents | `dodaj_dokument`, `izmeni_dokument`, `obrisi_dokument`, `vrati_dokument`, `predlozi_trajno_brisanje`, `potvrdi_trajno_brisanje`, `odbij_trajno_brisanje`, `povuci_trajno_brisanje`, `zavrsi_trajno_brisanje` |
| Deleting | `obrisi_porodicu`, `odustani_od_brisanja`, `obrisi_nalog` |

Only the service role may call `obavestenja_za_slanje` and `oznaci_poslato` (the sender). `pozovi_obavestenja` is
called by the schedule only. The rest (`moja_porodica`, `mfa_ispunjen`, `prijavljen_sa_mfa`, `moj_prostor`, the
checks and the trigger functions) are helpers.

## Triggers

| Trigger | On | Does |
|---|---|---|
| `karton_unos_istorija`, `raspored_casova_istorija` | changes to `karton_unos`, `raspored_casova` | write `karton_izmena` |
| `stavka_obavestenje` | insert on `stavka` | queue a notification for the other parent |
| `unos_obavestenje` | insert on `unos` | the same, for each thread entry |
| `zahtev_kalendara_obavestenje` | insert, or a change of `stanje`, on `zahtev_kalendara` | the same, for a proposal and its answer |
| `dokument_obavestenje` | insert on `dokument` | the same, for a new document |
| `karton_izmena_obavestenje` | insert on `karton_izmena` | the same, naming the field, never its value |

## Storage

The private bucket `dokumenti` accepts PDF, JPEG, PNG and WebP up to 10 MB, each file under `<family>/<uuid>.<ext>`.
Its policies: the family's parents read and upload; deleting is allowed only for a document with an approved
request in `dokument_brisanje`, or for a family whose deletion both parents asked for. There is no update policy.

## Realtime, schedules, Vault

- Publication `supabase_realtime`: `roditelj`, `stavka`, `unos`, `boravak`, `dogadjaj`, `zahtev_kalendara`,
  `karton_unos`, `karton_izmena`, `raspored_casova`, `dokument`, `dokument_trag`, `dokument_brisanje`
  (`20261111030000_realtime.sql`).
- `pg_cron` jobs, created only where `pg_cron` and `pg_net` are on: `obavestenja-odmah` (`*/5 * * * *`) and
  `obavestenja-dnevno` (`0 6,7 * * *`, sending only when it is 08:00 in Belgrade)
  (`20261111020000_obavestenja_raspored.sql`).
- Vault secrets the schedule reads: `obavestenja_url` and `obavestenja_kljuc`.

## Tests

`supabase/tests/*.test.sql` (pgTAP, `npm run test:baza`): the family and invitation, documents, deleting for
good, profiles, items with the calendar and the record (`podaci.test.sql`), who may open a space, the fixes after
the security review, notifications, and deleting a family space.
