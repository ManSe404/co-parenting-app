# Edge Function `obavestenja`

The sender of notification e-mails, in `supabase/functions/obavestenja/index.ts` (Deno, no dependencies). The
database decides what to send; this function only sends it. Its setup guide, in Serbian, is
`supabase/functions/obavestenja/README.md`.

## What it does

1. Accepts a call only when the `Authorization: Bearer` header or the `apikey` header equals the project's
   service-role key, compared through SHA-256 so the comparison leaks neither length nor position.
2. Reads what is due with `obavestenja_za_slanje(p_rezim)`.
3. Groups the rows by recipient and sends one e-mail per recipient through the Resend HTTP API (text and HTML,
   with a link per row to the copy at `APP_URL`).
4. Marks the rows with `oznaci_poslato(p_ids, p_greska)`: sent, or the error, so the next run tries again. Rows
   older than 7 days are no longer offered.

Each outbound call has a timeout (15 s to PostgREST, 20 s to Resend). Logs carry counts and errors, never
addresses or texts.

## How to run it

Deployed with `npx supabase functions deploy obavestenja`. Locally, start Supabase without `-x edge-runtime`, then
`npx supabase functions serve obavestenja --env-file supabase/.env`. A local run still sends real e-mail through
Resend. No test for the function is committed.

## Configuration

`RESEND_API_KEY`, `OBAVESTENJA_FROM` and `APP_URL` (set with `npx supabase secrets set`); `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase. A missing one raises "Nedostaje tajna …", which lands in the
rows' `greska` when it happens while sending, and in the function's log otherwise. See
[configuration.md](../configuration.md#edge-function-obavestenja).

## Contract

| | |
|---|---|
| Called by | `pg_cron` through `public.pozovi_obavestenja`, which reads the address and the key from Vault and POSTs through `pg_net`; or by hand with `curl` |
| Request | `POST` (or `GET`) `…/functions/v1/obavestenja?rezim=odmah` or `?rezim=dnevno`, service-role key as bearer; the body is ignored |
| `odmah` | every 5 minutes: urgent rows, and every row of a parent who chose `odmah` |
| `dnevno` | at 06:00 and 07:00 UTC; `pozovi_obavestenja` lets through only the run at 08:00 in Belgrade; rows of parents who chose `dnevno` |
| Answers | `200` with `{"rezim", "primalaca", "poslato", "neuspelo"}`; `400` for another `rezim`; `401` without the key; `405` for another method; `500` when reading the queue fails |
| Row it reads | `id`, `za_roditelja`, `email`, `oznaka`, `vrsta`, `hitno`, `naslov`, `tekst`, `putanja`, `kreirano`: the result of `obavestenja_za_slanje` in `supabase/migrations/20261111010000_obavestenja.sql`, mirrored by hand in the `Red` interface of `index.ts` |

The schedules exist only if `pg_cron` and `pg_net` were on when the migration
`20261111020000_obavestenja_raspored.sql` ran; see [operations/deployment.md](../../operations/deployment.md).
