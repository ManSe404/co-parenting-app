# Notifications

## E-mail

When one parent does something the other should know about, the other parent gets an e-mail. Each parent
chooses how often in the settings (`ObavestenjaPodesavanje.svelte`, database function `postavi_obavestenja`):

- `odmah`: every notification at once;
- `dnevno` (the default): one digest a day at 08:00 Belgrade time, and anything urgent at once;
- `nikad`: nothing is queued, and what was waiting is dropped.

Urgent means an item with the Hitno flag, or a calendar proposal that touches the next 48 hours.

What is queued, by database triggers: a new item; every entry in an item's thread (a reply, a proposal to close,
its confirmation, declining or withdrawing it, activating, reopening, editing); a calendar proposal and the
answer to it; a new document; a change to the record. A record e-mail names the field that changed, never its
value, because it may be health data.

The rules live in the database; the Edge Function `obavestenja` only sends. It runs every 5 minutes for `odmah`
and once a day for `dnevno`, sends one e-mail per recipient through Resend, and marks the rows as sent. A failed
send stays queued with its error and is tried again; rows older than 7 days are left alone. How it fits together:
[architecture/overview.md](../../architecture/overview.md) and
[diagrams/notification-flow.md](../../diagrams/notification-flow.md). A copy without Resend set up works; only
the e-mails do not go out.

## Live updates

The other parent's changes show up without reloading the page. The app holds one Realtime channel per family and
re-reads the screen 500 ms after the last change (`src/lib/osvezavanje.ts`). What a parent receives is decided by
the same row-level security as every read.
