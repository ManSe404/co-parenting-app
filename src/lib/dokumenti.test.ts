import { describe, expect, it } from 'vitest';
import {
  type Dokument,
  GreskaDokumenta,
  NAJVECA_VELICINA,
  aktivni,
  bezKvacica,
  brojDokumenata,
  cekajuMene,
  odbijBrisanje,
  otvorenZahtev,
  potvrdiBrisanje,
  povuciBrisanje,
  predloziBrisanje,
  trajnoObrisani,
  vratiUzZahtev,
  brojPoKategoriji,
  imeFajla,
  izmeni,
  nazivIzFajla,
  obrisani,
  obrisi,
  opisTraga,
  proveriUlaz,
  proveriVelicinu,
  velicinaTekst,
  vrati,
  vrstaFajla,
} from './dokumenti';

function dok(id: string, izmene: Partial<Dokument> = {}): Dokument {
  return {
    id,
    naziv: `Dokument ${id}`,
    kategorija: 'ostalo',
    datum: null,
    napomena: '',
    tip: 'application/pdf',
    velicina: 1000,
    putanja: id,
    otpremio: 'tata',
    otpremljeno: '2026-11-01T10:00:00.000Z',
    obrisan: null,
    obrisao: null,
    trag: [{ vrsta: 'otpremljen', ko: 'tata', kada: '2026-11-01T10:00:00.000Z' }],
    ...izmene,
  };
}

describe('vrsta fajla', () => {
  it('prihvata PDF i slike, a ne SVG ni HTML', () => {
    expect(vrstaFajla({ name: 'a.pdf', type: 'application/pdf' })).toBe('application/pdf');
    expect(vrstaFajla({ name: 'a.jpg', type: 'image/jpeg' })).toBe('image/jpeg');
    expect(vrstaFajla({ name: 'a.svg', type: 'image/svg+xml' })).toBeNull();
    expect(vrstaFajla({ name: 'a.html', type: 'text/html' })).toBeNull();
  });

  it('bez tipa (neki telefoni) odlučuje ekstenzija', () => {
    expect(vrstaFajla({ name: 'NALAZ.PDF', type: '' })).toBe('application/pdf');
    expect(vrstaFajla({ name: 'slika.jpeg', type: 'application/octet-stream' })).toBe('image/jpeg');
    expect(vrstaFajla({ name: 'bez-ekstenzije', type: '' })).toBeNull();
  });

  it('iPhone HEIC se prepoznaje da bi se pretvorio u JPEG', () => {
    expect(vrstaFajla({ name: 'IMG_1.HEIC', type: 'image/heic' })).toBe('heic');
    expect(vrstaFajla({ name: 'IMG_1.heic', type: '' })).toBe('heic');
  });
});

describe('provere', () => {
  it('veličina: prazan i prevelik fajl se odbijaju', () => {
    expect(() => proveriVelicinu(0)).toThrow(GreskaDokumenta);
    expect(() => proveriVelicinu(NAJVECA_VELICINA + 1)).toThrow(/prevelik/);
    expect(() => proveriVelicinu(NAJVECA_VELICINA)).not.toThrow();
  });

  it('polja se čiste, a naziv i kategorija su obavezni', () => {
    expect(proveriUlaz({ naziv: '  Nalaz   alergologa ', kategorija: 'zdravlje', datum: '', napomena: ' x ' })).toEqual({
      naziv: 'Nalaz alergologa',
      kategorija: 'zdravlje',
      datum: null,
      napomena: 'x',
    });
    expect(() => proveriUlaz({ naziv: ' ', kategorija: 'zdravlje', datum: null, napomena: '' })).toThrow(/naziv/);
    expect(() => proveriUlaz({ naziv: 'A', kategorija: 'nesto' as never, datum: null, napomena: '' })).toThrow(/kategoriju/);
    expect(() => proveriUlaz({ naziv: 'A', kategorija: 'skola', datum: '31.12.2026', napomena: '' })).toThrow(/Datum/);
    expect(() => proveriUlaz({ naziv: 'A', kategorija: 'skola', datum: null, napomena: 'x'.repeat(501) })).toThrow(/Napomena/);
  });

  it('naziv iz imena fajla, ali ne iz imena koje daje kamera', () => {
    expect(nazivIzFajla('lekarski_nalaz-okt.pdf')).toBe('Lekarski nalaz-okt');
    expect(nazivIzFajla('IMG_20261104_101500.jpg')).toBe('');
    expect(nazivIzFajla('PXL_20261104.jpg')).toBe('');
  });
});

describe('brisanje ne briše', () => {
  it('obrisan dokument pamti ko je obrisao, a vraćanje ostavlja trag', () => {
    const d1 = obrisi(dok('1'), 'mama', '2026-11-02T10:00:00.000Z');
    expect(d1.obrisan).toBe('2026-11-02T10:00:00.000Z');
    expect(d1.obrisao).toBe('mama');
    expect(() => obrisi(d1, 'tata', '2026-11-02T11:00:00.000Z')).toThrow(/već obrisan/);
    expect(() => izmeni(d1, { naziv: 'Novo', kategorija: 'skola', datum: null, napomena: '' }, 'tata', 't')).toThrow(/Prvo ga vrati/);

    const d2 = vrati(d1, 'tata', '2026-11-03T10:00:00.000Z');
    expect(d2.obrisan).toBeNull();
    expect(d2.trag.map((t) => `${t.vrsta}:${t.ko}`)).toEqual(['otpremljen:tata', 'obrisan:mama', 'vracen:tata']);
    expect(() => vrati(d2, 'tata', 't')).toThrow(/nije obrisan/);
  });

  it('izmena menja polja i upisuje se u trag', () => {
    const d = izmeni(dok('1'), { naziv: 'Potvrda', kategorija: 'skola', datum: '2026-09-01', napomena: '' }, 'mama', 't');
    expect(d.naziv).toBe('Potvrda');
    expect(d.kategorija).toBe('skola');
    expect(d.trag.at(-1)).toEqual({ vrsta: 'izmenjen', ko: 'mama', kada: 't' });
  });
});

describe('spiskovi', () => {
  const lista = [
    dok('a', { naziv: 'Nalaz alergologa', kategorija: 'zdravlje', datum: '2026-10-01' }),
    dok('b', { naziv: 'Potvrda o upisu', kategorija: 'skola', datum: '2025-09-01', napomena: 'Za časove' }),
    dok('c', { naziv: 'Račun', kategorija: 'troskovi', otpremljeno: '2026-11-03T10:00:00.000Z' }),
    dok('d', { naziv: 'Stari nalaz', kategorija: 'zdravlje', obrisan: '2026-11-02T10:00:00.000Z', obrisao: 'mama' }),
  ];

  it('aktivni: bez obrisanih, najnoviji prvi (datum na dokumentu, pa otpremanje)', () => {
    expect(aktivni(lista).map((d) => d.id)).toEqual(['c', 'a', 'b']);
  });

  it('filter po kategoriji i pretraga bez kvačica', () => {
    expect(aktivni(lista, { kategorija: 'zdravlje' }).map((d) => d.id)).toEqual(['a']);
    expect(aktivni(lista, { upit: 'casove' }).map((d) => d.id)).toEqual(['b']);
    expect(aktivni(lista, { upit: 'RACUN' }).map((d) => d.id)).toEqual(['c']);
    expect(aktivni(lista, { upit: 'škola' }).map((d) => d.id)).toEqual(['b']);
  });

  it('obrisani su posebno, a brojevi kategorija ih ne računaju', () => {
    expect(obrisani(lista).map((d) => d.id)).toEqual(['d']);
    expect(brojPoKategoriji(lista).get('zdravlje')).toBe(1);
  });
});

describe('tekstovi', () => {
  it('srpska množina', () => {
    expect([0, 1, 2, 5, 11, 12, 21, 22, 25].map(brojDokumenata)).toEqual([
      '0 dokumenata',
      '1 dokument',
      '2 dokumenta',
      '5 dokumenata',
      '11 dokumenata',
      '12 dokumenata',
      '21 dokument',
      '22 dokumenta',
      '25 dokumenata',
    ]);
  });

  it('veličina fajla', () => {
    expect(velicinaTekst(840)).toBe('840 B');
    expect(velicinaTekst(240 * 1024)).toBe('240 KB');
    expect(velicinaTekst(3.4 * 1024 * 1024)).toBe('3,4 MB');
    expect(velicinaTekst(12 * 1024 * 1024)).toBe('12 MB');
  });

  it('ime za preuzimanje nosi pravu ekstenziju i nema zabranjenih znakova', () => {
    expect(imeFajla({ naziv: 'Nalaz 1/2: krv', tip: 'application/pdf' })).toBe('Nalaz 1 2 krv.pdf');
    expect(imeFajla({ naziv: 'Slika', tip: 'image/jpeg' })).toBe('Slika.jpg');
  });

  it('trag sa rodom i drugim licem', () => {
    expect(opisTraga('obrisan', 'mama', 'tata', 'Mama')).toBe('Mama je obrisala');
    expect(opisTraga('otpremljen', 'tata', 'mama', 'Tata')).toBe('Tata je dodao');
    expect(opisTraga('vracen', 'tata', 'tata', 'Tata')).toBe('Vratio si');
    expect(opisTraga('izmenjen', 'mama', 'mama', 'Mama')).toBe('Izmenila si');
  });

  it('pretraga ne mari za kvačice ni Đ', () => {
    expect(bezKvacica('Đurđevdan ČAS šž')).toBe('djurdjevdan cas sz');
  });
});

describe('trajno brisanje: samo iz obrisanih i samo kad se oboje slože', () => {
  const obrisan = dok('x', { obrisan: '2026-11-02T10:00:00.000Z', obrisao: 'mama' });

  it('predlaže se samo za obrisan dokument, samo uz oba roditelja, jedan po dokumentu', () => {
    expect(() => predloziBrisanje(dok('y'), [], 2, 'tata', 't', 'z1')).toThrow(/iz obrisanih/);
    expect(() => predloziBrisanje(obrisan, [], 1, 'tata', 't', 'z1')).toThrow(/još niste povezani/);
    const z = predloziBrisanje(obrisan, [], 2, 'tata', 't', 'z1');
    expect(z).toMatchObject({ dokumentId: 'x', naziv: 'Dokument x', predlozio: 'tata', stanje: 'ceka' });
    expect(() => predloziBrisanje(obrisan, [z], 2, 'mama', 't', 'z2')).toThrow(/već predloženo/);
  });

  it('predlagač ne potvrđuje ni ne odbija sam sebi; drugi ne povlači tuđi predlog', () => {
    const z = predloziBrisanje(obrisan, [], 2, 'tata', 't', 'z1');
    expect(() => potvrdiBrisanje(z, 'tata', 't')).toThrow(/drugi roditelj/);
    expect(() => odbijBrisanje(z, 'tata', 't')).toThrow(/povučeš/);
    expect(() => povuciBrisanje(z, 'mama', 't')).toThrow(/onaj ko je predložio/);
    expect(potvrdiBrisanje(z, 'mama', 't2')).toMatchObject({ stanje: 'odobreno', odgovorio: 'mama' });
    expect(odbijBrisanje(z, 'mama', 't2').stanje).toBe('odbijeno');
    expect(povuciBrisanje(z, 'tata', 't2').stanje).toBe('povuceno');
  });

  it('odgovoren predlog se ne menja; posle odbijanja može nov predlog', () => {
    const z = odbijBrisanje(predloziBrisanje(obrisan, [], 2, 'tata', 't', 'z1'), 'mama', 't2');
    expect(() => potvrdiBrisanje(z, 'mama', 't3')).toThrow(/više ne čeka/);
    expect(otvorenZahtev([z], 'x')).toBeNull();
    expect(predloziBrisanje(obrisan, [z], 2, 'tata', 't3', 'z2').stanje).toBe('ceka');
  });

  it('vraćanje odgovara na predlog, a posle saglasnosti vraćanja nema', () => {
    const z = predloziBrisanje(obrisan, [], 2, 'tata', 't', 'z1');
    expect(vratiUzZahtev(z, 'tata', 't2')?.stanje).toBe('povuceno');
    expect(vratiUzZahtev(z, 'mama', 't2')?.stanje).toBe('odbijeno');
    expect(vratiUzZahtev(null, 'mama', 't2')).toBeNull();
    expect(() => vratiUzZahtev(potvrdiBrisanje(z, 'mama', 't2'), 'tata', 't3')).toThrow(/ne može da se vrati/);
  });

  it('šta čeka mene i zapis trajno obrisanih', () => {
    const z1 = predloziBrisanje(obrisan, [], 2, 'tata', 't', 'z1');
    expect(cekajuMene([z1], 'mama').map((z) => z.id)).toEqual(['z1']);
    expect(cekajuMene([z1], 'tata')).toEqual([]);
    const gotov = { ...potvrdiBrisanje(z1, 'mama', 't2'), stanje: 'obrisano' as const, dokumentId: null, zavrseno: 't3' };
    expect(trajnoObrisani([z1, gotov]).map((z) => z.naziv)).toEqual(['Dokument x']);
  });
});
