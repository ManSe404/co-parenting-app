# 0003. A family space and an invitation instead of a list of allowed e-mails

## Status

Accepted, 2026-11-04; replaces the two-address list of the first plan. Written down as an ADR on 2026-11-16 from
[roadmap.md, sections 6 and 9](../roadmap.md#9-decisions).

## Context

The first plan let in only two e-mail addresses listed in advance. That needs the other parent's e-mail before
they join, and ties a copy of the app to one family.

## Decision

The first parent opens a family space and gets an invitation link for the other parent. The link is valid for
7 days, works once and can be bound to an e-mail; the database stores only the SHA-256 of its token, and a new link
cancels the old one. A space holds two parents at most, and one account belongs to one space. Signing up is open,
but an account without a space sees nothing.

## Consequences

- The other parent's e-mail is not needed in advance.
- One copy can serve several families, each in its own space. Which accounts may open a space is limited
  separately ([0005](0005-public-code-private-copy.md)).
- Every table of family data carries `porodica_id`, and RLS reads it through `moja_porodica()`.
