import { describe, expect, it } from 'vitest';
import { bezbednoDalje } from './putanje';

describe('kuda posle prijave', () => {
  it('putanje u aplikaciji prolaze', () => {
    expect(bezbednoDalje('/stavka/?id=1#x')).toBe('/stavka/?id=1#x');
    expect(bezbednoDalje('/poziv/?t=ab')).toBe('/poziv/?t=ab');
  });

  it('nikad na drugi sajt', () => {
    for (const d of ['//zlo.example', '/\t/zlo.example', '/\n/zlo.example', '/\\zlo.example', 'https://zlo.example', 'javascript:alert(1)', '', null]) {
      expect(bezbednoDalje(d)).toBe('/');
    }
  });
});
