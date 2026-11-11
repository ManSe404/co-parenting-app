# Documentation

The app is a shared space for two separated parents of one child, where anything that concerns both needs the
other parent's consent and the database enforces it.

Read in this order:

| # | Document | What it answers | Status | Last checked |
|---|---|---|---|---|
| 1 | [product/vision.md](product/vision.md) | why the app exists, for whom, what it is not | current | 2026-11-11 |
| 2 | [product/glossary.md](product/glossary.md) | the Serbian words of the screens, the code and the database | current | 2026-11-11 |
| 3 | [product/features/home.md](product/features/home.md) | what the home screen shows | current | 2026-11-11 |
| 4 | [product/features/items.md](product/features/items.md) | items, their states, the board, the list and the history | current | 2026-11-11 |
| 5 | [product/features/calendar.md](product/features/calendar.md) | stays, activities, and why every change is a proposal | current | 2026-11-11 |
| 6 | [product/features/record.md](product/features/record.md) | the child's record and its change log | current | 2026-11-11 |
| 7 | [product/features/documents.md](product/features/documents.md) | documents, the trash, deleting for good | current | 2026-11-11 |
| 8 | [product/features/accounts.md](product/features/accounts.md) | sign-in, MFA, the family space, the invitation, profiles | current | 2026-11-11 |
| 9 | [product/features/notifications.md](product/features/notifications.md) | e-mail notifications and live updates | current | 2026-11-11 |
| 10 | [product/features/privacy.md](product/features/privacy.md) | the privacy page, export, deleting a family space or an account | current | 2026-11-11 |
| 11 | [design/screens.md](design/screens.md) | how the screens were planned, with the look and the navigation as built | current | 2026-11-11 |
| 12 | [roadmap.md](roadmap.md) | phases and their status, what is not built, where the plan and the code differ, the plan's data, tests and decisions | current | 2026-11-11 |
| 13 | [architecture/overview.md](architecture/overview.md) | how it is built: context, building blocks, flows, data, deployment | current | 2026-11-11 |
| 14 | [architecture/crosscutting.md](architecture/crosscutting.md) | security, privacy, errors, observability | current | 2026-11-11 |
| 15 | [diagrams/context.md](diagrams/context.md) | who uses it and which outside systems it talks to | current | 2026-11-11 |
| 16 | [diagrams/container.md](diagrams/container.md) | the parts that run and how they talk | current | 2026-11-11 |
| 17 | [diagrams/proposal-flow.md](diagrams/proposal-flow.md) | a calendar proposal from one parent to the other | current | 2026-11-11 |
| 18 | [diagrams/notification-flow.md](diagrams/notification-flow.md) | a change becoming an e-mail | current | 2026-11-11 |
| 19 | [reference/codebase.md](reference/codebase.md) | the map of the code | current | 2026-11-11 |
| 20 | [reference/data-model.md](reference/data-model.md) | tables, functions, triggers, storage, Realtime, schedules | current | 2026-11-11 |
| 21 | [reference/configuration.md](reference/configuration.md) | every setting by name and where it is set | current | 2026-11-11 |
| 22 | [guides/setup.md](guides/setup.md) | running the demo and the local database | current | 2026-11-11 |
| 23 | [guides/development.md](guides/development.md) | checks, how the code is organised, conventions | current | 2026-11-11 |
| 24 | [operations/deployment.md](operations/deployment.md) | deploying your own copy and checking it | current | 2026-11-11 |

Open decisions are under "Open" in [roadmap.md](roadmap.md#open) and
[architecture/overview.md](architecture/overview.md#open).

Next to the code, in Serbian: [supabase/README.md](../supabase/README.md) (the database folder) and
[supabase/functions/obavestenja/README.md](../supabase/functions/obavestenja/README.md) (setting up the sender).

**Layout.** product/ holds the why and the what, design/ the screens, roadmap.md the phases, architecture/ how it
is built, diagrams/ the Mermaid diagrams, reference/ what exists, guides/ how to work on it and operations/ how to
run a copy. Some documents end with the original plan text, translated from Serbian. A change updates the documents
it makes wrong in the same commit.
