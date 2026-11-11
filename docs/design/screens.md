# Screens

The screens as the plan drew them: the home screen (section 4) and every other screen (section 5), translated from
Serbian below. The code follows them, with the differences listed in
[roadmap.md](../roadmap.md#where-the-plan-and-the-code-differ). What each screen does is described under
[product/features/](../product/features/).

The interface is in Serbian. A label the app shows is written here as it appears in the app, in quotes, with an
English gloss the first time it comes up; the words the code and the database share are in the
[glossary](../product/glossary.md).

As built:

- Navigation: "Početna" (home), "Stavke" (items), "Kalendar" (calendar), "Karton" (record) and "Dokumenti"
  (documents). On a phone they are icons in a bottom bar, on a computer links in the top bar. Settings open from
  the round initial at the top right.
- The look follows the author's website: Space Grotesk and DM Mono (bundled through `@fontsource`), a dark
  background with teal and violet accents, and a light theme that follows the device setting
  (`src/styles/global.css`). The two parents have fixed colours: teal (`bio`) and violet (`ai`).

## Original plan text

Sections 4 and 5 of the original plan, translated from Serbian. A date in brackets is the day a decision was added
to the plan.

### 4. Home (dashboard)

The drawing is translated:

```
┌────────────────────────────────────────────────────────────────┐
│ Tuesday, 3 November                                            │
│ WAITS FOR YOU 2  ·  WAITS FOR MUM 1  ·  NEW SINCE LAST VISIT 3 │
├────────────────────┬────────────────────┬──────────────────────┤
│ UNANSWERED     3   │ OPEN       5       │ CLOSED (30 d)     4  │
├────────────────────┴──────┬─────────────┴──────────────────────┤
│ URGENT                    │ IMPORTANT                          │
│ · Trip permission   ⏱ 2d  │ · Summer holiday: dates            │
│ · Doctor's check-up       │ · Swimming sign-up                 │
├─────────────┬─────────────┼──────────────┬─────────────────────┤
│ SCHOOL    3 │ HEALTH    2 │ ACTIVITIES 1 │ CHILD'S NEEDS 2     │
│ two items   │ two items   │ one item     │ two items           │
├─────────────┴─────────────┴──────┬───────┴─────────────────────┤
│ UPCOMING (14 days)               │ NEW SINCE LAST VISIT        │
│ Thu 5.11  parents' meeting       │ mum: replied to "Jacket"    │
│ Mon 9.11  due: trip permission   │ mum: new item "Trip"        │
└──────────────────────────────────┴─────────────────────────────┘
```

In the app the same places read "čeka tebe" (waits for you), "čeka mamu" (waits for mum), "novo" (new), "Hitno"
(urgent), "Važno" (important), "Predstojeće" (upcoming) and "Novo od poslednje posete" (new since your last visit);
the states and the areas carry the labels listed in the [glossary](../product/glossary.md#3-terms).

Order (2026-11-03), the same on a phone and on a computer: **"Hitno" + "Važno"** at the top → "čeka tebe" /
"čeka mamu" / "novo" → "Na tebi je" (your turn) → "Tabla" (the board, as a strip with the number of items per
column) → the areas → "Predstojeće" → "Novo od poslednje posete". "Hitno" must always be visible: a red border and
a countdown to the deadline ("kasni 1 dan", one day late; "danas", today; "za 2 dana", in 2 days). An empty "Hitno"
becomes a calm grey card.

The home screen speaks like a person: a greeting for the time of day, the child's name, and one sentence instead of
a wall of numbers ("Dve stvari su hitne. Na tebi su tri teme.": two things are urgent, three topics are on you).
The areas have icons and a colour of their own.

**From the brief:** "Neodgovoreno", "Otvoreno", "Zatvoreno" (the states); "Važno", "Hitno" (the flags); "Škola",
"Zdravlje", "Vanškolske aktivnosti", "Detetove potrebe" (four of the areas).

**Proposed additions:**

| # | Addition | What it gives | Phase |
|---|---|---|---|
| 1 | Waits for you / waits for the other parent | splits the unanswered items by whose turn it is; the most useful number on the screen | v1 |
| 2 | Upcoming (14 days) | item deadlines and appointments: check-ups, parents' meetings, competitions | v1 |
| 3 | New since the last visit | what the other parent added or answered since your last visit | v1 |
| 4 | The child's record | standing facts: paediatrician, school and class teacher, coaches, allergies and therapy, clothing and shoe sizes | v1, as the record (2026-11-04), section 5 |
| 5 | Who has the child + the next handover | the schedule of stays | v1, as the calendar (2026-11-04), section 5 |
| 6 | Shared expenses | who paid for what, and the balance | v3, only if both parents want it |

### 5. Screens

- **Home**: section 4.
- **Items: board** ("Tabla", the default). Three columns: **"Stavke"** (items: unanswered), **"Aktivno"** (active:
  open) and **"Rešeno"** (resolved: closed, plus proposals waiting for confirmation). Cards are dragged left and
  right: with the mouse at once, and on a phone after a short press of the finger, so that a plain swipe still
  scrolls. What a drag means:

  | From → to | What happens |
  |---|---|
  | Stavke → Aktivno | moves the item to Aktivno, with an optional note (for example "we talked on the phone") |
  | Stavke or Aktivno → Rešeno | a proposal to close: it asks for the decision, and the other parent confirms |
  | Rešeno (your own proposal) → Aktivno | withdraws the proposal |
  | Rešeno (the other parent's proposal) → Aktivno | declines the proposal, with a reason |
  | Rešeno (closed) → Aktivno | reopens the item, with a reason |
  | anything → Stavke | not allowed; a message explains why |

  A proposal that waits for your confirmation has the buttons **"Potvrdi"** (confirm) and **"Odbij"** (decline) on
  its card. Rešeno shows the last 30 days; older items are in the list.
- **Calendar** ("Kalendar", 2026-11-04), in the style of Google Calendar. It holds who the child is with and the
  child's activities.
  - **Views:** "Dan" (day) · "Nedelja" (week) · "Mesec" (month) · "Raspored" (schedule). On a phone the week is 3
    days. The arrows ‹ › move by a day, a week or a month. "Danas" (today) works in every view: it goes back to
    today and scrolls the hours to the current time. A click on a day in the week's header opens that day. The
    chosen view is remembered on the device.
  - **Who has the child:** every day is coloured in the colour of the parent (dad teal, mum violet, like the two
    dots in the logo). One-off changes are hatched.
  - **Handover:** a tile "⇄ 15:00 · Ide kod tate" (goes to dad's) with "ti preuzimaš" (you take over) or
    "preuzima mama" (mum takes over), highlighted when you are the one who takes over. The wording was chosen to say
    what happens to the child ("ide kod tate") rather than sound like an official record ("primopredaja", handover).
    The same text is at the top of the calendar, in the schedule and on the home screen
    ("Danas u 15:00 ide kod tate · ti preuzimaš": today at 15:00 goes to dad's, you take over). In the month view it
    is the mark "⇄ 15:00".
  - **Activities:** "Trening" (training), "Rođendan" (birthday), "Škola" (school), "Lekar" (doctor), "Ostalo"
    (other), each with a colour of its own that does not mix with the parents' colours. An activity lasts one day
    (all day, or from a time to a time) and can repeat every week or every other week, on chosen days, until a
    date. It also has the fields "Ko vodi" (who takes the child), place and note. In the week and day views
    activities are blocks on the hours; overlapping ones share the width, and a click opens the details. A click
    on an empty spot proposes an activity at that time. Items with a date sit in the "ceo dan" (all day) row.
  - **Dragging** ("of course every change waits for confirmation"):
    - an activity is dragged to another day or hour (week and day views) or to another day (month view). For a
      repeating one you choose "Samo ovaj put" (just this once: the series skips that day, and a one-off activity
      takes its place) or "Svaki put" (every time: it changes the weekday and the time of the series);
    - the handover tile is dragged up or down, and so proposes another time on that day. That is a one-off change
      for the difference in time, and the regular schedule stays the same;
    - with the mouse at once, with a finger after a short press. While you drag, a dashed frame shows where the
      activity or the handover will land and at what time;
    - when you let go, "Bilo / Postaje" (was / becomes) pops up with a message. Nothing changes until the other
      parent accepts.
  - **Nobody changes the calendar alone.** This holds for stays and for activities. Adding, changing, deleting and
    dragging are requests that the other parent accepts. Until they do, nothing changes: the proposal is dashed,
    and a day with a proposal has an orange frame. The proposer cannot accept their own request, only withdraw it.
    Declining needs a reason. Everything stays in "Istorija promena" (history of changes).
  - **A stay has two layers:** the regular schedule (which can repeat) and one-off changes, which apply over the
    regular one. Stays of the same layer do not overlap, and this is checked again on acceptance.
  - Proposals that wait for you go into "čeka tebe" and "Na tebi je" on the home screen.
- **Record** ("Karton", 2026-11-04): the child's standing facts.
  - Layout: the header holds the name, the age and the basic facts (date of birth, full name). Below are **"Škola"**
    (school) · **"Zdravlje"** (health), then **"Važni kontakti"** (important contacts) · **"Mere i veličine"**
    (measures and sizes), then across the full width **"Raspored časova"** (school timetable) and **"Drugari"**
    (friends). **"Vanškolske aktivnosti"** (activities outside school) are at the bottom, across the full width, as
    cards side by side. Each activity also shows "U kalendaru: …" (in the calendar: …) if the calendar has an
    activity of the same name. A separate page for activities was not made: the bottom bar on a phone already has
    five icons, and the times are in the calendar.
  - Groups of single facts: "Škola", "Zdravlje", "Mere i veličine", "Osnovno" (basic facts). In "Škola",
    "Mere i veličine" and "Osnovno" the app offers the missing fields as buttons ("+ Visina", + height).
    **"Zdravlje"** (2026-11-04) has only "+ Dodaj" (+ add), and the suggestions ("Pedijatar", paediatrician;
    "Alergije", allergies; "Vakcine", vaccines …) are offered only while the name is typed.
  - **"Škola"** also has a list, **"Nastavnici"** (teachers: name, subject or role, contact, note), with
    "+ Dodaj nastavnika" (+ add a teacher), as many as needed. The earlier field for the class teacher was
    removed.
  - **"Raspored časova"** is a card of its own (2026-11-04). It can be:
    - typed in by hand into a table of days × lessons, with lessons added and removed, and a note (for example
      shifts);
    - imported from Excel (.xlsx, the first sheet) or CSV. The separators `;` and `,` are recognised, day names in
      Latin, Cyrillic or English, days in columns or in rows, and lessons written as "1." or "8:00–8:45". The
      imported table is reviewed and corrected before it is saved. Excel is read without an extra library;
    - photographed or uploaded as a picture, which is shrunk before it is saved and opens enlarged.

    On a computer it is the whole table with today highlighted. On a phone there are buttons for the days and the
    list of that day's lessons. Changes go into "Promene u kartonu" (changes in the record). In the database the
    picture goes to private storage (like the documents), not into the table.
  - **"Drugari"** (2026-11-04): a friend, their parent, the parent's phone (a click calls) and a note.
  - List groups: **"Vanškolske aktivnosti"** and **"Važni kontakti"**. There can be as many entries as needed.
    Each activity is a card with its times, place, coach or contact and note, and each contact has a phone and a
    note.
  - Both parents edit directly, without confirmation, but every change remembers who, when, the old and the new
    value ("Promene u kartonu"). The other parent sees it on the home screen under "Novo od poslednje posete".
  - While one edit is open, the other buttons are locked, so that typed text is not lost.
  - The age is computed from the date of birth.
- **History of agreements** ("Istorija dogovora"; 2026-11-04: it belongs to the items, not to the record): the
  third view on the "Stavke" screen ("Tabla" · "Lista" · "Istorija": board, list, history). It holds every closed
  item with its agreement, by month and newest first, with who asked and who confirmed. It has an area filter,
  search and CSV export. "Starije rešene" (older resolved items) on the board leads here.
- **Documents** ("Dokumenti"; 2026-11-04: a page of its own next to "Karton"): certificates, medical findings,
  receipts, scans. Cards with a thumbnail, name, category and date; search and a category filter ("Škola",
  "Zdravlje", "Vanškolske" (activities outside school), "Lična dokumenta" (personal documents), "Pravno i dogovori"
  (legal and agreements), "Računi" (receipts), "Ostalo"). Adding: on a phone "Slikaj" (take a photo) or picking a
  file, on a computer also dragging it in. Viewing: a picture or a PDF in the app (on a phone a PDF opens in a new
  tab), "Otvori" (open), "Preuzmi" (download), "Izmeni" (edit), "Obriši" (delete), and the trail of who did what.
  Deleted documents wait in the section "Obrisani" (deleted), from where either of you restores them. A document the
  other parent added since your last visit carries the mark "novo".
- **Parent profile** (2026-11-04; migration `20261104040000_profil_roditelja.sql`): in the settings
  ("Podešavanja", the round initial at the top right, also in the demo) each parent edits their own profile: name
  and surname, phone, address (where the child stays with you, for handovers), a contact e-mail and a note (for
  example working hours). The other parent sees it; the phone is a call link, the address opens a map, the e-mail
  opens mail. In the database these are columns in `roditelj`, changed only through `sacuvaj_profil`, which touches
  only your own row. The roles "Tata" (dad) and "Mama" (mum) and their case forms stay fixed.
- **Navigation:** "Početna" · "Stavke" · "Kalendar" · "Karton" · "Dokumenti". On a phone these are icons in a
  bottom bar, as in apps, and the logo and "+ Nova" (+ new) stay at the top. On a computer everything is in the
  top bar.
- **Items: list** ("Lista"): filters by state, area, flag and "Čeka mene" (waits for me); search; CSV export. The
  switch between "Tabla" and "Lista" remembers the choice on the device.
- **Item**: the description, the replies in time order, the history of edits, and the buttons to reply, to propose
  closing ("Predloži zatvaranje"), to confirm closing ("Potvrdi i zatvori" in the app) and to reopen
  ("Ponovo otvori").
- **New item**: title, area, flags, deadline (optional), description. On a phone it should take less than half a
  minute.
- **Sign-in**: a button to sign in with Google, and an e-mail link below it. No password.
