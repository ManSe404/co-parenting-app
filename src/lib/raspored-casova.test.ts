import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { citajXlsx, danIzNaziva, parsirajCsv, sazetakRasporeda, uRaspored } from './raspored-casova';

/** A minimal .xlsx (zip) in memory, deflated like Excel writes it. */
function napraviXlsx(fajlovi: Record<string, string>): Uint8Array {
  const lokalni: Buffer[] = [];
  const centralni: Buffer[] = [];
  let pomak = 0;
  for (const [ime, sadrzaj] of Object.entries(fajlovi)) {
    const imeB = Buffer.from(ime);
    const podaci = deflateRawSync(Buffer.from(sadrzaj));
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(8, 8);
    l.writeUInt32LE(podaci.length, 18);
    l.writeUInt32LE(Buffer.byteLength(sadrzaj), 22);
    l.writeUInt16LE(imeB.length, 26);
    lokalni.push(l, imeB, podaci);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(podaci.length, 20);
    c.writeUInt32LE(Buffer.byteLength(sadrzaj), 24);
    c.writeUInt16LE(imeB.length, 28);
    c.writeUInt32LE(pomak, 42);
    centralni.push(c, imeB);
    pomak += 30 + imeB.length + podaci.length;
  }
  const cd = Buffer.concat(centralni);
  const kraj = Buffer.alloc(22);
  kraj.writeUInt32LE(0x06054b50, 0);
  kraj.writeUInt16LE(Object.keys(fajlovi).length, 8);
  kraj.writeUInt16LE(Object.keys(fajlovi).length, 10);
  kraj.writeUInt32LE(cd.length, 12);
  kraj.writeUInt32LE(pomak, 16);
  return new Uint8Array(Buffer.concat([...lokalni, cd, kraj]));
}

describe('dani', () => {
  it('latinica, ćirilica, engleski', () => {
    expect(['Ponedeljak', 'utorak', 'SREDA', 'Četvrtak', 'cet', 'Петак', 'Monday', 'subota'].map(danIzNaziva)).toEqual([
      0, 1, 2, 3, 3, 4, 0, -1,
    ]);
  });
});

describe('CSV', () => {
  it('srpski Excel: tačka-zarez, BOM, zaglavlje sa danima', () => {
    const csv = '﻿Čas;Ponedeljak;Utorak;Sreda;Četvrtak;Petak\r\n1;Srpski;Matematika;Engleski;Srpski;Fizičko\r\n2;Matematika;Srpski;Priroda;Muzičko;Likovno\r\n';
    const r = uRaspored(parsirajCsv(csv));
    expect(r.casovi).toEqual(['1', '2']);
    expect(r.tabela[0]).toEqual(['Srpski', 'Matematika', 'Engleski', 'Srpski', 'Fizičko']);
  });

  it('zarez i navodnici sa zarezom unutra', () => {
    expect(parsirajCsv('a,"b, c","d ""x"""\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "x"'],
      ['1', '2', '3'],
    ]);
  });

  it('bez zaglavlja: prva kolona su časovi ako tako izgleda', () => {
    const r = uRaspored(parsirajCsv('1.;A;B;C;D;E\n2.;F;G;H;I;J'));
    expect(r.casovi).toEqual(['1.', '2.']);
    expect(r.tabela[1]).toEqual(['F', 'G', 'H', 'I', 'J']);
    const bez = uRaspored(parsirajCsv('A;B;C;D;E\nF;G;H;I;J'));
    expect(bez.casovi).toEqual(['1.', '2.']);
    expect(bez.tabela[0]).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('dani u redovima umesto u kolonama', () => {
    const r = uRaspored(parsirajCsv(';1;2\nPon;Srpski;Matematika\nUto;Engleski;Srpski\nSre;A;B\nČet;C;D\nPet;E;F'));
    expect(r.casovi).toEqual(['1', '2']);
    expect(r.tabela[0]).toEqual(['Srpski', 'Engleski', 'A', 'C', 'E']);
  });

  it('ćirilično zaglavlje i vremena časova; prazni redovi i kolone se preskaču', () => {
    const r = uRaspored(parsirajCsv('Време;Понедељак;Уторак;Среда;Четвртак;Петак;\n8:00-8:45;Српски;Математика;;;;\n\n'));
    expect(r.casovi).toEqual(['8:00-8:45']);
    expect(r.tabela[0]).toEqual(['Српски', 'Математика', '', '', '']);
  });

  it('prazna tabela je greška', () => {
    expect(() => uRaspored(parsirajCsv('\n;;\n'))).toThrow(/prazna/);
  });
});

describe('Excel .xlsx', () => {
  it('čita prvi list: deljeni tekst, brojevi i tekst u ćeliji', async () => {
    const xlsx = napraviXlsx({
      'xl/sharedStrings.xml':
        '<sst><si><t>Čas</t></si><si><t>Ponedeljak</t></si><si><t>Utorak</t></si><si><t>Sreda</t></si><si><r><t>Čet</t></r><r><t>vrtak</t></r></si><si><t>Petak</t></si><si><t>Srpski &amp; jezik</t></si></sst>',
      'xl/worksheets/sheet1.xml':
        '<worksheet><sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c></row>' +
        '<row r="2"><c r="A2"><v>1</v></c><c r="B2" t="s"><v>6</v></c><c r="D2" t="inlineStr"><is><t>Priroda</t></is></c></row>' +
        '</sheetData></worksheet>',
    });
    const redovi = await citajXlsx(xlsx);
    expect(redovi[0]).toEqual(['Čas', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak']);
    const r = uRaspored(redovi);
    expect(r.casovi).toEqual(['1']);
    expect(r.tabela[0]).toEqual(['Srpski & jezik', '', 'Priroda', '', '']);
  });

  it('fajl koji nije zip', async () => {
    await expect(citajXlsx(new Uint8Array([1, 2, 3]))).rejects.toThrow(/xlsx/);
  });
});

describe('sažetak za istoriju kartona', () => {
  it('opisuje šta postoji', () => {
    expect(sazetakRasporeda({ casovi: ['1.'], tabela: [['A', '', '', '', '']], slika: 'data:', napomena: '' })).toBe('tabela, 1 časova, slika');
    expect(sazetakRasporeda(null)).toBe('nema');
  });
});
