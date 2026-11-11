// E-mail notifications: each parent's choice of how often. The rules (what is
// queued, for whom, what counts as urgent) live in the database
// (supabase/migrations/*_obavestenja.sql); the app only shows and saves the
// preference. In the demo it lives in this browser.

export type RezimObavestenja = 'odmah' | 'dnevno' | 'nikad';

export const REZIMI: { kljuc: RezimObavestenja; naziv: string; opis: string }[] = [
  { kljuc: 'odmah', naziv: 'Odmah', opis: 'Mejl za svaku promenu, čim se dogodi.' },
  { kljuc: 'dnevno', naziv: 'Jednom dnevno', opis: 'Jedan pregled ujutru u 8; hitne stvari odmah.' },
  { kljuc: 'nikad', naziv: 'Nikad', opis: 'Bez mejlova. Promene vidiš samo u aplikaciji.' },
];

export const PODRAZUMEVANO: RezimObavestenja = 'dnevno';

export function jeRezim(v: unknown): v is RezimObavestenja {
  return v === 'odmah' || v === 'dnevno' || v === 'nikad';
}

export interface ObavestenjaIzvor {
  readonly demo: boolean;
  rezim(): Promise<RezimObavestenja>;
  postavi(r: RezimObavestenja): Promise<void>;
}

const KLJUC_DEMO = 'coparenting.demo.obavestenja';

function demoIzvor(): ObavestenjaIzvor {
  return {
    demo: true,
    async rezim() {
      try {
        const v = localStorage.getItem(KLJUC_DEMO);
        return jeRezim(v) ? v : PODRAZUMEVANO;
      } catch {
        return PODRAZUMEVANO;
      }
    },
    async postavi(r) {
      try {
        localStorage.setItem(KLJUC_DEMO, r);
      } catch {
        /* the demo forgets on reload */
      }
    },
  };
}

async function bazaIzvor(): Promise<ObavestenjaIzvor> {
  const { supabase } = await import('./supabase');
  const { poruka } = await import('./nalog');
  const sb = supabase();
  return {
    demo: false,
    async rezim() {
      const { data: s } = await sb.auth.getSession();
      const moj = s.session?.user.id;
      const { data, error } = await sb.from('roditelj').select('korisnik, obavestenja').eq('korisnik', moj ?? '').maybeSingle();
      if (error) throw new Error(poruka(error));
      const v = data?.obavestenja;
      return jeRezim(v) ? v : PODRAZUMEVANO;
    },
    async postavi(r) {
      const { error } = await sb.rpc('postavi_obavestenja', { p_rezim: r });
      if (error) throw new Error(poruka(error));
    },
  };
}

let trenutni: Promise<ObavestenjaIzvor> | null = null;

export function obavestenjaIzvor(): Promise<ObavestenjaIzvor> {
  trenutni ??= import('./supabase').then(async (s) => {
    if (s.jeDemo()) return demoIzvor();
    await (await import('./pristup-spreman')).pristupSpreman;
    return bazaIzvor();
  });
  return trenutni;
}
