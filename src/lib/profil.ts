// Parent profile: what the other parent may need to reach you. Each parent
// edits their own; both see both. The same checks run in the database.

export interface Profil {
  ime: string;
  telefon: string;
  /** Where the child stays with this parent (handovers). */
  adresa: string;
  kontaktEmail: string;
  /** E.g. working hours, when it is easiest to call. */
  napomena: string;
  izmenjen: string | null;
}

export interface ProfilRoditelja extends Profil {
  /** 'tata' or 'mama'. */
  uloga: string;
  oznaka: string;
}

export class GreskaProfila extends Error {}

export function prazanProfil(): Profil {
  return { ime: '', telefon: '', adresa: '', kontaktEmail: '', napomena: '', izmenjen: null };
}

const TELEFON = /^[0-9 +()/-]*$/;
const MEJL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims and checks the fields; throws a message the screen can show. */
export function proveriProfil(p: Omit<Profil, 'izmenjen'>): Omit<Profil, 'izmenjen'> {
  const ime = p.ime.trim().replace(/\s+/g, ' ');
  const telefon = p.telefon.trim();
  const adresa = p.adresa.trim();
  const kontaktEmail = p.kontaktEmail.trim().toLowerCase();
  const napomena = p.napomena.trim();
  if (ime.length > 80) throw new GreskaProfila('Ime je predugo (najviše 80 znakova).');
  if (telefon.length > 40 || !TELEFON.test(telefon)) throw new GreskaProfila('Telefon sme da ima samo cifre, razmake i znakove + - / ( ).');
  if (adresa.length > 200) throw new GreskaProfila('Adresa je preduga (najviše 200 znakova).');
  if (kontaktEmail.length > 120 || (kontaktEmail && !MEJL.test(kontaktEmail))) throw new GreskaProfila('Mejl nije ispravan.');
  if (napomena.length > 300) throw new GreskaProfila('Napomena je preduga (najviše 300 znakova).');
  return { ime, telefon, adresa, kontaktEmail, napomena };
}

export function popunjen(p: Profil): boolean {
  return Boolean(p.ime || p.telefon || p.adresa || p.kontaktEmail || p.napomena);
}

/** "064 123 4567" → "tel:0641234567" (only digits and a leading +). */
export function telLink(telefon: string): string {
  const t = telefon.trim();
  return `tel:${t.startsWith('+') ? '+' : ''}${t.replace(/\D/g, '')}`;
}

/** Opens the address in the phone's map app or Google Maps. */
export function mapaLink(adresa: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresa.trim())}`;
}
