# 0004. Sign-in with e-mail and password; the e-mail is the login name

## Status

Accepted, 2026-11-04; replaces "Google with an e-mail link as a fallback" (decision 3 of 2026-11-03). Written down
as an ADR on 2026-11-16 from [roadmap.md, section 6](../roadmap.md#6-data-and-technology-recommendation)
("Sign-in") and the list of differences in [roadmap.md](../roadmap.md#where-the-plan-and-the-code-differ).

## Context

The first plan signed in with Google, with an e-mail link as a fallback and no password. The later decision added
e-mail and password; the plan does not record why the e-mail link was dropped. A separate username was asked for.

## Decision

Accounts sign in with e-mail and password (at least 10 characters, letters and digits; the e-mail is confirmed by a
link; a forgotten password is reset by e-mail). The e-mail is the login name. Google sign-in is optional and stays
off until the owner of a copy creates an OAuth client. MFA with an authenticator app (TOTP) is optional, and when it
is on, a restrictive RLS policy lets data through only at `aal2`.

A separate username was not introduced: without an e-mail there is no password reset, and signing in with a
username would mean revealing somewhere which e-mail it belongs to.

## Consequences

- A hosted copy needs its own SMTP server, because Supabase's built-in sender mails only the project's team.
- There is no e-mail link (passwordless) sign-in.
