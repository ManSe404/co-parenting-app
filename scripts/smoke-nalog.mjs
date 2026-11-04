// Accounts end to end, in headless Chrome against the local Supabase:
// sign up with e-mail confirmation (read from the local Mailpit inbox), create
// the family space, turn on MFA with a real TOTP code, sign out and back in
// through MFA, and link the second parent from a separate browser profile.
//
// Needs: `npm run baza` (local Supabase) and `npm run dev:baza` (dev server).
//   npm run smoke:nalog
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8040';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8044';
const PORT = 9334;
const LOZINKA = 'Probna12345lozinka';
const oznaka = Date.now().toString(36);
const SLIKA = fileURLToPath(new URL('./fixtures/raspored.png', import.meta.url));
const TATA = `tata.${oznaka}@primer.rs`;
const MAMA = `mama.${oznaka}@primer.rs`;

const profil = mkdtempSync(join(tmpdir(), 'coparenting-nalog-'));
const chrome = spawn(process.env.CHROME ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profil}`, `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: 'ignore' });
async function kraj(kod) {
  chrome.kill();
  await new Promise((r) => (chrome.exitCode !== null ? r() : chrome.once('exit', r)));
  try { rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* harmless */ }
  process.exit(kod);
}
process.on('uncaughtException', (e) => { console.error('FAIL', e.message); kraj(1); });
process.on('unhandledRejection', (e) => { console.error('FAIL', e instanceof Error ? e.message : e); kraj(1); });

const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (m) => console.log('OK  ', m);

// ---- TOTP (RFC 6238), to answer MFA like an authenticator app ----
function totp(tajna) {
  const abeceda = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bitovi = '';
  for (const c of tajna.replace(/=+$/, '').toUpperCase()) bitovi += abeceda.indexOf(c).toString(2).padStart(5, '0');
  const kljuc = Buffer.from(bitovi.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const brojac = Buffer.alloc(8);
  brojac.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', kljuc).update(brojac).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** A code that will not expire mid-request: skip the last seconds of a 30 s window. */
async function svezKod(tajna) {
  const ostalo = 30_000 - (Date.now() % 30_000);
  if (ostalo < 4_000) await spavaj(ostalo + 200);
  return totp(tajna);
}

// ---- A page over the DevTools protocol, optionally in its own browser profile ----
let pregledac;
async function veza(url) {
  const ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let n = 0;
  const cekaju = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && cekaju.has(m.id)) { cekaju.get(m.id)(m); cekaju.delete(m.id); }
  });
  return (method, params = {}) => new Promise((r) => { const id = ++n; cekaju.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
}

async function stranica(odvojeno = false) {
  let v;
  for (let i = 0; i < 50 && !v; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await spavaj(200); }
  }
  pregledac ??= await veza(v.webSocketDebuggerUrl);
  const kontekst = odvojeno ? (await pregledac('Target.createBrowserContext')).result.browserContextId : undefined;
  const { targetId } = (await pregledac('Target.createTarget', { url: 'about:blank', ...(kontekst ? { browserContextId: kontekst } : {}) })).result;
  const lista = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const cdp = await veza(lista.find((t) => t.id === targetId).webSocketDebuggerUrl);
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  const ev = async (izraz) => {
    const r = await cdp('Runtime.evaluate', { expression: izraz, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  const s = {
    ev,
    idi: async (url) => { await cdp('Page.navigate', { url }); await spavaj(1500); },
    adresa: () => ev('location.pathname + location.search'),
    // While a page is being replaced, document.body can be null: just wait.
    async cekajTekst(tekst, ms = 12000) {
      for (let i = 0; i < ms / 100; i++) {
        try { if (await ev(`(document.body?.innerText ?? '').includes(${JSON.stringify(tekst)})`)) return; } catch { /* navigating */ }
        await spavaj(100);
      }
      throw new Error(`nema teksta: ${tekst}\n--- ${await s.adresa()}\n${(await ev(`document.body?.innerText ?? ''`)).slice(0, 800)}`);
    },
    async cekajAdresu(deo, ms = 12000) {
      for (let i = 0; i < ms / 100; i++) {
        try { if ((await s.adresa()).includes(deo)) return; } catch { /* navigating */ }
        await spavaj(100);
      }
      throw new Error(`adresa nije ${deo}, nego ${await s.adresa()}`);
    },
    // Waits for the field: right after a navigation the form may not be there yet.
    async upisi(sel, v) {
      await s.cekajUslov(`!!document.querySelector(${JSON.stringify(sel)})`, 'polje ' + sel);
      return ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    },
    staroUpisi: (sel, v) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`),
    async postaviFajl(selektor, putanja) {
      const { root } = (await cdp('DOM.getDocument', { depth: -1 })).result;
      const { nodeId } = (await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: selektor })).result;
      if (!nodeId) throw new Error('nema polja ' + selektor);
      await cdp('DOM.setFileInputFiles', { nodeId, files: [putanja] });
    },
    async cekajUslov(izraz, opis, ms = 12000) {
      for (let i = 0; i < ms / 100; i++) {
        try { if (await ev(izraz)) return; } catch { /* navigating */ }
        await spavaj(100);
      }
      throw new Error('nije ispunjeno: ' + opis);
    },
    // Waits until the button exists and is enabled: a disabled button ignores clicks.
    async klikni(tekst) {
      const nadji = `[...document.querySelectorAll('button, a')].find(b => b.innerText.trim() === ${JSON.stringify(tekst)})`;
      await s.cekajUslov(`(() => { const b = ${nadji}; return !!b && !b.disabled; })()`, 'dugme ' + tekst);
      await ev(`${nadji}.click()`);
    },
  };
  return s;
}

// ---- The confirmation link from the local inbox ----
async function linkIzMejla(adresa) {
  for (let i = 0; i < 40; i++) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${adresa}"`)}`)).json();
    const id = r.messages?.[0]?.ID;
    if (id) {
      const poruka = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const link = /(https?:\/\/[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+)/.exec(poruka.HTML ?? poruka.Text)?.[1];
      if (link) return link.replace(/&amp;/g, '&');
    }
    await spavaj(250);
  }
  throw new Error(`nema mejla za ${adresa}`);
}

async function registrujISePotvrdi(s, email) {
  await s.cekajTekst('Nov nalog');
  await s.ev(`[...document.querySelectorAll('[role=tab]')].find(b => b.innerText.trim() === 'Nov nalog').click()`);
  await spavaj(150);
  await s.upisi('input[type=email]', email);
  await s.upisi('input[autocomplete=new-password]', LOZINKA);
  await s.klikni('Napravi nalog');
  await s.cekajTekst('Poslali smo mejl');
  await s.idi(await linkIzMejla(email));
}

// =========================================================================
const tata = await stranica();

// 1. Without an account the app sends you to sign in.
await tata.idi(`${BASE}/?demo=0`);
await tata.cekajAdresu('/prijava/');
await tata.cekajTekst('Nastavi preko Google-a');
ok('bez naloga aplikacija vodi na prijavu (Google, mejl i lozinka)');

// 2. Sign up, confirm the e-mail, land on the welcome screen.
await registrujISePotvrdi(tata, TATA);
await tata.cekajAdresu('/dobrodosli/');
await tata.cekajTekst('Porodični prostor');
ok('registracija sa potvrdom mejla vodi na dobrodošlicu');

// 3. Create the family space.
await tata.klikni('Tata');
await tata.klikni('Napravi prostor');
await tata.cekajTekst('Pozovi mamu');
await tata.upisi('.poziv input[type=email]', MAMA);
await tata.klikni('Napravi link za mamu');
await tata.cekajTekst('Link važi 7 dana');
const link = await tata.ev(`document.querySelector('input[aria-label="Link za poziv"]').value`);
if (!/\/poziv\/\?t=[a-f0-9]{64}$/.test(link)) throw new Error('link: ' + link);
ok('prvi roditelj pravi prostor i dobija link za poziv');

// 4. Turn on MFA with a real code.
await tata.klikni('Dalje');
await tata.cekajTekst('Zaštiti nalog');
await tata.cekajTekst('Uključi dvostepenu prijavu');
await tata.klikni('Uključi dvostepenu prijavu');
await tata.cekajTekst('Skeniraj QR kod');
const tajna = await tata.ev(`document.querySelector('.tajna').innerText.trim()`);
await tata.upisi('input[aria-label="Šestocifreni kod"]', await svezKod(tajna));
await tata.klikni('Potvrdi i uključi');
await tata.cekajTekst('Uključena.');
ok('MFA se uključuje kodom iz aplikacije');

await tata.klikni('Uđi u aplikaciju');
await tata.cekajUslov(`document.documentElement.dataset.pristup === 'ok' && document.querySelector('h1 .ime')?.innerText === 'Tata'`, 'tata je u aplikaciji');
await tata.cekajUslov(`/detetove potrebe/i.test(document.body.innerText)`, 'oblast „Detetove potrebe“');
ok('posle dobrodošlice aplikacija se otvara, bez imena deteta (piše „dete“)');

// 5. Sign out, sign in again: password, then the MFA code.
await tata.idi(`${BASE}/podesavanja/`);
await tata.cekajTekst('Odjavi se');
await tata.klikni('Odjavi se');
await tata.cekajAdresu('/prijava/');
await tata.upisi('input[type=email]', TATA);
await tata.upisi('input[autocomplete=current-password]', LOZINKA);
await tata.klikni('Prijavi se');
await tata.cekajAdresu('/mfa/');
await tata.upisi('input[aria-label="Šestocifreni kod"]', '000000');
await tata.klikni('Potvrdi');
await tata.cekajTekst('Kod nije tačan');
await spavaj(300);
await tata.upisi('input[aria-label="Šestocifreni kod"]', await svezKod(tajna));
await tata.klikni('Potvrdi');
await tata.cekajAdresu('/');
await tata.cekajUslov(`document.querySelector('h1 .ime')?.innerText === 'Tata'`, 'tata je ponovo u aplikaciji');
ok('ponovna prijava traži lozinku pa MFA kod; pogrešan kod se odbija');

// 6. The second parent, in a separate browser profile, accepts the link.
const mama = await stranica(true);
await mama.idi(link);
await mama.cekajTekst('Tata te poziva');
await mama.cekajTekst('U prostoru ćeš biti: Mama');
await mama.klikni('Napravi nalog');
await registrujISePotvrdi(mama, MAMA);
await mama.cekajAdresu('/poziv/');
await mama.klikni('Prihvati i poveži nas');
await mama.cekajUslov(`location.pathname === '/' && document.documentElement.dataset.pristup === 'ok'`, 'mama je u aplikaciji');
// On a new device the dashboard must greet her, not the other parent.
await mama.cekajUslov(`document.querySelector('h1 .ime')?.innerText === 'Mama'`, 'početna pozdravlja mamu, ne tatu');
// Tata fills in his profile; mama should see it.
await tata.idi(`${BASE}/podesavanja/`);
await tata.klikni('Popuni profil');
await tata.upisi('input[autocomplete=tel]', '064 111 2222');
await tata.upisi('input[autocomplete=street-address]', 'Kralja Petra 5, Beograd');
await tata.klikni('Sačuvaj profil');
await tata.cekajTekst('Profil je sačuvan.');

await mama.idi(`${BASE}/podesavanja/`);
await mama.cekajTekst('Povezani ste: Tata je u prostoru.');
await mama.cekajTekst('064 111 2222');
await mama.cekajTekst('Kralja Petra 5, Beograd');
ok('drugi roditelj otvara link, pravi nalog, prihvata i vidi tatu i njegov profil (telefon, adresa)');

await tata.idi(`${BASE}/podesavanja/`);
await tata.cekajTekst('Povezani ste: Mama je u prostoru.');
ok('prvi roditelj vidi da je mama povezana');

// 7. The link does not work a second time.
const treci = await stranica(true);
await treci.idi(link);
await treci.cekajTekst('Ovaj link više ne radi');
await treci.cekajTekst('Link je već iskorišćen.');
ok('isti link ne radi drugi put');

// 8. Documents are shared through the private bucket.
await tata.idi(`${BASE}/dokumenti/`);
await tata.cekajTekst('Još nema dokumenata');
await tata.klikni('Dodaj dokument');
await tata.cekajTekst('Novi dokument');
await tata.postaviFajl('dialog[open] input[type=file]:not([capture])', SLIKA);
await tata.cekajTekst('Slika PNG');
await tata.upisi('dialog[open] input[placeholder^="Npr. Nalaz"]', 'Nalaz alergologa');
await tata.klikni('Zdravlje');
await tata.klikni('Sačuvaj dokument');
await tata.cekajTekst('„Nalaz alergologa“ je dodat. Mama ga sada vidi.');
ok('tata dodaje dokument u privatnu kantu');

const slikaUcitana = (sel) => `(() => { const i = document.querySelector(${JSON.stringify(sel)}); return !!i && i.complete && i.naturalWidth > 0 && i.src.startsWith('http://127.0.0.1:8041/'); })()`;
await mama.idi(`${BASE}/dokumenti/`);
await mama.cekajTekst('Nalaz alergologa');
await mama.cekajUslov(slikaUcitana('button.dok img'), 'sličica preko potpisanog linka');
const potpisanLink = await mama.ev(`document.querySelector('button.dok img').src`);
await mama.ev(`document.querySelector('button.dok').click()`);
await mama.cekajTekst('Tata je dodao');
await mama.cekajUslov(slikaUcitana('dialog[open] .prikaz img'), 'slika u pregledu');
ok('mama vidi dokument i otvara ga preko potpisanog linka');

await mama.klikni('Obriši');
await mama.klikni('Da, obriši');
await mama.cekajTekst('Obrisala si');
await tata.idi(`${BASE}/dokumenti/`);
await tata.cekajTekst('Obrisani · 1');
await tata.ev(`document.querySelector('details.obrisani').open = true`);
await tata.cekajTekst('Mama je obrisala');
await tata.ev(`document.querySelector('details.obrisani button.vrati').click()`);
await tata.cekajTekst('„Nalaz alergologa“ je vraćen.');
await mama.idi(`${BASE}/dokumenti/`);
await mama.cekajUslov(`!!document.querySelector('button.dok') && !document.querySelector('details.obrisani')`, 'dokument vraćen i kod mame');
ok('brisanje samo označi: tata vidi ko je obrisao i vraća dokument');

// 9. Permanent deletion needs both: tata proposes, mama confirms, the file is gone.
await tata.idi(`${BASE}/dokumenti/`);
await tata.ev(`document.querySelector('button.dok').click()`);
await tata.klikni('Obriši');
await tata.klikni('Da, obriši');
await tata.cekajTekst('Obrisao si');
await tata.ev(`document.querySelector('dialog[open]').close()`);
await tata.ev(`document.querySelector('details.obrisani').open = true`);
await tata.klikni('Trajno obriši…');
await tata.klikni('Predloži trajno brisanje');
await tata.cekajTekst('Čeka se da Mama potvrdi.');
if (!(await fetch(potpisanLink)).ok) throw new Error('fajl bi još morao da postoji');
ok('tata predlaže trajno brisanje; fajl je i dalje tu');

await mama.idi(`${BASE}/`);
await mama.cekajTekst('Dokumenti: trajno brisanje „Nalaz alergologa“');
await mama.idi(`${BASE}/dokumenti/?obrisani=1`);
await mama.cekajTekst('Tata predlaže da se trajno obriše.');
await mama.klikni('Potvrdi trajno brisanje');
await mama.cekajTekst('„Nalaz alergologa“ je trajno obrisan.');
const posle = await fetch(potpisanLink);
if (posle.ok) throw new Error('fajl je i dalje u skladištu: ' + posle.status);
await tata.idi(`${BASE}/dokumenti/?obrisani=1`);
await tata.cekajTekst('TRAJNO OBRISANO');
await tata.cekajTekst('predložio Tata, potvrdila Mama');
ok('mama potvrđuje: fajl nestaje iz skladišta, ostaje zapis ko je predložio i ko potvrdio');

// 10. Items, calendar and karton are shared through the database.
const dan = (pomak) => { const d = new Date(); d.setDate(d.getDate() + pomak); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

await tata.idi(`${BASE}/nova/`);
await tata.cekajTekst('Novo pitanje ili tema');
await tata.upisi('input.input', 'Saglasnost za izlet');
await tata.klikni('Škola');
await tata.klikni('Postavi');
await tata.cekajAdresu('/stavka/?id=');
await tata.cekajTekst('Neodgovoreno');
const stavkaUrl = BASE + (await tata.adresa());

await mama.idi(`${BASE}/`);
await mama.cekajTekst('Saglasnost za izlet');
await mama.idi(stavkaUrl);
await mama.upisi('textarea', 'Potpisaću ja.');
await mama.klikni('Pošalji');
await mama.cekajTekst('Otvoreno');
await mama.klikni('Predloži zatvaranje…');
await mama.upisi('textarea', 'Mama potpisuje saglasnost.');
await mama.klikni('Predloži zatvaranje');
await mama.cekajTekst('Čeka da tata potvrdi.');

await tata.idi(`${BASE}/`);
await tata.cekajTekst('Mama predlaže da se zatvori');
await tata.idi(stavkaUrl);
await tata.cekajTekst('Potpisaću ja.');
await tata.klikni('Potvrdi i zatvori');
await tata.cekajTekst('ODLUKA · ZATVORENO');
ok('stavka: tata pita, mama odgovara i predlaže zatvaranje, tata potvrđuje, sve preko baze');

await mama.idi(`${BASE}/kalendar/`);
await mama.cekajTekst('Kod koga je dete');
await mama.klikni('+ Boravak');
await mama.cekajTekst('Predloži promenu u kalendaru');
await mama.ev(`(() => { const d = document.querySelectorAll('dialog[open] input[type=date]'); const t = document.querySelectorAll('dialog[open] input[type=time]');
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(d[0], '${dan(-1)}'); set(t[0], '10:00'); set(d[1], '${dan(2)}'); set(t[1], '18:00'); return true; })()`);
await mama.upisi('dialog[open] textarea', 'Ove nedelje kod mame.');
await mama.ev(`[...document.querySelectorAll('dialog[open] button')].find(b => b.innerText.trim() === 'Pošalji predlog').click()`);
await mama.cekajTekst('Predlog je poslat');

await tata.idi(`${BASE}/kalendar/`);
await tata.cekajTekst('Ove nedelje kod mame.');
await tata.cekajUslov(`[...document.querySelectorAll('.zahtev')].some(k => k.innerText.includes('Ove nedelje kod mame.') && [...k.querySelectorAll('button')].some(b => b.innerText.trim() === 'Prihvati'))`, 'dugme Prihvati');
await tata.ev(`(() => { const k = [...document.querySelectorAll('.zahtev')].find(k => k.innerText.includes('Ove nedelje kod mame.')); [...k.querySelectorAll('button')].find(b => b.innerText.trim() === 'Prihvati').click(); return true; })()`);
await tata.cekajTekst('Prihvaćeno');
await tata.idi(`${BASE}/`);
await tata.cekajTekst('Sada je kod mame');
await mama.idi(`${BASE}/`);
await mama.cekajTekst('Sada je kod mame');
ok('kalendar: mama predlaže boravak, tata prihvata, oboje vide da je dete kod mame');

// An activity: tata proposes swimming tomorrow, mama accepts, tata sees it in his week.
await tata.ev(`localStorage.setItem('coparenting.kalendar.prikaz', 'nedelja')`);
await tata.idi(`${BASE}/kalendar/`);
await tata.klikni('+ Aktivnost');
await tata.cekajTekst('Predloži aktivnost');
await tata.upisi('dialog[open] input[placeholder^="Npr. Fudbal"]', 'Bazen');
await tata.ev(`(() => { const d = document.querySelector('dialog[open] input[type=date]'); d.value = '${dan(1)}'; d.dispatchEvent(new Event('input', { bubbles: true }));
  const t = document.querySelectorAll('dialog[open] input[type=time]'); const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(t[0], '10:00'); set(t[1], '11:00'); return true; })()`);
await tata.ev(`[...document.querySelectorAll('dialog[open] button')].find(b => b.innerText.trim() === 'Pošalji predlog').click()`);
await tata.cekajTekst('Predlog je poslat');
await mama.idi(`${BASE}/kalendar/`);
await mama.cekajUslov(`[...document.querySelectorAll('.zahtev')].some(k => k.innerText.includes('Bazen'))`, 'mama vidi predlog aktivnosti');
await mama.ev(`(() => { const k = [...document.querySelectorAll('.zahtev')].find(k => k.innerText.includes('Bazen')); [...k.querySelectorAll('button')].find(b => b.innerText.trim() === 'Prihvati').click(); return true; })()`);
await mama.cekajTekst('Kalendar je promenjen');
await tata.idi(`${BASE}/kalendar/`);
// A confirmed activity is a solid block (a pending one is dashed, class "predlog").
await tata.cekajUslov(`[...document.querySelectorAll('.blok')].some(e => e.innerText.includes('Bazen') && !e.classList.contains('predlog'))`, 'potvrđena aktivnost u tatinoj nedelji');
ok('kalendar: tata predlaže aktivnost, mama prihvata, aktivnost je u tatinom kalendaru');

await mama.idi(`${BASE}/karton/`);
await mama.cekajTekst('Zdravlje');
await mama.ev(`[...document.getElementById('g-zdravlje').closest('section').querySelectorAll('button')].find(b => b.innerText.trim() === '+ Dodaj').click()`);
await mama.upisi('form.uredi input', 'Alergije');
await mama.upisi('form.uredi textarea', 'Polen breze');
await mama.ev(`[...document.querySelectorAll('form.uredi button')].find(b => b.innerText.trim() === 'Sačuvaj').click()`);
await mama.cekajTekst('Polen breze');
await tata.idi(`${BASE}/karton/`);
await tata.cekajTekst('Polen breze');
await tata.idi(`${BASE}/`);
await tata.cekajTekst('Karton: Alergije');
ok('karton: mama upisuje alergiju, tata je vidi u kartonu i na početnoj pod „Novo“');

await kraj(0);
