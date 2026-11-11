# Calendar

Who the child is with, and the child's activities (`src/components/Kalendar.svelte`; the rules in
`src/lib/kalendar.ts` and `src/lib/dogadjaji.ts`).

## Stays

- A stay (boravak) is a period when the child is with one parent. There are two layers: the regular schedule
  (redovno) and one-off changes (izuzetak), which win over the regular schedule for their time span. Stays of
  the same layer do not overlap.
- Times are local wall-clock strings (`YYYY-MM-DDTHH:mm`): both parents live in one time zone.
- Each day takes the colour of the parent who has the child. A handover reads "ide kod tate" (goes to dad's) or
  "ide kod mame" (goes to mum's), with who takes the child.

## Activities

An activity (dogadjaj) is a training, a birthday, a school event, a doctor's visit or something else. It sits on
one day, all day or from a time to a time, and can repeat weekly or every other week on chosen weekdays, until a
date. It can name the parent who takes the child, the place and a note.

## Nobody changes the calendar alone

- Adding, changing, deleting and dragging a stay or an activity make a request (zahtev kalendara). Nothing
  changes until the other parent accepts it. The proposer can withdraw it, never accept it. Declining needs a
  reason.
- Dragging a repeating activity asks "Samo ovaj put" (just this once: the series skips that day and a one-off
  activity takes its place) or "Svaki put" (every time: the series moves).
- Dragging a handover proposes another time on that day, as a one-off change; the regular schedule stays.
- The database enforces the same. `boravak` and `dogadjaj` have no write policy. Requests come in through
  `predlozi_kalendar` and `predlozi_dogadjaj`; only `prihvati_zahtev` writes the calendar, after checking that
  the other parent accepts and checking overlaps again. `odbij_zahtev` and `povuci_zahtev` close a request. A
  request keeps only the fields the other parent is shown.
- Requests that wait for you show on the home screen under "Na tebi je" (your turn). The flow is drawn in
  [diagrams/proposal-flow.md](../../diagrams/proposal-flow.md).

## Views

Day, week (three days on a phone), month and schedule (Raspored). The chosen view is remembered on the device.
The screens are drawn in [design/screens.md](../../design/screens.md) (section 5).
