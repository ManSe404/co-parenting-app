# Documentation

The app is a shared space for two separated parents of one child, where anything that concerns both needs the
other parent's consent and the database enforces it.

Read in this order:

| # | Document | What it answers | Status | Last checked |
|---|---|---|---|---|
| 1 | [product/vision.md](product/vision.md) | the problem, how the app solves it, why this way, for whom, what it is not, how we know it works | current | 2026-11-16 |
| 2 | [product/features/README.md](product/features/README.md) | every feature, its status and where it lives in the code | current | 2026-11-16 |
| 3 | [product/glossary.md](product/glossary.md) | the Serbian words of the screens, the code and the database | current | 2026-11-16 |
| 4 | [product/features/home.md](product/features/home.md) | what the home screen shows | current | 2026-11-16 |
| 5 | [product/features/items.md](product/features/items.md) | items, their states, the board, the list and the history | current | 2026-11-16 |
| 6 | [product/features/calendar.md](product/features/calendar.md) | stays, activities, and why every change is a proposal | current | 2026-11-16 |
| 7 | [product/features/record.md](product/features/record.md) | the child's record and its change log | current | 2026-11-16 |
| 8 | [product/features/documents.md](product/features/documents.md) | documents, the trash, deleting for good | current | 2026-11-16 |
| 9 | [product/features/accounts.md](product/features/accounts.md) | sign-in, MFA, the family space, the invitation, profiles | current | 2026-11-16 |
| 10 | [product/features/notifications.md](product/features/notifications.md) | e-mail notifications and live updates | current | 2026-11-16 |
| 11 | [product/features/privacy.md](product/features/privacy.md) | the privacy page, export, deleting a family space or an account | current | 2026-11-16 |
| 12 | [design/screens.md](design/screens.md) | how the screens were planned, with the look and the navigation as built | current | 2026-11-16 |
| 13 | [roadmap.md](roadmap.md) | phases and their status, what is not built, structural work in priority order, where the plan and the code differ, the plan's data, tests and decisions | current | 2026-11-16 |
| 14 | [architecture/overview.md](architecture/overview.md) | how it is built: context, building blocks, flows, data, deployment | current | 2026-11-16 |
| 15 | [architecture/crosscutting.md](architecture/crosscutting.md) | security, privacy, errors, observability | current | 2026-11-16 |
| 16 | [adr/](#decisions) | the decisions whose reasons are recorded, one per file | current | 2026-11-16 |
| 17 | [diagrams/context.md](diagrams/context.md) | who uses it and which outside systems it talks to | current | 2026-11-16 |
| 18 | [diagrams/container.md](diagrams/container.md) | the parts that run and how they talk | current | 2026-11-16 |
| 19 | [diagrams/proposal-flow.md](diagrams/proposal-flow.md) | a calendar proposal from one parent to the other | current | 2026-11-16 |
| 20 | [diagrams/notification-flow.md](diagrams/notification-flow.md) | a change becoming an e-mail | current | 2026-11-16 |
| 21 | [reference/codebase.md](reference/codebase.md) | the map of the code | current | 2026-11-16 |
| 22 | [reference/services/site.md](reference/services/site.md) | the static site: what it does, how to run it, its contracts | current | 2026-11-16 |
| 23 | [reference/services/database.md](reference/services/database.md) | the Supabase schema and rules: running, testing, deploying, contracts | current | 2026-11-16 |
| 24 | [reference/services/obavestenja.md](reference/services/obavestenja.md) | the Edge Function that sends e-mail: request, answers, secrets | current | 2026-11-16 |
| 25 | [reference/data-model.md](reference/data-model.md) | tables, functions, triggers, storage, Realtime, schedules | current | 2026-11-16 |
| 26 | [reference/configuration.md](reference/configuration.md) | every setting by name and where it is set | current | 2026-11-16 |
| 27 | [guides/setup.md](guides/setup.md) | running the demo and the local database | current | 2026-11-16 |
| 28 | [guides/development.md](guides/development.md) | checks, how the code is organised, conventions | current | 2026-11-16 |
| 29 | [operations/deployment.md](operations/deployment.md) | deploying your own copy and checking it | current | 2026-11-16 |

## Decisions

| ADR | Decision | Status |
|---|---|---|
| [0001](adr/0001-supabase-as-the-backend.md) | Supabase as the backend, with no server of our own | accepted |
| [0002](adr/0002-consent-rules-in-the-database.md) | the consent rules are enforced by the database | accepted |
| [0003](adr/0003-family-space-and-invitation.md) | a family space and an invitation instead of a list of allowed e-mails | accepted |
| [0004](adr/0004-email-is-the-login-name.md) | sign-in with e-mail and password; the e-mail is the login name | accepted |
| [0005](adr/0005-public-code-private-copy.md) | public code under MIT, with a private hosted copy | accepted |
| [0006](adr/0006-record-edited-directly-with-a-log.md) | the record is edited directly, with a change log | accepted |

Open decisions are under "Open" in [roadmap.md](roadmap.md#open) and
[architecture/overview.md](architecture/overview.md#open).

Next to the code, in Serbian: [supabase/README.md](../supabase/README.md) (the database folder) and
[supabase/functions/obavestenja/README.md](../supabase/functions/obavestenja/README.md) (setting up the sender).

**Layout.** product/ holds the why and the what, design/ the screens, roadmap.md the phases, architecture/ how it
is built, adr/ the decisions, diagrams/ the Mermaid diagrams, reference/ what exists (with services/ for the three
parts deployed separately), guides/ how to work on it and operations/ how to run a copy. Some documents end with the
original plan text, translated from Serbian. A change updates the documents it makes wrong in the same commit.
