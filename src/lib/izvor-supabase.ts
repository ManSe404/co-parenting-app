// The real data source: items, calendar and karton in the database, shared by
// both parents. Every change goes through a database function that enforces
// the same rules as the demo (see supabase/migrations/*_stavke_kalendar_karton.sql);
// this file only reads rows and calls those functions.
//
// Parents are 'tata' / 'mama' in the app and auth accounts in the database;
// the mapping comes from the `roditelj` rows. Timestamps are normalised to
// JavaScript ISO strings, because the app compares them as strings.

import { GreskaPravila, proveriNovu } from './domen';
import type { Dogadjaj, PredlogDogadjaja } from './dogadjaji';
import type { Izvor } from './izvor';
import type { Boravak, PredlogBoravka, ZahtevKalendara } from './kalendar';
import { type GrupaKartona, type IzmenaKartona, type UnosKartona, sacuvajUnos, sazetak } from './karton';
import { poruka } from './nalog';
import { OBLASTI, RODITELJI } from './osnova';
import { type RasporedCasova, sazetakRasporeda } from './raspored-casova';
import { supabase } from './supabase';
import type { OblastKljuc, Podaci, Roditelj, Stanje, Stavka, Unos, VrstaUnosa } from './tipovi';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Red = Record<string, unknown>;

const iso = (t: unknown): string => new Date(t as string).toISOString();
const isoIliNull = (t: unknown): string | null => (t ? iso(t) : null);

function greska(e: unknown): GreskaPravila {
  return new GreskaPravila(poruka(e));
}

const STRANA = 1000;

// The shared tables the screens read (all in the supabase_realtime
// publication, migration 20261111030000_realtime.sql).
const TABELE_PROMENA = [
  'roditelj', 'stavka', 'unos', 'boravak', 'dogadjaj', 'zahtev_kalendara',
  'karton_unos', 'karton_izmena', 'raspored_casova', 'dokument', 'dokument_trag', 'dokument_brisanje',
];

async function redovi<T = Red>(upit: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await upit;
  if (error) throw greska(error);
  return (data ?? []) as T[];
}

/** "New since your last visit": marked once per browser session, like the demo. */
async function videoOd(korisnik: string): Promise<string | null> {
  const kljuc = `coparenting.videoOd.${korisnik}`;
  try {
    const sacuvano = sessionStorage.getItem(kljuc);
    if (sacuvano !== null) return sacuvano || null;
  } catch {
    /* no session storage: ask every time */
  }
  const { data, error } = await supabase().rpc('oznaci_posetu');
  if (error) return null;
  const prethodna = isoIliNull(data);
  try {
    sessionStorage.setItem(kljuc, prethodna ?? '');
  } catch {
    /* ignore */
  }
  return prethodna;
}

export function napraviSupabaseIzvor(): Izvor {
  const sb = supabase();

  async function rpc<T = unknown>(ime: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.rpc(ime, args);
    if (error) throw greska(error);
    return data as T;
  }

  // PostgREST returns at most max_rows (1000, supabase/config.toml and the
  // hosted default) rows per request; read in pages so nothing is cut off.
  async function sve(tabela: string, poredak?: string): Promise<Red[]> {
    const svi: Red[] = [];
    for (let od = 0; ; od += STRANA) {
      const upit = sb.from(tabela).select('*');
      const strana = await redovi((poredak ? upit.order(poredak).order('id') : upit.order('id')).range(od, od + STRANA - 1));
      svi.push(...strana);
      if (strana.length < STRANA) return svi;
    }
  }

  // Realtime: one channel per family, opened for the first listener and
  // closed after the last. What it delivers is decided by RLS, not by us:
  // before Realtime sends a change to a subscriber it evaluates the table's
  // SELECT policies with that subscriber's JWT, and every table here has RLS
  // on with "clan cita …" (porodica_id = moja_porodica()) plus the
  // restrictive MFA policy (migrations 20261104020000 and 20261104050000),
  // so a parent gets only their family's rows (with MFA only at aal2) and an
  // outsider gets nothing. The porodica_id filter below only trims the stream.
  // Locally without the realtime service the subscription just never connects
  // and the screens keep refreshing the old way (after their own actions).
  const slusaoci = new Set<() => void>();
  let kanal: RealtimeChannel | null = null;
  let otvaranje: Promise<void> | null = null;

  async function otvoriKanal(): Promise<void> {
    const { data } = await sb.from('roditelj').select('porodica_id').limit(1).maybeSingle();
    const porodica = (data?.porodica_id as string | undefined) ?? null;
    if (!porodica || kanal || slusaoci.size === 0) return;
    const k = sb.channel(`porodica-${porodica}`);
    for (const tabela of TABELE_PROMENA) {
      k.on('postgres_changes', { event: '*', schema: 'public', table: tabela, filter: `porodica_id=eq.${porodica}` }, () => {
        for (const cb of slusaoci) cb();
      });
    }
    k.subscribe();
    kanal = k;
  }

  function zatvoriKanal(): void {
    if (!kanal) return;
    void sb.removeChannel(kanal);
    kanal = null;
  }

  return {
    demo: false,

    naPromenu(cb) {
      slusaoci.add(cb);
      if (!kanal && !otvaranje) {
        otvaranje = otvoriKanal()
          .catch(() => {
            /* no realtime (e.g. local without the service): nothing to follow */
          })
          .finally(() => (otvaranje = null));
      }
      return () => {
        slusaoci.delete(cb);
        if (slusaoci.size === 0) zatvoriKanal();
      };
    },

    async ucitaj(): Promise<Podaci> {
      const { data: s } = await sb.auth.getSession();
      const moj = s.session?.user.id;
      if (!moj) throw new GreskaPravila('Nisi prijavljen.');

      const [rod, st, un, bo, dg, za, ku, ki, rc] = await Promise.all([
        redovi(sb.from('roditelj').select('korisnik, uloga, oznaka, oznaka_akuzativ, oznaka_genitiv, boja, poslednja_poseta')),
        sve('stavka'),
        sve('unos', 'kreirano'),
        sve('boravak', 'pocetak'),
        sve('dogadjaj'),
        sve('zahtev_kalendara', 'kreirano'),
        sve('karton_unos'),
        sve('karton_izmena', 'kada'),
        redovi(sb.from('raspored_casova').select('*')),
      ]);

      const uloga = new Map(rod.map((r) => [r.korisnik as string, r.uloga as string]));
      const ko = (id: unknown): string => uloga.get(id as string) ?? '?';
      const koIliNull = (id: unknown): string | null => (id ? ko(id) : null);

      const mojRed = rod.find((r) => r.korisnik === moj);
      if (!mojRed) throw new GreskaPravila('Nisi u porodičnom prostoru.');
      const drugiRed = rod.find((r) => r.korisnik !== moj);
      const uRoditelja = (r: Red): Roditelj => ({
        id: r.uloga as string,
        oznaka: r.oznaka as string,
        oznakaAkuzativ: r.oznaka_akuzativ as string,
        oznakaGenitiv: r.oznaka_genitiv as string,
        boja: r.boja as 'bio' | 'ai',
        poslednjaPoseta: isoIliNull(r.poslednja_poseta),
      });
      const ja = uRoditelja(mojRed);
      // Before the second parent joins, the app still shows their role.
      const drugi: Roditelj = drugiRed
        ? uRoditelja(drugiRed)
        : { ...RODITELJI[ja.id === 'tata' ? 'mama' : 'tata'], poslednjaPoseta: null };

      const stavke: Stavka[] = st.map((r) => ({
        id: r.id as string,
        naslov: r.naslov as string,
        opis: r.opis as string,
        oblast: r.oblast as OblastKljuc,
        stanje: r.stanje as Stanje,
        vazno: r.vazno as boolean,
        hitno: r.hitno as boolean,
        datum: (r.datum as string | null) ?? null,
        otvorio: ko(r.otvorio),
        odluka: (r.odluka as string | null) ?? null,
        zatvaranjePredlozio: koIliNull(r.zatvaranje_predlozio),
        kreirano: iso(r.kreirano),
        izmenjeno: iso(r.izmenjeno),
        zatvoreno: isoIliNull(r.zatvoreno),
      }));

      const unosi: Unos[] = un.map((r) => ({
        id: r.id as string,
        stavkaId: r.stavka_id as string,
        autor: ko(r.autor),
        vrsta: r.vrsta as VrstaUnosa,
        tekst: r.tekst as string,
        kreirano: iso(r.kreirano),
      }));

      const boravci: Boravak[] = bo.map((r) => ({
        id: r.id as string,
        vrsta: r.vrsta as Boravak['vrsta'],
        kod: r.kod as string,
        od: r.pocetak as string,
        do: r.kraj as string,
        napomena: r.napomena as string,
        kreirano: iso(r.kreirano),
      }));

      const dogadjaji: Dogadjaj[] = dg.map((r) => ({
        id: r.id as string,
        naziv: r.naziv as string,
        vrsta: r.vrsta as Dogadjaj['vrsta'],
        datum: r.datum as string,
        ceoDan: r.ceo_dan as boolean,
        od: r.pocetak as string,
        do: r.kraj as string,
        ponavljanje: r.ponavljanje as Dogadjaj['ponavljanje'],
        vodi: (r.vodi as string | null) ?? null,
        mesto: r.mesto as string,
        napomena: r.napomena as string,
        izuzeti: (r.izuzeti as string[]) ?? [],
        kreirano: iso(r.kreirano),
      }));

      const zahtevi: ZahtevKalendara[] = za.map((r) => ({
        id: r.id as string,
        predmet: r.predmet as 'boravak' | 'dogadjaj',
        vrsta: r.vrsta as ZahtevKalendara['vrsta'],
        boravakId: (r.boravak_id as string | null) ?? null,
        boravci: (r.boravci as PredlogBoravka[]) ?? [],
        dogadjajId: (r.dogadjaj_id as string | null) ?? null,
        dogadjaj: (r.dogadjaj as PredlogDogadjaja | null) ?? null,
        jednom: (r.jednom as string | null) ?? null,
        poruka: r.poruka as string,
        predlozio: ko(r.predlozio),
        stanje: r.stanje as ZahtevKalendara['stanje'],
        razlog: (r.razlog as string | null) ?? null,
        kreirano: iso(r.kreirano),
        reseno: isoIliNull(r.reseno),
        resio: koIliNull(r.resio),
      }));

      const karton: UnosKartona[] = ku.map((r) => ({
        id: r.id as string,
        grupa: r.grupa as GrupaKartona,
        naziv: r.naziv as string,
        vrednost: r.vrednost as string,
        ...(r.detalji ? { detalji: r.detalji as Record<string, string> } : {}),
        izmenio: ko(r.izmenio),
        izmenjeno: iso(r.izmenjeno),
      }));

      // The log keeps snapshots; the app shows them as one-line summaries.
      const izmeneKartona: IzmenaKartona[] = ki.map((r) => {
        const raspored = r.unos_id === 'raspored-casova';
        const opis = (snimak: unknown): string | null => {
          if (!snimak) return null;
          const x = snimak as Record<string, unknown>;
          if (raspored) {
            return sazetakRasporeda({
              casovi: (x.casovi as string[]) ?? [],
              tabela: (x.tabela as string[][]) ?? [],
              slika: x.slika ? 'slika' : null,
              napomena: (x.napomena as string) ?? '',
            });
          }
          return sazetak({
            grupa: x.grupa as GrupaKartona,
            naziv: x.naziv as string,
            vrednost: (x.vrednost as string) ?? '',
            detalji: (x.detalji as Record<string, string> | null) ?? undefined,
          });
        };
        return {
          id: r.id as string,
          unosId: r.unos_id as string,
          grupa: r.grupa as GrupaKartona,
          naziv: r.naziv as string,
          staro: opis(r.staro),
          novo: opis(r.novo),
          autor: ko(r.autor),
          kada: iso(r.kada),
        };
      });

      const rr = rc[0];
      const rasporedCasova: RasporedCasova | null = rr
        ? {
            casovi: rr.casovi as string[],
            tabela: rr.tabela as string[][],
            slika: (rr.slika as string | null) ?? null,
            napomena: rr.napomena as string,
            izmenio: ko(rr.izmenio),
            izmenjeno: iso(rr.izmenjeno),
          }
        : null;

      return {
        ja,
        drugi,
        // The child's name is never shown; the app says "dete" everywhere.
        dete: { ime: 'Dete' },
        oblasti: OBLASTI,
        stavke,
        unosi,
        boravci,
        dogadjaji,
        zahtevi,
        karton,
        izmeneKartona,
        rasporedCasova,
        videoOd: await videoOd(moj),
      };
    },

    async novaStavka(ulaz) {
      const u = proveriNovu(ulaz);
      return rpc<string>('nova_stavka', {
        p_naslov: u.naslov,
        p_opis: u.opis,
        p_oblast: u.oblast,
        p_vazno: u.vazno,
        p_hitno: u.hitno,
        p_datum: u.datum,
      });
    },

    async izmeniStavku(id, izmena) {
      await rpc('izmeni_stavku', { p_id: id, p_izmena: izmena });
    },

    async odgovori(id, tekst) {
      await rpc('odgovori_na_stavku', { p_id: id, p_tekst: tekst });
    },
    async predloziZatvaranje(id, odluka) {
      await rpc('predlozi_zatvaranje', { p_id: id, p_odluka: odluka });
    },
    async potvrdiZatvaranje(id) {
      await rpc('potvrdi_zatvaranje', { p_id: id });
    },
    async odbijZatvaranje(id, razlog) {
      await rpc('odbij_zatvaranje', { p_id: id, p_razlog: razlog });
    },
    async povuciPredlog(id, uAktivno = false) {
      await rpc('povuci_predlog_zatvaranja', { p_id: id, p_u_aktivno: uAktivno });
    },
    async aktiviraj(id, napomena) {
      await rpc('aktiviraj_stavku', { p_id: id, p_napomena: napomena });
    },
    async ponovoOtvori(id, razlog) {
      await rpc('ponovo_otvori_stavku', { p_id: id, p_razlog: razlog });
    },

    async predloziKalendar(ulaz) {
      await rpc('predlozi_kalendar', {
        p_vrsta: ulaz.vrsta,
        p_boravak_id: ulaz.boravakId,
        p_boravci: ulaz.boravci,
        p_poruka: ulaz.poruka,
      });
    },

    async predloziDogadjaj(ulaz) {
      await rpc('predlozi_dogadjaj', {
        p_vrsta: ulaz.vrsta,
        p_dogadjaj_id: ulaz.dogadjajId,
        p_dogadjaj: ulaz.dogadjaj,
        p_poruka: ulaz.poruka,
        p_jednom: ulaz.jednom ?? null,
      });
    },

    async prihvatiZahtev(id) {
      await rpc('prihvati_zahtev', { p_id: id });
    },
    async odbijZahtev(id, razlog) {
      await rpc('odbij_zahtev', { p_id: id, p_razlog: razlog });
    },
    async povuciZahtev(id) {
      await rpc('povuci_zahtev', { p_id: id });
    },

    async sacuvajKarton(ulaz) {
      // The app's own rules check and tidy the entry first (same messages as
      // the demo); the database checks again and logs the change.
      const [cist] = sacuvajUnos([], { ...ulaz, id: null }, '', '', () => 'novi').unosi;
      await rpc('sacuvaj_karton', {
        p_id: ulaz.id,
        p_grupa: cist.grupa,
        p_naziv: cist.naziv,
        p_vrednost: cist.vrednost,
        p_detalji: cist.detalji ?? null,
      });
    },

    async obrisiKarton(id) {
      await rpc('obrisi_karton', { p_id: id });
    },

    async sacuvajRasporedCasova(r) {
      await rpc(
        'sacuvaj_raspored',
        r
          ? { p_casovi: r.casovi, p_tabela: r.tabela, p_slika: r.slika, p_napomena: r.napomena }
          : { p_casovi: null, p_tabela: null, p_slika: null, p_napomena: null },
      );
    },
  };
}
