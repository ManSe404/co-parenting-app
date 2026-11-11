import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Promenljiv, pratiPromene } from './osvezavanje';

/** A source whose change signal the test fires by hand. */
function izvor(): Promenljiv & { javi: () => void; pretplata: number } {
  const slusaoci = new Set<() => void>();
  return {
    pretplata: 0,
    javi: () => slusaoci.forEach((cb) => cb()),
    naPromenu(cb) {
      slusaoci.add(cb);
      this.pretplata = slusaoci.size;
      return () => {
        slusaoci.delete(cb);
        this.pretplata = slusaoci.size;
      };
    },
  };
}

describe('osvežavanje na promenu', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('više signala zaredom daje jedno osvežavanje, 500 ms posle poslednjeg', async () => {
    const iz = izvor();
    const osvezi = vi.fn();
    pratiPromene(iz, osvezi);
    await vi.advanceTimersByTimeAsync(0);
    expect(iz.pretplata).toBe(1);

    iz.javi();
    await vi.advanceTimersByTimeAsync(300);
    iz.javi();
    await vi.advanceTimersByTimeAsync(300);
    expect(osvezi).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(osvezi).toHaveBeenCalledTimes(1);
  });

  it('bez signala ne osvežava', async () => {
    const osvezi = vi.fn();
    pratiPromene(izvor(), osvezi);
    await vi.advanceTimersByTimeAsync(5000);
    expect(osvezi).not.toHaveBeenCalled();
  });

  it('signal tokom osvežavanja zakazuje tačno još jedno', async () => {
    const iz = izvor();
    let zavrsi: () => void = () => {};
    const osvezi = vi.fn(() => new Promise<void>((r) => (zavrsi = r)));
    pratiPromene(iz, osvezi);
    await vi.advanceTimersByTimeAsync(0);

    iz.javi();
    await vi.advanceTimersByTimeAsync(500);
    expect(osvezi).toHaveBeenCalledTimes(1);
    iz.javi();
    iz.javi();
    await vi.advanceTimersByTimeAsync(500);
    expect(osvezi).toHaveBeenCalledTimes(1);

    zavrsi();
    await vi.advanceTimersByTimeAsync(0);
    expect(osvezi).toHaveBeenCalledTimes(2);
    zavrsi();
    await vi.advanceTimersByTimeAsync(1000);
    expect(osvezi).toHaveBeenCalledTimes(2);
  });

  it('prekid odjavljuje i poništava zakazano osvežavanje', async () => {
    const iz = izvor();
    const osvezi = vi.fn();
    const stani = pratiPromene(iz, osvezi);
    await vi.advanceTimersByTimeAsync(0);
    iz.javi();
    stani();
    await vi.advanceTimersByTimeAsync(1000);
    expect(osvezi).not.toHaveBeenCalled();
    expect(iz.pretplata).toBe(0);
  });

  it('radi i sa izvorom koji tek stiže, a prekid pre toga ne ostavlja pretplatu', async () => {
    const iz = izvor();
    const osvezi = vi.fn();
    pratiPromene(Promise.resolve(iz), osvezi);
    await vi.advanceTimersByTimeAsync(0);
    expect(iz.pretplata).toBe(1);
    iz.javi();
    await vi.advanceTimersByTimeAsync(500);
    expect(osvezi).toHaveBeenCalledTimes(1);

    const kasni = izvor();
    const stani = pratiPromene(new Promise<Promenljiv>((r) => setTimeout(() => r(kasni), 100)), osvezi);
    stani();
    await vi.advanceTimersByTimeAsync(200);
    expect(kasni.pretplata).toBe(0);
  });

  it('greška u osvežavanju ne prekida praćenje', async () => {
    const iz = izvor();
    const osvezi = vi.fn().mockRejectedValueOnce(new Error('pukla veza')).mockResolvedValue(undefined);
    pratiPromene(iz, osvezi);
    await vi.advanceTimersByTimeAsync(0);
    iz.javi();
    await vi.advanceTimersByTimeAsync(500);
    iz.javi();
    await vi.advanceTimersByTimeAsync(500);
    expect(osvezi).toHaveBeenCalledTimes(2);
  });
});
