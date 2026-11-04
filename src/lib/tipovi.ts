import type { Dogadjaj } from './dogadjaji';
import type { Boravak, ZahtevKalendara } from './kalendar';
import type { IzmenaKartona, UnosKartona } from './karton';
import type { RasporedCasova } from './raspored-casova';

// Domain types. Names follow the Serbian UI so the code, the database and the
// screens all use the same words.

export type Stanje = 'neodgovoreno' | 'otvoreno' | 'zatvoreno';

export type OblastKljuc = 'skola' | 'zdravlje' | 'vanskolske' | 'potrebe' | 'ostalo';

/** Area labels come from data, so the child's name never lives in the code. */
export interface Oblast {
  kljuc: OblastKljuc;
  naziv: string;
}

export interface Roditelj {
  id: string;
  /** What the app shows for this parent, e.g. "Tata" or "Mama". */
  oznaka: string;
  /** Accusative form for "čeka …", e.g. "mamu". */
  oznakaAkuzativ: string;
  /** Genitive form for "kod …", e.g. "mame". */
  oznakaGenitiv: string;
  /** Calendar colour token: 'bio' (teal) or 'ai' (violet), same for both viewers. */
  boja: 'bio' | 'ai';
  poslednjaPoseta: string | null;
}

export interface Stavka {
  id: string;
  naslov: string;
  opis: string;
  oblast: OblastKljuc;
  stanje: Stanje;
  vazno: boolean;
  hitno: boolean;
  /** Deadline or appointment, as YYYY-MM-DD. */
  datum: string | null;
  otvorio: string;
  /** The decision; set when closing is proposed, kept once closed. */
  odluka: string | null;
  zatvaranjePredlozio: string | null;
  kreirano: string;
  izmenjeno: string;
  zatvoreno: string | null;
}

export type VrstaUnosa =
  | 'odgovor'
  | 'aktivirano'
  | 'predlog_zatvaranja'
  | 'povucen_predlog'
  | 'odbijeno_zatvaranje'
  | 'zatvoreno'
  | 'ponovo_otvoreno';

/** One entry in an item's thread: a reply or a recorded state change. */
export interface Unos {
  id: string;
  stavkaId: string;
  autor: string;
  vrsta: VrstaUnosa;
  tekst: string;
  kreirano: string;
}

export interface Podaci {
  ja: Roditelj;
  drugi: Roditelj;
  dete: { ime: string };
  oblasti: Oblast[];
  stavke: Stavka[];
  unosi: Unos[];
  boravci: Boravak[];
  dogadjaji: Dogadjaj[];
  zahtevi: ZahtevKalendara[];
  karton: UnosKartona[];
  izmeneKartona: IzmenaKartona[];
  rasporedCasova: RasporedCasova | null;
  /** Start of "new since your last visit"; null on the very first visit. */
  videoOd: string | null;
}

export interface NovaStavkaUlaz {
  naslov: string;
  opis: string;
  oblast: OblastKljuc;
  vazno: boolean;
  hitno: boolean;
  datum: string | null;
}

export type IzmenaStavke = Partial<NovaStavkaUlaz>;
