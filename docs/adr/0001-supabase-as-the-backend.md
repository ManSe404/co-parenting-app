# 0001. Supabase as the backend, with no server of our own

## Status

Accepted, 2026-11-03 (decision 3 of the plan). Written down as an ADR on 2026-11-16 from the plan's own reasons in
[roadmap.md, sections 6 and 9](../roadmap.md#6-data-and-technology-recommendation).

## Context

The app has to store a family's data, health data included, in the EU, keep a history that does not depend on the
app, and cost nothing to run. The plan weighed a Google Sheet with Apps Script: the sheet opens directly, but edits
in it bypass the app's rules (states, history, confirmation of closing), the app is slower, and it is hard to make
it look like the author's website.

## Decision

Supabase (Postgres) in the EU region, on the free plan, plays the backend. Access rules are RLS policies, business
rules are constraints, functions and triggers in the database, and e-mail is a Supabase Edge Function. The browser
talks to Supabase directly through `supabase-js`. All the logic is in SQL migrations in `supabase/migrations/`. A
sheet, if ever needed, gets a one-way copy and is never a source of data.

## Consequences

- No server to run or patch; the site is static files on any host.
- The rules are written in SQL and tested with pgTAP, which needs a local Supabase in Docker.
- A free project pauses after a week without activity; the weekly export the plan names against that is not built.
- The app depends on Supabase's Auth, Storage, Realtime and Vault; moving away means rewriting those parts.
