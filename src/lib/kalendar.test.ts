import { describe, expect, it } from 'vitest';
import { GreskaPravila } from './domen';
import {
  type Boravak,
  type PredlogBoravka,
  type ZahtevKalendara,
  daniZahteva,
  efektivno,
  mesecnaMreza,
  napraviZahtev,
  odbijZahtev,
  ponovi,
  povuciZahtev,
  prihvatiZahtev,
  segmentiDana,
  trenutnoKod,
} from './kalendar';

const TATA = 'tata';
const MAMA = 'mama';
const RODITELJI = [TATA, MAMA];
const T = '2026-11-04T10:00:00.000Z';
let n = 0;
const noviId = () => `n${++n}`;

function b(id: string, kod: string, od: string, doT: string, vrsta: Boravak['vrsta'] = 'redovno'): Boravak {
  return { id, vrsta, kod, od, do: doT, napomena: '', kreirano: T };
}

// Mama Mon 08:00 → Wed 15:00, Tata Wed 15:00 → Thu 08:00, Mama Thu 08:00 → Mon 08:00.
const RASPORED: Boravak[] = [
  b('r1', MAMA, '2026-11-02T08:00', '2026-11-04T15:00'),
  b('r2', TATA, '2026-11-04T15:00', '2026-11-05T08:00'),
  b('r3', MAMA, '2026-11-05T08:00', '2026-11-09T08:00'),
];

function predlog(p: Partial<PredlogBoravka> = {}): PredlogBoravka {
  return { vrsta: 'izuzetak', kod: TATA, od: '2026-11-07T10:00', do: '2026-11-08T18:00', napomena: '', ...p };
}

describe('ko ima dete', () => {
  it('redovan raspored, sa primopredajom na granici', () => {
    expect(efektivno(RASPORED, '2026-11-04T14:59')?.kod).toBe(MAMA);
    expect(efektivno(RASPORED, '2026-11-04T15:00')?.kod).toBe(TATA);
    expect(efektivno(RASPORED, '2026-11-10T12:00')).toBeNull();
  });

  it('jednokratna promena važi preko redovnog rasporeda', () => {
    const sa = [...RASPORED, b('i1', TATA, '2026-11-07T10:00', '2026-11-08T18:00', 'izuzetak')];
    expect(efektivno(sa, '2026-11-07T12:00')?.kod).toBe(TATA);
    expect(efektivno(sa, '2026-11-08T18:00')?.kod).toBe(MAMA);
  });

  it('dan se deli na segmente po vremenu', () => {
    expect(segmentiDana('2026-11-04', RASPORED)).toEqual([
      { kod: MAMA, izuzetak: false, od: 0, do: 900 },
      { kod: TATA, izuzetak: false, od: 900, do: 1440 },
    ]);
    expect(segmentiDana('2026-11-06', RASPORED)).toEqual([{ kod: MAMA, izuzetak: false, od: 0, do: 1440 }]);
    expect(segmentiDana('2026-11-12', RASPORED)).toEqual([{ kod: null, izuzetak: false, od: 0, do: 1440 }]);
  });

  it('sledeća primopredaja preskače granice bez promene roditelja', () => {
    const sa = [...RASPORED, b('r4', MAMA, '2026-11-09T08:00', '2026-11-11T15:00')];
    const r = trenutnoKod(sa, new Date(2026, 10, 5, 12, 0));
    expect(r.kod).toBe(MAMA);
    expect(r.sledeca).toEqual({ kada: '2026-11-11T15:00', od: MAMA, ka: null });
    expect(trenutnoKod(RASPORED, new Date(2026, 10, 4, 9, 0)).sledeca).toEqual({
      kada: '2026-11-04T15:00',
      od: MAMA,
      ka: TATA,
    });
  });
});

describe('mesec', () => {
  it('nedelje počinju ponedeljkom i pokrivaju ceo mesec', () => {
    const m = mesecnaMreza(2026, 10); // novembar 2026: 1. je nedelja
    expect(m[0][0]).toBe('2026-10-26');
    expect(m[0][6]).toBe('2026-11-01');
    expect(m.at(-1)!.at(-1)).toBe('2026-12-06');
    expect(m.every((n) => n.length === 7)).toBe(true);
  });
});

describe('ponavljanje', () => {
  it('svake druge nedelje do datuma', () => {
    const p = ponovi(predlog({ vrsta: 'redovno', od: '2026-11-06T18:00', do: '2026-11-09T08:00' }), 14, '2026-12-05');
    expect(p.map((x) => [x.od, x.do])).toEqual([
      ['2026-11-06T18:00', '2026-11-09T08:00'],
      ['2026-11-20T18:00', '2026-11-23T08:00'],
      ['2026-12-04T18:00', '2026-12-07T08:00'],
    ]);
  });

  it('prelazak na zimsko vreme ne pomera dan', () => {
    const p = ponovi(predlog({ od: '2026-10-21T18:00', do: '2026-10-22T08:00' }), 7, '2026-11-01');
    expect(p.map((x) => x.od)).toEqual(['2026-10-21T18:00', '2026-10-28T18:00']);
  });
});

describe('zahtevi: niko ne menja kalendar sam', () => {
  function zahtev(ulaz: Partial<Parameters<typeof napraviZahtev>[0]> = {}, ko = MAMA): ZahtevKalendara {
    const z = napraviZahtev(
      { vrsta: 'dodaj', boravakId: null, boravci: [predlog()], poruka: '', ...ulaz },
      ko,
      RODITELJI,
      RASPORED,
      T,
    );
    return { id: 'z1', ...z };
  }

  it('novi zahtev čeka i ništa ne menja dok ga drugi ne prihvati', () => {
    const z = zahtev();
    expect(z.stanje).toBe('ceka');
    expect(() => prihvatiZahtev(z, MAMA, RASPORED, T, noviId)).toThrow(GreskaPravila);
    const r = prihvatiZahtev(z, TATA, RASPORED, T, noviId);
    expect(r.zahtev).toMatchObject({ stanje: 'prihvacen', resio: TATA });
    expect(r.boravci).toHaveLength(RASPORED.length + 1);
    expect(efektivno(r.boravci, '2026-11-07T12:00')?.kod).toBe(TATA);
  });

  it('izmena i brisanje važe tek posle prihvatanja', () => {
    const izmena = zahtev({ vrsta: 'izmeni', boravakId: 'r2', boravci: [predlog({ vrsta: 'redovno', od: '2026-11-04T16:00', do: '2026-11-05T08:00' })] });
    const posle = prihvatiZahtev(izmena, TATA, RASPORED, T, noviId).boravci;
    expect(posle.some((x) => x.id === 'r2')).toBe(false);
    expect(efektivno(posle, '2026-11-04T15:30')).toBeNull();

    const brisanje = zahtev({ vrsta: 'obrisi', boravakId: 'r2', boravci: [] });
    expect(prihvatiZahtev(brisanje, TATA, RASPORED, T, noviId).boravci.map((x) => x.id)).toEqual(['r1', 'r3']);
  });

  it('preklapanje u istom sloju se odbija, jednokratna promena sme preko redovnog', () => {
    expect(() => zahtev({ boravci: [predlog({ vrsta: 'redovno' })] })).toThrow(/Preklapa/);
    // One request is one layer: the title the other parent sees must be true.
    expect(() =>
      zahtev({ boravci: [predlog({ od: '2026-12-01T10:00', do: '2026-12-02T10:00' }), predlog({ vrsta: 'redovno', od: '2026-12-03T10:00', do: '2026-12-04T10:00' })] }),
    ).toThrow(/posebno/);
    expect(() => zahtev()).not.toThrow();
  });

  it('pri prihvatanju se ponovo proverava, jer se kalendar u međuvremenu promenio', () => {
    const z = zahtev();
    const sad = [...RASPORED, b('i9', MAMA, '2026-11-07T00:00', '2026-11-07T23:00', 'izuzetak')];
    expect(() => prihvatiZahtev(z, TATA, sad, T, noviId)).toThrow(/Ne može/);
  });

  it('odbijanje traži razlog; povlači samo predlagač', () => {
    const z = zahtev();
    expect(() => odbijZahtev(z, TATA, ' ', T)).toThrow(GreskaPravila);
    expect(odbijZahtev(z, TATA, 'Taj vikend putujemo', T)).toMatchObject({ stanje: 'odbijen', razlog: 'Taj vikend putujemo' });
    expect(() => povuciZahtev(z, TATA, T)).toThrow(GreskaPravila);
    expect(povuciZahtev(z, MAMA, T).stanje).toBe('povucen');
    expect(() => prihvatiZahtev(povuciZahtev(z, MAMA, T), TATA, RASPORED, T, noviId)).toThrow(/rešen/);
  });

  it('neispravan unos', () => {
    expect(() => zahtev({ boravci: [predlog({ od: '2026-11-08T10:00', do: '2026-11-07T10:00' })] })).toThrow(/posle/);
    expect(() => zahtev({ boravci: [predlog({ kod: 'baka' })] })).toThrow(GreskaPravila);
    expect(() => zahtev({ vrsta: 'obrisi', boravakId: 'nema', boravci: [] })).toThrow(/ne postoji/);
  });

  it('obeležava dane na koje zahtev utiče', () => {
    expect([...daniZahteva(zahtev(), RASPORED)]).toEqual(['2026-11-07', '2026-11-08']);
    const z = zahtev({ boravci: [predlog({ od: '2026-11-07T18:00', do: '2026-11-08T00:00' })] });
    expect([...daniZahteva(z, RASPORED)]).toEqual(['2026-11-07']);
  });
});
