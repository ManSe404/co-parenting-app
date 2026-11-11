// Sends the queued e-mail notifications (see supabase/migrations/*_obavestenja.sql).
//
// Called by pg_cron through pg_net (migration *_obavestenja_raspored.sql):
//   ?rezim=odmah   every 5 minutes: urgent rows, and everything for parents who chose "odmah"
//   ?rezim=dnevno  once a day at 08:00 Europe/Belgrade: the digest for parents who chose "dnevno"
//
// Only the service role may call it: the caller must send the project's
// service_role key as a bearer token. The function then reads what is due
// with obavestenja_za_slanje, sends one e-mail per recipient through the
// Resend HTTP API, and marks the rows with oznaci_poslato (sent, or the
// error, so the next run tries again).
//
// Secrets (supabase secrets set): RESEND_API_KEY, OBAVESTENJA_FROM, APP_URL.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// No npm SDK: plain fetch against PostgREST and Resend, each with a timeout.

interface Red {
  id: string;
  za_roditelja: string;
  email: string;
  oznaka: string;
  vrsta: string;
  hitno: boolean;
  naslov: string;
  tekst: string;
  putanja: string;
  kreirano: string;
}

type Rezim = 'odmah' | 'dnevno';

const VREME_REST = 15_000;
const VREME_RESEND = 20_000;

const env = (ime: string): string => {
  const v = Deno.env.get(ime);
  if (!v) throw new Error(`Nedostaje tajna ${ime}.`);
  return v;
};

// Compares two secrets without leaking their length or where they differ.
async function istaTajna(a: string, b: string): Promise<boolean> {
  const h = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let razlika = 0;
  for (let i = 0; i < x.length; i++) razlika |= x[i] ^ y[i];
  return razlika === 0;
}

async function pozvan(req: Request): Promise<boolean> {
  const kljuc = env('SUPABASE_SERVICE_ROLE_KEY');
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const apikey = req.headers.get('apikey') ?? '';
  return (await istaTajna(bearer, kljuc)) || (await istaTajna(apikey, kljuc));
}

async function rpc<T>(ime: string, args: Record<string, unknown>): Promise<T> {
  const kljuc = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${ime}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: kljuc, Authorization: `Bearer ${kljuc}` },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(VREME_REST),
  });
  if (!r.ok) throw new Error(`${ime}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return (await r.json()) as T;
}

// ---------------------------------------------------------------------------
// The e-mail
// ---------------------------------------------------------------------------

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function link(putanja: string): string {
  const osnova = env('APP_URL').replace(/\/$/, '');
  return `${osnova}${putanja.startsWith('/') ? putanja : `/${putanja}`}`;
}

function naslovMejla(rezim: Rezim, redovi: Red[]): string {
  if (rezim === 'odmah' && redovi.length === 1) {
    const r = redovi[0];
    return `${r.hitno ? 'Hitno: ' : ''}${r.naslov}`;
  }
  const n = redovi.length;
  const hitnih = redovi.filter((r) => r.hitno).length;
  const stvari = n === 1 ? '1 nova stvar' : n < 5 ? `${n} nove stvari` : `${n} novih stvari`;
  if (rezim === 'odmah') return `${hitnih ? 'Hitno: ' : ''}${stvari} u zajedničkom prostoru`;
  return `Dnevni pregled: ${stvari}${hitnih ? ` (hitno: ${hitnih})` : ''}`;
}

export function telaMejla(rezim: Rezim, redovi: Red[]): { text: string; html: string } {
  const oznaka = redovi[0].oznaka;
  const uvod =
    rezim === 'dnevno'
      ? `Zdravo, ${oznaka}. Od juče u zajedničkom prostoru ima ${redovi.length === 1 ? 'jedna nova stvar' : 'novih stvari'}:`
      : `Zdravo, ${oznaka}. ${redovi.length === 1 ? 'Nova stvar u zajedničkom prostoru:' : 'Nove stvari u zajedničkom prostoru:'}`;
  const stavke = redovi.map((r) => ({ ...r, adresa: link(r.putanja) }));

  const text = [
    uvod,
    '',
    ...stavke.flatMap((r) => [`${r.hitno ? '[HITNO] ' : ''}${r.naslov}`, ...(r.tekst ? r.tekst.split('\n').map((l) => `  ${l}`) : []), `  ${r.adresa}`, '']),
    `Koliko često stižu ovi mejlovi biraš u aplikaciji pod Podešavanja → Obaveštenja mejlom: ${link('/podesavanja/')}`,
  ].join('\n');

  const html = [
    `<p>${esc(uvod)}</p>`,
    '<ul style="padding-left:1.2em">',
    ...stavke.map(
      (r) =>
        `<li style="margin:0 0 .8em">${r.hitno ? '<strong style="color:#b91c1c">Hitno:</strong> ' : ''}<strong>${esc(r.naslov)}</strong>` +
        (r.tekst ? `<br>${esc(r.tekst).replace(/\n/g, '<br>')}` : '') +
        `<br><a href="${esc(r.adresa)}">Otvori u aplikaciji</a></li>`,
    ),
    '</ul>',
    `<p style="color:#666;font-size:.9em">Koliko često stižu ovi mejlovi biraš u aplikaciji pod <a href="${esc(link('/podesavanja/'))}">Podešavanja → Obaveštenja mejlom</a>.</p>`,
  ].join('\n');

  return { text, html };
}

async function posalji(rezim: Rezim, redovi: Red[]): Promise<void> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('RESEND_API_KEY')}` },
    body: JSON.stringify({
      from: env('OBAVESTENJA_FROM'),
      to: [redovi[0].email],
      subject: naslovMejla(rezim, redovi),
      ...telaMejla(rezim, redovi),
    }),
    signal: AbortSignal.timeout(VREME_RESEND),
  });
  if (!r.ok) throw new Error(`Resend: ${r.status} ${(await r.text()).slice(0, 300)}`);
}

// ---------------------------------------------------------------------------
// One run
// ---------------------------------------------------------------------------

export async function obradi(rezim: Rezim): Promise<{ primalaca: number; poslato: number; neuspelo: number }> {
  const redovi = await rpc<Red[]>('obavestenja_za_slanje', { p_rezim: rezim });
  const poPrimaocu = new Map<string, Red[]>();
  for (const r of redovi) poPrimaocu.set(r.za_roditelja, [...(poPrimaocu.get(r.za_roditelja) ?? []), r]);

  let poslato = 0;
  let neuspelo = 0;
  for (const grupa of poPrimaocu.values()) {
    const ids = grupa.map((r) => r.id);
    try {
      await posalji(rezim, grupa);
      await rpc('oznaci_poslato', { p_ids: ids, p_greska: null });
      poslato += ids.length;
    } catch (e) {
      neuspelo += ids.length;
      const greska = e instanceof Error ? e.message : String(e);
      // No addresses or texts in the log: the rows keep the error themselves.
      console.error(`obavestenja(${rezim}): slanje nije uspelo za ${ids.length} red(ova): ${greska}`);
      try {
        await rpc('oznaci_poslato', { p_ids: ids, p_greska: greska });
      } catch (e2) {
        console.error(`obavestenja(${rezim}): ni greška nije upisana: ${e2 instanceof Error ? e2.message : String(e2)}`);
      }
    }
  }
  return { primalaca: poPrimaocu.size, poslato, neuspelo };
}

export async function zahtev(req: Request): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!(await pozvan(req))) return new Response('Unauthorized', { status: 401 });
  const rezim = new URL(req.url).searchParams.get('rezim');
  if (rezim !== 'odmah' && rezim !== 'dnevno') return new Response('rezim mora biti odmah ili dnevno', { status: 400 });
  try {
    const r = await obradi(rezim);
    return Response.json({ rezim, ...r });
  } catch (e) {
    console.error(`obavestenja(${rezim}): ${e instanceof Error ? e.message : String(e)}`);
    return new Response('Slanje nije uspelo.', { status: 500 });
  }
}

Deno.serve(zahtev);
