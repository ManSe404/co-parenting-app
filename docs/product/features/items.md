# Items

An item (stavka) is one question or topic between the parents, with a clear state. It is not a chat: the thread
under an item is the record of how it was decided.

## Rules

- Each item has a state (unanswered, open, closed), exactly one area (school, health, activities outside
  school, the child's needs, other), two optional flags (important, urgent) and an optional date, a deadline or
  an appointment.
- A new item is unanswered and waits for the other parent. When the other parent replies, it becomes open.
- Closing needs a written decision. One parent proposes the closing; the other confirms it, or declines with a
  reason. The proposer can withdraw the proposal. A closed item can be reopened with a reason.
- A closed item, or one whose closing waits for confirmation, cannot be edited. Every edit of an open item is
  written into its thread with the old value.
- Whose turn it is, is computed from the state, the author and the closing proposal (`naPotezu`, `cekaDrugog`
  in `src/lib/domen.ts`), never stored.

The app (`src/lib/domen.ts`) and the database apply the same rules. Database functions: `nova_stavka`,
`izmeni_stavku`, `odgovori_na_stavku`, `aktiviraj_stavku`, `predlozi_zatvaranje`, `potvrdi_zatvaranje`,
`odbij_zatvaranje`, `povuci_predlog_zatvaranja`, `ponovo_otvori_stavku`. Tables `stavka` and `unos`:
[reference/data-model.md](../../reference/data-model.md).

## Screens

- **Board** ("Tabla", `Tabla.svelte`): three columns, "Stavke" (unanswered), "Aktivno" (open) and "Rešeno" (closed
  in the last 30 days, and closing proposals that wait for confirmation). Cards are dragged with the mouse, or on a
  phone after a short press, so a plain swipe still scrolls. A drag is allowed only where the rules allow the move;
  the table of moves is in [design/screens.md](../../design/screens.md) (section 5).
- **List** ("Lista", `Stavke.svelte`): filters by state, area, flag and "Čeka mene" (waits for me), search, and
  CSV export. The choice between board and list is remembered on the device.
- **History of agreements** ("Istorija", `IstorijaDogovora.svelte`): every closed item with its decision, by month,
  newest first, with an area filter, search and CSV export.
- **One item** (`/stavka/?id=…`, `StavkaDetalj.svelte`) with its thread and actions, and **a new item**
  (`/nova/`, `NovaStavka.svelte`).
