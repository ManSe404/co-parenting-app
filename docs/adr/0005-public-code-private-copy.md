# 0005. Public code under MIT, with a private hosted copy

## Status

Accepted, 2026-11-04. Written down as an ADR on 2026-11-16 from
[roadmap.md, section 6](../roadmap.md#6-data-and-technology-recommendation) ("Open code, private copy").

## Context

The owner wants his hosted copy to be only for his family, and wants anyone else to be able to run their own copy
for theirs. Free GitHub Pages also serves only from a public repository.

## Decision

The repository is public under the MIT licence. Who may open a family space on a copy is the table
`dozvoljeni_osnivac`: with e-mails in it, only those accounts; while it is empty, anyone, so another person's copy
works without any setup. The second parent always comes in through the invitation. An account that may not open a
space sees an explanation on the welcome screen and a link to the repository.

## Consequences

- The source must hold no personal data: the demo data uses a neutral child, and the real data lives only in the
  database.
- The page itself is public on any host; the data is protected by sign-in and RLS, not by a hidden address.
- The site's Supabase URL and publishable key end up in the public build, which they are made for.
