// The Supabase client, and which mode the app runs in.
//
// "baza": real accounts (PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY set).
// "demo": no accounts, demo data in this browser. It is also what you get on
// purpose with ?demo=1 (e.g. to show the app before signing up); ?demo=0 ends it.

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

const URL_BAZE = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KLJUC = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined;
const KLJUC_DEMO = 'coparenting.demo';

export function imaBazu(): boolean {
  return Boolean(URL_BAZE && KLJUC);
}

// The demo lives only in this tab (sessionStorage): it never sticks to the
// browser, so a parent who tried it and then signs in sees real data. The
// same decision is made before paint in layouts/App.astro.
export function jeDemo(): boolean {
  if (!imaBazu()) return true;
  try {
    localStorage.removeItem(KLJUC_DEMO);
    const q = new URLSearchParams(location.search).get('demo');
    if (q === '1') sessionStorage.setItem(KLJUC_DEMO, '1');
    if (q === '0') sessionStorage.removeItem(KLJUC_DEMO);
    return sessionStorage.getItem(KLJUC_DEMO) === '1';
  } catch {
    return false;
  }
}

export function izadjiIzDemoa(): void {
  try {
    sessionStorage.removeItem(KLJUC_DEMO);
    localStorage.removeItem(KLJUC_DEMO);
  } catch {
    /* ignore */
  }
}

let klijent: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!URL_BAZE || !KLJUC) throw new Error('Baza nije podešena.');
  klijent ??= createClient(URL_BAZE, KLJUC, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  return klijent;
}
