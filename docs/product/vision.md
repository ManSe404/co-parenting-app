# Vision

## Why it exists

Two parents who look after one child separately still decide many things together: school, health,
activities, and who has the child when. In a chat those decisions get lost, and one parent can change a plan
alone. This app gives both parents one place where every topic has a clear state, every decision stays written
down, and nothing that concerns both changes without the other parent's consent.

The database enforces that rule, not only the screens: closing an item, every change to the calendar,
deleting a document for good and deleting the family space all need the other parent.

## For whom

- The two parents of one child, with the same rights. A family space holds two parents (one in the role
  `tata`, one in the role `mama`) and one child. There is no admin.
- Anyone who wants their own copy for their family. The code is public under the MIT licence, and a copy runs
  on a free Supabase project and a static host ([operations/deployment.md](../operations/deployment.md)). The
  owner of a copy can limit who may open a family space on it.

The interface is in Serbian (Latin script). Its words are explained in the [glossary](glossary.md).

## What it does

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

## Principles

- Nobody changes alone what concerns both parents.
- Nothing is lost quietly: a closed item stays, every edit of an item goes into its thread, every change to the
  record keeps the old and the new value, and a deleted document waits in the trash.
- The same rights for both parents.
- Private by default: a parent reads only their own family's data, and with MFA turned on only after the second
  step. There is no analytics or tracking. The child's name is never shown.
- Simple to use on a phone and on a computer.

## What it is not

- Not a chat: each item is one topic with a state and, at the end, a decision.
- Not a server application: a static site whose browser code talks to Supabase directly. There is no backend of
  its own ([architecture/overview.md](../architecture/overview.md)).
- Not for several children or households: one family space is two parents and one child.
- Not a ledger of shared expenses: that phase is optional and not built ([roadmap.md](../roadmap.md)).

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
