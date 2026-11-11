// Demo data source: everything lives in this browser's localStorage, and a
// switcher lets you act as either parent to try the whole flow alone.

import type { Izvor } from '../izvor';
import type { Podaci, Stavka } from '../tipovi';
import {
  GreskaPravila,
  aktiviraj,
  izmeni,
  type Promena,
  odbijZatvaranje,
  odgovori,
  ponovoOtvori,
  potvrdiZatvaranje,
  povuciPredlog,
  predloziZatvaranje,
  proveriNovu,
} from '../domen';
import { napraviZahtevDogadjaja, prihvatiZahtevDogadjaja } from '../dogadjaji';
import { napraviZahtev, odbijZahtev, povuciZahtev, prihvatiZahtev } from '../kalendar';
import { obrisiUnos, sacuvajUnos } from '../karton';
import { sazetakRasporeda } from '../raspored-casova';
import { DETE, OBLASTI, RODITELJI, type DemoStanje, napraviSeed } from './seed';

const KLJUC = 'coparenting.demo.v1';
const KLJUC_JA = 'coparenting.demo.ja';
const KLJUC_VIDEO = 'coparenting.demo.videoOd.';

// Storage can be missing or throw (private window, blocked site data); the
// demo then still works, it just forgets on reload.
let uMemoriji: DemoStanje | null = null;

function procitaj(): DemoStanje {
  try {
    const raw = localStorage.getItem(KLJUC);
    if (raw) {
      const st = JSON.parse(raw) as DemoStanje;
      // Demo data saved by an older version: fill in what it did not have yet.
      if (!st.boravci || !st.zahtevi || !st.karton || !st.izmeneKartona || !st.dogadjaji || st.rasporedCasova === undefined) {
        const seed = napraviSeed(new Date());
        st.boravci ??= seed.boravci;
        st.dogadjaji ??= seed.dogadjaji;
        st.zahtevi ??= seed.zahtevi;
        st.karton ??= seed.karton;
        st.izmeneKartona ??= seed.izmeneKartona;
        if (st.rasporedCasova === undefined) st.rasporedCasova = seed.rasporedCasova;
        sacuvaj(st);
      }
      return st;
    }
  } catch {
    if (uMemoriji) return uMemoriji;
  }
  if (uMemoriji) return uMemoriji;
  const novo = napraviSeed(new Date());
  sacuvaj(novo);
  return novo;
}

function sacuvaj(stanje: DemoStanje): void {
  uMemoriji = stanje;
  try {
    localStorage.setItem(KLJUC, JSON.stringify(stanje));
  } catch {
    /* keep it in memory only */
  }
}

export function trenutniRoditelj(): string {
  try {
    const id = localStorage.getItem(KLJUC_JA);
    if (id && id in RODITELJI) return id;
  } catch {
    /* default below */
  }
  return 'tata';
}

export function postaviRoditelja(id: string): void {
  try {
    localStorage.setItem(KLJUC_JA, id);
  } catch {
    /* ignore */
  }
}

export function resetujDemo(): void {
  uMemoriji = null;
  try {
    localStorage.removeItem(KLJUC);
    for (const id of Object.keys(RODITELJI)) sessionStorage.removeItem(KLJUC_VIDEO + id);
  } catch {
    /* ignore */
  }
}

/** Remember where "new since last visit" starts for this browser session. */
function videoOd(stanje: DemoStanje, ja: string): string | null {
  const kljuc = KLJUC_VIDEO + ja;
  try {
    const sacuvano = sessionStorage.getItem(kljuc);
    if (sacuvano !== null) return sacuvano || null;
    const prethodna = stanje.posete[ja] ?? null;
    sessionStorage.setItem(kljuc, prethodna ?? '');
    stanje.posete[ja] = new Date().toISOString();
    sacuvaj(stanje);
    return prethodna;
  } catch {
    return stanje.posete[ja] ?? null;
  }
}

function nadjiZahtev(stanje: DemoStanje, id: string): number {
  const i = stanje.zahtevi.findIndex((z) => z.id === id);
  if (i < 0) throw new GreskaPravila('Zahtev ne postoji.');
  return i;
}

/** With real accounts: the real family's parent labels. */
function pravaPorodica(): { oznake: Record<string, { oznaka: string; akuzativ: string; genitiv: string }> } | null {
  try {
    const p = JSON.parse(sessionStorage.getItem('coparenting.porodica') ?? 'null');
    if (!p) return null;
    const oznake: Record<string, { oznaka: string; akuzativ: string; genitiv: string }> = {};
    for (const c of [p.ja, p.drugi].filter(Boolean)) {
      oznake[c.uloga] = { oznaka: c.oznaka, akuzativ: c.oznakaAkuzativ, genitiv: c.oznakaGenitiv };
    }
    return { oznake };
  } catch {
    return null;
  }
}

export function napraviMockIzvor({ demo = true }: { demo?: boolean } = {}): Izvor {
  const sada = () => new Date().toISOString();

  async function promeni(id: string, fn: (s: Stavka, ja: string, t: string) => Promena): Promise<void> {
    const stanje = procitaj();
    const i = stanje.stavke.findIndex((s) => s.id === id);
    if (i < 0) throw new GreskaPravila('Stavka ne postoji.');
    const p = fn(stanje.stavke[i], trenutniRoditelj(), sada());
    stanje.stavke[i] = p.stavka;
    if (p.unos) stanje.unosi.push({ id: crypto.randomUUID(), ...p.unos });
    sacuvaj(stanje);
  }

  return {
    demo,

    async ucitaj(): Promise<Podaci> {
      const stanje = procitaj();
      const jaId = trenutniRoditelj();
      const drugiId = Object.keys(RODITELJI).find((id) => id !== jaId)!;
      const od = videoOd(stanje, jaId);
      const prava = demo ? null : pravaPorodica();
      const roditelj = (id: string) => {
        const o = prava?.oznake[id];
        return {
          ...RODITELJI[id],
          ...(o ? { oznaka: o.oznaka, oznakaAkuzativ: o.akuzativ, oznakaGenitiv: o.genitiv } : {}),
          poslednjaPoseta: stanje.posete[id] ?? null,
        };
      };
      return {
        ja: roditelj(jaId),
        drugi: roditelj(drugiId),
        // The child's name is never shown; the app says "dete" everywhere.
        dete: { ime: DETE.ime },
        oblasti: OBLASTI,
        stavke: stanje.stavke,
        unosi: stanje.unosi,
        boravci: stanje.boravci,
        dogadjaji: stanje.dogadjaji,
        zahtevi: stanje.zahtevi,
        karton: stanje.karton,
        izmeneKartona: stanje.izmeneKartona,
        rasporedCasova: stanje.rasporedCasova,
        videoOd: od,
      };
    },

    async novaStavka(ulaz) {
      const u = proveriNovu(ulaz);
      const stanje = procitaj();
      const t = sada();
      const id = crypto.randomUUID();
      stanje.stavke.push({
        id,
        ...u,
        stanje: 'neodgovoreno',
        otvorio: trenutniRoditelj(),
        odluka: null,
        zatvaranjePredlozio: null,
        kreirano: t,
        izmenjeno: t,
        zatvoreno: null,
      });
      sacuvaj(stanje);
      return id;
    },

    async izmeniStavku(id, izmena) {
      await promeni(id, (s, ja, t) => izmeni(s, ja, izmena, t));
    },

    odgovori: (id, tekst) => promeni(id, (s, ja, t) => odgovori(s, ja, tekst, t)),
    predloziZatvaranje: (id, odluka) => promeni(id, (s, ja, t) => predloziZatvaranje(s, ja, odluka, t)),
    potvrdiZatvaranje: (id) => promeni(id, (s, ja, t) => potvrdiZatvaranje(s, ja, t)),
    odbijZatvaranje: (id, razlog) => promeni(id, (s, ja, t) => odbijZatvaranje(s, ja, razlog, t)),
    povuciPredlog: (id, uAktivno = false) => promeni(id, (s, ja, t) => povuciPredlog(s, ja, t, uAktivno)),
    aktiviraj: (id, napomena) => promeni(id, (s, ja, t) => aktiviraj(s, ja, napomena, t)),

    async predloziKalendar(ulaz) {
      const stanje = procitaj();
      const z = napraviZahtev(ulaz, trenutniRoditelj(), Object.keys(RODITELJI), stanje.boravci, sada());
      stanje.zahtevi.push({ id: crypto.randomUUID(), ...z });
      sacuvaj(stanje);
    },

    async predloziDogadjaj(ulaz) {
      const stanje = procitaj();
      const z = napraviZahtevDogadjaja(ulaz, trenutniRoditelj(), Object.keys(RODITELJI), stanje.dogadjaji, sada());
      stanje.zahtevi.push({ id: crypto.randomUUID(), ...z });
      sacuvaj(stanje);
    },

    async prihvatiZahtev(id) {
      const stanje = procitaj();
      const i = nadjiZahtev(stanje, id);
      const z = stanje.zahtevi[i];
      if (z.predmet === 'dogadjaj') {
        const r = prihvatiZahtevDogadjaja(z, trenutniRoditelj(), stanje.dogadjaji, sada(), () => crypto.randomUUID());
        stanje.zahtevi[i] = r.zahtev;
        stanje.dogadjaji = r.dogadjaji;
      } else {
        const r = prihvatiZahtev(z, trenutniRoditelj(), stanje.boravci, sada(), () => crypto.randomUUID());
        stanje.zahtevi[i] = r.zahtev;
        stanje.boravci = r.boravci;
      }
      sacuvaj(stanje);
    },

    async odbijZahtev(id, razlog) {
      const stanje = procitaj();
      const i = nadjiZahtev(stanje, id);
      stanje.zahtevi[i] = odbijZahtev(stanje.zahtevi[i], trenutniRoditelj(), razlog, sada());
      sacuvaj(stanje);
    },

    async sacuvajKarton(ulaz) {
      const stanje = procitaj();
      const r = sacuvajUnos(stanje.karton, ulaz, trenutniRoditelj(), sada(), () => crypto.randomUUID());
      stanje.karton = r.unosi;
      if (r.izmena) stanje.izmeneKartona.push({ id: crypto.randomUUID(), ...r.izmena });
      sacuvaj(stanje);
    },

    async sacuvajRasporedCasova(r) {
      const stanje = procitaj();
      const pre = sazetakRasporeda(stanje.rasporedCasova);
      const posle = sazetakRasporeda(r);
      const t = sada();
      stanje.rasporedCasova = r ? { ...r, napomena: r.napomena.trim(), izmenio: trenutniRoditelj(), izmenjeno: t } : null;
      stanje.izmeneKartona.push({
        id: crypto.randomUUID(),
        unosId: 'raspored-casova',
        grupa: 'skola',
        naziv: 'Raspored časova',
        staro: pre === 'nema' ? null : pre,
        novo: r ? posle : null,
        autor: trenutniRoditelj(),
        kada: t,
      });
      sacuvaj(stanje);
    },

    async obrisiKarton(id) {
      const stanje = procitaj();
      const r = obrisiUnos(stanje.karton, id, trenutniRoditelj(), sada());
      stanje.karton = r.unosi;
      stanje.izmeneKartona.push({ id: crypto.randomUUID(), ...r.izmena });
      sacuvaj(stanje);
    },

    async povuciZahtev(id) {
      const stanje = procitaj();
      const i = nadjiZahtev(stanje, id);
      stanje.zahtevi[i] = povuciZahtev(stanje.zahtevi[i], trenutniRoditelj(), sada());
      sacuvaj(stanje);
    },
    ponovoOtvori: (id, razlog) => promeni(id, (s, ja, t) => ponovoOtvori(s, ja, razlog, t)),
    // Demo data lives in this browser only: nobody else changes it.
    naPromenu: () => () => {},
  };
}
