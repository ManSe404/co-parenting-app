import { describe, expect, it } from 'vitest';
import { istorija } from './istorija';
import type { Stavka } from './tipovi';

const T = '2026-11-04T10:00:00.000Z';

describe('istorija odluka', () => {
  function s(id: string, p: Partial<Stavka>): Stavka {
    return {
      id,
      naslov: id,
      opis: '',
      oblast: 'skola',
      stanje: 'zatvoreno',
      vazno: false,
      hitno: false,
      datum: null,
      otvorio: 'tata',
      odluka: 'x',
      zatvaranjePredlozio: null,
      kreirano: T,
      izmenjeno: T,
      zatvoreno: T,
      ...p,
    };
  }

  const stavke = [
    s('a', { zatvoreno: '2026-11-02T10:00:00.000Z', odluka: 'Kupuje tata patike' }),
    s('b', { zatvoreno: '2026-10-20T10:00:00.000Z', oblast: 'zdravlje' }),
    s('c', { zatvoreno: '2026-11-03T10:00:00.000Z' }),
    s('d', { stanje: 'otvoreno', zatvoreno: null }),
  ];

  it('samo zatvorene, najnovije prve, po mesecima', () => {
    expect(istorija(stavke, { oblast: '', q: '' }).map((g) => [g.mesec, g.stavke.map((x) => x.id)])).toEqual([
      ['2026-11', ['c', 'a']],
      ['2026-10', ['b']],
    ]);
  });

  it('filtrira po oblasti i traži i po odluci', () => {
    expect(istorija(stavke, { oblast: 'zdravlje', q: '' }).flatMap((g) => g.stavke.map((x) => x.id))).toEqual(['b']);
    expect(istorija(stavke, { oblast: '', q: 'patike' }).flatMap((g) => g.stavke.map((x) => x.id))).toEqual(['a']);
  });
});
