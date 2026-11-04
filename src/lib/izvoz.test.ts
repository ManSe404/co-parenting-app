import { describe, expect, it } from 'vitest';
import { polje } from './izvoz';

describe('CSV ćelija', () => {
  it('tekst koji bi bio formula ostaje običan tekst', () => {
    expect(polje('=HYPERLINK("https://x")')).toBe(`"'=HYPERLINK(""https://x"")"`);
    expect(polje('+381 64 123')).toBe("'+381 64 123");
    expect(polje('-')).toBe("'-");
    expect(polje('@zbir')).toBe("'@zbir");
  });

  it('navodnici, zarez i novi red', () => {
    expect(polje('Obično')).toBe('Obično');
    expect(polje('a, b')).toBe('"a, b"');
    expect(polje('a\rb')).toBe('"a\rb"');
  });
});
