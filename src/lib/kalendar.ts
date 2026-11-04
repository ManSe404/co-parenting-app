// Custody calendar: who the child is with, and how that changes.
//
// Confirmed periods (boravci) are never edited directly. Every change is a
// request (zahtev) to add, change or delete, and it only takes effect when the
// other parent accepts it. The database enforces the same: no write policy on
// the periods table, only an accept function that checks who is accepting.
//
// Two layers: the regular schedule (redovno) and one-off changes (izuzetak).
// A one-off change wins over the regular schedule for its time span, so a
// swapped weekend is one entry instead of a rewrite of the regular schedule.
//
// Times are local wall-clock strings "YYYY-MM-DDTHH:mm" (both parents live in
// one time zone), so they compare correctly as plain strings.

import { GreskaPravila, danasnjiDan, kaoDatum, plusDana, uDan } from './domen';
import type { Dogadjaj, PredlogDogadjaja } from './dogadjaji';

export type VrstaBoravka = 'redovno' | 'izuzetak';

export interface PredlogBoravka {
  vrsta: VrstaBoravka;
  /** Parent id the child is with. */
  kod: string;
  od: string;
  do: string;
  napomena: string;
}

export interface Boravak extends PredlogBoravka {
  id: string;
  kreirano: string;
}

export type VrstaZahteva = 'dodaj' | 'izmeni' | 'obrisi';
export type StanjeZahteva = 'ceka' | 'prihvacen' | 'odbijen' | 'povucen';

export interface ZahtevKalendara {
  id: string;
  /** What the request is about: custody (default) or an activity. */
  predmet?: 'boravak' | 'dogadjaj';
  vrsta: VrstaZahteva;
  /** The period being changed or deleted. */
  boravakId: string | null;
  /** New periods: one or more for dodaj, exactly one for izmeni, none for obrisi. */
  boravci: PredlogBoravka[];
  /** For activity requests: the activity being changed or deleted. */
  dogadjajId?: string | null;
  /** For activity requests: the new or changed activity. */
  dogadjaj?: PredlogDogadjaja | null;
  /** Activity moved just this once: the occurrence's original day. */
  jednom?: string | null;
  poruka: string;
  predlozio: string;
  stanje: StanjeZahteva;
  razlog: string | null;
  kreirano: string;
  reseno: string | null;
  resio: string | null;
}

export interface NoviZahtevUlaz {
  vrsta: VrstaZahteva;
  boravakId: string | null;
  boravci: PredlogBoravka[];
  poruka: string;
}

// --------------------------------------------------------------------------
// Time helpers
// --------------------------------------------------------------------------

export function trenutak(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${kaoDatum(d)}T${hh}:${mm}`;
}

export function datumDela(t: string): string {
  return t.slice(0, 10);
}

export function vremeDela(t: string): string {
  return t.slice(11, 16);
}


function minuti(t: string): number {
  return Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
}

const prekriva = (b: { od: string; do: string }, t: string) => b.od <= t && t < b.do;
const seku = (a: { od: string; do: string }, b: { od: string; do: string }) => a.od < b.do && b.od < a.do;

// --------------------------------------------------------------------------
// Who has the child
// --------------------------------------------------------------------------

/** The period in effect at `t`: a one-off change wins over the regular schedule. */
export function efektivno(boravci: Boravak[], t: string): Boravak | null {
  return (
    boravci.find((b) => b.vrsta === 'izuzetak' && prekriva(b, t)) ??
    boravci.find((b) => b.vrsta === 'redovno' && prekriva(b, t)) ??
    null
  );
}

export interface Segment {
  kod: string | null;
  izuzetak: boolean;
  /** Minutes from midnight. */
  od: number;
  do: number;
}

/** Who has the child across one day, as consecutive segments. */
export function segmentiDana(datum: string, boravci: Boravak[]): Segment[] {
  const pocetak = `${datum}T00:00`;
  const kraj = `${plusDana(datum, 1)}T00:00`;
  const granice = new Set([pocetak, kraj]);
  for (const b of boravci) {
    if (b.od > pocetak && b.od < kraj) granice.add(b.od);
    if (b.do > pocetak && b.do < kraj) granice.add(b.do);
  }
  const tacke = [...granice].sort();
  const segmenti: Segment[] = [];
  for (let i = 0; i < tacke.length - 1; i++) {
    const e = efektivno(boravci, tacke[i]);
    const od = minuti(tacke[i]);
    const doMin = tacke[i + 1] === kraj ? 1440 : minuti(tacke[i + 1]);
    const kod = e?.kod ?? null;
    const izuzetak = e?.vrsta === 'izuzetak';
    const prethodni = segmenti.at(-1);
    if (prethodni && prethodni.kod === kod && prethodni.izuzetak === izuzetak) prethodni.do = doMin;
    else segmenti.push({ kod, izuzetak, od, do: doMin });
  }
  return segmenti;
}

export interface Primopredaja {
  kada: string;
  od: string | null;
  ka: string | null;
}

/** Where the child is now, and the next moment that changes. */
export function trenutnoKod(boravci: Boravak[], sada: Date): { kod: string | null; sledeca: Primopredaja | null } {
  const t = trenutak(sada);
  const kod = efektivno(boravci, t)?.kod ?? null;
  const granice = [...new Set(boravci.flatMap((b) => [b.od, b.do]).filter((g) => g > t))].sort();
  for (const g of granice) {
    const ka = efektivno(boravci, g)?.kod ?? null;
    if (ka !== kod) return { kod, sledeca: { kada: g, od: kod, ka } };
  }
  return { kod, sledeca: null };
}

// --------------------------------------------------------------------------
// Month grid (weeks start on Monday)
// --------------------------------------------------------------------------

export function mesecnaMreza(godina: number, mesec: number): string[][] {
  const prvi = new Date(godina, mesec, 1);
  const pomak = (prvi.getDay() + 6) % 7;
  const start = kaoDatum(new Date(godina, mesec, 1 - pomak));
  const nedelje: string[][] = [];
  let d = start;
  do {
    const nedelja: string[] = [];
    for (let i = 0; i < 7; i++) {
      nedelja.push(d);
      d = plusDana(d, 1);
    }
    nedelje.push(nedelja);
  } while (uDan(d).getMonth() === mesec);
  return nedelje;
}

export function danas(sada: Date): string {
  return kaoDatum(danasnjiDan(sada));
}

// --------------------------------------------------------------------------
// Requests
// --------------------------------------------------------------------------

export function proveriBoravak(p: PredlogBoravka, roditelji: string[]): void {
  if (!roditelji.includes(p.kod)) throw new GreskaPravila('Izaberi kod koga je dete.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.od) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.do)) {
    throw new GreskaPravila('Upiši datum i vreme početka i kraja.');
  }
  if (p.od >= p.do) throw new GreskaPravila('Kraj mora biti posle početka.');
}

/** Periods of the same layer may touch at a handover but never overlap. */
export function preklapanja(novi: PredlogBoravka[], postojeci: Boravak[], izuzmi: string | null = null): string[] {
  const greske: string[] = [];
  novi.forEach((n, i) => {
    for (const b of postojeci) {
      if (b.id !== izuzmi && b.vrsta === n.vrsta && seku(n, b)) greske.push(`${n.od}–${n.do} se preklapa sa ${b.od}–${b.do}`);
    }
    for (const m of novi.slice(i + 1)) {
      if (m.vrsta === n.vrsta && seku(n, m)) greske.push(`${n.od}–${n.do} se preklapa sa ${m.od}–${m.do}`);
    }
  });
  return greske;
}

/** Repeat a period every `korakDana` days, while it starts on or before `doDatuma`. */
export function ponovi(p: PredlogBoravka, korakDana: number, doDatuma: string): PredlogBoravka[] {
  if (korakDana <= 0) return [p];
  const rez: PredlogBoravka[] = [];
  for (let k = 0; k < 200; k++) {
    const od = `${plusDana(datumDela(p.od), k * korakDana)}T${vremeDela(p.od)}`;
    if (datumDela(od) > doDatuma) break;
    const doT = `${plusDana(datumDela(p.do), k * korakDana)}T${vremeDela(p.do)}`;
    rez.push({ ...p, od, do: doT });
  }
  return rez;
}

export function napraviZahtev(
  ulaz: NoviZahtevUlaz,
  ja: string,
  roditelji: string[],
  boravci: Boravak[],
  sada: string,
): Omit<ZahtevKalendara, 'id'> {
  if (ulaz.vrsta === 'dodaj' && ulaz.boravci.length === 0) throw new GreskaPravila('Nema šta da se doda.');
  if (ulaz.vrsta === 'izmeni' && ulaz.boravci.length !== 1) throw new GreskaPravila('Izmena menja tačno jedan boravak.');
  if (ulaz.vrsta !== 'dodaj' && !boravci.some((b) => b.id === ulaz.boravakId)) {
    throw new GreskaPravila('Taj boravak više ne postoji.');
  }
  if (ulaz.vrsta === 'obrisi' && ulaz.boravci.length) throw new GreskaPravila('Brisanje ne dodaje boravke.');
  ulaz.boravci.forEach((b) => proveriBoravak(b, roditelji));
  const sukobi = preklapanja(ulaz.boravci, boravci, ulaz.vrsta === 'izmeni' ? ulaz.boravakId : null);
  if (sukobi.length) throw new GreskaPravila(`Preklapa se sa postojećim rasporedom: ${sukobi[0]}.`);
  return {
    vrsta: ulaz.vrsta,
    boravakId: ulaz.vrsta === 'dodaj' ? null : ulaz.boravakId,
    boravci: ulaz.boravci.map((b) => ({ ...b, napomena: b.napomena.trim() })),
    poruka: ulaz.poruka.trim(),
    predlozio: ja,
    stanje: 'ceka',
    razlog: null,
    kreirano: sada,
    reseno: null,
    resio: null,
  };
}

/** The other parent accepts: the change is applied in one step. */
export function prihvatiZahtev(
  z: ZahtevKalendara,
  ja: string,
  boravci: Boravak[],
  sada: string,
  noviId: () => string,
): { zahtev: ZahtevKalendara; boravci: Boravak[] } {
  if (z.predmet === 'dogadjaj') throw new GreskaPravila('Ovo je zahtev za aktivnost.');
  if (z.stanje !== 'ceka') throw new GreskaPravila('Zahtev je već rešen.');
  if (z.predlozio === ja) throw new GreskaPravila('Zahtev prihvata drugi roditelj.');
  let sledeci = boravci;
  if (z.vrsta !== 'dodaj') {
    if (!boravci.some((b) => b.id === z.boravakId)) throw new GreskaPravila('Taj boravak više ne postoji.');
    sledeci = boravci.filter((b) => b.id !== z.boravakId);
  }
  // Check again: the calendar may have changed since the request was made.
  const sukobi = preklapanja(z.boravci, sledeci);
  if (sukobi.length) throw new GreskaPravila(`Ne može: ${sukobi[0]}. Neka se predloži ponovo.`);
  sledeci = [...sledeci, ...z.boravci.map((b) => ({ ...b, id: noviId(), kreirano: sada }))];
  return { zahtev: { ...z, stanje: 'prihvacen', reseno: sada, resio: ja }, boravci: sledeci };
}

export function odbijZahtev(z: ZahtevKalendara, ja: string, razlog: string, sada: string): ZahtevKalendara {
  if (z.stanje !== 'ceka') throw new GreskaPravila('Zahtev je već rešen.');
  if (z.predlozio === ja) throw new GreskaPravila('Svoj zahtev možeš da povučeš.');
  if (!razlog.trim()) throw new GreskaPravila('Napiši zašto ne prihvataš.');
  return { ...z, stanje: 'odbijen', razlog: razlog.trim(), reseno: sada, resio: ja };
}

export function povuciZahtev(z: ZahtevKalendara, ja: string, sada: string): ZahtevKalendara {
  if (z.stanje !== 'ceka') throw new GreskaPravila('Zahtev je već rešen.');
  if (z.predlozio !== ja) throw new GreskaPravila('Možeš da povučeš samo svoj zahtev.');
  return { ...z, stanje: 'povucen', reseno: sada, resio: ja };
}

/** Days a pending request touches, for marking them on the grid. */
export function daniZahteva(z: ZahtevKalendara, boravci: Boravak[], dogadjaji: Dogadjaj[] = []): Set<string> {
  const dani = new Set<string>();
  if (z.predmet === 'dogadjaj') {
    if (z.dogadjaj) dani.add(z.dogadjaj.datum);
    const stari = dogadjaji.find((d) => d.id === z.dogadjajId);
    if (stari) dani.add(stari.datum);
    return dani;
  }
  const opsezi = [...z.boravci, ...boravci.filter((b) => b.id === z.boravakId)];
  for (const o of opsezi) {
    let d = datumDela(o.od);
    const kraj = datumDela(o.do);
    for (let i = 0; i < 400 && d <= kraj; i++) {
      // A period ending exactly at midnight does not touch that day.
      if (d === kraj && vremeDela(o.do) === '00:00' && d !== datumDela(o.od)) break;
      dani.add(d);
      d = plusDana(d, 1);
    }
  }
  return dani;
}

/**
 * A handover dragged to another time on its day, as a one-off change: later
 * means the child stays longer with the parent before; earlier means the
 * parent after takes over sooner. The regular schedule is left alone.
 */
export function pomeriPrelazak(
  datum: string,
  pp: { min: number; od: string | null; ka: string },
  novMin: number,
  napomena = 'Pomeren prelazak',
): PredlogBoravka {
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  if (novMin === pp.min) throw new GreskaPravila('Vreme je isto.');
  if (novMin <= 0 || novMin >= 24 * 60) throw new GreskaPravila('Prelazak ostaje u istom danu.');
  if (novMin > pp.min) {
    if (!pp.od) throw new GreskaPravila('Pre ovog prelaska nije upisano kod koga je dete.');
    return { vrsta: 'izuzetak', kod: pp.od, od: `${datum}T${hhmm(pp.min)}`, do: `${datum}T${hhmm(novMin)}`, napomena };
  }
  return { vrsta: 'izuzetak', kod: pp.ka, od: `${datum}T${hhmm(novMin)}`, do: `${datum}T${hhmm(pp.min)}`, napomena };
}
