// Pure rules of the app: who is on turn, what is urgent, and how an item moves
// between states. No I/O here, so every rule is unit-tested, and the database
// enforces the same transitions on its side once Supabase is wired in.

import { OBLASTI } from './osnova';
import type { IzmenaStavke, NovaStavkaUlaz, Podaci, Stavka, Unos, VrstaUnosa } from './tipovi';

export const DANA_ZA_HITNO = 3;
export const DANA_PREDSTOJECE = 14;
export const DANA_ZATVORENO = 30;

export class GreskaPravila extends Error {}

// --------------------------------------------------------------------------
// Dates. `datum` is a calendar day (YYYY-MM-DD) in local time.
// --------------------------------------------------------------------------

export function uDan(datum: string): Date {
  const [g, m, d] = datum.split('-').map(Number);
  return new Date(g, m - 1, d);
}

export function danasnjiDan(sada: Date): Date {
  return new Date(sada.getFullYear(), sada.getMonth(), sada.getDate());
}

export function kaoDatum(dan: Date): string {
  const m = String(dan.getMonth() + 1).padStart(2, '0');
  const d = String(dan.getDate()).padStart(2, '0');
  return `${dan.getFullYear()}-${m}-${d}`;
}

/** Calendar arithmetic that stays correct across daylight-saving changes. */
export function plusDana(datum: string, n: number): string {
  const d = uDan(datum);
  return kaoDatum(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Whole calendar days from today to `datum`; negative when it has passed. */
export function danaDo(datum: string, sada: Date): number {
  const ms = uDan(datum).getTime() - danasnjiDan(sada).getTime();
  return Math.round(ms / 86_400_000);
}

// --------------------------------------------------------------------------
// Who is on turn
// --------------------------------------------------------------------------

/** True when this item needs an action from `ja`. */
export function naPotezu(s: Stavka, ja: string): boolean {
  if (s.stanje === 'zatvoreno') return false;
  if (s.zatvaranjePredlozio) return s.zatvaranjePredlozio !== ja;
  return s.stanje === 'neodgovoreno' && s.otvorio !== ja;
}

/** True when `ja` is waiting for the other parent on this item. */
export function cekaDrugog(s: Stavka, ja: string): boolean {
  if (s.stanje === 'zatvoreno') return false;
  if (s.zatvaranjePredlozio) return s.zatvaranjePredlozio === ja;
  return s.stanje === 'neodgovoreno' && s.otvorio === ja;
}

// --------------------------------------------------------------------------
// Urgency and ordering
// --------------------------------------------------------------------------

/** Flagged urgent, or still open with a date within three days (or overdue). */
export function jeHitno(s: Stavka, sada: Date): boolean {
  if (s.stanje === 'zatvoreno') return false;
  if (s.hitno) return true;
  return s.datum !== null && danaDo(s.datum, sada) <= DANA_ZA_HITNO;
}

export function jeVazno(s: Stavka): boolean {
  return s.stanje !== 'zatvoreno' && s.vazno;
}

/** Urgent first, then by nearest date, then most recently changed. */
export function poHitnosti(sada: Date) {
  return (a: Stavka, b: Stavka): number => {
    const h = Number(jeHitno(b, sada)) - Number(jeHitno(a, sada));
    if (h !== 0) return h;
    if (a.datum && b.datum && a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
    if (a.datum && !b.datum) return -1;
    if (!a.datum && b.datum) return 1;
    return b.izmenjeno.localeCompare(a.izmenjeno);
  };
}

// --------------------------------------------------------------------------
// Dashboard
// --------------------------------------------------------------------------

export interface Aktivnost {
  stavka: Stavka;
  opis: string;
  kada: string;
}

export interface Pregled {
  naPotezu: Stavka[];
  cekaDrugog: Stavka[];
  neodgovoreno: number;
  otvoreno: number;
  zatvorenoNedavno: number;
  hitno: Stavka[];
  vazno: Stavka[];
  poOblasti: { kljuc: string; naziv: string; broj: number; prve: Stavka[] }[];
  predstojece: Stavka[];
  novo: Aktivnost[];
  /** Board column counts; Rešeno = pending confirmation + closed in 30 days. */
  kolone: Record<Kolona, number>;
}

export const OPIS_UNOSA: Record<VrstaUnosa, string> = {
  odgovor: 'odgovor',
  aktivirano: 'pomereno u Aktivno',
  predlog_zatvaranja: 'predlog zatvaranja',
  povucen_predlog: 'povučen predlog',
  odbijeno_zatvaranje: 'odbijeno zatvaranje',
  zatvoreno: 'potvrđeno zatvaranje',
  ponovo_otvoreno: 'ponovo otvoreno',
  izmenjeno: 'izmena stavke',
};

export function napraviPregled(p: Podaci, sada: Date): Pregled {
  const ja = p.ja.id;
  const red = poHitnosti(sada);
  const aktivne = p.stavke.filter((s) => s.stanje !== 'zatvoreno').sort(red);

  const danas = kaoDatum(danasnjiDan(sada));
  const kraj = plusDana(danas, DANA_PREDSTOJECE);
  const granicaZatvorenih = sada.getTime() - DANA_ZATVORENO * 86_400_000;

  const poOblasti = p.oblasti
    .map((o) => {
      const u = aktivne.filter((s) => s.oblast === o.kljuc);
      return { kljuc: o.kljuc, naziv: o.naziv, broj: u.length, prve: u.slice(0, 2) };
    })
    // "Ostalo" only earns a card when something is in it.
    .filter((o) => o.kljuc !== 'ostalo' || o.broj > 0);

  return {
    naPotezu: aktivne.filter((s) => naPotezu(s, ja)),
    cekaDrugog: aktivne.filter((s) => cekaDrugog(s, ja)),
    neodgovoreno: aktivne.filter((s) => s.stanje === 'neodgovoreno').length,
    otvoreno: aktivne.filter((s) => s.stanje === 'otvoreno').length,
    zatvorenoNedavno: p.stavke.filter(
      (s) => s.stanje === 'zatvoreno' && s.zatvoreno !== null && Date.parse(s.zatvoreno) >= granicaZatvorenih,
    ).length,
    hitno: aktivne.filter((s) => jeHitno(s, sada)),
    vazno: aktivne.filter(jeVazno),
    poOblasti,
    predstojece: p.stavke
      .filter((s) => s.datum !== null && s.datum >= danas && s.datum <= kraj)
      .sort((a, b) => (a.datum! < b.datum! ? -1 : a.datum! > b.datum! ? 1 : 0)),
    novo: novoOdPoslednjePosete(p),
    kolone: {
      stavke: aktivne.filter((s) => kolona(s) === 'stavke').length,
      aktivno: aktivne.filter((s) => kolona(s) === 'aktivno').length,
      reseno: p.stavke.filter(
        (s) =>
          kolona(s) === 'reseno' &&
          (s.stanje !== 'zatvoreno' || (s.zatvoreno !== null && Date.parse(s.zatvoreno) >= granicaZatvorenih)),
      ).length,
    },
  };
}

/** What the other parent created or wrote since `videoOd`, newest first. */
export function novoOdPoslednjePosete(p: Podaci, najvise = 6): Aktivnost[] {
  const drugi = p.drugi.id;
  const od = p.videoOd ?? '';
  const poId = new Map(p.stavke.map((s) => [s.id, s]));

  const nove: Aktivnost[] = p.stavke
    .filter((s) => s.otvorio === drugi && s.kreirano > od)
    .map((s) => ({ stavka: s, opis: 'nova stavka', kada: s.kreirano }));

  const unosi: Aktivnost[] = p.unosi
    .filter((u) => u.autor === drugi && u.kreirano > od && poId.has(u.stavkaId))
    .map((u) => ({ stavka: poId.get(u.stavkaId)!, opis: OPIS_UNOSA[u.vrsta], kada: u.kreirano }));

  // One line per item: its latest change.
  const vidjene = new Set<string>();
  return [...nove, ...unosi]
    .sort((a, b) => b.kada.localeCompare(a.kada))
    .filter((a) => !vidjene.has(a.stavka.id) && Boolean(vidjene.add(a.stavka.id)))
    .slice(0, najvise);
}

// --------------------------------------------------------------------------
// Transitions. Each returns the changed item and the thread entry to record.
// --------------------------------------------------------------------------

export interface Promena {
  stavka: Stavka;
  unos: Omit<Unos, 'id'> | null;
}

function unos(s: Stavka, autor: string, vrsta: VrstaUnosa, tekst: string, sada: string): Omit<Unos, 'id'> {
  return { stavkaId: s.id, autor, vrsta, tekst, kreirano: sada };
}

function obavezno(tekst: string, poruka: string): string {
  const t = tekst.trim();
  if (!t) throw new GreskaPravila(poruka);
  return t;
}

export function proveriNovu(ulaz: NovaStavkaUlaz): NovaStavkaUlaz {
  return {
    ...ulaz,
    naslov: obavezno(ulaz.naslov, 'Naslov je obavezan.'),
    opis: ulaz.opis.trim(),
    datum: ulaz.datum || null,
  };
}

function rokTekst(d: string | null): string {
  return d ? `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}. ${d.slice(0, 4)}.` : 'bez roka';
}

function nazivOblasti(k: string): string {
  return OBLASTI.find((o) => o.kljuc === k)?.naziv ?? k;
}

/**
 * An edit of an open item. What changed goes into the item's thread, in the
 * same words as izmeni_stavku in the database; a closed item, or one whose
 * closing waits for the other parent, is not edited.
 */
export function izmeni(s: Stavka, autor: string, izmena: IzmenaStavke, sada: string): Promena {
  if (s.stanje === 'zatvoreno') throw new GreskaPravila('Rešena stavka se ne menja. Ako treba, ponovo je otvori.');
  if (s.zatvaranjePredlozio) throw new GreskaPravila('Zatvaranje čeka potvrdu. Povuci ili odbij predlog, pa izmeni.');
  const n = proveriNovu({
    naslov: izmena.naslov ?? s.naslov,
    opis: izmena.opis ?? s.opis,
    oblast: izmena.oblast ?? s.oblast,
    vazno: izmena.vazno ?? s.vazno,
    hitno: izmena.hitno ?? s.hitno,
    datum: 'datum' in izmena ? (izmena.datum ?? null) : s.datum,
  });
  const promene: string[] = [];
  if (n.naslov !== s.naslov) promene.push(`Naslov: „${s.naslov}“ → „${n.naslov}“`);
  if (n.oblast !== s.oblast) promene.push(`Oblast: ${nazivOblasti(s.oblast)} → ${nazivOblasti(n.oblast)}`);
  if (n.vazno !== s.vazno) promene.push(n.vazno ? 'Označeno kao važno' : 'Više nije označeno kao važno');
  if (n.hitno !== s.hitno) promene.push(n.hitno ? 'Označeno kao hitno' : 'Više nije označeno kao hitno');
  if (n.datum !== s.datum) promene.push(`Rok: ${rokTekst(s.datum)} → ${rokTekst(n.datum)}`);
  if (n.opis !== s.opis) {
    promene.push(s.opis === '' ? 'Dodat opis' : `Opis izmenjen; ranije: „${s.opis.length > 1500 ? `${s.opis.slice(0, 1500)}…` : s.opis}“`);
  }
  if (!promene.length) return { stavka: s, unos: null };
  return { stavka: { ...s, ...n, izmenjeno: sada }, unos: unos(s, autor, 'izmenjeno', promene.join('\n'), sada) };
}

/** A reply from the other parent moves an unanswered item to open. */
export function odgovori(s: Stavka, autor: string, tekst: string, sada: string): Promena {
  if (s.stanje === 'zatvoreno') throw new GreskaPravila('Zatvorena stavka se prvo ponovo otvara.');
  const t = obavezno(tekst, 'Odgovor je prazan.');
  const stanje = s.stanje === 'neodgovoreno' && autor !== s.otvorio ? 'otvoreno' : s.stanje;
  return { stavka: { ...s, stanje, izmenjeno: sada }, unos: unos(s, autor, 'odgovor', t, sada) };
}

export function predloziZatvaranje(s: Stavka, autor: string, odluka: string, sada: string): Promena {
  if (s.stanje === 'zatvoreno') throw new GreskaPravila('Stavka je već zatvorena.');
  if (s.zatvaranjePredlozio) throw new GreskaPravila('Zatvaranje je već predloženo.');
  const t = obavezno(odluka, 'Upiši odluku pre zatvaranja.');
  // A proposal from the parent who was asked is also an answer.
  const stanje = s.stanje === 'neodgovoreno' && autor !== s.otvorio ? 'otvoreno' : s.stanje;
  return {
    stavka: { ...s, stanje, odluka: t, zatvaranjePredlozio: autor, izmenjeno: sada },
    unos: unos(s, autor, 'predlog_zatvaranja', t, sada),
  };
}

export function potvrdiZatvaranje(s: Stavka, autor: string, sada: string): Promena {
  if (!s.zatvaranjePredlozio) throw new GreskaPravila('Zatvaranje nije predloženo.');
  if (s.zatvaranjePredlozio === autor) throw new GreskaPravila('Zatvaranje potvrđuje drugi roditelj.');
  return {
    stavka: { ...s, stanje: 'zatvoreno', zatvaranjePredlozio: null, zatvoreno: sada, izmenjeno: sada },
    unos: unos(s, autor, 'zatvoreno', s.odluka ?? '', sada),
  };
}

export function odbijZatvaranje(s: Stavka, autor: string, razlog: string, sada: string): Promena {
  if (!s.zatvaranjePredlozio) throw new GreskaPravila('Zatvaranje nije predloženo.');
  if (s.zatvaranjePredlozio === autor) throw new GreskaPravila('Svoj predlog možeš da povučeš.');
  const t = obavezno(razlog, 'Napiši zašto se ne slažeš.');
  return {
    stavka: { ...s, odluka: null, zatvaranjePredlozio: null, stanje: 'otvoreno', izmenjeno: sada },
    unos: unos(s, autor, 'odbijeno_zatvaranje', t, sada),
  };
}

/** `uAktivno`: the board drop target was Aktivno, so the item lands there. */
export function povuciPredlog(s: Stavka, autor: string, sada: string, uAktivno = false): Promena {
  if (s.zatvaranjePredlozio !== autor) throw new GreskaPravila('Možeš da povučeš samo svoj predlog.');
  const stanje = uAktivno && s.stanje === 'neodgovoreno' ? 'otvoreno' : s.stanje;
  return {
    stavka: { ...s, stanje, odluka: null, zatvaranjePredlozio: null, izmenjeno: sada },
    unos: unos(s, autor, 'povucen_predlog', '', sada),
  };
}

/** Either parent moves an unanswered item to open, e.g. after talking it over. */
export function aktiviraj(s: Stavka, autor: string, napomena: string, sada: string): Promena {
  if (s.stanje !== 'neodgovoreno') throw new GreskaPravila('Stavka je već aktivna ili rešena.');
  if (s.zatvaranjePredlozio) throw new GreskaPravila('Zatvaranje je predloženo; prvo ga potvrdite ili odbijte.');
  return {
    stavka: { ...s, stanje: 'otvoreno', izmenjeno: sada },
    unos: unos(s, autor, 'aktivirano', napomena.trim(), sada),
  };
}

// --------------------------------------------------------------------------
// Board. Three columns map onto the states; an item whose closing has been
// proposed already sits under Rešeno, marked as waiting for confirmation.
// --------------------------------------------------------------------------

export type Kolona = 'stavke' | 'aktivno' | 'reseno';

export const KOLONE: Kolona[] = ['stavke', 'aktivno', 'reseno'];

export function kolona(s: Stavka): Kolona {
  if (s.stanje === 'zatvoreno' || s.zatvaranjePredlozio) return 'reseno';
  return s.stanje === 'otvoreno' ? 'aktivno' : 'stavke';
}

/** What dropping an item into a column means, and what it needs from you. */
export type Potez =
  | { vrsta: 'nista' }
  | { vrsta: 'zabranjeno'; razlog: string }
  | { vrsta: 'aktiviraj' }
  | { vrsta: 'predlozi' }
  | { vrsta: 'odbij' }
  | { vrsta: 'povuci' }
  | { vrsta: 'ponovo' };

export function potezZaKolonu(s: Stavka, cilj: Kolona, ja: string): Potez {
  const sad = kolona(s);
  if (sad === cilj) return { vrsta: 'nista' };
  if (cilj === 'stavke') {
    return { vrsta: 'zabranjeno', razlog: 'U Stavke idu samo nova, neodgovorena pitanja.' };
  }
  if (cilj === 'reseno') return { vrsta: 'predlozi' };
  if (sad === 'stavke') return { vrsta: 'aktiviraj' };
  if (s.stanje === 'zatvoreno') return { vrsta: 'ponovo' };
  return s.zatvaranjePredlozio === ja ? { vrsta: 'povuci' } : { vrsta: 'odbij' };
}

export function ponovoOtvori(s: Stavka, autor: string, razlog: string, sada: string): Promena {
  if (s.stanje !== 'zatvoreno') throw new GreskaPravila('Stavka nije zatvorena.');
  const t = obavezno(razlog, 'Napiši zašto se stavka ponovo otvara.');
  return {
    stavka: { ...s, stanje: 'otvoreno', odluka: null, zatvoreno: null, izmenjeno: sada },
    unos: unos(s, autor, 'ponovo_otvoreno', t, sada),
  };
}
