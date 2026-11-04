// The child's record (karton): standing facts both parents need at hand.
//
// Karton entries are edited directly by either parent, but every change is
// recorded with who, when, the old and the new value, and it shows up in the
// other parent's "new since your last visit". The calendar is the part that
// needs both parents to agree; the karton is a shared notebook.

import { GreskaPravila } from './domen';

export type GrupaKartona = 'osnovno' | 'zdravlje' | 'skola' | 'nastavnici' | 'aktivnosti' | 'mere' | 'kontakti' | 'drugari';

export interface UnosKartona {
  id: string;
  grupa: GrupaKartona;
  /** Field name ("Alergije"), or the record title in a list group ("Fudbal"). */
  naziv: string;
  vrednost: string;
  /** Structured fields of a record in a list group (termini, mesto, …). */
  detalji?: Record<string, string>;
  izmenio: string;
  izmenjeno: string;
}

export interface IzmenaKartona {
  id: string;
  unosId: string;
  grupa: GrupaKartona;
  naziv: string;
  /** One-line summary before the change; null when the entry was added. */
  staro: string | null;
  /** One-line summary after the change; null when the entry was deleted. */
  novo: string | null;
  autor: string;
  kada: string;
}

export interface UlazKartona {
  id: string | null;
  grupa: GrupaKartona;
  naziv: string;
  vrednost: string;
  detalji?: Record<string, string>;
}

/**
 * predloziKao: "cipovi" shows missing fields as quick "+ Visina" buttons;
 * "lista" shows one "+ Dodaj" and offers the names only while typing
 * (Zdravlje should not be a wall of suggestions).
 */
export const GRUPE: { kljuc: GrupaKartona; naziv: string; ikona: string; predlozi: string[]; predloziKao: 'cipovi' | 'lista' }[] = [
  { kljuc: 'osnovno', naziv: 'Osnovno', ikona: 'karton', predlozi: ['Datum rođenja', 'Puno ime'], predloziKao: 'cipovi' },
  {
    kljuc: 'zdravlje',
    naziv: 'Zdravlje',
    ikona: 'zdravlje',
    predlozi: ['Pedijatar', 'Stomatolog', 'Krvna grupa', 'Alergije', 'Stalna terapija', 'Vakcine', 'Hronična stanja', 'Zdravstvena knjižica'],
    predloziKao: 'lista',
  },
  { kljuc: 'skola', naziv: 'Škola', ikona: 'skola', predlozi: ['Škola', 'Razred i odeljenje'], predloziKao: 'cipovi' },
  { kljuc: 'nastavnici', naziv: 'Nastavnici', ikona: 'skola', predlozi: [], predloziKao: 'cipovi' },
  { kljuc: 'aktivnosti', naziv: 'Vanškolske aktivnosti', ikona: 'vanskolske', predlozi: [], predloziKao: 'cipovi' },
  { kljuc: 'mere', naziv: 'Mere i veličine', ikona: 'potrebe', predlozi: ['Visina', 'Težina', 'Odeća', 'Obuća'], predloziKao: 'cipovi' },
  { kljuc: 'kontakti', naziv: 'Važni kontakti', ikona: 'kontakt', predlozi: [], predloziKao: 'cipovi' },
  { kljuc: 'drugari', naziv: 'Drugari', ikona: 'drugari', predlozi: [], predloziKao: 'cipovi' },
];

export interface PoljeZapisa {
  kljuc: string;
  naziv: string;
  placeholder: string;
  viseRedova?: boolean;
  telefon?: boolean;
}

/**
 * Groups that hold a list of records instead of single facts: any number of
 * activities, any number of contacts, each with its own details.
 */
export const ZAPISI: Partial<
  Record<GrupaKartona, { dugme: string; naslov: string; placeholder: string; polja: PoljeZapisa[] }>
> = {
  aktivnosti: {
    dugme: '+ Dodaj aktivnost',
    naslov: 'Aktivnost',
    placeholder: 'Npr. Fudbal',
    polja: [
      { kljuc: 'termini', naziv: 'Termini', placeholder: 'Npr. utorak i četvrtak 17–18h' },
      { kljuc: 'mesto', naziv: 'Gde', placeholder: 'Npr. sala kod škole' },
      { kljuc: 'kontakt', naziv: 'Trener / kontakt', placeholder: 'Ime i telefon' },
      { kljuc: 'napomena', naziv: 'Napomena', placeholder: 'Članarina, oprema, prevoz…', viseRedova: true },
    ],
  },
  nastavnici: {
    dugme: '+ Dodaj nastavnika',
    naslov: 'Ime',
    placeholder: 'Npr. Ana Petrović',
    polja: [
      { kljuc: 'predmet', naziv: 'Predmet / uloga', placeholder: 'Npr. učiteljica, engleski, razredni' },
      { kljuc: 'kontakt', naziv: 'Kontakt', placeholder: 'Telefon, mejl ili Viber grupa', telefon: true },
      { kljuc: 'napomena', naziv: 'Napomena', placeholder: 'Npr. otvorena vrata utorkom 12h', viseRedova: true },
    ],
  },
  drugari: {
    dugme: '+ Dodaj drugara',
    naslov: 'Drugar / drugarica',
    placeholder: 'Npr. Luka iz odeljenja',
    polja: [
      { kljuc: 'roditelj', naziv: 'Roditelj', placeholder: 'Ime mame ili tate' },
      { kljuc: 'telefon', naziv: 'Telefon roditelja', placeholder: '06…', telefon: true },
      { kljuc: 'napomena', naziv: 'Napomena', placeholder: 'Npr. gde žive, alergije, rođendan', viseRedova: true },
    ],
  },
  kontakti: {
    dugme: '+ Dodaj kontakt',
    naslov: 'Ko je',
    placeholder: 'Npr. Baka i deka',
    polja: [
      { kljuc: 'telefon', naziv: 'Telefon', placeholder: '06…', telefon: true },
      { kljuc: 'napomena', naziv: 'Napomena', placeholder: 'Kada i za šta mogu da pomognu', viseRedova: true },
    ],
  },
};

export function jeSpisak(grupa: GrupaKartona): boolean {
  return grupa in ZAPISI;
}

/** Record details, with text saved before records existed shown as a note. */
export function detaljiZapisa(u: Pick<UnosKartona, 'vrednost' | 'detalji'>): Record<string, string> {
  const d = { ...(u.detalji ?? {}) };
  if (u.vrednost && !d.napomena) d.napomena = u.vrednost;
  return d;
}

/** One line for history and "new" feeds: "Fudbal · utorak 17h · sala kod škole". */
export function sazetak(u: Pick<UnosKartona, 'grupa' | 'naziv' | 'vrednost' | 'detalji'>): string {
  if (!jeSpisak(u.grupa)) return u.vrednost;
  const d = detaljiZapisa(u);
  const delovi = (ZAPISI[u.grupa]?.polja ?? []).map((p) => d[p.kljuc]?.trim()).filter(Boolean);
  return [u.naziv, ...delovi].join(' · ');
}

function ocistiDetalje(d: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(d ?? {})
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v),
  );
}

/** Suggested fields of a group that are not filled in yet. */
export function nedostaje(grupa: GrupaKartona, unosi: UnosKartona[]): string[] {
  const g = GRUPE.find((x) => x.kljuc === grupa);
  const ima = new Set(unosi.filter((u) => u.grupa === grupa).map((u) => u.naziv.toLocaleLowerCase('sr')));
  return (g?.predlozi ?? []).filter((p) => !ima.has(p.toLocaleLowerCase('sr')));
}

export function sacuvajUnos(
  unosi: UnosKartona[],
  ulaz: UlazKartona,
  autor: string,
  sada: string,
  noviId: () => string,
): { unosi: UnosKartona[]; izmena: Omit<IzmenaKartona, 'id'> | null } {
  const spisak = jeSpisak(ulaz.grupa);
  const naziv = ulaz.naziv.trim();
  const vrednost = spisak ? '' : ulaz.vrednost.trim();
  const detalji = spisak ? ocistiDetalje(ulaz.detalji) : undefined;
  if (!naziv) throw new GreskaPravila(spisak ? `Upiši: ${ZAPISI[ulaz.grupa]!.naslov.toLocaleLowerCase('sr')}.` : 'Upiši naziv polja.');
  if (!spisak && !vrednost) throw new GreskaPravila('Upiši vrednost; prazno polje se briše.');
  const novi = { grupa: ulaz.grupa, naziv, vrednost, ...(spisak ? { detalji } : {}) };

  if (ulaz.id === null) {
    const id = noviId();
    return {
      unosi: [...unosi, { id, ...novi, izmenio: autor, izmenjeno: sada }],
      izmena: { unosId: id, grupa: ulaz.grupa, naziv, staro: null, novo: sazetak(novi), autor, kada: sada },
    };
  }

  const stari = unosi.find((u) => u.id === ulaz.id);
  if (!stari) throw new GreskaPravila('To polje više ne postoji.');
  const pre = sazetak(stari);
  const posle = sazetak(novi);
  if (stari.naziv === naziv && pre === posle) return { unosi, izmena: null };
  return {
    unosi: unosi.map((u) => (u.id === stari.id ? { ...u, ...novi, izmenio: autor, izmenjeno: sada } : u)),
    izmena: { unosId: stari.id, grupa: stari.grupa, naziv, staro: pre, novo: posle, autor, kada: sada },
  };
}

export function obrisiUnos(
  unosi: UnosKartona[],
  id: string,
  autor: string,
  sada: string,
): { unosi: UnosKartona[]; izmena: Omit<IzmenaKartona, 'id'> } {
  const stari = unosi.find((u) => u.id === id);
  if (!stari) throw new GreskaPravila('To polje više ne postoji.');
  return {
    unosi: unosi.filter((u) => u.id !== id),
    izmena: { unosId: id, grupa: stari.grupa, naziv: stari.naziv, staro: sazetak(stari), novo: null, autor, kada: sada },
  };
}

/** Age in whole years from "15. 4. 2018.", "15.04.2018" or "2018-04-15". */
export function godine(datumRodjenja: string, sada: Date): number | null {
  const t = datumRodjenja.trim();
  let g: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const sr = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/.exec(t);
  if (iso) [g, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (sr) [d, m, g] = [Number(sr[1]), Number(sr[2]), Number(sr[3])];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  let god = sada.getFullYear() - g;
  if (sada.getMonth() + 1 < m || (sada.getMonth() + 1 === m && sada.getDate() < d)) god--;
  return god >= 0 && god < 30 ? god : null;
}

/** "8 godina", "1 godina", "3 godine" */
export function godineTekst(n: number): string {
  const d = n % 10;
  const s = n % 100;
  if (d === 1 && s !== 11) return `${n} godina`;
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} godine`;
  return `${n} godina`;
}
