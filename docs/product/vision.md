# Vision

## The problem or opportunity

Two parents who look after one child separately still decide many things together: school, health, activities
outside school, the child's needs, and who has the child when. In a chat those decisions get lost, and one parent
can change a plan alone. What the plan asks for shows what a chat lacks: one topic with a clear state, whose turn
it is always visible, and the decision written down when the topic closes
([original plan, section 1](#1-what-we-are-building); [glossary, section 3](glossary.md#3-terms)). The plan also
asks for one place for what both parents need at hand: the standing facts about the child (the paediatrician, the
school and the teachers, the coaches, allergies and therapy, clothing and shoe sizes) and the documents
(certificates, medical findings, receipts, scans).

It concerns both parents equally. The plan keeps every closed item and remembers who changed what and when,
because "this protects both parents equally" ([original plan, section 2](#2-principles)).

The opportunity: such a place can run on free services, a static host and a free Supabase project, and with public
code any family can run its own copy ([roadmap.md](../roadmap.md#goal),
[operations/deployment.md](../operations/deployment.md)).

How we know: the case is one family. The plan was written for the owner's copy, which "is only for his family"
([roadmap.md, section 6](../roadmap.md#6-data-and-technology-recommendation)), and it keeps the words of the brief
it started from: the states, the flags and the areas ([design/screens.md](../design/screens.md#4-home-dashboard),
"From the brief").

- Open: the repository holds no number: how often a decision got lost or a plan was changed alone before the app,
  or how many other families have the same problem.
- Open: no outside source (research, interviews with other parents) backs the problem.

## How we solve it

One shared space per family, for the two parents and their child, where every topic has a clear state, every
decision stays written down, and nothing that concerns both changes without the other parent's consent. The
database enforces that rule, not only the screens: closing an item, every change to the calendar, deleting a
document for good and deleting the family space all need the other parent. The record is a deliberate exception:
either parent edits it directly, and every change is logged.

What a parent does differently afterwards:

- Instead of asking in a chat, they open an item: one topic with an area, flags and an optional deadline. The other
  parent answers in its thread, and the item closes only with a written decision that the other parent confirms.
  What was agreed is found later in the history of agreements, not by scrolling back through messages.
- Instead of announcing a change to who has the child, or to an activity, they propose it in the calendar. Nothing
  changes until the other parent accepts.
- Instead of asking the other parent for a phone number, a size or a finding, they look in the record and the
  documents.
- They start from the home screen, which shows what is urgent, what waits for them and what waits for the other
  parent, who has the child, and what the other parent did since their last visit. An e-mail tells them when the
  other parent did something (at once, once a day, or never, as each parent chooses), and open screens update
  live.

The parts of the app:

- [Home](features/home.md): what is urgent, what waits for whom, who has the child, what is new.
- [Items](features/items.md): questions and topics with a state, closed by a decision both parents confirm.
- [Calendar](features/calendar.md): who has the child and the child's activities; every change is a proposal.
- [Record](features/record.md): the child's standing facts, every change logged.
- [Documents](features/documents.md): files in private storage; deleting one for good needs both parents.
- [Accounts and the family space](features/accounts.md): sign-in, MFA, the invitation, parent profiles.
- [Notifications](features/notifications.md): e-mail about the other parent's changes, and live updates.
- [Privacy and deletion](features/privacy.md): what is kept, who sees it, how a family space is deleted.

A demo runs on example data in the browser, with no account: `?demo=1` on a copy with a database, or any
build without Supabase settings.

## Why this way

The options the plan and the code weighed, and why they lost:

| Option | Why it lost | Where it is recorded |
|---|---|---|
| Keep deciding in a chat | A message has no state and no decision at the end, so decisions get lost. The plan's answer: "This is not a chat. Every item is one topic with a clear state." | [original plan, section 1](#1-what-we-are-building) |
| A Google Sheet with Apps Script | The sheet opens directly, but edits in it bypass the app's rules (states, history, confirmation of closing), the app is slower, and it is hard to make it look like the website. A one-way, read-only copy to a sheet may come later; the sheet is never a source of data. | [roadmap.md, section 6](../roadmap.md#6-data-and-technology-recommendation) and [section 9](../roadmap.md#9-decisions) |
| Rules in the screens only | A changed client could skip them. Every write therefore goes through a database function that checks who is asking, and no table has a write policy for clients. | [architecture/overview.md](../architecture/overview.md#goals-and-constraints) |
| A server of our own | The goal is free to run with no server to look after. Supabase plays the backend: RLS policies for access, constraints and triggers for the business rules, an Edge Function for e-mail. | [roadmap.md, section 6](../roadmap.md#6-data-and-technology-recommendation), [architecture/overview.md](../architecture/overview.md#goals-and-constraints) |
| A list of two allowed e-mail addresses | Replaced by a family space and an invitation link: the other parent's e-mail is not needed in advance, and one copy can serve other families, each in its own space. | [roadmap.md, sections 6 and 9](../roadmap.md#9-decisions) |
| Consent for every change to the record as well | The record is a shared notebook, not a decision. Either parent edits it directly, and a database trigger logs who changed what, with the old and the new value. | [features/record.md](features/record.md) |

- Open: which host serves the owner's copy. The plan chose Cloudflare Pages, so that the app does not share the
  `github.io` origin and the sign-in kept in the browser with the owner's other sites; the workflow and the README
  use GitHub Pages ([roadmap.md](../roadmap.md#open), [architecture/overview.md](../architecture/overview.md#open)).
- Open: there are no ADRs yet (`docs/adr/` does not exist). The decisions above are recorded only in the plan
  ([roadmap.md, section 9](../roadmap.md#9-decisions)).

## For whom

Who uses it:

- The two parents of one child, with the same rights. A family space holds two parents (one in the role
  `tata`, one in the role `mama`) and one child. There is no admin.
- Anyone who wants their own copy for their family. The code is public under the MIT licence, and a copy runs
  on a free Supabase project and a static host ([operations/deployment.md](../operations/deployment.md)).

The interface is in Serbian (Latin script). Its words are explained in the [glossary](glossary.md).

Who decides:

- Inside a family, the two parents together: everything that concerns both (above), deleting the family space,
  and whether the optional shared expenses (F3) are built at all, "only if both parents want them"
  ([roadmap.md](../roadmap.md#phases)).
- On a copy, its owner: the person who deploys it and creates the Supabase project. They are the database's
  administrator and so technically can read its data (the privacy page, `src/pages/privatnost.astro`). They choose
  the region where the data is stored, who may open a family space (the table `dozvoljeni_osnivac`), and whether
  e-mail notifications and Google sign-in are set up.
- About the code and the plan, the repository owner. The questions still open are under "Open" in
  [roadmap.md](../roadmap.md#open).

## What it is not

- Not a chat: each item is one topic with a state and, at the end, a decision.
- Not a server application: a static site whose browser code talks to Supabase directly. There is no backend of
  its own ([architecture/overview.md](../architecture/overview.md)).
- Not for several children or households: one family space is two parents and one child, and one account belongs
  to one space.
- Not for parents in different time zones: calendar times are local wall-clock times
  ([features/calendar.md](features/calendar.md)).
- Not a ledger of shared expenses: that phase is optional and not built ([roadmap.md](../roadmap.md)).
- Not a backup: only the item list and the history of agreements export, as CSV. The weekly automatic export that
  would also be a backup, and keep a free Supabase project from pausing after a week without activity, is not
  built ([roadmap.md](../roadmap.md#later-or-not-built)).
- Not an app installed on the phone: there is no web app manifest and no service worker. Whether to build it is
  open ([roadmap.md](../roadmap.md#open)).

## How we know it works

**That the rules hold.** The app works when nobody can change alone what concerns both parents and nobody outside
a family reads its data. Checks in the repository measure that ([guides/development.md](../guides/development.md);
what each one covers is listed in [roadmap.md, section 8](../roadmap.md#8-tests)):

| What it measures | Command | Where |
|---|---|---|
| The rules in the database: closing an item, the calendar, deleting a document for good, deleting a family space, the family space and the invitation, MFA, documents, profiles, notifications, who may open a space | `npm run test:baza` (needs `npm run baza`) | `supabase/tests/` |
| The same rules in the app | `npm test` | `src/lib/*.test.ts` |
| The flows in a browser: the demo, and two real accounts in separate browsers | `npm run smoke`, `npm run smoke:nalog` | `scripts/` |
| Types and components, with no errors and no warnings | `npm run check` | |

No CI runs these checks: the only workflow is the optional GitHub Pages deploy. They run only by hand, and
[guides/development.md](../guides/development.md) asks for them before a commit.

Not covered by a check in the repository:

- Live updates: the local database runs without Realtime, so they are covered by reading the policies and by the
  RLS tests, not by a live run.
- The e-mail sender (`supabase/functions/obavestenja/`): the plan records a run through Node with a fake `fetch`,
  but no such test is in the repository.
- A running copy: the app has no logging or monitoring of its own. What there is to look at is in
  [operations/deployment.md](../operations/deployment.md#checking-a-running-copy).

**That it solves the problem.** Not measured.

- Open: no measure says whether decisions stop getting lost, or whether both parents keep using the app. The plan
  names the risk ("without notifications an app like this is easily forgotten. If after F1 it turns out that the
  other parent does not open it regularly, notifications come next", [roadmap.md, section 7](../roadmap.md#7-phases)),
  but nothing measures it. The database keeps each parent's last visit (`roditelj.poslednja_poseta`), and nothing
  turns it into a measure.

## Principles

- Nobody changes alone what concerns both parents.
- Nothing is lost quietly: a closed item stays, every edit of an item goes into its thread, every change to the
  record keeps the old and the new value, and a deleted document waits in the trash.
- The same rights for both parents.
- Private by default: a parent reads only their own family's data, and with MFA turned on only after the second
  step. There is no analytics or tracking. The child's name is never shown.
- Simple to use on a phone and on a computer.

## Original plan text

Sections 1 and 2 of the original plan, translated from Serbian. Where the plan and the code differ, the code and
the text above are right; the differences are listed in
[roadmap.md](../roadmap.md#where-the-plan-and-the-code-differ).

### 1. What we are building

One shared place for both parents of one child. Here questions are asked, answers and decisions are written down,
and everything about school, health, activities outside school and the child's needs is followed. Only the two
parents have access, and both have the same rights.

This is not a chat. Every item is one topic with a clear state: waiting for an answer, being agreed on, or
resolved. When a topic is closed, the decision stays written down.

### 2. Principles

- **Simple.** There are three main screens: home (the dashboard), the list of items and a single item. On a phone
  it installs as an app (PWA).
- **Nothing is deleted.** An item is closed, not deleted. Every change remembers who made it and when. This
  protects both parents equally.
- **The same rights.** The app has no admin.
- **Designed like the website.** The same tokens as manse404.github.io/webpage: Space Grotesk + DM Mono, a dark
  background, teal and violet accents, cards with a thin border, chips, small mono captions above sections. No
  animated background. Next to the dark theme there is a light theme that follows the phone's setting.
- **Privacy.** Data about the child, health included, is stored in the EU. Only two accounts have access. There is
  no analytics or tracking.
