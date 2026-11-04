// The app talks to its data only through this interface: demo data in the
// browser (mock/) without an account, the database (izvor-supabase.ts) with one.

import type { NoviZahtevDogadjajaUlaz } from './dogadjaji';
import type { NoviZahtevUlaz } from './kalendar';
import type { UlazKartona } from './karton';
import type { UlazRasporeda } from './raspored-casova';
import type { IzmenaStavke, NovaStavkaUlaz, Podaci } from './tipovi';

export interface Izvor {
  /** True for demo data, which also shows the parent switcher. */
  readonly demo: boolean;
  ucitaj(): Promise<Podaci>;
  novaStavka(ulaz: NovaStavkaUlaz): Promise<string>;
  izmeniStavku(id: string, izmena: IzmenaStavke): Promise<void>;
  odgovori(id: string, tekst: string): Promise<void>;
  predloziZatvaranje(id: string, odluka: string): Promise<void>;
  potvrdiZatvaranje(id: string): Promise<void>;
  odbijZatvaranje(id: string, razlog: string): Promise<void>;
  povuciPredlog(id: string, uAktivno?: boolean): Promise<void>;
  aktiviraj(id: string, napomena: string): Promise<void>;
  predloziKalendar(ulaz: NoviZahtevUlaz): Promise<void>;
  predloziDogadjaj(ulaz: NoviZahtevDogadjajaUlaz): Promise<void>;
  prihvatiZahtev(id: string): Promise<void>;
  odbijZahtev(id: string, razlog: string): Promise<void>;
  povuciZahtev(id: string): Promise<void>;
  sacuvajKarton(ulaz: UlazKartona): Promise<void>;
  obrisiKarton(id: string): Promise<void>;
  /** Saves the school timetable (null removes it); logged like any karton change. */
  sacuvajRasporedCasova(r: UlazRasporeda | null): Promise<void>;
  ponovoOtvori(id: string, razlog: string): Promise<void>;
}

let trenutni: Promise<Izvor> | null = null;

export function izvor(): Promise<Izvor> {
  trenutni ??= import('./supabase').then(async (s) => {
    if (s.jeDemo()) return (await import('./mock/izvor-mock')).napraviMockIzvor({ demo: true });
    // With real accounts, wait until the guard knows who is signed in.
    await (await import('./pristup-spreman')).pristupSpreman;
    return (await import('./izvor-supabase')).napraviSupabaseIzvor();
  });
  return trenutni;
}
