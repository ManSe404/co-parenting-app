// School timetable: a grid of lessons (rows) by weekday (columns), filled in by
// hand, imported from a CSV or Excel file, and/or kept as a photo.
//
// The importer reads .xlsx without a library: an .xlsx file is a zip of XML
// files, and the browser can inflate zip entries with DecompressionStream.

export const DANI_SKOLE = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak'];

export interface UlazRasporeda {
  /** Lesson labels, one per row: "1.", "2." or times like "8:00–8:45". */
  casovi: string[];
  /** tabela[cas][dan], dan 0 = Monday … 4 = Friday. */
  tabela: string[][];
  /** Photo of the timetable (data URL in the demo, storage path later). */
  slika: string | null;
  napomena: string;
}

export interface RasporedCasova extends UlazRasporeda {
  izmenio: string;
  izmenjeno: string;
}

export function prazanRaspored(casova = 6): Pick<UlazRasporeda, 'casovi' | 'tabela'> {
  return {
    casovi: Array.from({ length: casova }, (_, i) => `${i + 1}.`),
    tabela: Array.from({ length: casova }, () => DANI_SKOLE.map(() => '')),
  };
}

export function imaTabelu(r: Pick<UlazRasporeda, 'tabela'> | null): boolean {
  return !!r && r.tabela.some((red) => red.some((c) => c.trim()));
}

/** "5 dana × 6 časova, slika" — for the karton change log. */
export function sazetakRasporeda(r: UlazRasporeda | null): string {
  if (!r) return 'nema';
  const delovi: string[] = [];
  if (imaTabelu(r)) delovi.push(`tabela, ${r.casovi.length} časova`);
  if (r.slika) delovi.push('slika');
  if (r.napomena.trim()) delovi.push(`napomena: ${r.napomena.trim()}`);
  return delovi.join(', ') || 'prazno';
}

// --------------------------------------------------------------------------
// CSV
// --------------------------------------------------------------------------

/** CSV as exported by Excel in Serbian (";") or English (","), or tab-separated. */
export function parsirajCsv(tekst: string): string[][] {
  const t = tekst.replace(/^﻿/, '');
  // Guess the separator from the first line that has something in it.
  const prviRed = t.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const sep = [';', '\t', ','].reduce((a, b) => (prviRed.split(b).length > prviRed.split(a).length ? b : a), ',');
  const redovi: string[][] = [];
  let red: string[] = [];
  let polje = '';
  let uNavodnicima = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (uNavodnicima) {
      if (c === '"' && t[i + 1] === '"') {
        polje += '"';
        i++;
      } else if (c === '"') uNavodnicima = false;
      else polje += c;
    } else if (c === '"') uNavodnicima = true;
    else if (c === sep) {
      red.push(polje);
      polje = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      red.push(polje);
      redovi.push(red);
      red = [];
      polje = '';
    } else polje += c;
  }
  if (polje || red.length) {
    red.push(polje);
    redovi.push(red);
  }
  return redovi.map((r) => r.map((x) => x.trim()));
}

// --------------------------------------------------------------------------
// XLSX (first worksheet, text and numbers)
// --------------------------------------------------------------------------

function u16(b: Uint8Array, i: number) {
  return b[i] | (b[i + 1] << 8);
}

function u32(b: Uint8Array, i: number) {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}

async function izvadi(metod: number, podaci: Uint8Array): Promise<string> {
  if (metod === 0) return new TextDecoder().decode(podaci);
  if (metod !== 8) throw new Error('Nepodržana kompresija u fajlu.');
  const tok = new Blob([podaci as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(await new Response(tok).arrayBuffer());
}

async function zip(b: Uint8Array): Promise<Map<string, () => Promise<string>>> {
  let kraj = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (u32(b, i) === 0x06054b50) {
      kraj = i;
      break;
    }
  }
  if (kraj < 0) throw new Error('Ovo nije Excel (.xlsx) fajl.');
  const broj = u16(b, kraj + 10);
  let p = u32(b, kraj + 16);
  const fajlovi = new Map<string, () => Promise<string>>();
  for (let n = 0; n < broj; n++) {
    if (u32(b, p) !== 0x02014b50) break;
    const metod = u16(b, p + 10);
    const velicina = u32(b, p + 20);
    const duzinaImena = u16(b, p + 28);
    const duzinaDodatka = u16(b, p + 30);
    const duzinaKomentara = u16(b, p + 32);
    const lokalni = u32(b, p + 42);
    const ime = new TextDecoder().decode(b.subarray(p + 46, p + 46 + duzinaImena));
    const pocetak = lokalni + 30 + u16(b, lokalni + 26) + u16(b, lokalni + 28);
    fajlovi.set(ime, () => izvadi(metod, b.subarray(pocetak, pocetak + velicina)));
    p += 46 + duzinaImena + duzinaDodatka + duzinaKomentara;
  }
  return fajlovi;
}

function xmlTekst(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

function kolona(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function citajXlsx(podaci: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const b = podaci instanceof Uint8Array ? podaci : new Uint8Array(podaci);
  const fajlovi = await zip(b);
  const listovi = [...fajlovi.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
  if (!listovi.length) throw new Error('U fajlu nema tabele.');
  const deljeni: string[] = [];
  const ss = fajlovi.get('xl/sharedStrings.xml');
  if (ss) {
    for (const si of (await ss()).match(/<si>[\s\S]*?<\/si>/g) ?? []) {
      deljeni.push(xmlTekst((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
    }
  }
  const list = await fajlovi.get(listovi[0])!();
  const redovi: string[][] = [];
  for (const r of list.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const red: string[] = [];
    for (const c of r.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = /r="([A-Z]+\d+)"/.exec(c)?.[1];
      const tip = /t="(\w+)"/.exec(c)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1];
      let tekst = '';
      if (tip === 's' && v !== undefined) tekst = deljeni[Number(v)] ?? '';
      else if (tip === 'inlineStr') tekst = xmlTekst((/<t[^>]*>([\s\S]*?)<\/t>/.exec(c)?.[1] ?? ''));
      else if (v !== undefined) tekst = xmlTekst(v);
      const i = ref ? kolona(ref) : red.length;
      while (red.length < i) red.push('');
      red[i] = tekst.trim();
    }
    redovi.push(red);
  }
  return redovi;
}

// --------------------------------------------------------------------------
// Turning any table into the timetable grid
// --------------------------------------------------------------------------

const PREFIKSI = [
  ['pon', 'mon', 'пон'],
  ['uto', 'tue', 'уто'],
  ['sre', 'wed', 'сре'],
  ['cet', 'thu', 'чет'],
  ['pet', 'fri', 'пет'],
];

/** 0–4 for a weekday name in Latin, Cyrillic or English, else -1. */
export function danIzNaziva(s: string): number {
  const n = s
    .trim()
    .toLocaleLowerCase('sr')
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .slice(0, 3);
  return PREFIKSI.findIndex((p) => p.includes(n));
}

function bezPraznih(redovi: string[][]): string[][] {
  const r = redovi.filter((red) => red.some((c) => c.trim()));
  const sirina = Math.max(0, ...r.map((red) => red.length));
  const pune = Array.from({ length: sirina }, (_, i) => r.some((red) => (red[i] ?? '').trim()));
  return r.map((red) => Array.from({ length: sirina }, (_, i) => red[i] ?? '').filter((_, i) => pune[i]));
}

const IZGLEDA_KAO_CAS = /^(\d{1,2}\.?|\d{1,2}[:.]\d{2}.*|[ivx]+\.?)$/i;

export function uRaspored(ulaz: string[][]): Pick<UlazRasporeda, 'casovi' | 'tabela'> {
  let redovi = bezPraznih(ulaz);
  if (!redovi.length) throw new Error('Tabela je prazna.');

  // Days down the first column instead of across the top: turn it around.
  const daniURedu = redovi[0].filter((c) => danIzNaziva(c) >= 0).length;
  const daniUKoloni = redovi.filter((r) => danIzNaziva(r[0] ?? '') >= 0).length;
  if (daniUKoloni >= 3 && daniUKoloni > daniURedu) {
    redovi = redovi[0].map((_, i) => redovi.map((r) => r[i] ?? ''));
  }

  let kolonaDana: number[];
  let telo = redovi;
  const zaglavlje = redovi[0].map(danIzNaziva);
  if (zaglavlje.filter((d) => d >= 0).length >= 3) {
    kolonaDana = [0, 1, 2, 3, 4].map((d) => zaglavlje.indexOf(d));
    telo = redovi.slice(1);
  } else {
    const prvaJeCas = telo.filter((r) => IZGLEDA_KAO_CAS.test((r[0] ?? '').trim())).length >= Math.ceil(telo.length / 2);
    const od = prvaJeCas ? 1 : 0;
    kolonaDana = [0, 1, 2, 3, 4].map((d) => od + d);
  }

  const levo = kolonaDana.filter((k) => k >= 0);
  const kolonaCasa = levo.length && Math.min(...levo) > 0 ? 0 : -1;
  const casovi = telo.map((r, i) => (kolonaCasa >= 0 && r[kolonaCasa]?.trim() ? r[kolonaCasa].trim() : `${i + 1}.`));
  const tabela = telo.map((r) => kolonaDana.map((k) => (k >= 0 ? (r[k] ?? '').trim() : '')));
  return { casovi, tabela };
}

/** Read a picked file (CSV or Excel) into the timetable grid. */
export async function uveziFajl(fajl: File): Promise<Pick<UlazRasporeda, 'casovi' | 'tabela'>> {
  const ime = fajl.name.toLowerCase();
  if (ime.endsWith('.xls')) throw new Error('Stari .xls format nije podržan. U Excelu: Sačuvaj kao → .xlsx ili CSV.');
  const redovi = ime.endsWith('.xlsx') ? await citajXlsx(await fajl.arrayBuffer()) : parsirajCsv(await fajl.text());
  return uRaspored(redovi);
}
