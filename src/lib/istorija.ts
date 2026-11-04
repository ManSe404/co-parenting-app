// History of agreements: every closed item with the decision written down,
// newest first, grouped by month. It belongs to the items, not to the karton.

import type { OblastKljuc, Stavka } from './tipovi';

export interface FilterIstorije {
  oblast: OblastKljuc | '';
  q: string;
}

export function istorija(stavke: Stavka[], f: FilterIstorije): { mesec: string; stavke: Stavka[] }[] {
  const q = f.q.trim().toLocaleLowerCase('sr');
  const zatvorene = stavke
    .filter((s) => s.stanje === 'zatvoreno')
    .filter((s) => !f.oblast || s.oblast === f.oblast)
    .filter((s) => !q || `${s.naslov} ${s.opis} ${s.odluka ?? ''}`.toLocaleLowerCase('sr').includes(q))
    .sort((a, b) => (b.zatvoreno ?? b.izmenjeno).localeCompare(a.zatvoreno ?? a.izmenjeno));

  const grupe: { mesec: string; stavke: Stavka[] }[] = [];
  for (const s of zatvorene) {
    const mesec = (s.zatvoreno ?? s.izmenjeno).slice(0, 7);
    const poslednja = grupe.at(-1);
    if (poslednja?.mesec === mesec) poslednja.stavke.push(s);
    else grupe.push({ mesec, stavke: [s] });
  }
  return grupe;
}
