# 0002. The consent rules are enforced by the database

## Status

Accepted, 2026-11-04. Written down as an ADR on 2026-11-16 from
[roadmap.md, section 6](../roadmap.md#6-data-and-technology-recommendation) ("The 'nobody alone' rule is enforced
by the database, not only by the app") and the goals in
[architecture/overview.md](../architecture/overview.md#goals-and-constraints).

## Context

The app's promise is that nothing that concerns both parents changes without the other parent's consent. The site
runs in the browser, so a parent could change its code; rules kept only in the screens could be skipped.

## Decision

No table has an insert, update or delete policy for clients. Every write is a `security definer` function with an
empty `search_path` that checks who is asking. The calendar tables `boravak` and `dogadjaj` are written only by
`prihvati_zahtev`, which checks that the other parent is accepting and checks overlaps again; closing an item,
deleting a document for good and deleting the family space need the other parent in the same way.

## Consequences

- The rules hold against a changed client.
- Each rule also exists in TypeScript (`src/lib/`) for the demo and for the screens; a change to a rule changes
  both, with a test on each side ([guides/development.md](../guides/development.md)). Nothing checks
  automatically that the two copies agree.
- Every new write needs a new function and a migration.
