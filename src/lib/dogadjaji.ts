// The child's activities in the calendar: trainings, friends' birthdays,
// school events, doctor visits. Same rule as custody: nobody adds, changes or
// deletes alone; every change is a request the other parent accepts.
//
// An activity sits on one day (all day, or from–to), and can repeat weekly on
// chosen weekdays, every week or every other week, until a date.

import { GreskaPravila, plusDana, uDan } from './domen';
import type { Boravak, ZahtevKalendara } from './kalendar';
import { segmentiDana } from './kalendar';

export type VrstaDogadjaja = 'trening' | 'rodjendan' | 'skola' | 'lekar' | 'ostalo';

export const VRSTE_DOGADJAJA: { kljuc: VrstaDogadjaja; naziv: string; boja: string }[] = [
  { kljuc: 'trening', naziv: 'Trening', boja: 'var(--akt-trening)' },
  { kljuc: 'rodjendan', naziv: 'Rođendan', boja: 'var(--akt-rodjendan)' },
  { kljuc: 'skola', naziv: 'Škola', boja: 'var(--akt-skola)' },
  { kljuc: 'lekar', naziv: 'Lekar', boja: 'var(--akt-lekar)' },
  { kljuc: 'ostalo', naziv: 'Ostalo', boja: 'var(--akt-ostalo)' },
];

export const DANI_KRATKO = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned'];

export type Ponavljanje =
  | { tip: 'ne' }
  /** dani: 0 = Monday … 6 = Sunday. */
  | { tip: 'nedeljno'; svakih: 1 | 2; dani: number[]; do: string | null };

export interface PredlogDogadjaja {
  naziv: string;
  vrsta: VrstaDogadjaja;
  /** First day, YYYY-MM-DD. */
  datum: string;
  ceoDan: boolean;
  /** HH:mm, ignored for all-day activities. */
  od: string;
  do: string;
  ponavljanje: Ponavljanje;
  /** Parent who takes the child there, if agreed. */
  vodi: string | null;
  mesto: string;
  napomena: string;
  /** Days skipped in a repeating series (an occurrence moved "just this once"). */
  izuzeti?: string[];
}

export interface Dogadjaj extends PredlogDogadjaja {
  id: string;
  kreirano: string;
}

export interface NoviZahtevDogadjajaUlaz {
  vrsta: 'dodaj' | 'izmeni' | 'obrisi';
  dogadjajId: string | null;
  dogadjaj: PredlogDogadjaja | null;
  poruka: string;
  /** Move only this occurrence of a repeating series: the day it is moved from. */
  jednom?: string | null;
}

// --------------------------------------------------------------------------
// Occurrences
// --------------------------------------------------------------------------

export function danUNedelji(datum: string): number {
  return (uDan(datum).getDay() + 6) % 7;
}

function ponedeljak(datum: string): string {
  return plusDana(datum, -danUNedelji(datum));
}

function nedeljaRazlika(a: string, b: string): number {
  return Math.round((uDan(ponedeljak(b)).getTime() - uDan(ponedeljak(a)).getTime()) / (7 * 86_400_000));
}

export function minutaOd(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

export interface Pojava<T extends PredlogDogadjaja = Dogadjaj> {
  dogadjaj: T;
  datum: string;
  ceoDan: boolean;
  odMin: number;
  doMin: number;
}

/** Every occurrence of the activities between two days, inclusive, sorted. */
export function pojave<T extends PredlogDogadjaja>(dogadjaji: T[], od: string, doDana: string): Pojava<T>[] {
  const rez: Pojava<T>[] = [];
  for (const d of dogadjaji) {
    const p = d.ponavljanje;
    const dani: string[] = [];
    if (p.tip === 'ne') {
      if (d.datum >= od && d.datum <= doDana) dani.push(d.datum);
    } else {
      const kraj = p.do && p.do < doDana ? p.do : doDana;
      for (let dan = d.datum > od ? d.datum : od; dan <= kraj; dan = plusDana(dan, 1)) {
        if (p.dani.includes(danUNedelji(dan)) && nedeljaRazlika(d.datum, dan) % p.svakih === 0) dani.push(dan);
      }
    }
    for (const datum of dani) {
      if (d.izuzeti?.includes(datum)) continue;
      rez.push({
        dogadjaj: d,
        datum,
        ceoDan: d.ceoDan,
        odMin: d.ceoDan ? 0 : minutaOd(d.od),
        doMin: d.ceoDan ? 1440 : minutaOd(d.do),
      });
    }
  }
  return rez.sort((a, b) => a.datum.localeCompare(b.datum) || Number(b.ceoDan) - Number(a.ceoDan) || a.odMin - b.odMin);
}

/**
 * Side-by-side layout for timed occurrences of one day, like a calendar app:
 * overlapping blocks share the width, each gets a column and the column count.
 */
export function rasporediKolone<T extends { odMin: number; doMin: number }>(p: T[]): (T & { kolona: number; kolona_ukupno: number })[] {
  const sortirano = [...p].sort((a, b) => a.odMin - b.odMin || b.doMin - a.doMin);
  const rez: (T & { kolona: number; kolona_ukupno: number })[] = [];
  let grupa: (T & { kolona: number; kolona_ukupno: number })[] = [];
  let krajGrupe = -1;
  const zatvori = () => {
    const ukupno = Math.max(1, ...grupa.map((g) => g.kolona + 1));
    for (const g of grupa) g.kolona_ukupno = ukupno;
    rez.push(...grupa);
    grupa = [];
  };
  for (const x of sortirano) {
    if (grupa.length && x.odMin >= krajGrupe) zatvori();
    const zauzete = new Set(grupa.filter((g) => g.doMin > x.odMin).map((g) => g.kolona));
    let k = 0;
    while (zauzete.has(k)) k++;
    grupa.push({ ...x, kolona: k, kolona_ukupno: 1 });
    krajGrupe = Math.max(krajGrupe, x.doMin);
  }
  if (grupa.length) zatvori();
  return rez;
}

// --------------------------------------------------------------------------
// Handovers within a day (who hands the child to whom, and when)
// --------------------------------------------------------------------------

export interface PrimopredajaDana {
  min: number;
  od: string | null;
  ka: string;
}

export function primopredajeDana(datum: string, boravci: Boravak[]): PrimopredajaDana[] {
  const seg = segmentiDana(datum, boravci);
  const rez: PrimopredajaDana[] = [];
  for (let i = 1; i < seg.length; i++) {
    const ka = seg[i].kod;
    if (ka && ka !== seg[i - 1].kod) rez.push({ min: seg[i].od, od: seg[i - 1].kod, ka });
  }
  return rez;
}

// --------------------------------------------------------------------------
// Requests
// --------------------------------------------------------------------------

export function proveriDogadjaj(d: PredlogDogadjaja, roditelji: string[]): void {
  if (!d.naziv.trim()) throw new GreskaPravila('Upiši naziv aktivnosti.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.datum)) throw new GreskaPravila('Izaberi datum.');
  if (!d.ceoDan) {
    if (!/^\d{2}:\d{2}$/.test(d.od) || !/^\d{2}:\d{2}$/.test(d.do)) throw new GreskaPravila('Upiši vreme početka i kraja.');
    if (d.od >= d.do) throw new GreskaPravila('Kraj mora biti posle početka.');
  }
  if (d.vodi !== null && !roditelji.includes(d.vodi)) throw new GreskaPravila('Nepoznat roditelj.');
  const p = d.ponavljanje;
  if (p.tip === 'nedeljno') {
    if (!p.dani.length) throw new GreskaPravila('Izaberi dane u nedelji.');
    if (p.do !== null && p.do < d.datum) throw new GreskaPravila('Ponavljanje mora da traje bar do prvog dana.');
  }
}

export function napraviZahtevDogadjaja(
  ulaz: NoviZahtevDogadjajaUlaz,
  ja: string,
  roditelji: string[],
  dogadjaji: Dogadjaj[],
  sada: string,
): Omit<ZahtevKalendara, 'id'> {
  if (ulaz.vrsta !== 'dodaj' && !dogadjaji.some((d) => d.id === ulaz.dogadjajId)) {
    throw new GreskaPravila('Ta aktivnost više ne postoji.');
  }
  if (ulaz.vrsta !== 'obrisi') {
    if (!ulaz.dogadjaj) throw new GreskaPravila('Nema podataka o aktivnosti.');
    proveriDogadjaj(ulaz.dogadjaj, roditelji);
  }
  const d = ulaz.dogadjaj;
  if (ulaz.jednom && ulaz.vrsta !== 'izmeni') throw new GreskaPravila('„Samo jednom“ važi samo za pomeranje.');
  return {
    predmet: 'dogadjaj',
    jednom: ulaz.jednom ?? null,
    vrsta: ulaz.vrsta,
    boravakId: null,
    boravci: [],
    dogadjajId: ulaz.vrsta === 'dodaj' ? null : ulaz.dogadjajId,
    dogadjaj:
      ulaz.vrsta === 'obrisi' || !d
        ? null
        : { ...d, naziv: d.naziv.trim(), mesto: d.mesto.trim(), napomena: d.napomena.trim() },
    poruka: ulaz.poruka.trim(),
    predlozio: ja,
    stanje: 'ceka',
    razlog: null,
    kreirano: sada,
    reseno: null,
    resio: null,
  };
}

export function prihvatiZahtevDogadjaja(
  z: ZahtevKalendara,
  ja: string,
  dogadjaji: Dogadjaj[],
  sada: string,
  noviId: () => string,
): { zahtev: ZahtevKalendara; dogadjaji: Dogadjaj[] } {
  if (z.stanje !== 'ceka') throw new GreskaPravila('Zahtev je već rešen.');
  if (z.predlozio === ja) throw new GreskaPravila('Zahtev prihvata drugi roditelj.');
  let sledeci = dogadjaji;
  if (z.jednom && z.dogadjaj) {
    // Just this once: the series skips that day, and a one-off takes its place.
    const serija = dogadjaji.find((d) => d.id === z.dogadjajId);
    if (!serija) throw new GreskaPravila('Ta aktivnost više ne postoji.');
    const jednom = z.jednom;
    sledeci = dogadjaji.map((d) => (d.id === serija.id ? { ...d, izuzeti: [...new Set([...(d.izuzeti ?? []), jednom])] } : d));
    sledeci = [...sledeci, { ...z.dogadjaj, id: noviId(), kreirano: sada }];
    return { zahtev: { ...z, stanje: 'prihvacen', reseno: sada, resio: ja }, dogadjaji: sledeci };
  }
  if (z.vrsta !== 'dodaj') {
    if (!dogadjaji.some((d) => d.id === z.dogadjajId)) throw new GreskaPravila('Ta aktivnost više ne postoji.');
    sledeci = dogadjaji.filter((d) => d.id !== z.dogadjajId);
  }
  if (z.vrsta !== 'obrisi' && z.dogadjaj) {
    // A change keeps the id, so links and history stay attached to it.
    const id = z.vrsta === 'izmeni' ? z.dogadjajId! : noviId();
    sledeci = [...sledeci, { ...z.dogadjaj, id, kreirano: sada }];
  }
  return { zahtev: { ...z, stanje: 'prihvacen', reseno: sada, resio: ja }, dogadjaji: sledeci };
}

/** "uto, čet · svake nedelje do 20. 12." style summary of a repeat rule. */
export function opisPonavljanja(p: Ponavljanje): string {
  if (p.tip === 'ne') return '';
  const dani = [...p.dani].sort().map((d) => DANI_KRATKO[d]).join(', ');
  const ritam = p.svakih === 1 ? 'svake nedelje' : 'svake druge nedelje';
  const kraj = p.do ? ` do ${Number(p.do.slice(8, 10))}. ${Number(p.do.slice(5, 7))}.` : '';
  return `${dani} · ${ritam}${kraj}`;
}

// --------------------------------------------------------------------------
// Dragging in the calendar: every drop becomes a proposal.
// --------------------------------------------------------------------------

function vreme(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * An activity dropped on another day or time. A repeating one moves either
 * just this once (the series skips that day) or every time (the weekday and
 * time of the series change).
 */
export function pomeriDogadjaj(
  d: Dogadjaj,
  saDatum: string,
  naDatum: string,
  naOdMin: number | null,
  svakiPut: boolean,
): NoviZahtevDogadjajaUlaz {
  const { id: _id, kreirano: _k, ...osnova } = d;
  let od = d.od;
  let doV = d.do;
  if (!d.ceoDan && naOdMin !== null) {
    const trajanje = minutaOd(d.do) - minutaOd(d.od);
    if (naOdMin + trajanje > 24 * 60 - 1) throw new GreskaPravila('Aktivnost ne može da pređe u sledeći dan.');
    od = vreme(naOdMin);
    doV = vreme(naOdMin + trajanje);
  }
  const ponavlja = d.ponavljanje.tip === 'nedeljno';

  if (ponavlja && !svakiPut) {
    return {
      vrsta: 'izmeni',
      dogadjajId: d.id,
      jednom: saDatum,
      dogadjaj: { ...osnova, datum: naDatum, od, do: doV, ponavljanje: { tip: 'ne' }, izuzeti: undefined },
      poruka: '',
    };
  }

  let ponavljanje = d.ponavljanje;
  let datum = naDatum;
  if (ponavljanje.tip === 'nedeljno') {
    const sa = danUNedelji(saDatum);
    const na = danUNedelji(naDatum);
    ponavljanje = { ...ponavljanje, dani: [...new Set(ponavljanje.dani.map((x) => (x === sa ? na : x)))].sort() };
    // The series keeps its start, unless the move goes before it.
    datum = naDatum < d.datum ? naDatum : d.datum;
  }
  return { vrsta: 'izmeni', dogadjajId: d.id, dogadjaj: { ...osnova, datum, od, do: doV, ponavljanje }, poruka: '' };
}
