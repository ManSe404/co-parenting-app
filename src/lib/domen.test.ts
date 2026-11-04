import { describe, expect, it } from 'vitest';
import {
  GreskaPravila,
  aktiviraj,
  kolona,
  potezZaKolonu,
  cekaDrugog,
  danaDo,
  izmeni,
  jeHitno,
  naPotezu,
  napraviPregled,
  odbijZatvaranje,
  odgovori,
  ponovoOtvori,
  potvrdiZatvaranje,
  povuciPredlog,
  predloziZatvaranje,
  proveriNovu,
} from './domen';
import type { Podaci, Stavka, Unos } from './tipovi';

const TATA = 'tata';
const MAMA = 'mama';
const SADA = new Date(2026, 10, 3, 10, 0); // utorak, 3. novembar 2026.
const T = '2026-11-03T10:00:00.000Z';

function stavka(izmene: Partial<Stavka> = {}): Stavka {
  return {
    id: 's1',
    naslov: 'Potvrda za izlet',
    opis: '',
    oblast: 'skola',
    stanje: 'neodgovoreno',
    vazno: false,
    hitno: false,
    datum: null,
    otvorio: TATA,
    odluka: null,
    zatvaranjePredlozio: null,
    kreirano: '2026-11-01T08:00:00.000Z',
    izmenjeno: '2026-11-01T08:00:00.000Z',
    zatvoreno: null,
    ...izmene,
  };
}

function podaci(stavke: Stavka[], unosi: Unos[] = [], videoOd: string | null = null): Podaci {
  return {
    ja: { id: TATA, oznaka: 'Tata', oznakaAkuzativ: 'tatu', oznakaGenitiv: 'tate', boja: 'bio', poslednjaPoseta: null },
    drugi: { id: MAMA, oznaka: 'Mama', oznakaAkuzativ: 'mamu', oznakaGenitiv: 'mame', boja: 'ai', poslednjaPoseta: null },
    dete: { ime: 'Dete' },
    oblasti: [
      { kljuc: 'skola', naziv: 'Škola' },
      { kljuc: 'zdravlje', naziv: 'Zdravlje' },
      { kljuc: 'ostalo', naziv: 'Ostalo' },
    ],
    stavke,
    unosi,
    boravci: [],
    dogadjaji: [],
    zahtevi: [],
    karton: [],
    izmeneKartona: [],
    rasporedCasova: null,
    videoOd,
  };
}

describe('datumi', () => {
  it('broji kalendarske dane od danas', () => {
    expect(danaDo('2026-11-03', SADA)).toBe(0);
    expect(danaDo('2026-11-06', SADA)).toBe(3);
    expect(danaDo('2026-11-01', SADA)).toBe(-2);
  });
});

describe('ko je na potezu', () => {
  it('neodgovoreno čeka roditelja koji nije pitao', () => {
    const s = stavka();
    expect(naPotezu(s, MAMA)).toBe(true);
    expect(naPotezu(s, TATA)).toBe(false);
    expect(cekaDrugog(s, TATA)).toBe(true);
  });

  it('otvoreno bez predloga nikoga ne čeka', () => {
    const s = stavka({ stanje: 'otvoreno' });
    expect(naPotezu(s, MAMA)).toBe(false);
    expect(naPotezu(s, TATA)).toBe(false);
  });

  it('predlog zatvaranja čeka drugog roditelja', () => {
    const s = stavka({ stanje: 'otvoreno', zatvaranjePredlozio: MAMA, odluka: 'Ide' });
    expect(naPotezu(s, TATA)).toBe(true);
    expect(cekaDrugog(s, MAMA)).toBe(true);
  });

  it('zatvoreno nikoga ne čeka', () => {
    const s = stavka({ stanje: 'zatvoreno' });
    expect(naPotezu(s, MAMA) || naPotezu(s, TATA)).toBe(false);
  });
});

describe('hitno', () => {
  it('ručna oznaka', () => {
    expect(jeHitno(stavka({ hitno: true }), SADA)).toBe(true);
  });

  it('datum u naredna 3 dana ili prošao', () => {
    expect(jeHitno(stavka({ datum: '2026-11-06' }), SADA)).toBe(true);
    expect(jeHitno(stavka({ datum: '2026-11-07' }), SADA)).toBe(false);
    expect(jeHitno(stavka({ datum: '2026-10-30' }), SADA)).toBe(true);
  });

  it('zatvoreno nije hitno ni sa oznakom', () => {
    expect(jeHitno(stavka({ hitno: true, stanje: 'zatvoreno' }), SADA)).toBe(false);
  });
});

describe('prelazi stanja', () => {
  it('odgovor drugog roditelja otvara stavku', () => {
    const p = odgovori(stavka(), MAMA, 'Može', T);
    expect(p.stavka.stanje).toBe('otvoreno');
    expect(p.unos).toMatchObject({ autor: MAMA, vrsta: 'odgovor', tekst: 'Može' });
  });

  it('dopuna onoga ko je pitao ostavlja neodgovoreno', () => {
    expect(odgovori(stavka(), TATA, 'Rok je petak', T).stavka.stanje).toBe('neodgovoreno');
  });

  it('prazan odgovor se odbija', () => {
    expect(() => odgovori(stavka(), MAMA, '   ', T)).toThrow(GreskaPravila);
  });

  it('zatvaranje traži odluku i potvrdu drugog roditelja', () => {
    const s = stavka({ stanje: 'otvoreno' });
    expect(() => predloziZatvaranje(s, TATA, '', T)).toThrow(GreskaPravila);

    const predlog = predloziZatvaranje(s, TATA, 'Potpisuje mama', T).stavka;
    expect(predlog.stanje).toBe('otvoreno');
    expect(() => potvrdiZatvaranje(predlog, TATA, T)).toThrow(GreskaPravila);

    const zatvorena = potvrdiZatvaranje(predlog, MAMA, T).stavka;
    expect(zatvorena).toMatchObject({ stanje: 'zatvoreno', odluka: 'Potpisuje mama', zatvoreno: T });
  });

  it('predlog onoga ko je pitan je ujedno odgovor', () => {
    expect(predloziZatvaranje(stavka(), MAMA, 'Ne treba', T).stavka.stanje).toBe('otvoreno');
  });

  it('odbijanje vraća stavku u otvoreno i briše predlog', () => {
    const predlog = predloziZatvaranje(stavka({ stanje: 'otvoreno' }), TATA, 'X', T).stavka;
    const p = odbijZatvaranje(predlog, MAMA, 'Nisam saglasna', T);
    expect(p.stavka).toMatchObject({ stanje: 'otvoreno', odluka: null, zatvaranjePredlozio: null });
    expect(() => odbijZatvaranje(predlog, TATA, 'x', T)).toThrow(GreskaPravila);
  });

  it('samo predlagač povlači predlog', () => {
    const predlog = predloziZatvaranje(stavka({ stanje: 'otvoreno' }), TATA, 'X', T).stavka;
    expect(() => povuciPredlog(predlog, MAMA, T)).toThrow(GreskaPravila);
    expect(povuciPredlog(predlog, TATA, T).stavka.zatvaranjePredlozio).toBeNull();
  });

  it('ponovno otvaranje traži razlog', () => {
    const z = stavka({ stanje: 'zatvoreno', odluka: 'X', zatvoreno: T });
    expect(() => ponovoOtvori(z, MAMA, ' ', T)).toThrow(GreskaPravila);
    expect(ponovoOtvori(z, MAMA, 'Promenio se termin', T).stavka).toMatchObject({
      stanje: 'otvoreno',
      zatvoreno: null,
    });
  });

  it('nova stavka mora imati naslov', () => {
    const ulaz = { naslov: ' ', opis: '', oblast: 'skola' as const, vazno: false, hitno: false, datum: null };
    expect(() => proveriNovu(ulaz)).toThrow(GreskaPravila);
  });
});

describe('pregled', () => {
  it('deli čekanje, broji stanja i bira predstojeće', () => {
    const stavke = [
      stavka({ id: 'a', otvorio: MAMA }),
      stavka({ id: 'b', otvorio: TATA, datum: '2026-11-05' }),
      stavka({ id: 'c', stanje: 'otvoreno', vazno: true, datum: '2026-12-20' }),
      stavka({ id: 'd', stanje: 'zatvoreno', zatvoreno: '2026-10-20T10:00:00.000Z', datum: '2026-11-10' }),
      stavka({ id: 'e', stanje: 'zatvoreno', zatvoreno: '2026-08-01T10:00:00.000Z' }),
    ];
    const p = napraviPregled(podaci(stavke), SADA);

    expect(p.naPotezu.map((s) => s.id)).toEqual(['a']);
    expect(p.cekaDrugog.map((s) => s.id)).toEqual(['b']);
    expect([p.neodgovoreno, p.otvoreno, p.zatvorenoNedavno]).toEqual([2, 1, 1]);
    expect(p.hitno.map((s) => s.id)).toEqual(['b']);
    expect(p.vazno.map((s) => s.id)).toEqual(['c']);
    // Closed items with a date still show up as upcoming appointments.
    expect(p.predstojece.map((s) => s.id)).toEqual(['b', 'd']);
    expect(p.poOblasti.map((o) => o.kljuc)).toEqual(['skola', 'zdravlje']);
    expect(p.kolone).toEqual({ stavke: 2, aktivno: 1, reseno: 1 });
  });

  it('novo od poslednje posete prikazuje samo tuđe izmene posle posete', () => {
    const stavke = [
      stavka({ id: 'a', otvorio: MAMA, kreirano: '2026-11-02T09:00:00.000Z' }),
      stavka({ id: 'b', otvorio: MAMA, kreirano: '2026-10-25T09:00:00.000Z' }),
    ];
    const unosi: Unos[] = [
      { id: 'u1', stavkaId: 'b', autor: MAMA, vrsta: 'odgovor', tekst: 'ok', kreirano: '2026-11-02T12:00:00.000Z' },
      { id: 'u2', stavkaId: 'b', autor: TATA, vrsta: 'odgovor', tekst: 'ok', kreirano: '2026-11-02T13:00:00.000Z' },
    ];
    const novo = napraviPregled(podaci(stavke, unosi, '2026-11-01T00:00:00.000Z'), SADA).novo;
    expect(novo.map((a) => [a.stavka.id, a.opis])).toEqual([
      ['b', 'odgovor'],
      ['a', 'nova stavka'],
    ]);
  });

  it('novo prikazuje svaku stavku jednom, sa poslednjom izmenom', () => {
    const stavke = [stavka({ id: 'a', otvorio: MAMA, kreirano: '2026-11-02T09:00:00.000Z' })];
    const unosi: Unos[] = [
      { id: 'u1', stavkaId: 'a', autor: MAMA, vrsta: 'odgovor', tekst: 'x', kreirano: '2026-11-02T10:00:00.000Z' },
      { id: 'u2', stavkaId: 'a', autor: MAMA, vrsta: 'predlog_zatvaranja', tekst: 'y', kreirano: '2026-11-02T11:00:00.000Z' },
    ];
    const novo = napraviPregled(podaci(stavke, unosi, '2026-11-01T00:00:00.000Z'), SADA).novo;
    expect(novo.map((a) => [a.stavka.id, a.opis])).toEqual([['a', 'predlog zatvaranja']]);
  });
});

describe('tabla', () => {
  it('stanje određuje kolonu; predlog zatvaranja je već pod Rešeno', () => {
    expect(kolona(stavka())).toBe('stavke');
    expect(kolona(stavka({ stanje: 'otvoreno' }))).toBe('aktivno');
    expect(kolona(stavka({ stanje: 'otvoreno', zatvaranjePredlozio: MAMA }))).toBe('reseno');
    expect(kolona(stavka({ stanje: 'zatvoreno' }))).toBe('reseno');
  });

  it('prevlačenje bira pravi prelaz', () => {
    const nova = stavka();
    const aktivna = stavka({ stanje: 'otvoreno' });
    const mojPredlog = stavka({ stanje: 'otvoreno', zatvaranjePredlozio: TATA, odluka: 'x' });
    const njenPredlog = stavka({ stanje: 'otvoreno', zatvaranjePredlozio: MAMA, odluka: 'x' });
    const zatvorena = stavka({ stanje: 'zatvoreno', odluka: 'x' });

    expect(potezZaKolonu(nova, 'aktivno', TATA).vrsta).toBe('aktiviraj');
    expect(potezZaKolonu(nova, 'reseno', TATA).vrsta).toBe('predlozi');
    expect(potezZaKolonu(aktivna, 'reseno', TATA).vrsta).toBe('predlozi');
    expect(potezZaKolonu(aktivna, 'stavke', TATA).vrsta).toBe('zabranjeno');
    expect(potezZaKolonu(mojPredlog, 'aktivno', TATA).vrsta).toBe('povuci');
    expect(potezZaKolonu(njenPredlog, 'aktivno', TATA).vrsta).toBe('odbij');
    expect(potezZaKolonu(zatvorena, 'aktivno', TATA).vrsta).toBe('ponovo');
    expect(potezZaKolonu(aktivna, 'aktivno', TATA).vrsta).toBe('nista');
  });

  it('aktiviranje radi i za onoga ko je pitao, napomena nije obavezna', () => {
    const p = aktiviraj(stavka(), TATA, '', T);
    expect(p.stavka.stanje).toBe('otvoreno');
    expect(p.unos).toMatchObject({ vrsta: 'aktivirano', tekst: '' });
    expect(() => aktiviraj(stavka({ stanje: 'otvoreno' }), TATA, '', T)).toThrow(GreskaPravila);
  });

  it('povučen predlog sa table završava u Aktivno', () => {
    const predlog = predloziZatvaranje(stavka(), TATA, 'Nije potrebno', T).stavka;
    expect(predlog.stanje).toBe('neodgovoreno');
    expect(povuciPredlog(predlog, TATA, T, true).stavka.stanje).toBe('otvoreno');
    expect(povuciPredlog(predlog, TATA, T).stavka.stanje).toBe('neodgovoreno');
  });
});

describe('izmena stavke', () => {
  it('u tok stavke upisuje šta je bilo i šta je sada (iste reči kao baza)', () => {
    const r = izmeni(stavka({ datum: '2026-11-10' }), MAMA, { naslov: 'Potvrda za izlet na Avalu', datum: '2026-11-12', oblast: 'ostalo' }, T);
    expect(r.stavka).toMatchObject({ naslov: 'Potvrda za izlet na Avalu', datum: '2026-11-12', oblast: 'ostalo', izmenjeno: T });
    expect(r.unos).toMatchObject({
      vrsta: 'izmenjeno',
      autor: MAMA,
      tekst: 'Naslov: „Potvrda za izlet“ → „Potvrda za izlet na Avalu“\nOblast: Škola → Ostalo\nRok: 10. 11. 2026. → 12. 11. 2026.',
    });
  });

  it('izmena bez promene se ne beleži', () => {
    expect(izmeni(stavka(), TATA, { naslov: ' Potvrda za izlet ' }, T).unos).toBeNull();
  });

  it('rešena stavka i stavka čije zatvaranje čeka potvrdu se ne menjaju', () => {
    expect(() => izmeni(stavka({ stanje: 'zatvoreno' }), TATA, { naslov: 'x' }, T)).toThrow(/Rešena/);
    expect(() => izmeni(stavka({ stanje: 'otvoreno', zatvaranjePredlozio: MAMA }), TATA, { opis: 'x' }, T)).toThrow(/čeka potvrdu/);
  });
});
