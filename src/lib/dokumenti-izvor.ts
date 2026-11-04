// Where documents live. In the demo: this browser (IndexedDB). With real
// accounts: the database plus a private storage bucket only the two parents
// can open. The screens only see this interface.

import type { Dokument, TipFajla, UlazDokumenta, ZahtevBrisanja } from './dokumenti';

export interface DokumentiIzvor {
  readonly demo: boolean;
  lista(): Promise<Dokument[]>;
  otpremi(fajl: Blob, tip: TipFajla, ulaz: UlazDokumenta): Promise<Dokument>;
  izmeni(id: string, ulaz: UlazDokumenta): Promise<void>;
  obrisi(id: string): Promise<void>;
  vrati(id: string): Promise<void>;
  /** An address that shows (or, with `preuzmi`, downloads) the file; valid for a few minutes. */
  adresa(d: Dokument, preuzmi?: boolean): Promise<string>;
  /** Addresses for many files at once, for thumbnails. */
  adrese(lista: Dokument[]): Promise<Map<string, string>>;

  // Permanent deletion: from the trash only, with both parents' agreement.
  brisanja(): Promise<ZahtevBrisanja[]>;
  predloziTrajnoBrisanje(dokumentId: string): Promise<void>;
  /** The other parent agrees: the file is removed for good, a record stays. */
  potvrdiTrajnoBrisanje(zahtevId: string): Promise<void>;
  odbijTrajnoBrisanje(zahtevId: string): Promise<void>;
  povuciTrajnoBrisanje(zahtevId: string): Promise<void>;
  /** Finishes an agreed deletion that was interrupted (e.g. the connection dropped). */
  zavrsiTrajnoBrisanje(zahtevId: string): Promise<void>;
}

let trenutni: Promise<DokumentiIzvor> | null = null;

export function dokumentiIzvor(): Promise<DokumentiIzvor> {
  trenutni ??= import('./supabase').then(async (s) => {
    if (s.jeDemo()) return (await import('./mock/dokumenti-mock')).napraviDemoDokumente();
    await (await import('./pristup-spreman')).pristupSpreman;
    return (await import('./dokumenti-supabase')).napraviDokumenteUBazi();
  });
  return trenutni;
}
