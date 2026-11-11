# Record

The child's record (karton): standing facts both parents need at hand (`src/components/Karton.svelte`; the rules
in `src/lib/karton.ts`).

- Groups of single fields: basic facts (osnovno), school (skola), health (zdravlje), measures and sizes (mere).
  Groups that are lists, as long as needed: teachers (nastavnici), activities outside school (aktivnosti),
  important contacts (kontakti) and friends (drugari).
- The school timetable (raspored časova): typed in as a table of weekdays and lessons, imported from a CSV or
  Excel file (`.xlsx`, read without a library), and/or kept as a photo (`src/lib/raspored-casova.ts`).
- Either parent edits directly, without the other's confirmation: the record is a shared notebook, not a
  decision. Every change is logged instead, with who, when, the old and the new value. A database trigger
  writes the log (`karton_izmena`), not the app, and the other parent sees the change on the home screen.
- While one edit is open, the other edit buttons are locked, so typed text is not lost.
- The age is computed from the date of birth.

Database: tables `karton_unos`, `raspored_casova` and `karton_izmena`; functions `sacuvaj_karton`,
`obrisi_karton` and `sacuvaj_raspored`. The timetable photo is kept in `raspored_casova.slika` as a shrunk data
URL, not in the storage bucket.
