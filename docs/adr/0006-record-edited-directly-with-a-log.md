# 0006. The record is edited directly, with a change log, not by consent

## Status

Accepted, 2026-11-04. Written down as an ADR on 2026-11-16 from
[product/features/record.md](../product/features/record.md) and the table "Why this way" in
[product/vision.md](../product/vision.md#why-this-way).

## Context

Everything that concerns both parents needs the other parent's consent ([0002](0002-consent-rules-in-the-database.md)).
The child's record holds standing facts both parents need at hand: the paediatrician, sizes, teachers, contacts.

## Decision

The record is a shared notebook, not a decision. Either parent edits it directly. Every change is logged with who,
when, the old and the new value, by a database trigger (`karton_izmena`), not by the app, and the other parent sees
it on the home screen and, if they chose, in an e-mail that names the field but never its value.

## Consequences

- One parent can change a fact without asking; the log makes it visible and keeps the old value.
- The log is written even if a client skips the app's own code.
