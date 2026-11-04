// Getting a picked file ready for upload. Phone photos are shrunk (they are
// often 5–12 MB); iPhone HEIC photos become JPEG where the browser can read
// them; PDFs and small pictures go as they are.

import { GreskaDokumenta, type TipFajla, proveriVelicinu, vrstaFajla } from './dokumenti';

/** A scanned A4 page stays readable at this size. */
const NAJDUZA_IVICA = 2400;
const DOVOLJNO_MALA = 1.5 * 1024 * 1024;

export async function pripremi(f: File): Promise<{ fajl: Blob; tip: TipFajla }> {
  const vrsta = vrstaFajla(f);
  if (!vrsta) throw new GreskaDokumenta('Ovaj fajl ne može da se doda. Dozvoljeni su PDF i slike (JPG, PNG, WebP).');
  if (vrsta === 'application/pdf') {
    proveriVelicinu(f.size);
    return { fajl: f, tip: vrsta };
  }

  let slika: ImageBitmap;
  try {
    slika = await createImageBitmap(f);
  } catch {
    throw new GreskaDokumenta(
      vrsta === 'heic'
        ? 'Ovaj pregledač ne ume da otvori HEIC sliku sa iPhone-a. Dodaj je sa telefona („Slikaj“ ili iz galerije) ili je sačuvaj kao JPG.'
        : 'Ova slika ne može da se otvori. Probaj JPG ili PNG.',
    );
  }

  const najduza = Math.max(slika.width, slika.height);
  if (vrsta !== 'heic' && najduza <= NAJDUZA_IVICA && f.size <= DOVOLJNO_MALA) {
    slika.close();
    return { fajl: f, tip: vrsta };
  }

  const k = Math.min(1, NAJDUZA_IVICA / najduza);
  const c = document.createElement('canvas');
  c.width = Math.round(slika.width * k);
  c.height = Math.round(slika.height * k);
  const g = c.getContext('2d')!;
  // JPEG has no transparency: a see-through PNG would turn black without this.
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(slika, 0, 0, c.width, c.height);
  slika.close();
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new GreskaDokumenta('Slika ne može da se pripremi. Probaj ponovo.');
  proveriVelicinu(blob.size);
  return { fajl: blob, tip: 'image/jpeg' };
}
