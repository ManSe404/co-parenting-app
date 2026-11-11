# Notification e-mail

How a change becomes an e-mail to the other parent (from `supabase/migrations/20261111010000_obavestenja.sql`,
`20261111020000_obavestenja_raspored.sql` and `supabase/functions/obavestenja/index.ts`).

```mermaid
sequenceDiagram
  participant T as Trigger on stavka, unos, zahtev_kalendara, dokument, karton_izmena
  participant Q as Queue obavestenje
  participant C as pg_cron
  participant P as pozovi_obavestenja
  participant V as Vault
  participant F as Edge Function obavestenja
  participant R as Resend

  T->>Q: insert a row for the other parent, unless they chose nikad
  C->>P: every 5 minutes with odmah, at 06:00 and 07:00 UTC with dnevno
  P->>P: dnevno goes on only when it is 08:00 in Belgrade
  P->>V: read obavestenja_url and obavestenja_kljuc
  P->>F: POST ?rezim=..., service-role key as bearer (pg_net)
  F->>F: compare the bearer with SUPABASE_SERVICE_ROLE_KEY
  F->>Q: rpc obavestenja_za_slanje(rezim)
  F->>R: one e-mail per recipient
  F->>Q: rpc oznaci_poslato(ids, error or null)
```
