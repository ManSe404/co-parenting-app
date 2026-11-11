// Accounts and the family space: sign-in (e-mail + password, Google), MFA,
// creating the family, and the invitation that links the second parent.

import { putanja } from './putanje';
import { supabase } from './supabase';

export type Uloga = 'tata' | 'mama';

export interface Clan {
  korisnik: string;
  uloga: Uloga;
  oznaka: string;
  oznakaAkuzativ: string;
  oznakaGenitiv: string;
  boja: 'bio' | 'ai';
  poslednjaPoseta: string | null;
}

export interface Porodica {
  id: string;
  ja: Clan;
  drugi: Clan | null;
  dete: { id: string; ime: string };
}

/** Where the user stands, from "not signed in" to "ready". */
export type Pristup =
  | { stanje: 'odjavljen' }
  | { stanje: 'mfa' }
  | { stanje: 'bez-porodice'; email: string }
  | { stanje: 'spreman'; email: string; porodica: Porodica };

/** Supabase/Postgres errors in plain Serbian where we know them. */
export function poruka(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return 'Pogrešan mejl ili lozinka.';
  if (/Email not confirmed/i.test(m)) return 'Mejl još nije potvrđen. Otvori link koji ti je stigao.';
  if (/already registered/i.test(m)) return 'Nalog sa tim mejlom već postoji. Prijavi se.';
  if (/Password should be at least/i.test(m)) return 'Lozinka mora imati bar 10 znakova.';
  if (/Password should contain/i.test(m)) return 'Lozinka mora imati i slova i brojeve.';
  if (/provider is not enabled|Unsupported provider/i.test(m)) return 'Prijava preko Google-a još nije podešena.';
  if (/Invalid TOTP code|invalid.*code/i.test(m)) return 'Kod nije tačan. Uzmi novi iz aplikacije i probaj ponovo.';
  if (/rate limit|too many/i.test(m)) return 'Previše pokušaja. Sačekaj malo pa probaj ponovo.';
  if (/failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(m)) {
    return 'Nema veze sa serverom. Proveri internet pa probaj ponovo.';
  }
  return m;
}

function adresa(p: string): string {
  return `${location.origin}${putanja(p)}`;
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

export async function prijavaLozinkom(email: string, lozinka: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: lozinka });
  if (error) throw new Error(poruka(error));
}

/** Returns true when the e-mail must be confirmed before the first sign-in. */
export async function registracija(email: string, lozinka: string, dalje: string): Promise<boolean> {
  const { data, error } = await supabase().auth.signUp({
    email: email.trim(),
    password: lozinka,
    options: { emailRedirectTo: adresa(`/prijava/?dalje=${encodeURIComponent(dalje)}`) },
  });
  if (error) throw new Error(poruka(error));
  return !data.session;
}

export async function prijavaGoogle(dalje: string): Promise<void> {
  const { error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: adresa(`/prijava/?dalje=${encodeURIComponent(dalje)}`) },
  });
  if (error) throw new Error(poruka(error));
}

export async function zaboravljenaLozinka(email: string): Promise<void> {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: adresa('/prijava/?nova-lozinka=1'),
  });
  if (error) throw new Error(poruka(error));
}

export async function novaLozinka(lozinka: string): Promise<void> {
  const { error } = await supabase().auth.updateUser({ password: lozinka });
  if (error) throw new Error(poruka(error));
}

export async function odjava(): Promise<void> {
  await supabase().auth.signOut();
}

// ---------------------------------------------------------------------------
// MFA (codes from an authenticator app)
// ---------------------------------------------------------------------------

export interface MfaStanje {
  ukljucen: boolean;
  faktorId: string | null;
}

export async function mfaStanje(): Promise<MfaStanje> {
  const { data, error } = await supabase().auth.mfa.listFactors();
  if (error) throw new Error(poruka(error));
  const f = data.totp.find((x) => x.status === 'verified') ?? null;
  return { ukljucen: !!f, faktorId: f?.id ?? null };
}

/** Starts enrolling: returns the QR code (SVG) and the secret for typing in. */
export async function mfaZapocni(): Promise<{ faktorId: string; qr: string; tajna: string }> {
  // A half-finished enrolment from before would block a new one: clear it.
  const lista = await supabase().auth.mfa.listFactors();
  for (const f of lista.data?.all ?? []) {
    if (f.status !== 'verified') await supabase().auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase().auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Aplikacija za kodove' });
  if (error) throw new Error(poruka(error));
  return { faktorId: data.id, qr: data.totp.qr_code, tajna: data.totp.secret };
}

/** Verifies a 6-digit code: finishes enrolment, or completes a sign-in. */
export async function mfaPotvrdi(faktorId: string, kod: string): Promise<void> {
  const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId: faktorId, code: kod.replace(/\s/g, '') });
  if (error) throw new Error(poruka(error));
}

/**
 * Turning MFA off asks for a current code first, so an unlocked phone or
 * laptop alone is not enough to switch it off.
 */
export async function mfaIskljuci(faktorId: string, kod: string): Promise<void> {
  await mfaPotvrdi(faktorId, kod);
  const { error } = await supabase().auth.mfa.unenroll({ factorId: faktorId });
  if (error) throw new Error(poruka(error));
  await supabase().auth.refreshSession();
}

// ---------------------------------------------------------------------------
// Where the user stands
// ---------------------------------------------------------------------------

function uClana(r: Record<string, unknown>): Clan {
  return {
    korisnik: r.korisnik as string,
    uloga: r.uloga as Uloga,
    oznaka: r.oznaka as string,
    oznakaAkuzativ: r.oznaka_akuzativ as string,
    oznakaGenitiv: r.oznaka_genitiv as string,
    boja: r.boja as 'bio' | 'ai',
    poslednjaPoseta: (r.poslednja_poseta as string | null) ?? null,
  };
}

export async function pristup(): Promise<Pristup> {
  const sb = supabase();
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return { stanje: 'odjavljen' };

  const { data: nivo } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivo && nivo.nextLevel === 'aal2' && nivo.currentLevel !== 'aal2') return { stanje: 'mfa' };

  const email = s.session.user.email ?? '';
  const ja = s.session.user.id;
  const { data: redovi, error } = await sb.from('roditelj').select('*');
  if (error) throw new Error(poruka(error));
  const moj = redovi?.find((r) => r.korisnik === ja);
  if (!moj) return { stanje: 'bez-porodice', email };

  const drugi = redovi!.find((r) => r.korisnik !== ja);
  const { data: deca, error: e2 } = await sb.from('dete').select('id, ime').order('kreirano').limit(1);
  if (e2) throw new Error(poruka(e2));
  return {
    stanje: 'spreman',
    email,
    porodica: {
      id: moj.porodica_id as string,
      ja: uClana(moj),
      drugi: drugi ? uClana(drugi) : null,
      dete: deca?.[0] ?? { id: '', ime: '' },
    },
  };
}

// ---------------------------------------------------------------------------
// Family space and invitation
// ---------------------------------------------------------------------------

/** False when this copy of the app lets only listed accounts open a space. */
export async function mogudaOtvorimProstor(): Promise<boolean> {
  const { data, error } = await supabase().rpc('mogu_da_otvorim_prostor');
  if (error) throw new Error(poruka(error));
  return data === true;
}

export async function kreirajPorodicu(imeDeteta: string, uloga: Uloga): Promise<void> {
  const { error } = await supabase().rpc('kreiraj_porodicu', { p_ime_deteta: imeDeteta, p_uloga: uloga });
  if (error) throw new Error(poruka(error));
}

export interface Pozivnica {
  link: string;
  istice: string;
}

export async function napraviPozivnicu(email: string | null): Promise<Pozivnica> {
  const { data, error } = await supabase().rpc('napravi_pozivnicu', { p_email: email || null });
  if (error) throw new Error(poruka(error));
  const red = (data as { token: string; istice: string }[])[0];
  return { link: adresa(`/poziv/?t=${red.token}`), istice: red.istice };
}

export async function mojaPozivnica(): Promise<{ email: string | null; istice: string; iskoriscena: string | null } | null> {
  const { data, error } = await supabase().rpc('moja_pozivnica');
  if (error) throw new Error(poruka(error));
  return (data as { email: string | null; istice: string; iskoriscena: string | null }[])[0] ?? null;
}

export interface PregledPozivnice {
  dete: string | null;
  pozvao: string | null;
  uloga: Uloga | null;
  vazi: boolean;
  razlog: string | null;
}

export async function pogledajPozivnicu(token: string): Promise<PregledPozivnice> {
  const { data, error } = await supabase().rpc('pogledaj_pozivnicu', { p_token: token });
  if (error) throw new Error(poruka(error));
  return (data as PregledPozivnice[])[0];
}

export async function prihvatiPozivnicu(token: string): Promise<void> {
  const { error } = await supabase().rpc('prihvati_pozivnicu', { p_token: token });
  if (error) throw new Error(poruka(error));
}

// ---------------------------------------------------------------------------
// Deleting the family space (both parents must ask), then one's own account
// ---------------------------------------------------------------------------

export interface StanjeBrisanja {
  jaZatrazio: boolean;
  drugiZatrazio: boolean;
  /** Both asked: only the files and rows are left to remove. */
  odobreno: boolean;
}

export async function stanjeBrisanja(): Promise<StanjeBrisanja> {
  const sb = supabase();
  const { data: s } = await sb.auth.getSession();
  const ja = s.session?.user.id;
  const [{ data: rod, error }, { data: por, error: e2 }] = await Promise.all([
    sb.from('roditelj').select('korisnik, brisanje_zatrazeno'),
    sb.from('porodica').select('brisanje_odobreno').limit(1).maybeSingle(),
  ]);
  if (error) throw new Error(poruka(error));
  if (e2) throw new Error(poruka(e2));
  return {
    jaZatrazio: !!rod?.find((r) => r.korisnik === ja)?.brisanje_zatrazeno,
    drugiZatrazio: !!rod?.find((r) => r.korisnik !== ja)?.brisanje_zatrazeno,
    odobreno: !!por?.brisanje_odobreno,
  };
}

/**
 * Asks for the space to be deleted. 'ceka' until the other parent asks too;
 * with both, the files are removed through the Storage API and then every
 * row ('obrisano').
 */
export async function obrisiPorodicu(): Promise<'ceka' | 'obrisano'> {
  const sb = supabase();
  for (let i = 0; i < 4; i++) {
    const { data, error } = await sb.rpc('obrisi_porodicu');
    if (error) throw new Error(poruka(error));
    const r = data as { stanje: 'ceka' | 'fajlovi' | 'obrisano'; putanje?: string[] };
    if (r.stanje !== 'fajlovi') return r.stanje;
    const { error: e2 } = await sb.storage.from('dokumenti').remove(r.putanje ?? []);
    if (e2) throw new Error(poruka(e2));
  }
  throw new Error('Fajlovi nisu obrisani do kraja. Probaj ponovo.');
}

export async function odustaniOdBrisanja(): Promise<void> {
  const { error } = await supabase().rpc('odustani_od_brisanja');
  if (error) throw new Error(poruka(error));
}

/** Removes the caller's own account; allowed only once out of a family space. */
export async function obrisiNalog(): Promise<void> {
  const { error } = await supabase().rpc('obrisi_nalog');
  if (error) throw new Error(poruka(error));
  await supabase().auth.signOut({ scope: 'local' });
}

/** Marks this visit; returns the previous one (start of "new since"). */
export async function oznaciPosetu(): Promise<string | null> {
  const { data, error } = await supabase().rpc('oznaci_posetu');
  if (error) throw new Error(poruka(error));
  return (data as string | null) ?? null;
}
