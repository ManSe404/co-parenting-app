// Documents: scans, certificates, findings, PDFs and photos about the child.
//
// Rules, the same in the demo and in the database:
// - either parent adds documents; the file itself never changes afterwards;
// - nothing disappears: "deleting" marks the document, both parents see who
//   did it and when, and either of them can bring it back;
// - every step is kept in the document's trail (who uploaded, edited, deleted,
//   restored).

export type KategorijaKljuc = 'skola' | 'zdravlje' | 'vanskolske' | 'licna' | 'pravno' | 'troskovi' | 'ostalo';

export interface Kategorija {
  kljuc: KategorijaKljuc;
  naziv: string;
  /** Icon name in Ikona.svelte. */
  ikona: string;
  /** CSS colour for the category's dot and thumbnail tint. */
  boja: string;
  /** Hint shown when choosing the category. */
  primeri: string;
}

export const KATEGORIJE: readonly Kategorija[] = [
  { kljuc: 'skola', naziv: 'Škola', ikona: 'skola', boja: 'var(--akt-skola)', primeri: 'potvrda o upisu, svedočanstvo, opravdanje' },
  { kljuc: 'zdravlje', naziv: 'Zdravlje', ikona: 'zdravlje', boja: 'var(--akt-lekar)', primeri: 'nalaz, uput, recept, lekarsko uverenje' },
  { kljuc: 'vanskolske', naziv: 'Vanškolske', ikona: 'vanskolske', boja: 'var(--akt-trening)', primeri: 'upisnica, raspored treninga, takmičenje' },
  { kljuc: 'licna', naziv: 'Lična dokumenta', ikona: 'karton', boja: 'var(--bio)', primeri: 'izvod, pasoš, zdravstvena knjižica' },
  { kljuc: 'pravno', naziv: 'Pravno i dogovori', ikona: 'dokument', boja: 'var(--ai)', primeri: 'sporazum, rešenje, dopis centra za socijalni rad' },
  { kljuc: 'troskovi', naziv: 'Računi', ikona: 'racun', boja: 'var(--warn)', primeri: 'račun, uplatnica, potvrda o plaćanju' },
  { kljuc: 'ostalo', naziv: 'Ostalo', ikona: 'dokument', boja: 'var(--akt-ostalo)', primeri: 'sve što ne spada nigde drugde' },
];

export function kategorija(kljuc: KategorijaKljuc): Kategorija {
  return KATEGORIJE.find((k) => k.kljuc === kljuc) ?? KATEGORIJE[KATEGORIJE.length - 1];
}

/** File types a document may have. No SVG or HTML: they can carry scripts. */
export type TipFajla = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export const TIPOVI: Record<TipFajla, { ekstenzija: string; naziv: string }> = {
  'image/jpeg': { ekstenzija: 'jpg', naziv: 'Slika JPG' },
  'image/png': { ekstenzija: 'png', naziv: 'Slika PNG' },
  'image/webp': { ekstenzija: 'webp', naziv: 'Slika WebP' },
  'application/pdf': { ekstenzija: 'pdf', naziv: 'PDF' },
};

/** Largest file after shrinking photos; the free database plan has 1 GB in all. */
export const NAJVECA_VELICINA = 10 * 1024 * 1024;

export type VrstaTraga = 'otpremljen' | 'izmenjen' | 'obrisan' | 'vracen';

export interface Trag {
  vrsta: VrstaTraga;
  /** Parent id ('tata' / 'mama'). */
  ko: string;
  kada: string;
}

export interface Dokument {
  id: string;
  naziv: string;
  kategorija: KategorijaKljuc;
  /** Date written on the document (e.g. the day of the exam), YYYY-MM-DD. */
  datum: string | null;
  napomena: string;
  tip: TipFajla;
  velicina: number;
  /** Where the file lives: the storage path in the database, the id in the demo. */
  putanja: string;
  otpremio: string;
  otpremljeno: string;
  obrisan: string | null;
  obrisao: string | null;
  trag: Trag[];
}

export interface UlazDokumenta {
  naziv: string;
  kategorija: KategorijaKljuc;
  datum: string | null;
  napomena: string;
}

export class GreskaDokumenta extends Error {}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const PO_EKSTENZIJI: Record<string, TipFajla | 'heic'> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  heic: 'heic',
  heif: 'heic',
};

/**
 * What kind of file the user picked. Some phones send no type at all, so the
 * extension decides then. 'heic' (iPhone photos) must be converted first.
 */
export function vrstaFajla(f: { name: string; type: string }): TipFajla | 'heic' | null {
  const tip = f.type.toLowerCase();
  if (tip in TIPOVI) return tip as TipFajla;
  if (tip === 'image/jpg') return 'image/jpeg';
  if (tip === 'image/heic' || tip === 'image/heif') return 'heic';
  if (tip && tip !== 'application/octet-stream') return null;
  const ekst = /\.([a-z0-9]+)$/i.exec(f.name)?.[1]?.toLowerCase() ?? '';
  return PO_EKSTENZIJI[ekst] ?? null;
}

export function proveriVelicinu(velicina: number): void {
  if (velicina <= 0) throw new GreskaDokumenta('Fajl je prazan.');
  if (velicina > NAJVECA_VELICINA) {
    throw new GreskaDokumenta(`Fajl je prevelik (${velicinaTekst(velicina)}). Najviše je ${velicinaTekst(NAJVECA_VELICINA)}.`);
  }
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Trims and checks what the user typed; throws a message the screen can show. */
export function proveriUlaz(u: UlazDokumenta): UlazDokumenta {
  const naziv = u.naziv.trim().replace(/\s+/g, ' ');
  if (!naziv) throw new GreskaDokumenta('Upiši naziv dokumenta.');
  if (naziv.length > 120) throw new GreskaDokumenta('Naziv je predug (najviše 120 znakova).');
  if (!KATEGORIJE.some((k) => k.kljuc === u.kategorija)) throw new GreskaDokumenta('Izaberi kategoriju.');
  const datum = u.datum?.trim() || null;
  if (datum && (!DATUM.test(datum) || Number.isNaN(Date.parse(datum)))) throw new GreskaDokumenta('Datum nije ispravan.');
  const napomena = u.napomena.trim();
  if (napomena.length > 500) throw new GreskaDokumenta('Napomena je preduga (najviše 500 znakova).');
  return { naziv, kategorija: u.kategorija, datum, napomena };
}

/** "lekarski_nalaz-okt.pdf" → "Lekarski nalaz-okt" */
export function nazivIzFajla(ime: string): string {
  const bez = ime.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!bez || /^(img|dsc|scan|pxl|photo|image)[\s-]?\d/i.test(bez)) return '';
  return bez.charAt(0).toUpperCase() + bez.slice(1);
}

// ---------------------------------------------------------------------------
// Changes (pure; the demo source and the tests use them, the database has the
// same rules in its functions)
// ---------------------------------------------------------------------------

export function izmeni(d: Dokument, u: UlazDokumenta, ja: string, t: string): Dokument {
  if (d.obrisan) throw new GreskaDokumenta('Obrisan dokument se ne menja. Prvo ga vrati.');
  return { ...d, ...proveriUlaz(u), trag: [...d.trag, { vrsta: 'izmenjen', ko: ja, kada: t }] };
}

export function obrisi(d: Dokument, ja: string, t: string): Dokument {
  if (d.obrisan) throw new GreskaDokumenta('Dokument je već obrisan.');
  return { ...d, obrisan: t, obrisao: ja, trag: [...d.trag, { vrsta: 'obrisan', ko: ja, kada: t }] };
}

export function vrati(d: Dokument, ja: string, t: string): Dokument {
  if (!d.obrisan) throw new GreskaDokumenta('Dokument nije obrisan.');
  return { ...d, obrisan: null, obrisao: null, trag: [...d.trag, { vrsta: 'vracen', ko: ja, kada: t }] };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** Lower case without diacritics, so "cas" finds "čas" and "Dj" finds "Đ". */
export function bezKvacica(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Newest first: by the date on the document, else by upload time. */
function kljucRedosleda(d: Dokument): string {
  return d.datum ?? d.otpremljeno.slice(0, 10);
}

export function aktivni(lista: Dokument[], filter: { kategorija?: KategorijaKljuc | null; upit?: string } = {}): Dokument[] {
  const upit = bezKvacica(filter.upit?.trim() ?? '');
  return lista
    .filter((d) => !d.obrisan)
    .filter((d) => !filter.kategorija || d.kategorija === filter.kategorija)
    .filter((d) => !upit || bezKvacica(`${d.naziv} ${d.napomena} ${kategorija(d.kategorija).naziv}`).includes(upit))
    .sort((a, b) => kljucRedosleda(b).localeCompare(kljucRedosleda(a)) || b.otpremljeno.localeCompare(a.otpremljeno));
}

export function obrisani(lista: Dokument[]): Dokument[] {
  return lista.filter((d) => d.obrisan).sort((a, b) => (b.obrisan ?? '').localeCompare(a.obrisan ?? ''));
}

export function brojPoKategoriji(lista: Dokument[]): Map<KategorijaKljuc, number> {
  const m = new Map<KategorijaKljuc, number>();
  for (const d of lista) if (!d.obrisan) m.set(d.kategorija, (m.get(d.kategorija) ?? 0) + 1);
  return m;
}

/** Serbian plural: 1 dokument, 2–4 dokumenta, 5+ dokumenata (11–14 dokumenata). */
export function brojDokumenata(n: number): string {
  const d = n % 10;
  const s = n % 100;
  if (d === 1 && s !== 11) return `${n} dokument`;
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} dokumenta`;
  return `${n} dokumenata`;
}

/** "840 B", "240 KB", "3,4 MB" */
export function velicinaTekst(bajtova: number): string {
  if (bajtova < 1024) return `${bajtova} B`;
  if (bajtova < 1024 * 1024) return `${Math.round(bajtova / 1024)} KB`;
  const mb = bajtova / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB`;
}

/** File name for downloading: the title plus the right extension. */
export function imeFajla(d: Pick<Dokument, 'naziv' | 'tip'>): string {
  const osnova = d.naziv.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'dokument';
  return `${osnova}.${TIPOVI[d.tip].ekstenzija}`;
}

const GLAGOL: Record<VrstaTraga, string> = { otpremljen: 'dodal', izmenjen: 'izmenil', obrisan: 'obrisal', vracen: 'vratil' };

/** Past tense with the parent's gender: "dodao" for tata, "dodala" for mama. */
export function glagol(vrsta: VrstaTraga, ko: string): string {
  const osnova = GLAGOL[vrsta];
  return ko === 'mama' ? `${osnova}a` : `${osnova.slice(0, -1)}o`;
}

/** "Dodao si" when it was you, otherwise "Mama je obrisala". */
export function opisTraga(vrsta: VrstaTraga, ko: string, ja: string, oznaka: string): string {
  const g = glagol(vrsta, ko);
  return ko === ja ? `${g.charAt(0).toUpperCase()}${g.slice(1)} si` : `${oznaka} je ${g}`;
}

// ---------------------------------------------------------------------------
// Permanent deletion: only from the trash, only when both parents agree.
// One parent proposes, the other confirms (or declines); then the file is
// removed for good and only a short record stays.
// ---------------------------------------------------------------------------

export type StanjeBrisanja = 'ceka' | 'odobreno' | 'odbijeno' | 'povuceno' | 'obrisano';

export interface ZahtevBrisanja {
  id: string;
  /** Null once the document is gone. */
  dokumentId: string | null;
  naziv: string;
  kategorija: KategorijaKljuc;
  predlozio: string;
  predlozeno: string;
  stanje: StanjeBrisanja;
  odgovorio: string | null;
  odgovoreno: string | null;
  zavrseno: string | null;
}

/** The proposal still in play for a document ("ceka" or "odobreno"), if any. */
export function otvorenZahtev(zahtevi: ZahtevBrisanja[], dokumentId: string): ZahtevBrisanja | null {
  return zahtevi.find((z) => z.dokumentId === dokumentId && (z.stanje === 'ceka' || z.stanje === 'odobreno')) ?? null;
}

/** The latest declined proposal for a document, to show "Mama je odbila". */
export function poslednjeOdbijanje(zahtevi: ZahtevBrisanja[], dokumentId: string): ZahtevBrisanja | null {
  return (
    zahtevi
      .filter((z) => z.dokumentId === dokumentId && z.stanje === 'odbijeno')
      .sort((a, b) => (b.odgovoreno ?? '').localeCompare(a.odgovoreno ?? ''))[0] ?? null
  );
}

/** Proposals waiting for my answer. */
export function cekajuMene(zahtevi: ZahtevBrisanja[], ja: string): ZahtevBrisanja[] {
  return zahtevi.filter((z) => z.stanje === 'ceka' && z.predlozio !== ja);
}

/** The record of what was deleted for good, newest first. */
export function trajnoObrisani(zahtevi: ZahtevBrisanja[]): ZahtevBrisanja[] {
  return zahtevi.filter((z) => z.stanje === 'obrisano').sort((a, b) => (b.zavrseno ?? '').localeCompare(a.zavrseno ?? ''));
}

export function predloziBrisanje(
  d: Dokument,
  zahtevi: ZahtevBrisanja[],
  roditelja: number,
  ja: string,
  t: string,
  id: string,
): ZahtevBrisanja {
  if (!d.obrisan) throw new GreskaDokumenta('Trajno se briše samo dokument iz obrisanih.');
  if (roditelja < 2) throw new GreskaDokumenta('Trajno brisanje mora da potvrdi i drugi roditelj, a još niste povezani.');
  if (otvorenZahtev(zahtevi, d.id)) throw new GreskaDokumenta('Trajno brisanje je već predloženo.');
  return {
    id,
    dokumentId: d.id,
    naziv: d.naziv,
    kategorija: d.kategorija,
    predlozio: ja,
    predlozeno: t,
    stanje: 'ceka',
    odgovorio: null,
    odgovoreno: null,
    zavrseno: null,
  };
}

function odgovori(z: ZahtevBrisanja, stanje: StanjeBrisanja, ja: string, t: string): ZahtevBrisanja {
  if (z.stanje !== 'ceka') throw new GreskaDokumenta('Ovaj predlog više ne čeka potvrdu.');
  return { ...z, stanje, odgovorio: ja, odgovoreno: t };
}

export function potvrdiBrisanje(z: ZahtevBrisanja, ja: string, t: string): ZahtevBrisanja {
  if (z.stanje === 'ceka' && z.predlozio === ja) throw new GreskaDokumenta('Trajno brisanje mora da potvrdi drugi roditelj.');
  return odgovori(z, 'odobreno', ja, t);
}

export function odbijBrisanje(z: ZahtevBrisanja, ja: string, t: string): ZahtevBrisanja {
  if (z.stanje === 'ceka' && z.predlozio === ja) throw new GreskaDokumenta('Svoj predlog možeš da povučeš, a odbija ga drugi roditelj.');
  return odgovori(z, 'odbijeno', ja, t);
}

export function povuciBrisanje(z: ZahtevBrisanja, ja: string, t: string): ZahtevBrisanja {
  if (z.stanje === 'ceka' && z.predlozio !== ja) throw new GreskaDokumenta('Povući može samo onaj ko je predložio.');
  return odgovori(z, 'povuceno', ja, t);
}

/**
 * Restoring a document answers its open proposal: the proposer withdraws it,
 * the other parent declines it. After both agreed there is no way back.
 */
export function vratiUzZahtev(z: ZahtevBrisanja | null, ja: string, t: string): ZahtevBrisanja | null {
  if (!z) return null;
  if (z.stanje === 'odobreno') throw new GreskaDokumenta('Oboje ste potvrdili trajno brisanje; dokument više ne može da se vrati.');
  return z.predlozio === ja ? povuciBrisanje(z, ja, t) : odbijBrisanje(z, ja, t);
}
