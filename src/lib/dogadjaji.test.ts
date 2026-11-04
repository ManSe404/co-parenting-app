import { describe, expect, it } from 'vitest';
import { GreskaPravila } from './domen';
import {
  type Dogadjaj,
  type PredlogDogadjaja,
  napraviZahtevDogadjaja,
  opisPonavljanja,
  pojave,
  pomeriDogadjaj,
  prihvatiZahtevDogadjaja,
  primopredajeDana,
  rasporediKolone,
} from './dogadjaji';
import type { Boravak, ZahtevKalendara } from './kalendar';
import { odbijZahtev, pomeriPrelazak } from './kalendar';
import { ostaleRazlike } from './kalendar-opis';

const T = '2026-11-04T10:00:00.000Z';
const RODITELJI = ['tata', 'mama'];
let n = 0;
const noviId = () => `d${++n}`;

function predlog(p: Partial<PredlogDogadjaja> = {}): PredlogDogadjaja {
  return {
    naziv: 'Fudbal',
    vrsta: 'trening',
    datum: '2026-11-03',
    ceoDan: false,
    od: '17:00',
    do: '18:00',
    ponavljanje: { tip: 'ne' },
    vodi: null,
    mesto: '',
    napomena: '',
    ...p,
  };
}

const d = (id: string, p: Partial<PredlogDogadjaja> = {}): Dogadjaj => ({ id, kreirano: T, ...predlog(p) });

describe('ponavljanje', () => {
  it('nedeljno, utorkom i četvrtkom, do datuma', () => {
    const fudbal = d('f', { ponavljanje: { tip: 'nedeljno', svakih: 1, dani: [1, 3], do: '2026-11-12' } });
    expect(pojave([fudbal], '2026-11-01', '2026-11-30').map((p) => p.datum)).toEqual([
      '2026-11-03',
      '2026-11-05',
      '2026-11-10',
      '2026-11-12',
    ]);
  });

  it('svake druge nedelje, bez kraja', () => {
    const e = d('e', { datum: '2026-11-07', ponavljanje: { tip: 'nedeljno', svakih: 2, dani: [5], do: null } });
    expect(pojave([e], '2026-11-01', '2026-12-06').map((p) => p.datum)).toEqual(['2026-11-07', '2026-11-21', '2026-12-05']);
  });

  it('ne počinje pre prvog dana i poštuje opseg', () => {
    const e = d('e', { datum: '2026-11-10', ponavljanje: { tip: 'nedeljno', svakih: 1, dani: [0, 1], do: null } });
    expect(pojave([e], '2026-11-09', '2026-11-17').map((p) => p.datum)).toEqual(['2026-11-10', '2026-11-16', '2026-11-17']);
  });

  it('ceo dan ide pre vremenskih, vremenski po početku', () => {
    const p = pojave([d('a', { od: '18:00', do: '19:00' }), d('b', { ceoDan: true }), d('c', { od: '09:00', do: '10:00' })], '2026-11-03', '2026-11-03');
    expect(p.map((x) => x.dogadjaj.id)).toEqual(['b', 'c', 'a']);
    expect(p[1]).toMatchObject({ odMin: 540, doMin: 600 });
  });

  it('opis', () => {
    expect(opisPonavljanja({ tip: 'nedeljno', svakih: 1, dani: [3, 1], do: '2026-12-20' })).toBe('uto, čet · svake nedelje do 20. 12.');
  });
});

describe('raspored blokova u danu', () => {
  it('preklopljeni dele širinu, odvojeni ne', () => {
    const r = rasporediKolone([
      { id: 'a', odMin: 600, doMin: 720 },
      { id: 'b', odMin: 660, doMin: 780 },
      { id: 'c', odMin: 900, doMin: 960 },
    ]);
    const po = Object.fromEntries(r.map((x) => [x.id, [x.kolona, x.kolona_ukupno]]));
    expect(po).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });
});

describe('primopredaje u danu', () => {
  const b = (id: string, kod: string, od: string, doT: string): Boravak => ({ id, vrsta: 'redovno', kod, od, do: doT, napomena: '', kreirano: T });
  it('beleži ko predaje kome i kada', () => {
    const boravci = [b('1', 'mama', '2026-11-02T08:00', '2026-11-04T15:00'), b('2', 'tata', '2026-11-04T15:00', '2026-11-05T08:00')];
    expect(primopredajeDana('2026-11-04', boravci)).toEqual([{ min: 900, od: 'mama', ka: 'tata' }]);
    expect(primopredajeDana('2026-11-03', boravci)).toEqual([]);
  });
});

describe('zahtevi za aktivnosti: niko sam', () => {
  const ulaz = { vrsta: 'dodaj' as const, dogadjajId: null, dogadjaj: predlog({ naziv: ' Rođendan ', vrsta: 'rodjendan' as const }), poruka: '' };

  it('dodavanje čeka potvrdu drugog roditelja', () => {
    const z: ZahtevKalendara = { id: 'z', ...napraviZahtevDogadjaja(ulaz, 'mama', RODITELJI, [], T) };
    expect(z).toMatchObject({ predmet: 'dogadjaj', stanje: 'ceka' });
    expect(() => prihvatiZahtevDogadjaja(z, 'mama', [], T, noviId)).toThrow(GreskaPravila);
    const r = prihvatiZahtevDogadjaja(z, 'tata', [], T, noviId);
    expect(r.dogadjaji).toHaveLength(1);
    expect(r.dogadjaji[0].naziv).toBe('Rođendan');
  });

  it('izmena zadržava id; brisanje uklanja; odbijanje ne menja ništa', () => {
    const postoji = [d('f')];
    const izmena: ZahtevKalendara = {
      id: 'z1',
      ...napraviZahtevDogadjaja({ vrsta: 'izmeni', dogadjajId: 'f', dogadjaj: predlog({ od: '18:00', do: '19:00' }), poruka: '' }, 'tata', RODITELJI, postoji, T),
    };
    const posle = prihvatiZahtevDogadjaja(izmena, 'mama', postoji, T, noviId).dogadjaji;
    expect(posle.map((x) => [x.id, x.od])).toEqual([['f', '18:00']]);

    const brisanje: ZahtevKalendara = { id: 'z2', ...napraviZahtevDogadjaja({ vrsta: 'obrisi', dogadjajId: 'f', dogadjaj: null, poruka: '' }, 'tata', RODITELJI, postoji, T) };
    expect(prihvatiZahtevDogadjaja(brisanje, 'mama', postoji, T, noviId).dogadjaji).toEqual([]);
    expect(odbijZahtev(brisanje, 'mama', 'Trening i dalje traje', T).stanje).toBe('odbijen');
  });

  it('preskočeni dani ne idu kroz predlog, a izmena serije ih čuva', () => {
    const nedeljno = { tip: 'nedeljno' as const, svakih: 1 as const, dani: [1], do: null };
    const serija = d('s', { ponavljanje: nedeljno, izuzeti: ['2026-11-10'] });
    const z: ZahtevKalendara = {
      id: 'z3',
      ...napraviZahtevDogadjaja(
        { vrsta: 'izmeni', dogadjajId: 's', dogadjaj: { ...predlog({ ponavljanje: nedeljno, od: '17:30', do: '18:30' }), izuzeti: [] }, poruka: '' },
        'tata',
        RODITELJI,
        [serija],
        T,
      ),
    };
    expect(z.dogadjaj).not.toHaveProperty('izuzeti');
    expect(prihvatiZahtevDogadjaja(z, 'mama', [serija], T, noviId).dogadjaji[0]).toMatchObject({ id: 's', od: '17:30', izuzeti: ['2026-11-10'] });
  });

  it('drugi roditelj vidi i vrstu, mesto i napomenu', () => {
    expect(ostaleRazlike(predlog(), predlog({ vrsta: 'ostalo', mesto: 'Bazen', napomena: 'Ponesi kapu' }))).toEqual([
      'vrsta: Trening → Ostalo',
      'mesto: bez mesta → „Bazen“',
      'napomena: „Ponesi kapu“',
    ]);
    expect(ostaleRazlike(predlog(), predlog())).toEqual([]);
  });

  it('neispravan unos', () => {
    const z = (p: Partial<PredlogDogadjaja>) => napraviZahtevDogadjaja({ ...ulaz, dogadjaj: predlog(p) }, 'mama', RODITELJI, [], T);
    expect(() => z({ naziv: ' ' })).toThrow(/naziv/);
    expect(() => z({ od: '18:00', do: '17:00' })).toThrow(/posle/);
    expect(() => z({ ponavljanje: { tip: 'nedeljno', svakih: 1, dani: [], do: null } })).toThrow(/dane/);
    expect(() => z({ ceoDan: true, od: '', do: '' })).not.toThrow();
  });
});

describe('prevlačenje u kalendaru', () => {
  const fudbal = d('f', { ponavljanje: { tip: 'nedeljno', svakih: 1, dani: [1, 3], do: null } }); // uto, čet 17–18

  it('jednokratna aktivnost: novi dan i vreme, isto trajanje', () => {
    const r = pomeriDogadjaj(d('r', { datum: '2026-11-14', od: '12:00', do: '15:00' }), '2026-11-14', '2026-11-15', 16 * 60, true);
    expect(r).toMatchObject({ vrsta: 'izmeni', dogadjajId: 'r' });
    expect(r.dogadjaj).toMatchObject({ datum: '2026-11-15', od: '16:00', do: '19:00' });
  });

  it('ponavljanje, samo ovaj put: serija preskače taj dan, umesto njega jednokratna', () => {
    const ulaz = pomeriDogadjaj(fudbal, '2026-11-05', '2026-11-06', 18 * 60, false);
    expect(ulaz).toMatchObject({ jednom: '2026-11-05' });
    const z: ZahtevKalendara = { id: 'z', ...napraviZahtevDogadjaja(ulaz, 'tata', RODITELJI, [fudbal], T) };
    expect(() => prihvatiZahtevDogadjaja(z, 'tata', [fudbal], T, noviId)).toThrow(GreskaPravila);
    const posle = prihvatiZahtevDogadjaja(z, 'mama', [fudbal], T, noviId).dogadjaji;
    expect(pojave(posle, '2026-11-03', '2026-11-12').map((p) => [p.datum, p.dogadjaj.od])).toEqual([
      ['2026-11-03', '17:00'],
      ['2026-11-06', '18:00'],
      ['2026-11-10', '17:00'],
      ['2026-11-12', '17:00'],
    ]);
  });

  it('ponavljanje, svaki put: menja dan u nedelji i vreme serije', () => {
    const r = pomeriDogadjaj(fudbal, '2026-11-05', '2026-11-06', 18 * 60, true);
    expect(r.jednom).toBeUndefined();
    expect(r.dogadjaj).toMatchObject({ od: '18:00', do: '19:00', ponavljanje: { dani: [1, 4] } });
  });

  it('ne prelazi u sledeći dan', () => {
    expect(() => pomeriDogadjaj(d('k'), '2026-11-03', '2026-11-03', 23 * 60 + 30, true)).toThrow(/sledeći dan/);
  });

  it('pomeren prelazak je jednokratna promena za razliku u vremenu', () => {
    const pp = { min: 900, od: 'mama', ka: 'tata' };
    expect(pomeriPrelazak('2026-11-04', pp, 1020)).toMatchObject({ vrsta: 'izuzetak', kod: 'mama', od: '2026-11-04T15:00', do: '2026-11-04T17:00' });
    expect(pomeriPrelazak('2026-11-04', pp, 780)).toMatchObject({ kod: 'tata', od: '2026-11-04T13:00', do: '2026-11-04T15:00' });
    expect(() => pomeriPrelazak('2026-11-04', pp, 900)).toThrow(/isto/);
  });
});
