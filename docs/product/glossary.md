# Glossary

The screens, the code and the database use the same Serbian words (`src/lib/tipovi.ts`). This list gives each
word its meaning and where it lives.

| Word | Meaning | In the code |
|---|---|---|
| porodica, porodični prostor | the family space: two parents and one child; everything else belongs to one | table `porodica` |
| roditelj | a parent in a family space, in the role `tata` (dad) or `mama` (mum) | table `roditelj` |
| oznaka | how the app names a parent ("Tata", "Mama"), with the case forms sentences need | `roditelj.oznaka`, `oznaka_akuzativ`, `oznaka_genitiv`; `src/lib/osnova.ts` |
| dete | the child; the stored name is "Dete" and is never shown | table `dete` |
| pozivnica, poziv | the invitation link that brings the second parent in | table `pozivnica`, page `/poziv/` |
| dozvoljeni osnivač | an e-mail allowed to open a family space on this copy; an empty list allows everyone | table `dozvoljeni_osnivac` |
| stavka | an item: one question or topic | table `stavka` |
| stanje | the state of an item: `neodgovoreno` (unanswered), `otvoreno` (open), `zatvoreno` (closed) | `stavka.stanje` |
| oblast | the area of an item: `skola` (school), `zdravlje` (health), `vanskolske` (activities outside school), `potrebe` (the child's needs), `ostalo` (other) | `stavka.oblast`, `src/lib/osnova.ts` |
| važno, hitno | the flags important and urgent | `stavka.vazno`, `stavka.hitno` |
| unos | an entry in an item's thread: a reply, a state change or an edit | table `unos` |
| odluka | the decision written when an item closes | `stavka.odluka` |
| predlog zatvaranja | a proposal to close an item, which the other parent confirms | `stavka.zatvaranje_predlozio` |
| Tabla, Lista, Istorija dogovora | the board, the list and the history of agreements: three views of the items | `Tabla.svelte`, `Stavke.svelte`, `IstorijaDogovora.svelte` |
| Stavke, Aktivno, Rešeno | the board's columns: unanswered; open; closed or waiting for confirmation | `KOLONE` in `src/lib/domen.ts` |
| na potezu, čeka tebe | whose turn it is on an item; computed, never stored | `naPotezu`, `cekaDrugog` in `src/lib/domen.ts` |
| boravak | a stay: a period when the child is with one parent; `redovno` (the regular schedule) or `izuzetak` (a one-off change that wins over it) | table `boravak` |
| prelazak | a handover between the parents, shown as "ide kod tate" or "ide kod mame" | `src/lib/kalendar.ts`, `src/lib/kalendar-opis.ts` |
| dogadjaj, aktivnost | an activity in the calendar: `trening`, `rodjendan`, `skola`, `lekar`, `ostalo` | table `dogadjaj` |
| zahtev kalendara | a request to add, change or delete (`dodaj`, `izmeni`, `obrisi`) a stay or an activity; it waits (`ceka`) until it is accepted, declined or withdrawn (`prihvacen`, `odbijen`, `povucen`) | table `zahtev_kalendara` |
| karton | the child's record: standing facts in groups | tables `karton_unos`, `karton_izmena` |
| raspored časova | the school timetable, part of the record | table `raspored_casova` |
| dokument, trag | a document and its trail (uploaded, edited, deleted, restored) | tables `dokument`, `dokument_trag` |
| Obrisani | the trash: deleted documents either parent can restore | `dokument.obrisan` |
| trajno brisanje | deleting a document for good, which needs both parents | table `dokument_brisanje` |
| profil roditelja | a parent's name, phone, address, contact e-mail and note | columns of `roditelj` |
| obaveštenje | an e-mail notification queued for the other parent; each parent picks `odmah` (at once), `dnevno` (a daily digest) or `nikad` (never) | table `obavestenje`, `roditelj.obavestenja` |
| početna | the home screen | `Pocetna.svelte` |
| Novo od poslednje posete | what the other parent did since your last visit | `novoOdPoslednjePosete` in `src/lib/domen.ts` |
| izvor | the data source behind the screens: the demo or the database | `src/lib/izvor.ts` |
| baza, demo | the two modes: real accounts on Supabase, or example data in this browser tab | `src/lib/supabase.ts` |
| kanta | the private storage bucket `dokumenti` | `supabase/migrations/20261104020000_dokumenti.sql` |

## Original plan text

Section 3 of the original plan, translated from Serbian. Where the plan and the code differ, the code and the table
above are right; the differences are listed in
[roadmap.md](../roadmap.md#where-the-plan-and-the-code-differ). The labels in quotes are the ones the app shows.

### 3. Terms

The basic unit is the **item** ("stavka"), a question or a topic. Every item has three independent properties:

| Property | Values | Note |
|---|---|---|
| State | "Neodgovoreno" (unanswered) · "Otvoreno" (open) · "Zatvoreno" (closed) | the course of one topic |
| Area | "Škola" (school) · "Zdravlje" (health) · "Vanškolske aktivnosti" (activities outside school) · "Detetove potrebe" (the child's needs) · "Ostalo" (other) | exactly one |
| Flags | "Važno" (important) · "Hitno" (urgent) | both, one or neither |

"Važno" and "Hitno" are flags, not areas. An item that is "Hitno" and in "Zdravlje" is one item, and it shows both
under "Hitno" and under "Zdravlje".

#### Proposed meaning of the states

- **Unanswered**: one parent asked a question, and the other has not answered yet. It is always visible whose turn
  it is.
- **Open**: both parents have taken part, but no decision has been made yet.
- **Closed**: the decision is written down, or the topic no longer matters.

Transitions:

- a new item → unanswered; it waits for the other parent
- the other parent replies → open (automatically)
- closing requires writing the decision down. The proposal is that one parent proposes closing and the other
  confirms it.
- a closed item can be reopened, with a written reason

**Urgent** is set by hand. In addition, every item that is not closed and whose deadline falls within the next 3
days becomes urgent automatically.
