# Crosscutting: security, privacy, errors

## Security and privacy

- **One family, two parents.** Row-level security lets a parent read only their own family's rows
  (`porodica_id = moja_porodica()`). With MFA on, a restrictive policy on every table also requires the second
  step (`mfa_ispunjen()`, level `aal2`).
- **No direct writes.** Clients have no insert, update or delete rights on any table. Every change goes through a
  `security definer` function with an empty `search_path`, which checks who is asking and whether they may: the
  parent who proposed a calendar change cannot accept it, for example. The functions are granted to signed-in
  users; the one exception is `pogledaj_pozivnicu`, which also lets a visitor without an account see who
  invites them. The sender's two functions are granted to the service role only.
- **History cannot be rewritten.** A closed item does not change, every edit of an open item goes into its thread,
  and the record's change log is written by a trigger, not by the app.
- **Calendar requests carry only what the other parent is shown**, so nothing hidden can slip into the calendar
  with an accepted request.
- **Documents** are in a private bucket and open through signed links valid for 10 minutes. Uploads are accepted
  only as `<family>/<uuid>.<ext>` and only from that family's parents. Nobody can replace a file, and nobody can
  remove one without both parents. Photos are redrawn before upload, which drops their location and device data.
- **Invitations** store only the SHA-256 of the token. A used or expired link shows nothing about the family.
- **Size limits** on what one parent can write, so one family cannot fill a shared project.
- **Keys.** The browser gets only the publishable key (`PUBLIC_SUPABASE_KEY`), which is made to be public; RLS
  protects the data. The service-role key is used only by the sender, which gets it from Supabase
  (`SUPABASE_SERVICE_ROLE_KEY`), and by the schedule, which reads it from Vault. The Edge Function accepts only
  calls that carry the service-role key and compares it without leaking its length.
- **Notification e-mails** never carry record values, which may be health data: they name the field that
  changed.
- **The demo** lives in one tab's sessionStorage and never mixes with a real account.
- **Redirects.** A "go on to" target in the address must be a path inside the app (`bezbednoDalje` in
  `src/lib/putanje.ts`).
- **Export.** A CSV cell that a spreadsheet would run as a formula gets a leading apostrophe.
- **No tracking.** The site loads no analytics and no third-party script; the fonts are bundled.

## Errors

- Database functions raise errors with a Serbian message and an SQL state (`42501` for "not allowed", `22023` for
  invalid input); the screens show the message.
- Row locks keep two calls at the same moment from both passing a check, for example two invitation links.
- The sender keeps a failed e-mail in the queue with its error and tries again, for up to 7 days. Each of its
  outbound calls has a timeout.
- A screen that fails to refresh keeps what it shows, and the next change tries again.

## Observability

The app has no logging or monitoring of its own. The schedule's calls and their answers are in the table
`net._http_response` of the hosted project, and a failed e-mail keeps its error in `obavestenje.greska`.

## Open

- The shared `github.io` origin: see [overview.md](overview.md#open).
