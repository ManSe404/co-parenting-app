// Demo documents in this browser's IndexedDB (files are too big for
// localStorage). If the browser blocks storage, they live in memory until reload.

import {
  type Dokument,
  GreskaDokumenta,
  type TipFajla,
  type UlazDokumenta,
  type ZahtevBrisanja,
  izmeni,
  obrisi,
  odbijBrisanje,
  otvorenZahtev,
  potvrdiBrisanje,
  povuciBrisanje,
  predloziBrisanje,
  proveriUlaz,
  proveriVelicinu,
  vrati,
  vratiUzZahtev,
} from '../dokumenti';
import type { DokumentiIzvor } from '../dokumenti-izvor';
import { primeriDokumenata } from './dokumenti-primeri';
import { trenutniRoditelj } from './izvor-mock';

interface Zapis {
  dokument: Dokument;
  fajl: Blob;
}

const BAZA = 'coparenting-demo-dokumenti';
const SKLADISTE = 'dokumenti';
const KLJUC_SEME = 'coparenting.demo.dokumenti.seme';
const KLJUC_BRISANJA = 'coparenting.demo.dokumenti.brisanja';

const uMemoriji = new Map<string, Zapis>();
let brisanjaUMemoriji: ZahtevBrisanja[] = [];

function procitajBrisanja(): ZahtevBrisanja[] {
  try {
    const raw = localStorage.getItem(KLJUC_BRISANJA);
    if (raw) return JSON.parse(raw) as ZahtevBrisanja[];
  } catch {
    /* fall back to memory */
  }
  return brisanjaUMemoriji;
}

function sacuvajBrisanja(lista: ZahtevBrisanja[]): void {
  brisanjaUMemoriji = lista;
  try {
    localStorage.setItem(KLJUC_BRISANJA, JSON.stringify(lista));
  } catch {
    /* memory only */
  }
}

async function izbaci(id: string): Promise<void> {
  const db = await otvori();
  if (!db) {
    uMemoriji.delete(id);
    return;
  }
  const tx = db.transaction(SKLADISTE, 'readwrite');
  tx.objectStore(SKLADISTE).delete(id);
  await new Promise<void>((ok, ne) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ne(tx.error);
  });
}
let baza: Promise<IDBDatabase | null> | null = null;

function zahtev<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, ne) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ne(r.error);
  });
}

function otvori(): Promise<IDBDatabase | null> {
  baza ??= new Promise((ok) => {
    try {
      const r = indexedDB.open(BAZA, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(SKLADISTE, { keyPath: 'dokument.id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch {
      ok(null);
    }
  });
  return baza;
}

async function sve(): Promise<Zapis[]> {
  const db = await otvori();
  if (!db) return [...uMemoriji.values()];
  return zahtev(db.transaction(SKLADISTE).objectStore(SKLADISTE).getAll() as IDBRequest<Zapis[]>);
}

async function jedan(id: string): Promise<Zapis> {
  const db = await otvori();
  const z = db ? await zahtev(db.transaction(SKLADISTE).objectStore(SKLADISTE).get(id) as IDBRequest<Zapis | undefined>) : uMemoriji.get(id);
  if (!z) throw new GreskaDokumenta('Dokument ne postoji.');
  return z;
}

async function upisi(z: Zapis): Promise<void> {
  const db = await otvori();
  if (!db) {
    uMemoriji.set(z.dokument.id, z);
    return;
  }
  const tx = db.transaction(SKLADISTE, 'readwrite');
  tx.objectStore(SKLADISTE).put(z);
  await new Promise<void>((ok, ne) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ne(tx.error);
  });
}

/** The first time the demo opens, add the example documents once. */
let setva: Promise<void> | null = null;

function posej(): Promise<void> {
  setva ??= (async () => {
    try {
      if (localStorage.getItem(KLJUC_SEME)) return;
      localStorage.setItem(KLJUC_SEME, '1');
    } catch {
      if (uMemoriji.size) return;
    }
    if ((await sve()).length) return;
    const primeri = await primeriDokumenata(new Date());
    for (const p of primeri) await upisi(p);
    // Mama has proposed deleting the duplicate receipt for good: tata decides.
    const racun = primeri.find((p) => p.dokument.obrisan)!.dokument;
    const t = new Date(Date.parse(racun.obrisan!) + 60_000).toISOString();
    sacuvajBrisanja([predloziBrisanje(racun, [], 2, 'mama', t, 'demo-brisanje-1')]);
  })();
  return setva;
}

/** Back to the example documents (the ↺ button in the demo bar). */
export async function resetujDemoDokumente(): Promise<void> {
  uMemoriji.clear();
  brisanjaUMemoriji = [];
  setva = null;
  try {
    localStorage.removeItem(KLJUC_SEME);
    localStorage.removeItem(KLJUC_BRISANJA);
  } catch {
    /* ignore */
  }
  const db = await otvori();
  if (!db) return;
  const tx = db.transaction(SKLADISTE, 'readwrite');
  tx.objectStore(SKLADISTE).clear();
  await new Promise<void>((ok) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ok();
  });
}

export function napraviDemoDokumente(): DokumentiIzvor {
  const adrese = new Map<string, string>();
  const sada = () => new Date().toISOString();

  async function promeni(id: string, fn: (d: Dokument, ja: string, t: string) => Dokument): Promise<void> {
    const z = await jedan(id);
    await upisi({ ...z, dokument: fn(z.dokument, trenutniRoditelj(), sada()) });
  }

  async function odgovoriNa(zahtevId: string, fn: (z: ZahtevBrisanja, ja: string, t: string) => ZahtevBrisanja): Promise<void> {
    const lista = procitajBrisanja();
    const z = lista.find((x) => x.id === zahtevId);
    if (!z) throw new GreskaDokumenta('Predlog ne postoji.');
    const nov = fn(z, trenutniRoditelj(), sada());
    sacuvajBrisanja(lista.map((x) => (x.id === zahtevId ? nov : x)));
  }

  async function zavrsi(zahtevId: string): Promise<void> {
    const z = procitajBrisanja().find((x) => x.id === zahtevId);
    if (!z) throw new GreskaDokumenta('Predlog ne postoji.');
    if (z.stanje === 'obrisano') return;
    if (z.stanje !== 'odobreno') throw new GreskaDokumenta('Trajno brisanje nije potvrdio drugi roditelj.');
    if (z.dokumentId) {
      const a = adrese.get(z.dokumentId);
      if (a) URL.revokeObjectURL(a);
      adrese.delete(z.dokumentId);
      await izbaci(z.dokumentId);
    }
    const gotov: ZahtevBrisanja = { ...z, stanje: 'obrisano', zavrseno: sada() };
    sacuvajBrisanja(
      procitajBrisanja().map((x) =>
        x.id === zahtevId ? { ...gotov, dokumentId: null } : x.dokumentId === z.dokumentId ? { ...x, dokumentId: null } : x,
      ),
    );
  }

  async function adresa(d: Dokument): Promise<string> {
    let a = adrese.get(d.id);
    if (!a) {
      a = URL.createObjectURL((await jedan(d.id)).fajl);
      adrese.set(d.id, a);
    }
    return a;
  }

  return {
    demo: true,

    async lista() {
      await posej();
      return (await sve()).map((z) => z.dokument);
    },

    async otpremi(fajl: Blob, tip: TipFajla, ulaz: UlazDokumenta) {
      const u = proveriUlaz(ulaz);
      proveriVelicinu(fajl.size);
      const id = crypto.randomUUID();
      const ja = trenutniRoditelj();
      const t = sada();
      const dokument: Dokument = {
        id,
        ...u,
        tip,
        velicina: fajl.size,
        putanja: id,
        otpremio: ja,
        otpremljeno: t,
        obrisan: null,
        obrisao: null,
        trag: [{ vrsta: 'otpremljen', ko: ja, kada: t }],
      };
      await upisi({ dokument, fajl });
      return dokument;
    },

    izmeni: (id, ulaz) => promeni(id, (d, ja, t) => izmeni(d, ulaz, ja, t)),
    obrisi: (id) => promeni(id, (d, ja, t) => obrisi(d, ja, t)),

    async vrati(id) {
      const lista = procitajBrisanja();
      const z = otvorenZahtev(lista, id);
      const odgovor = vratiUzZahtev(z, trenutniRoditelj(), sada());
      await promeni(id, (d, ja, t) => vrati(d, ja, t));
      if (odgovor) sacuvajBrisanja(lista.map((x) => (x.id === odgovor.id ? odgovor : x)));
    },

    async brisanja() {
      await posej();
      return procitajBrisanja();
    },

    async predloziTrajnoBrisanje(dokumentId) {
      const lista = procitajBrisanja();
      const z = predloziBrisanje((await jedan(dokumentId)).dokument, lista, 2, trenutniRoditelj(), sada(), crypto.randomUUID());
      sacuvajBrisanja([...lista, z]);
    },

    async potvrdiTrajnoBrisanje(zahtevId) {
      await odgovoriNa(zahtevId, potvrdiBrisanje);
      await zavrsi(zahtevId);
    },

    odbijTrajnoBrisanje: (zahtevId) => odgovoriNa(zahtevId, odbijBrisanje),
    povuciTrajnoBrisanje: (zahtevId) => odgovoriNa(zahtevId, povuciBrisanje),

    zavrsiTrajnoBrisanje: (zahtevId) => zavrsi(zahtevId),

    // Blob addresses already download under the right name via <a download>.
    adresa: (d) => adresa(d),

    async adrese(lista) {
      const m = new Map<string, string>();
      for (const d of lista) m.set(d.id, await adresa(d));
      return m;
    },
  };
}
