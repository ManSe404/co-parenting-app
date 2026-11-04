// Human wording for calendar requests, shared by the calendar and the dashboard.

import { datumKratko, opseg } from './format';
import { type PredlogDogadjaja, VRSTE_DOGADJAJA, opisPonavljanja } from './dogadjaji';
import type { PredlogBoravka, ZahtevKalendara } from './kalendar';
import type { Podaci } from './tipovi';

export function roditeljPoId(p: Podaci, id: string | null) {
  return id === p.ja.id ? p.ja : id === p.drugi.id ? p.drugi : null;
}

export function opisBoravka(p: Podaci, b: PredlogBoravka): string {
  const r = roditeljPoId(p, b.kod);
  return `kod ${r?.oznakaGenitiv ?? '?'} · ${opseg(b.od, b.do)}${b.napomena ? ` · ${b.napomena}` : ''}`;
}

export function opisDogadjaja(p: Podaci, d: PredlogDogadjaja): string {
  const vreme = d.ceoDan ? 'ceo dan' : `${d.od}–${d.do}`;
  const kad = d.ponavljanje.tip === 'ne' ? `${datumKratko(d.datum)} ${vreme}` : `${opisPonavljanja(d.ponavljanje)} · ${vreme}`;
  const vodi = d.vodi ? ` · vodi ${roditeljPoId(p, d.vodi)?.oznaka.toLocaleLowerCase('sr') ?? '?'}` : '';
  return `${d.naziv} · ${kad}${vodi}`;
}

/**
 * What changes in an activity beyond its one-line description (kind, place,
 * note, first day of a series), so the parent who accepts sees every field.
 */
export function ostaleRazlike(stari: PredlogDogadjaja, novi: PredlogDogadjaja): string[] {
  const r: string[] = [];
  if (stari.vrsta !== novi.vrsta) r.push(`vrsta: ${nazivVrste(stari.vrsta)} → ${nazivVrste(novi.vrsta)}`);
  if (stari.mesto !== novi.mesto) r.push(`mesto: ${stari.mesto ? `„${stari.mesto}“` : 'bez mesta'} → ${novi.mesto ? `„${novi.mesto}“` : 'bez mesta'}`);
  if (stari.napomena !== novi.napomena) r.push(novi.napomena ? `napomena: „${novi.napomena}“` : 'napomena obrisana');
  if (novi.ponavljanje.tip !== 'ne' && stari.datum !== novi.datum) r.push(`počinje: ${datumKratko(stari.datum)} → ${datumKratko(novi.datum)}`);
  return r;
}

export function nazivVrste(v: string): string {
  return VRSTE_DOGADJAJA.find((x) => x.kljuc === v)?.naziv ?? v;
}

export function opisZahteva(p: Podaci, z: ZahtevKalendara): { naslov: string; redovi: string[] } {
  if (z.predmet === 'dogadjaj') {
    const stari = p.dogadjaji.find((d) => d.id === z.dogadjajId);
    const bilo = stari ? opisDogadjaja(p, stari) : 'aktivnost koja više ne postoji';
    if (z.vrsta === 'obrisi') return { naslov: 'Brisanje aktivnosti', redovi: [bilo] };
    if (z.jednom && stari) {
      const tada = `${stari.naziv} · ${datumKratko(z.jednom)} ${stari.ceoDan ? 'ceo dan' : `${stari.od}–${stari.do}`}`;
      const ostalo = ostaleRazlike({ ...stari, datum: z.jednom, ponavljanje: { tip: 'ne' } }, z.dogadjaj!);
      return { naslov: 'Pomeranje, samo jednom', redovi: [`bilo: ${tada}`, `postaje: ${opisDogadjaja(p, z.dogadjaj!)}`, ...ostalo] };
    }
    if (z.vrsta === 'izmeni') {
      const ostalo = stari ? ostaleRazlike(stari, z.dogadjaj!) : [];
      return { naslov: 'Izmena aktivnosti', redovi: [`bilo: ${bilo}`, `postaje: ${opisDogadjaja(p, z.dogadjaj!)}`, ...ostalo] };
    }
    return { naslov: `Nova aktivnost: ${nazivVrste(z.dogadjaj!.vrsta).toLocaleLowerCase('sr')}`, redovi: [opisDogadjaja(p, z.dogadjaj!)] };
  }
  if (z.vrsta === 'obrisi' || z.vrsta === 'izmeni') {
    const stari = p.boravci.find((b) => b.id === z.boravakId);
    const bilo = stari ? opisBoravka(p, stari) : 'boravak koji više ne postoji';
    if (z.vrsta === 'obrisi') return { naslov: 'Brisanje', redovi: [bilo] };
    return { naslov: 'Izmena', redovi: [`bilo: ${bilo}`, `postaje: ${opisBoravka(p, z.boravci[0])}`] };
  }
  const n = z.boravci.length;
  const naslov =
    z.boravci[0]?.vrsta === 'redovno' ? (n > 1 ? `Redovan raspored, ${n} termina` : 'Redovan raspored') : 'Jednokratna promena';
  const redovi = z.boravci.slice(0, 3).map((b) => opisBoravka(p, b));
  if (n > 3) {
    const poslednji = [...z.boravci].sort((a, b) => (a.do < b.do ? -1 : 1)).at(-1)!;
    redovi.push(`… i još ${n - 3}, poslednji do ${datumKratko(poslednji.do.slice(0, 10))}`);
  }
  return { naslov, redovi };
}

/**
 * A handover in the child's terms: "Ide kod tate", and who picks up,
 * from the viewer's side ("ti preuzimaš" / "preuzima mama").
 */
export function prelazak(p: Podaci, ka: string | null): { naslov: string; ko: string; moj: boolean } {
  const r = roditeljPoId(p, ka);
  if (!r) return { naslov: 'Dalje nije upisano', ko: '', moj: false };
  const moj = r.id === p.ja.id;
  return { naslov: `Ide kod ${r.oznakaGenitiv}`, ko: moj ? 'ti preuzimaš' : `preuzima ${r.oznaka.toLocaleLowerCase('sr')}`, moj };
}
