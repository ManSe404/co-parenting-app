// What the calendar views draw for a range of days: confirmed activities,
// proposed ones, and confirmed ones with a pending change or deletion.

import { type Dogadjaj, type PredlogDogadjaja, pojave } from './dogadjaji';
import type { ZahtevKalendara } from './kalendar';
import type { Podaci } from './tipovi';

export interface Blok {
  kljuc: string;
  dogadjaj: Dogadjaj | PredlogDogadjaja;
  datum: string;
  odMin: number;
  doMin: number;
  ceoDan: boolean;
  zahtev: ZahtevKalendara | null;
  /** potvrdjen; predlog = proposed new; izmena/brisanje = confirmed with a pending change. */
  stanje: 'potvrdjen' | 'predlog' | 'izmena' | 'brisanje';
}

export function blokovi(p: Podaci, od: string, doD: string): Blok[] {
  const cekaju = p.zahtevi.filter((z) => z.stanje === 'ceka' && z.predmet === 'dogadjaj');
  const potvrdjeni: Blok[] = pojave(p.dogadjaji, od, doD).map((x) => {
    const zahtev = cekaju.find((z) => z.dogadjajId === x.dogadjaj.id) ?? null;
    return {
      kljuc: `${x.dogadjaj.id}-${x.datum}`,
      dogadjaj: x.dogadjaj,
      datum: x.datum,
      odMin: x.odMin,
      doMin: x.doMin,
      ceoDan: x.ceoDan,
      zahtev,
      stanje: zahtev?.vrsta === 'obrisi' ? 'brisanje' : zahtev?.vrsta === 'izmeni' ? 'izmena' : 'potvrdjen',
    };
  });
  const predlozeni: Blok[] = cekaju
    .filter((z) => z.dogadjaj)
    .flatMap((z) =>
      pojave([z.dogadjaj!], od, doD).map((x) => ({
        kljuc: `${z.id}-${x.datum}`,
        dogadjaj: x.dogadjaj,
        datum: x.datum,
        odMin: x.odMin,
        doMin: x.doMin,
        ceoDan: x.ceoDan,
        zahtev: z,
        stanje: 'predlog' as const,
      })),
    );
  return [...potvrdjeni, ...predlozeni].sort(
    (a, b) => a.datum.localeCompare(b.datum) || Number(b.ceoDan) - Number(a.ceoDan) || a.odMin - b.odMin,
  );
}

export function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
