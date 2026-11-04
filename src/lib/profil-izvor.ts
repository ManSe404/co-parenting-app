// Where parent profiles live: this browser in the demo, the `roditelj` table
// with real accounts (saved only through sacuvaj_profil).

import { type Profil, type ProfilRoditelja, proveriProfil } from './profil';

export interface ProfilIzvor {
  readonly demo: boolean;
  /** My profile and the other parent's (null while not linked). */
  profili(): Promise<{ ja: ProfilRoditelja; drugi: ProfilRoditelja | null }>;
  sacuvaj(p: Omit<Profil, 'izmenjen'>): Promise<void>;
}

const KLJUC_DEMO = 'coparenting.demo.profili';

const DEMO_POCETNO: Record<string, Profil> = {
  tata: { ime: '', telefon: '', adresa: '', kontaktEmail: '', napomena: '', izmenjen: null },
  mama: {
    ime: 'Mama (demo)',
    telefon: '064 765 4321',
    adresa: 'Njegoševa 12, Beograd',
    kontaktEmail: '',
    napomena: 'Radim do 16h; posle toga najlakše na Viber.',
    izmenjen: '2026-10-20T18:00:00.000Z',
  },
};

function demoIzvor(): ProfilIzvor {
  const procitaj = (): Record<string, Profil> => {
    try {
      return { ...DEMO_POCETNO, ...(JSON.parse(localStorage.getItem(KLJUC_DEMO) ?? '{}') as Record<string, Profil>) };
    } catch {
      return { ...DEMO_POCETNO };
    }
  };
  const OZNAKE: Record<string, string> = { tata: 'Tata', mama: 'Mama' };
  const ja = async () => (await import('./mock/izvor-mock')).trenutniRoditelj();

  return {
    demo: true,
    async profili() {
      const svi = procitaj();
      const moj = await ja();
      const drugi = moj === 'tata' ? 'mama' : 'tata';
      return {
        ja: { uloga: moj, oznaka: OZNAKE[moj], ...svi[moj] },
        drugi: { uloga: drugi, oznaka: OZNAKE[drugi], ...svi[drugi] },
      };
    },
    async sacuvaj(p) {
      const svi = procitaj();
      svi[await ja()] = { ...proveriProfil(p), izmenjen: new Date().toISOString() };
      try {
        localStorage.setItem(KLJUC_DEMO, JSON.stringify(svi));
      } catch {
        /* the demo forgets on reload */
      }
    },
  };
}

async function bazaIzvor(): Promise<ProfilIzvor> {
  const { supabase } = await import('./supabase');
  const { poruka } = await import('./nalog');
  const sb = supabase();
  return {
    demo: false,
    async profili() {
      const { data: s } = await sb.auth.getSession();
      const moj = s.session?.user.id;
      const { data, error } = await sb
        .from('roditelj')
        .select('korisnik, uloga, oznaka, ime, telefon, adresa, kontakt_email, napomena, profil_izmenjen');
      if (error) throw new Error(poruka(error));
      const u = (r: Record<string, unknown>): ProfilRoditelja => ({
        uloga: r.uloga as string,
        oznaka: r.oznaka as string,
        ime: (r.ime as string) ?? '',
        telefon: (r.telefon as string) ?? '',
        adresa: (r.adresa as string) ?? '',
        kontaktEmail: (r.kontakt_email as string) ?? '',
        napomena: (r.napomena as string) ?? '',
        izmenjen: (r.profil_izmenjen as string | null) ?? null,
      });
      const ja = data?.find((r) => r.korisnik === moj);
      if (!ja) throw new Error('Nisi u porodičnom prostoru.');
      const drugi = data?.find((r) => r.korisnik !== moj);
      return { ja: u(ja), drugi: drugi ? u(drugi) : null };
    },
    async sacuvaj(p) {
      const c = proveriProfil(p);
      const { error } = await sb.rpc('sacuvaj_profil', {
        p_ime: c.ime,
        p_telefon: c.telefon,
        p_adresa: c.adresa,
        p_kontakt_email: c.kontaktEmail,
        p_napomena: c.napomena,
      });
      if (error) throw new Error(poruka(error));
    },
  };
}

let trenutni: Promise<ProfilIzvor> | null = null;

export function profilIzvor(): Promise<ProfilIzvor> {
  trenutni ??= import('./supabase').then(async (s) => {
    if (s.jeDemo()) return demoIzvor();
    await (await import('./pristup-spreman')).pristupSpreman;
    return bazaIzvor();
  });
  return trenutni;
}
