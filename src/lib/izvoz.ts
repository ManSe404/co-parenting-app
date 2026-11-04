import type { Podaci, Stavka } from './tipovi';

const NAZIV_STANJA = { neodgovoreno: 'Neodgovoreno', otvoreno: 'Otvoreno', zatvoreno: 'Zatvoreno' };

function polje(v: string): string {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV with a BOM, so Excel and Google Sheets read the Serbian letters right. */
export function uCsv(stavke: Stavka[], p: Podaci): string {
  const oblast = new Map(p.oblasti.map((o) => [o.kljuc, o.naziv]));
  const roditelj = new Map([p.ja, p.drugi].map((r) => [r.id, r.oznaka]));
  const zaglavlje = ['Naslov', 'Oblast', 'Stanje', 'Važno', 'Hitno', 'Datum', 'Otvorio', 'Opis', 'Odluka', 'Kreirano', 'Izmenjeno', 'Zatvoreno'];
  const redovi = stavke.map((s) => [
    s.naslov,
    oblast.get(s.oblast) ?? s.oblast,
    NAZIV_STANJA[s.stanje],
    s.vazno ? 'da' : '',
    s.hitno ? 'da' : '',
    s.datum ?? '',
    roditelj.get(s.otvorio) ?? s.otvorio,
    s.opis,
    s.odluka ?? '',
    s.kreirano,
    s.izmenjeno,
    s.zatvoreno ?? '',
  ]);
  return '﻿' + [zaglavlje, ...redovi].map((r) => r.map(polje).join(',')).join('\r\n');
}

export function preuzmi(ime: string, sadrzaj: string): void {
  const url = URL.createObjectURL(new Blob([sadrzaj], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: ime });
  a.click();
  URL.revokeObjectURL(url);
}
