// Documents in the database: the row in `dokument`, the file in the private
// bucket `dokumenti` under `<family id>/<document id>.<ext>`. Reading a file
// takes a signed address that works for ten minutes; there are no public links.
// Every change goes through a database function that checks who is asking.

import {
  type Dokument,
  GreskaDokumenta,
  type KategorijaKljuc,
  TIPOVI,
  type TipFajla,
  type Trag,
  type StanjeBrisanja,
  type UlazDokumenta,
  type VrstaTraga,
  type ZahtevBrisanja,
  imeFajla,
  proveriUlaz,
  proveriVelicinu,
} from './dokumenti';
import type { DokumentiIzvor } from './dokumenti-izvor';
import { poruka } from './nalog';
import { supabase } from './supabase';

const KANTA = 'dokumenti';
const TRAJANJE = 600;

interface Red {
  id: string;
  putanja: string;
  naziv: string;
  kategorija: KategorijaKljuc;
  datum: string | null;
  napomena: string;
  tip: TipFajla;
  velicina: number;
  otpremio: string;
  otpremljeno: string;
  obrisan: string | null;
  obrisao: string | null;
  dokument_trag: { vrsta: VrstaTraga; ko: string; kada: string }[];
}

const KOLONE = 'id, putanja, naziv, kategorija, datum, napomena, tip, velicina, otpremio, otpremljeno, obrisan, obrisao, dokument_trag(vrsta, ko, kada)';

/** Storage and database errors in plain Serbian where we know them. */
function greska(e: unknown): GreskaDokumenta {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/exceeded the maximum allowed size|payload too large/i.test(m)) return new GreskaDokumenta('Fajl je prevelik (najviše 10 MB).');
  if (/mime type .* is not supported|invalid_mime_type/i.test(m)) return new GreskaDokumenta('Ova vrsta fajla nije dozvoljena. Dodaj PDF ili sliku.');
  if (/row-level security|unauthorized|not allowed/i.test(m)) return new GreskaDokumenta('Nemaš pravo na ovo. Prijavi se ponovo.');
  if (/failed to fetch|network/i.test(m)) return new GreskaDokumenta('Nema veze sa serverom. Proveri internet pa probaj ponovo.');
  return new GreskaDokumenta(poruka(e));
}

export function napraviDokumenteUBazi(): DokumentiIzvor {
  const sb = supabase();
  const kanta = () => sb.storage.from(KANTA);
  const potpisane = new Map<string, { adresa: string; vazi: number }>();

  let porodica: Promise<{ id: string; uloga: Map<string, string> }> | null = null;
  function mojaPorodica() {
    porodica ??= (async () => {
      const { data, error } = await sb.from('roditelj').select('porodica_id, korisnik, uloga');
      if (error) throw greska(error);
      if (!data?.length) throw new GreskaDokumenta('Nisi u porodičnom prostoru.');
      return { id: data[0].porodica_id as string, uloga: new Map(data.map((r) => [r.korisnik as string, r.uloga as string])) };
    })();
    porodica.catch(() => (porodica = null));
    return porodica;
  }

  async function uDokument(r: Red): Promise<Dokument> {
    const { uloga } = await mojaPorodica();
    const ko = (id: string | null) => (id ? (uloga.get(id) ?? '?') : null);
    const trag: Trag[] = [...(r.dokument_trag ?? [])]
      .sort((a, b) => a.kada.localeCompare(b.kada))
      .map((t) => ({ vrsta: t.vrsta, ko: ko(t.ko)!, kada: t.kada }));
    return {
      id: r.id,
      naziv: r.naziv,
      kategorija: r.kategorija,
      datum: r.datum,
      napomena: r.napomena,
      tip: r.tip,
      velicina: Number(r.velicina),
      putanja: r.putanja,
      otpremio: ko(r.otpremio)!,
      otpremljeno: r.otpremljeno,
      obrisan: r.obrisan,
      obrisao: ko(r.obrisao),
      trag,
    };
  }

  async function rpc(ime: string, args: Record<string, unknown>): Promise<void> {
    const { error } = await sb.rpc(ime, args);
    if (error) throw greska(error);
  }

  function zaBazu(u: UlazDokumenta) {
    const p = proveriUlaz(u);
    return { p_naziv: p.naziv, p_kategorija: p.kategorija, p_datum: p.datum, p_napomena: p.napomena };
  }

  async function potpisi(putanje: string[], preuzmi?: Map<string, string>): Promise<Map<string, string>> {
    const sada = Date.now();
    const rezultat = new Map<string, string>();
    const fale: string[] = [];
    for (const p of putanje) {
      const k = preuzmi ? `${p}|preuzmi` : p;
      const s = potpisane.get(k);
      if (s && s.vazi > sada) rezultat.set(p, s.adresa);
      else fale.push(p);
    }
    if (fale.length && !preuzmi) {
      const { data, error } = await kanta().createSignedUrls(fale, TRAJANJE);
      if (error) throw greska(error);
      for (const d of data) {
        if (!d.path || !d.signedUrl) continue;
        rezultat.set(d.path, d.signedUrl);
        potpisane.set(d.path, { adresa: d.signedUrl, vazi: sada + (TRAJANJE - 60) * 1000 });
      }
    }
    for (const p of preuzmi ? fale : []) {
      const { data, error } = await kanta().createSignedUrl(p, TRAJANJE, { download: preuzmi!.get(p) ?? true });
      if (error) throw greska(error);
      rezultat.set(p, data.signedUrl);
      potpisane.set(`${p}|preuzmi`, { adresa: data.signedUrl, vazi: sada + (TRAJANJE - 60) * 1000 });
    }
    return rezultat;
  }

  return {
    demo: false,

    async lista() {
      const { data, error } = await sb.from('dokument').select(KOLONE).order('otpremljeno', { ascending: false });
      if (error) throw greska(error);
      return Promise.all((data as unknown as Red[]).map(uDokument));
    },

    async otpremi(fajl: Blob, tip: TipFajla, ulaz: UlazDokumenta) {
      const args = zaBazu(ulaz);
      proveriVelicinu(fajl.size);
      const { id: porodicaId } = await mojaPorodica();
      const id = crypto.randomUUID();
      const putanja = `${porodicaId}/${id}.${TIPOVI[tip].ekstenzija}`;
      const { error: e1 } = await kanta().upload(putanja, new Blob([fajl], { type: tip }), {
        contentType: tip,
        upsert: false,
        cacheControl: '3600',
      });
      if (e1) throw greska(e1);
      await rpc('dodaj_dokument', { p_id: id, p_putanja: putanja, ...args });
      const { data, error } = await sb.from('dokument').select(KOLONE).eq('id', id).single();
      if (error) throw greska(error);
      return uDokument(data as unknown as Red);
    },

    izmeni: (id, ulaz) => rpc('izmeni_dokument', { p_id: id, ...zaBazu(ulaz) }),
    obrisi: (id) => rpc('obrisi_dokument', { p_id: id }),
    vrati: (id) => rpc('vrati_dokument', { p_id: id }),

    async adresa(d, preuzmi = false) {
      const m = await potpisi([d.putanja], preuzmi ? new Map([[d.putanja, imeFajla(d)]]) : undefined);
      const a = m.get(d.putanja);
      if (!a) throw new GreskaDokumenta('Fajl trenutno ne može da se otvori.');
      return a;
    },

    async adrese(lista) {
      const m = await potpisi(lista.map((d) => d.putanja));
      return new Map(lista.flatMap((d) => (m.has(d.putanja) ? [[d.id, m.get(d.putanja)!] as const] : [])));
    },

    async brisanja() {
      const { data, error } = await sb
        .from('dokument_brisanje')
        .select('id, dokument_id, naziv, kategorija, predlozio, predlozeno, stanje, odgovorio, odgovoreno, zavrseno')
        .order('predlozeno', { ascending: false });
      if (error) throw greska(error);
      const { uloga } = await mojaPorodica();
      const ko = (id: string | null) => (id ? (uloga.get(id) ?? '?') : null);
      return (data ?? []).map(
        (r): ZahtevBrisanja => ({
          id: r.id,
          dokumentId: r.dokument_id,
          naziv: r.naziv,
          kategorija: r.kategorija as KategorijaKljuc,
          predlozio: ko(r.predlozio)!,
          predlozeno: r.predlozeno,
          stanje: r.stanje as StanjeBrisanja,
          odgovorio: ko(r.odgovorio),
          odgovoreno: r.odgovoreno,
          zavrseno: r.zavrseno,
        }),
      );
    },

    predloziTrajnoBrisanje: (dokumentId) => rpc('predlozi_trajno_brisanje', { p_dokument: dokumentId }),

    async potvrdiTrajnoBrisanje(zahtevId) {
      const { data, error } = await sb.rpc('potvrdi_trajno_brisanje', { p_id: zahtevId });
      if (error) throw greska(error);
      await zavrsi(zahtevId, data as string);
    },

    odbijTrajnoBrisanje: (zahtevId) => rpc('odbij_trajno_brisanje', { p_id: zahtevId }),
    povuciTrajnoBrisanje: (zahtevId) => rpc('povuci_trajno_brisanje', { p_id: zahtevId }),
    zavrsiTrajnoBrisanje: (zahtevId) => zavrsi(zahtevId, null),
  };

  /**
   * After both parents agreed: remove the file through the Storage API (the
   * bucket allows it only now), then let the database drop the row. If the
   * connection drops in between, running it again finishes the job.
   */
  async function zavrsi(zahtevId: string, putanja: string | null): Promise<void> {
    if (!putanja) {
      const { data, error } = await sb.from('dokument_brisanje').select('dokument(putanja)').eq('id', zahtevId).single();
      if (error) throw greska(error);
      putanja = (data as unknown as { dokument: { putanja: string } | null }).dokument?.putanja ?? null;
    }
    if (putanja) {
      const { error } = await kanta().remove([putanja]);
      if (error) throw greska(error);
      potpisane.delete(putanja);
      potpisane.delete(`${putanja}|preuzmi`);
    }
    await rpc('zavrsi_trajno_brisanje', { p_id: zahtevId });
  }
}
