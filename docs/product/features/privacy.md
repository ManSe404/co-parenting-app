# Privacy and deletion

- **The privacy page** `/privatnost/`, public and linked from sign-in and from the settings, says what the app
  keeps, who sees it, what goes out by e-mail, how to export and how to delete (`src/pages/privatnost.astro`).
- **Export.** The item list and the history of agreements export as CSV. A cell that starts with `=`, `+`, `-`
  or `@` gets a leading apostrophe, so a spreadsheet does not run it as a formula (`src/lib/izvoz.ts`).
- **Deleting the family space** needs both parents ("Brisanje", deletion, in "Podešavanja", the settings;
  `BrisanjePorodice.svelte`). Each parent calls `obrisi_porodicu`. The first call is recorded and can be taken back
  (`odustani_od_brisanja`) until the other parent asks too. The second call approves it: the app removes the files
  through the Storage API, which the bucket then allows for that family, and the next call removes every row.
  Nothing is kept. A family with one parent is deleted by that parent alone.
- **Deleting an account.** `obrisi_nalog` removes the caller's own account (e-mail, password, MFA factors,
  sessions), and only once they are out of a family space.

The other privacy rules (one family's data for its two parents only, MFA, private storage, no tracking) are in
[architecture/crosscutting.md](../../architecture/crosscutting.md).
