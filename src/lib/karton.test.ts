import { describe, expect, it } from 'vitest';
import { GreskaPravila } from './domen';
import { type UnosKartona, godine, godineTekst, nedostaje, obrisiUnos, sacuvajUnos, sazetak } from './karton';

const T = '2026-11-04T10:00:00.000Z';
let n = 0;
const noviId = () => `k${++n}`;

const OBUCA: UnosKartona = {
  id: 'u1',
  grupa: 'mere',
  naziv: 'Obuća',
  vrednost: '33',
  izmenio: 'tata',
  izmenjeno: '2026-10-01T10:00:00.000Z',
};

describe('karton', () => {
  it('novo polje se dodaje i beleži', () => {
    const r = sacuvajUnos([], { id: null, grupa: 'zdravlje', naziv: ' Alergije ', vrednost: ' polen ' }, 'mama', T, noviId);
    expect(r.unosi).toHaveLength(1);
    expect(r.unosi[0]).toMatchObject({ naziv: 'Alergije', vrednost: 'polen', izmenio: 'mama' });
    expect(r.izmena).toMatchObject({ staro: null, novo: 'polen', autor: 'mama' });
  });

  it('izmena pamti staru i novu vrednost; ista vrednost se ne beleži', () => {
    const r = sacuvajUnos([OBUCA], { id: 'u1', grupa: 'mere', naziv: 'Obuća', vrednost: '34' }, 'mama', T, noviId);
    expect(r.unosi[0]).toMatchObject({ vrednost: '34', izmenio: 'mama', izmenjeno: T });
    expect(r.izmena).toMatchObject({ staro: '33', novo: '34' });
    expect(sacuvajUnos([OBUCA], { id: 'u1', grupa: 'mere', naziv: 'Obuća', vrednost: '33' }, 'mama', T, noviId).izmena).toBeNull();
  });

  it('prazno se ne čuva; brisanje se beleži', () => {
    expect(() => sacuvajUnos([], { id: null, grupa: 'mere', naziv: 'Obuća', vrednost: ' ' }, 'mama', T, noviId)).toThrow(GreskaPravila);
    const r = obrisiUnos([OBUCA], 'u1', 'tata', T);
    expect(r.unosi).toEqual([]);
    expect(r.izmena).toMatchObject({ staro: '33', novo: null, naziv: 'Obuća' });
  });

  it('predlaže polja koja nedostaju', () => {
    expect(nedostaje('mere', [OBUCA])).toEqual(['Visina', 'Težina', 'Odeća']);
  });

  it('aktivnosti su spisak: koliko god zapisa, svaki sa svojim detaljima', () => {
    let unosi: UnosKartona[] = [];
    for (const [naziv, termini] of [['Fudbal', 'uto 17h'], ['Engleski', 'sub 10h'], ['Plivanje', '']]) {
      unosi = sacuvajUnos(unosi, { id: null, grupa: 'aktivnosti', naziv, vrednost: '', detalji: { termini } }, 'tata', T, noviId).unosi;
    }
    expect(unosi.map((u) => u.naziv)).toEqual(['Fudbal', 'Engleski', 'Plivanje']);
    expect(unosi[2].detalji).toEqual({});
    expect(nedostaje('aktivnosti', unosi)).toEqual([]);
  });

  it('izmena detalja zapisa se beleži kao sažetak', () => {
    const r1 = sacuvajUnos([], { id: null, grupa: 'aktivnosti', naziv: 'Fudbal', vrednost: '', detalji: { termini: 'uto 17h' } }, 'tata', T, noviId);
    const id = r1.unosi[0].id;
    const r2 = sacuvajUnos(r1.unosi, { id, grupa: 'aktivnosti', naziv: 'Fudbal', vrednost: '', detalji: { termini: 'uto 18h', mesto: ' sala ' } }, 'mama', T, noviId);
    expect(r2.izmena).toMatchObject({ staro: 'Fudbal · uto 17h', novo: 'Fudbal · uto 18h · sala' });
    expect(sacuvajUnos(r2.unosi, { id, grupa: 'aktivnosti', naziv: 'Fudbal', vrednost: '', detalji: { termini: 'uto 18h', mesto: 'sala' } }, 'mama', T, noviId).izmena).toBeNull();
  });

  it('zapis traži samo naslov; stari tekst bez detalja postaje napomena', () => {
    expect(() => sacuvajUnos([], { id: null, grupa: 'kontakti', naziv: ' ', vrednost: '' }, 'mama', T, noviId)).toThrow(GreskaPravila);
    expect(sazetak({ grupa: 'kontakti', naziv: 'Baka', vrednost: 'blizu škole' })).toBe('Baka · blizu škole');
  });

  it('računa godine iz više zapisa datuma', () => {
    const sada = new Date(2026, 10, 4);
    expect(godine('15. 4. 2018.', sada)).toBe(8);
    expect(godine('05.11.2018', sada)).toBe(7);
    expect(godine('2018-11-04', sada)).toBe(8);
    expect(godine('april 2018', sada)).toBeNull();
    expect([1, 3, 8, 12, 21].map(godineTekst)).toEqual(['1 godina', '3 godine', '8 godina', '12 godina', '21 godina']);
  });
});
