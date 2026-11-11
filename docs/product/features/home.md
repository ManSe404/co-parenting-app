# Home

The first screen after sign-in (`src/components/Pocetna.svelte`; the rules in `napraviPregled`,
`src/lib/domen.ts`).

- **Urgent and important** at the top. An item is urgent when it carries the Hitno flag, or when it is not
  closed and its date is three days away or less, or past (`DANA_ZA_HITNO`).
- **What waits for whom**: the items on your turn and the items waiting for the other parent.
- **"Na tebi je"** (your turn): items, calendar proposals and proposals to delete a document for good that need
  your answer.
- **The board** as a strip with the number of items per column, and **the areas** with their open items.
- **Upcoming** ("Predstojeće"): items with a date in the next 14 days (`DANA_PREDSTOJECE`).
- **New since your last visit**: what the other parent created or wrote on items, and their changes to the
  record. The visit is recorded with `oznaci_posetu`.
- **Who has the child** and the next handover.

The order of the cards and their wording are drawn in [design/screens.md](../../design/screens.md) (section 4).
