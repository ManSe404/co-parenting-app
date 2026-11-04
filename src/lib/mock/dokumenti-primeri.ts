// Example documents for the demo, drawn in the browser so the repository holds
// no real scans: a doctor's certificate (picture), an enrolment confirmation
// (PDF), a training schedule (picture) and a deleted receipt.

import type { Dokument, KategorijaKljuc, TipFajla } from '../dokumenti';

function dan(sada: Date, pomak: number): string {
  const d = new Date(sada);
  d.setDate(d.getDate() + pomak);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function trenutak(sada: Date, danaRanije: number, sat: number): string {
  const d = new Date(sada);
  d.setDate(d.getDate() - danaRanije);
  d.setHours(sat, 12, 0, 0);
  return d.toISOString();
}

/** A one-page PDF with plain text (ASCII, the built-in Helvetica font). */
function jednostavanPdf(redovi: string[]): Blob {
  const tekst = redovi
    .map((r, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 72 ${770 - i * (i === 0 ? 40 : 24)} Td (${r.replace(/[\\()]/g, '\\$&')}) Tj ET`)
    .join('\n');
  const objekti = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${tekst.length} >>\nstream\n${tekst}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const pomeraji: number[] = [];
  objekti.forEach((o, i) => {
    pomeraji.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objekti.length + 1}\n0000000000 65535 f \n`;
  pdf += pomeraji.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objekti.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}

/** A paper-like picture: a title, a few lines, an optional stamp. */
async function papir(naslov: string, redovi: string[], boja: string, pecat: boolean): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 1200;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbfaf7';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = boja;
  g.fillRect(0, 0, c.width, 14);
  g.fillStyle = '#1f2933';
  g.font = 'bold 44px sans-serif';
  g.fillText(naslov, 80, 150);
  g.font = '28px sans-serif';
  redovi.forEach((r, i) => g.fillText(r, 80, 250 + i * 56));
  g.strokeStyle = '#c9ced6';
  g.lineWidth = 2;
  for (let y = 250 + redovi.length * 56 + 40; y < 1000; y += 56) {
    g.beginPath();
    g.moveTo(80, y);
    g.lineTo(820, y);
    g.stroke();
  }
  if (pecat) {
    g.strokeStyle = boja;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(680, 1060, 80, 0, Math.PI * 2);
    g.stroke();
    g.font = 'bold 24px sans-serif';
    g.fillStyle = boja;
    g.fillText('OVERENO', 625, 1069);
  }
  return new Promise((r, ne) => c.toBlob((b) => (b ? r(b) : ne(new Error('canvas'))), 'image/png'));
}

interface Primer {
  dokument: Dokument;
  fajl: Blob;
}

function dokument(
  id: string,
  naziv: string,
  kategorija: KategorijaKljuc,
  tip: TipFajla,
  fajl: Blob,
  datum: string | null,
  napomena: string,
  otpremio: string,
  otpremljeno: string,
): Primer {
  return {
    fajl,
    dokument: {
      id,
      naziv,
      kategorija,
      datum,
      napomena,
      tip,
      velicina: fajl.size,
      putanja: id,
      otpremio,
      otpremljeno,
      obrisan: null,
      obrisao: null,
      trag: [{ vrsta: 'otpremljen', ko: otpremio, kada: otpremljeno }],
    },
  };
}

export async function primeriDokumenata(sada: Date): Promise<Primer[]> {
  const dete = '______________';
  const skolskaGodina = sada.getMonth() >= 8 ? sada.getFullYear() : sada.getFullYear() - 1;

  const uverenje = dokument(
    'demo-dok-1',
    'Lekarsko uverenje za sport',
    'zdravlje',
    'image/png',
    await papir('LEKARSKO UVERENJE', [`Ime i prezime: ${dete}`, 'Sposoban za sportske aktivnosti.', `Vazi do: ${dan(sada, 345)}`], '#65a30d', true),
    dan(sada, -20),
    'Važi godinu dana; treba za fudbal.',
    'mama',
    trenutak(sada, 20, 18),
  );
  const upis = dokument(
    'demo-dok-2',
    'Potvrda o upisu',
    'skola',
    'application/pdf',
    jednostavanPdf(['Potvrda o upisu', `Ucenik: ${dete}`, `Skolska godina: ${skolskaGodina}/${skolskaGodina + 1}`, 'Razred: treci', 'Izdato za potrebe roditelja.']),
    `${skolskaGodina}-09-01`,
    '',
    'tata',
    trenutak(sada, 60, 9),
  );
  const treninzi = dokument(
    'demo-dok-3',
    'Raspored treninga, jesen',
    'vanskolske',
    'image/png',
    await papir('RASPORED TRENINGA', ['Utorak 17:00 - 18:00', 'Cetvrtak 17:00 - 18:00', 'Teren kod skole, poneti kopacke.'], '#ea580c', false),
    null,
    'Trener šalje izmene u Viber grupi.',
    'tata',
    trenutak(sada, 9, 20),
  );
  const racun = dokument(
    'demo-dok-4',
    'Račun za patike (duplikat)',
    'troskovi',
    'image/png',
    await papir('RACUN', ['Patike za fudbal', 'Iznos: 6.490 RSD'], '#b45309', false),
    dan(sada, -12),
    '',
    'tata',
    trenutak(sada, 12, 19),
  );
  const obrisan = trenutak(sada, 2, 21);
  racun.dokument = {
    ...racun.dokument,
    obrisan,
    obrisao: 'mama',
    trag: [...racun.dokument.trag, { vrsta: 'obrisan', ko: 'mama', kada: obrisan }],
  };

  return [uverenje, upis, treninzi, racun];
}
