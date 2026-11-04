import { describe, expect, it } from 'vitest';
import { brojStavki } from './format';

describe('množina', () => {
  it('prati srpska pravila', () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map(brojStavki)).toEqual([
      '1 stavka',
      '2 stavke',
      '5 stavki',
      '11 stavki',
      '12 stavki',
      '21 stavka',
      '22 stavke',
      '25 stavki',
      '111 stavki',
    ]);
  });
});

import { recenicaHitno, recenicaNaTebi, rok } from './format';

describe('rečenice i rokovi', () => {
  const sada = new Date(2026, 10, 3, 10, 0);

  it('rok', () => {
    expect(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-08'].map((d) => rok(d, sada))).toEqual([
      'kasni 2 dana',
      'kasni 1 dan',
      'danas',
      'sutra',
      'za 5 dana',
    ]);
  });

  it('hitno', () => {
    expect([1, 2, 5, 21].map(recenicaHitno)).toEqual([
      'Jedna stvar je hitna.',
      'Dve stvari su hitne.',
      '5 stvari je hitno.',
      '21 stvar je hitna.',
    ]);
  });

  it('na tebi', () => {
    expect([1, 3, 5].map(recenicaNaTebi)).toEqual(['Na tebi je jedna tema.', 'Na tebi su tri teme.', 'Na tebi je 5 tema.']);
  });
});

import { kada, opseg } from './format';

describe('vreme u kalendaru', () => {
  const sada = new Date(2026, 10, 4, 10, 0);

  it('kada', () => {
    expect(kada('2026-11-04T15:00', sada)).toBe('danas u 15:00');
    expect(kada('2026-11-05T08:00', sada)).toBe('sutra u 08:00');
    expect(kada('2026-11-06T18:00', sada)).toBe('pet 6. nov u 18:00');
  });

  it('opseg', () => {
    expect(opseg('2026-11-04T15:00', '2026-11-04T20:00')).toBe('sre 4. nov 15:00–20:00');
    expect(opseg('2026-11-06T18:00', '2026-11-09T08:00')).toBe('pet 6. nov 18:00 → pon 9. nov 08:00');
  });
});
