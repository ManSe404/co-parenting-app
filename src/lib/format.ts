import { danaDo, uDan } from './domen';

const JEZIK = 'sr-Latn-RS';

const kratkiDan = new Intl.DateTimeFormat(JEZIK, { weekday: 'short', day: 'numeric', month: 'short' });
const dugiDan = new Intl.DateTimeFormat(JEZIK, { weekday: 'long', day: 'numeric', month: 'long' });
const relativno = new Intl.RelativeTimeFormat('sr-Latn', { numeric: 'auto' });

/** "čet 5. nov" */
export function datumKratko(datum: string): string {
  return kratkiDan.format(uDan(datum));
}

/** "utorak, 3. novembar" */
export function danasDugo(sada: Date): string {
  return dugiDan.format(sada);
}

/** "danas", "sutra", "za 4 dana", "pre 2 dana" for a YYYY-MM-DD date. */
export function doDatuma(datum: string, sada: Date): string {
  return relativno.format(danaDo(datum, sada), 'day');
}

/** "pre 5 minuta", "pre 3 sata", "juče" for an ISO timestamp. */
export function pre(iso: string, sada: Date): string {
  const sekundi = Math.round((Date.parse(iso) - sada.getTime()) / 1000);
  const abs = Math.abs(sekundi);
  if (abs < 60) return 'upravo';
  if (abs < 3600) return relativno.format(Math.round(sekundi / 60), 'minute');
  if (abs < 86_400) return relativno.format(Math.round(sekundi / 3600), 'hour');
  if (abs < 86_400 * 30) return relativno.format(Math.round(sekundi / 86_400), 'day');
  return kratkiDan.format(new Date(iso));
}

/** Serbian plural: 1 stavka, 2–4 stavke, 5+ stavki (11–14 stavki). */
export function brojStavki(n: number): string {
  const d = n % 10;
  const s = n % 100;
  if (d === 1 && s !== 11) return `${n} stavka`;
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} stavke`;
  return `${n} stavki`;
}

/** Deadline wording: "kasni 2 dana", "danas", "sutra", "za 4 dana". */
export function rok(datum: string, sada: Date): string {
  const d = danaDo(datum, sada);
  if (d < 0) return `kasni ${-d} ${-d === 1 ? 'dan' : 'dana'}`;
  if (d === 0) return 'danas';
  if (d === 1) return 'sutra';
  return `za ${d} dana`;
}

/** "Dobro jutro" / "Dobar dan" / "Dobro veče" by local hour. */
export function pozdrav(sada: Date): string {
  const h = sada.getHours();
  if (h < 11) return 'Dobro jutro';
  if (h < 18) return 'Dobar dan';
  return 'Dobro veče';
}

const RECI = ['nula', 'jedna', 'dve', 'tri', 'četiri'];

function brojRecju(n: number, veliko = false): string {
  const r = n < RECI.length ? RECI[n] : String(n);
  return veliko ? r.charAt(0).toUpperCase() + r.slice(1) : r;
}

/** "Jedna stvar je hitna." / "Dve stvari su hitne." / "Pet stvari je hitno." */
export function recenicaHitno(n: number): string {
  const d = n % 10;
  const s = n % 100;
  if (d === 1 && s !== 11) return `${brojRecju(n, true)} stvar je hitna.`;
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${brojRecju(n, true)} stvari su hitne.`;
  return `${brojRecju(n, true)} stvari je hitno.`;
}

/** "Na tebi je jedna tema." / "Na tebi su tri teme." / "Na tebi je 5 tema." */
export function recenicaNaTebi(n: number): string {
  const d = n % 10;
  const s = n % 100;
  if (d === 1 && s !== 11) return `Na tebi je ${brojRecju(n)} tema.`;
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `Na tebi su ${brojRecju(n)} teme.`;
  return `Na tebi je ${n} tema.`;
}

/** "danas u 15:00", "sutra u 08:00", "pet 6. nov u 18:00" for "YYYY-MM-DDTHH:mm". */
export function kada(t: string, sada: Date): string {
  const datum = t.slice(0, 10);
  const d = danaDo(datum, sada);
  const dan = d === 0 ? 'danas' : d === 1 ? 'sutra' : d === -1 ? 'juče' : datumKratko(datum);
  return `${dan} u ${t.slice(11, 16)}`;
}

/** "sre 4. nov 15:00–20:00" on one day, else "pet 6. nov 18:00 → pon 9. nov 08:00". */
export function opseg(od: string, doT: string): string {
  const d1 = od.slice(0, 10);
  const d2 = doT.slice(0, 10);
  if (d1 === d2) return `${datumKratko(d1)} ${od.slice(11, 16)}–${doT.slice(11, 16)}`;
  return `${datumKratko(d1)} ${od.slice(11, 16)} → ${datumKratko(d2)} ${doT.slice(11, 16)}`;
}

/** "novembar 2026" */
export function mesecGodina(godina: number, mesec: number): string {
  return new Intl.DateTimeFormat(JEZIK, { month: 'long', year: 'numeric' }).format(new Date(godina, mesec, 1)).replace(/\.$/, '');
}

/** "sreda, 4. novembar" for a YYYY-MM-DD date. */
export function danDugo(datum: string): string {
  return dugiDan.format(uDan(datum));
}

const saGodinom = new Intl.DateTimeFormat(JEZIK, { day: 'numeric', month: 'short', year: 'numeric' });
const satMinut = new Intl.DateTimeFormat(JEZIK, { hour: '2-digit', minute: '2-digit' });

/** "1. sep 2026." for a YYYY-MM-DD date. */
export function datumSaGodinom(datum: string): string {
  return saGodinom.format(uDan(datum));
}

/** "1. sep 2026. u 14:32" for an ISO timestamp. */
export function trenutakSaGodinom(iso: string): string {
  const d = new Date(iso);
  return `${saGodinom.format(d)} u ${satMinut.format(d)}`;
}
