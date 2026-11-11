# Accounts and the family space

Sign-in, MFA, the family space and the invitation (`src/lib/nalog.ts`; screens `Prijava.svelte`, `Mfa.svelte`,
`Dobrodosli.svelte`, `Poziv.svelte`, `PozoviRoditelja.svelte` and `Podesavanja.svelte`).

- **Sign-in** with e-mail and password. The e-mail is confirmed by a link, and a forgotten password is reset by
  e-mail. A password has at least 10 characters, with letters and digits (`supabase/config.toml` for the local
  database; a hosted project sets the same in its dashboard). Google sign-in is optional and stays off until the
  owner of a copy sets up an OAuth client.
- **MFA** with a code from an authenticator app (TOTP), turned on or off in the settings. With MFA on, the
  database also waits for the second step: a restrictive policy on every table lets data through only at
  `aal2`.
- **The family space.** The first parent creates it, choosing their role (tata or mama), and makes an
  invitation link for the other parent. The link is valid for 7 days and works once; the app binds it to the
  other parent's e-mail (the database also accepts a link without one). Only the SHA-256 of the link's token is
  stored, and a new link cancels the old one.
- A space holds two parents at most, and one account belongs to one space. Signing up is open, but an account
  without a space sees nothing.
- **Who may open a space** on a copy: while the table `dozvoljeni_osnivac` is empty, any account; with e-mails
  in it, only those accounts. The second parent always comes in through the invitation.
- **Parent profile**: name, phone, an address for handovers, a contact e-mail and a note. Both parents see both
  profiles; each edits only their own, through `sacuvaj_profil`. The phone is a call link, the address opens a
  map and the e-mail opens mail.

Database: tables `porodica`, `roditelj`, `dete`, `pozivnica` and `dozvoljeni_osnivac`; functions
`kreiraj_porodicu`, `mogu_da_otvorim_prostor`, `napravi_pozivnicu`, `pogledaj_pozivnicu`, `prihvati_pozivnicu`,
`moja_pozivnica`, `oznaci_posetu` and `sacuvaj_profil`.
