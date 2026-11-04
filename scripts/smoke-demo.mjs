// Smoke test of the demo flow in headless Chrome, over the DevTools protocol.
// Needs the dev server (`npm run dev`) and google-chrome on PATH.
//   npm run smoke
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8040';
const port = 9333;
const profil = mkdtempSync(join(tmpdir(), 'coparenting-smoke-'));
const chrome = spawn(process.env.CHROME ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profil}`, `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore' });
async function kraj(kod) {
  chrome.kill();
  await new Promise((r) => (chrome.exitCode !== null ? r() : chrome.once('exit', r)));
  try {
    rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    /* a leftover temp profile is harmless */
  }
  process.exit(kod);
}
process.on('uncaughtException', (e) => { console.error('FAIL', e.message); kraj(1); });
process.on('unhandledRejection', (e) => { console.error('FAIL', e instanceof Error ? e.message : e); kraj(1); });

let t;
for (let i = 0; i < 50 && !t; i++) {
  try { t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); }
  catch { await new Promise((r) => setTimeout(r, 200)); }
}
if (!t) throw new Error('Chrome se nije pokrenuo');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let n = 0;
const cekaju = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && cekaju.has(m.id)) { cekaju.get(m.id)(m); cekaju.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; cekaju.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));
async function idi(url) { await cdp('Page.navigate', { url }); await spavaj(1500); }
async function cekajTekst(tekst, ms = 5000) {
  for (let i = 0; i < ms / 100; i++) { if (await ev(`document.body.innerText.includes(${JSON.stringify(tekst)})`)) return true; await spavaj(100); }
  throw new Error(`nema teksta: ${tekst}\n---\n${(await ev('document.body.innerText')).slice(0, 1500)}`);
}
const klikni = (tekst) => ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(tekst)}); if (!b) throw new Error('nema dugmeta ' + ${JSON.stringify(tekst)}); b.click(); return true; })()`);
const upisi = (sel, v) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
// A modal dialog must open centred, never stuck in a corner (regression).
async function proveriSredinu(gde) {
  await spavaj(350); // let the opening animation finish
  const otvorenih = await ev(`document.querySelectorAll('dialog[open]').length`);
  if (otvorenih !== 1) throw new Error(`otvoreno je ${otvorenih} prozora umesto jednog (${gde})`);
  const r = await ev(`(() => { const d = document.querySelector('dialog[open]').getBoundingClientRect(); const v = document.documentElement; return { levo: d.left, desno: v.clientWidth - d.right, gore: d.top, dole: v.clientHeight - d.bottom }; })()`);
  const ok1 = Math.abs(r.levo - r.desno) <= 2 && Math.abs(r.gore - r.dole) <= 2 && r.gore > 0;
  if (!ok1) throw new Error(`prozor nije na sredini (${gde}): ${JSON.stringify(r)}`);
  if (process.env.SNIMCI) {
    const { data } = (await cdp('Page.captureScreenshot', { format: 'png' })).result;
    (await import('node:fs')).writeFileSync(`${process.env.SNIMCI}/prozor-${gde}.png`, Buffer.from(data, 'base64'));
  }
}
const kao = async (id) => { await ev(`localStorage.setItem('coparenting.demo.ja', '${id}')`); };
const ok = (m) => console.log('OK  ', m);

await cdp('Page.enable');
await cdp('Runtime.enable');
const greske = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') greske.push(m.params.exceptionDetails.text); });

await idi(`${BASE}/`);
await ev(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('coparenting.demo', '1'); true`);
await kao('tata');

// 1. Tata postavlja novo pitanje
await idi(`${BASE}/nova/`);
await cekajTekst('Novo pitanje ili tema');
await upisi('input.input', 'Test: rođendanska zabava');
await klikni('Zdravlje');
await klikni('Hitno');
await klikni('Postavi');
await spavaj(1500);
const url = await ev('location.href');
if (!url.includes('/stavka/?id=')) throw new Error('nije preusmereno na stavku: ' + url);
await cekajTekst('Neodgovoreno');
ok('nova stavka postavljena, stanje Neodgovoreno');

// 2. Mama odgovara -> Otvoreno
await kao('mama');
await idi(url);
await cekajTekst('Test: rođendanska zabava');
await upisi('textarea', 'Može u subotu.');
await klikni('Pošalji');
await cekajTekst('Može u subotu.');
await cekajTekst('Otvoreno');
ok('odgovor drugog roditelja prebacuje u Otvoreno');

// 3. Mama predlaže zatvaranje
await klikni('Predloži zatvaranje…');
await upisi('textarea', 'Subota u 12h, organizuje mama.');
await klikni('Predloži zatvaranje');
await cekajTekst('Čeka da tata potvrdi.');
ok('predlog zatvaranja čeka drugog roditelja');

// 4. Tata vidi predlog na početnoj i potvrđuje
await kao('tata');
await idi(`${BASE}/`);
await cekajTekst('Mama predlaže da se zatvori');
ok('predlog je na početnoj pod „Na tebi je“');
await idi(url);
await klikni('Potvrdi i zatvori');
await cekajTekst('ODLUKA · ZATVORENO');
await cekajTekst('potvrđuješ zatvaranje');
await cekajTekst('Subota u 12h, organizuje mama.');
ok('zatvaranje potvrđeno, odluka zapisana');

// 5. Ponovo otvori traži razlog
await klikni('Ponovo otvori');
const dugme = await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Ponovo otvori').disabled`);
if (!dugme) throw new Error('Ponovo otvori je dozvoljeno bez razloga');
ok('ponovno otvaranje bez razloga je onemogućeno');

// 6. Lista sa filterom i množina
await idi(`${BASE}/stavke/?stanje=zatvoreno`);
await cekajTekst('Test: rođendanska zabava');
await cekajTekst('4 stavke');
ok('lista filtrira zatvorene (4 stavke)');

// 7. Tabla: prevlačenje mišem
const klikniU = (opseg, tekst) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(opseg)} + ' button')].find(b => b.innerText.trim() === ${JSON.stringify(tekst)}); if (!b) throw new Error('nema dugmeta ' + ${JSON.stringify(tekst)}); b.click(); return true; })()`);
const idKartice = (naslov) => ev(`[...document.querySelectorAll('[data-stavka]')].find(e => e.innerText.includes(${JSON.stringify(naslov)}))?.dataset.stavka`);
// Measure without scrolling, so two points taken one after another stay valid.
const centar = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 40) }; })()`);
// A visible point inside a column, below the sticky navigation.
const uKolonu = (k) => ev(`(() => { const r = document.querySelector('[data-kolona="${k}"]').getBoundingClientRect(); const nav = document.querySelector('.nav').getBoundingClientRect().bottom; return { x: r.left + r.width / 2, y: Math.min(Math.max(r.top + 140, nav + 60), r.bottom - 20) }; })()`);
const naTablu = () => ev(`(() => { window.scrollTo(0, document.querySelector('.tabla').getBoundingClientRect().top + window.scrollY - 60); return true; })()`);
const uKoloni = (id, k) => ev(`document.querySelector('[data-kolona="${k}"] [data-stavka="${id}"]') !== null`);
const tacke = (od, ka, n = 12) => Array.from({ length: n }, (_, i) => ({ x: od.x + ((ka.x - od.x) * (i + 1)) / n, y: od.y + ((ka.y - od.y) * (i + 1)) / n }));

async function prevuciMisem(od, ka) {
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: od.x, y: od.y });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: od.x, y: od.y, button: 'left', buttons: 1, clickCount: 1 });
  for (const t of tacke(od, ka)) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: t.x, y: t.y, button: 'left', buttons: 1 });
    await spavaj(16);
  }
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ka.x, y: ka.y, button: 'left', buttons: 0, clickCount: 1 });
  await spavaj(400);
}

async function prevuciPrstom(od, ka) {
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: od.x, y: od.y }] });
  await spavaj(450); // zadrži prst
  for (const t of tacke(od, ka)) {
    await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: t.x, y: t.y }] });
    await spavaj(16);
  }
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await spavaj(400);
}

await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
await kao('tata');
await idi(`${BASE}/stavke/?prikaz=tabla`);
await cekajTekst('Lektira za novembar');
const lektira = await idKartice('Lektira za novembar');
await naTablu();
await prevuciMisem(await centar(`[data-stavka="${lektira}"]`), await uKolonu('reseno'));
await cekajTekst('Predloži da je rešeno');
await proveriSredinu('tabla');
if ((await ev('location.pathname')) !== '/stavke/') throw new Error('klik posle prevlačenja je otvorio karticu');
await upisi('dialog[open] textarea', 'Kupuje mama u knjižari.');
await klikniU('dialog[open]', 'Predloži');
await cekajTekst('čeka da mama potvrdi');
if (!(await uKoloni(lektira, 'reseno'))) throw new Error('kartica nije pod Rešeno');
ok('tabla: prevlačenje mišem u Rešeno traži odluku i pravi predlog; prozor je na sredini');

const alergolog = await idKartice('Kontrola kod alergologa');
await naTablu();
await prevuciMisem(await centar(`[data-stavka="${alergolog}"]`), await uKolonu('stavke'));
await cekajTekst('U Stavke idu samo nova');
if (!(await uKoloni(alergolog, 'aktivno'))) throw new Error('zabranjen potez je ipak pomerio karticu');
ok('tabla: vraćanje u Stavke je odbijeno uz poruku');

// 8. Telefon: mama prevlači prstom i potvrđuje predlog
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 900, deviceScaleFactor: 2, mobile: true });
await kao('mama');
await idi(`${BASE}/stavke/?prikaz=tabla`);
await cekajTekst('Zimska jakna');
const jakna = await idKartice('Zimska jakna');
await naTablu();
await prevuciPrstom(await centar(`[data-stavka="${jakna}"]`), await uKolonu('aktivno'));
await cekajTekst('Pomeri u Aktivno');
await proveriSredinu('telefon');
await klikniU('dialog[open]', 'Pomeri');
await spavaj(500);
if (!(await uKoloni(jakna, 'aktivno'))) {
  const dij = await ev(`document.querySelector('dialog[open]')?.innerText ?? '(nema dijaloga)'`);
  const gde = await ev(`document.querySelector('[data-stavka="${jakna}"]')?.closest('[data-kolona]')?.dataset.kolona ?? '(nema kartice)'`);
  throw new Error(`kartica nije prešla u Aktivno (kolona: ${gde}; dijalog: ${dij})`);
}
ok('telefon: zadrži-pa-prevuci prstom pomera karticu u Aktivno');

// A quick swipe without holding is a scroll, never a drag.
const izlet = await idKartice('Saglasnost za izlet');
await naTablu();
{
  const od = await centar(`[data-stavka="${izlet}"]`);
  const ka = await uKolonu('aktivno');
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: od.x, y: od.y }] });
  for (const t of tacke(od, ka, 6)) {
    await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: t.x, y: t.y }] });
    await spavaj(10);
  }
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await spavaj(600);
  if (await ev(`document.querySelector('dialog[open]') !== null`)) throw new Error('brz pokret prstom je pokrenuo prevlačenje');
  if (!(await uKoloni(izlet, 'stavke'))) throw new Error('brz pokret prstom je pomerio karticu');
}
ok('telefon: brz pokret prstom ne pomera karticu');

const naslovJakne = await ev(`document.querySelector('[data-stavka="${jakna}"] .k-naslov').innerText`);
if (!naslovJakne.includes('Zimska jakna')) throw new Error('prevučena je pogrešna kartica');
await klikniU(`[data-stavka="${lektira}"]`, 'Potvrdi');
await cekajTekst('Potvrdi da je rešeno');
await klikniU('dialog[open]', 'Potvrdi');
await spavaj(500);
const zatvorena = await ev(`document.querySelector('[data-stavka="${lektira}"]').classList.contains('zatvorena')`);
if (!zatvorena) throw new Error('predlog nije potvrđen');
ok('telefon: mama potvrđuje predlog dugmetom na kartici');

// 9. Kalendar: ništa se ne menja dok drugi roditelj ne prihvati
await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
const demo = () => ev(`JSON.parse(localStorage.getItem('coparenting.demo.v1'))`);
const brojBoravaka = async () => (await demo()).boravci.length;
const pomeriDan = (n) => ev(`(() => { const d = new Date(); d.setDate(d.getDate() + ${n}); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()`);

await kao('mama');
await idi(`${BASE}/kalendar/`);
await cekajTekst('Kod koga je');
const pre1 = await brojBoravaka();
await klikni('+ Boravak');
await cekajTekst('Predloži promenu u kalendaru');
await proveriSredinu('kalendar');
const dan30 = await pomeriDan(30);
await ev(`(() => { const d = document.querySelectorAll('dialog[open] input[type=date]'); const t = document.querySelectorAll('dialog[open] input[type=time]');
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(d[0], '${dan30}'); set(t[0], '10:00'); set(d[1], '${dan30}'); set(t[1], '18:00'); return true; })()`);
await upisi('dialog[open] textarea', 'Predstava u pozorištu u 11h.');
await klikniU('dialog[open]', 'Pošalji predlog');
await cekajTekst('Predlog je poslat');
if ((await brojBoravaka()) !== pre1) throw new Error('kalendar se promenio pre prihvatanja');
const mojZahtev = (await demo()).zahtevi.find((z) => z.poruka === 'Predstava u pozorištu u 11h.');
if (!mojZahtev || mojZahtev.stanje !== 'ceka') throw new Error('zahtev nije sačuvan kao „čeka“');
const imaPrihvati = await ev(`[...document.querySelectorAll('.zahtev')].filter(k => k.innerText.includes('pozorištu')).some(k => [...k.querySelectorAll('button')].some(b => b.innerText.trim() === 'Prihvati'))`);
if (imaPrihvati) throw new Error('predlagač vidi dugme Prihvati za svoj predlog');
ok('kalendar: prozor za predlog je na sredini; predlog čeka, kalendar nepromenjen, predlagač ne može sam da prihvati');

await kao('tata');
await idi(`${BASE}/`);
await cekajTekst('Kalendar: jednokratna promena');
ok('kalendar: predlog je na početnoj pod „Na tebi je“');

await idi(`${BASE}/kalendar/`);
await cekajTekst('pozorištu');
await ev(`(() => { const k = [...document.querySelectorAll('.zahtev')].find(k => k.innerText.includes('pozorištu')); [...k.querySelectorAll('button')].find(b => b.innerText.trim() === 'Prihvati').click(); return true; })()`);
await cekajTekst('Kalendar je promenjen');
if ((await brojBoravaka()) !== pre1 + 1) throw new Error('prihvaćen predlog nije upisan u kalendar');
ok('kalendar: drugi roditelj prihvata i tek tada se kalendar menja');

await kao('mama');
await idi(`${BASE}/kalendar/`);
await cekajTekst('zimskog raspusta');
await ev(`(() => { const k = [...document.querySelectorAll('.zahtev')].find(k => k.innerText.includes('zimskog raspusta')); [...k.querySelectorAll('button')].find(b => b.innerText.trim() === 'Odbij').click(); return true; })()`);
await cekajTekst('Odbij predlog');
await proveriSredinu('odbij');
await upisi('dialog[open] textarea', 'Tada smo kod bake.');
await klikniU('dialog[open]', 'Odbij');
await cekajTekst('Predlog je odbijen');
await cekajTekst('Tada smo kod bake.');
ok('kalendar: odbijanje traži razlog i ostaje u istoriji');

// 9b. Kalendar: aktivnosti, prevlačenje, prelasci, „Danas“
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
await kao('tata');
await ev(`localStorage.setItem('coparenting.kalendar.prikaz', 'nedelja')`);
await idi(`${BASE}/kalendar/`);
await cekajTekst('Kod koga je');
const dogadjaji = async () => (await demo()).dogadjaji;
const preAkt = (await dogadjaji()).length;
await klikni('+ Aktivnost');
await cekajTekst('Predloži aktivnost');
await proveriSredinu('aktivnost');
await upisi('dialog[open] input[placeholder^="Npr. Fudbal"]', 'Bazen');
await ev(`(() => { const d = document.querySelector('dialog[open] input[type=date]'); d.value = '${await pomeriDan(1)}'; d.dispatchEvent(new Event('input', { bubbles: true }));
  const t = document.querySelectorAll('dialog[open] input[type=time]'); const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(t[0], '10:00'); set(t[1], '11:00'); return true; })()`);
await klikniU('dialog[open]', 'Pošalji predlog');
await cekajTekst('Predlog je poslat');
if ((await dogadjaji()).length !== preAkt) throw new Error('aktivnost upisana pre potvrde');
await cekajTekst('čeka potvrdu');
ok('kalendar: predlog aktivnosti se vidi isprekidano i čeka potvrdu');

await kao('mama');
await idi(`${BASE}/kalendar/`);
await cekajTekst('Bazen');
await ev(`(() => { const k = [...document.querySelectorAll('.zahtev')].find(k => k.innerText.includes('Bazen')); [...k.querySelectorAll('button')].find(b => b.innerText.trim() === 'Prihvati').click(); return true; })()`);
await cekajTekst('Kalendar je promenjen');
if ((await dogadjaji()).length !== preAkt + 1) throw new Error('prihvaćena aktivnost nije upisana');
ok('kalendar: aktivnost je upisana tek kad drugi roditelj prihvati');

// Prevlačenje treninga koji se ponavlja, samo ovaj put
const naBlok = (tekst) => ev(`(() => { const b = [...document.querySelectorAll('button.blok')].find(b => b.innerText.includes(${JSON.stringify(tekst)})); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 8 }; })()`);
const fudbalOd = await naBlok('Fudbal');
await prevuciMisem(fudbalOd, { x: fudbalOd.x, y: fudbalOd.y + 46 });
await cekajTekst('Pomeri: Fudbal');
await proveriSredinu('pomeri');
await cekajTekst('Samo ovaj put');
await klikniU('dialog[open]', 'Pošalji predlog');
await cekajTekst('Predlog je poslat');
const pomeranjeZ = (await demo()).zahtevi.find((z) => z.stanje === 'ceka' && z.jednom);
if (!pomeranjeZ || pomeranjeZ.dogadjaj.od !== '18:00') throw new Error('pomeranje: ' + JSON.stringify(pomeranjeZ));
ok('kalendar: prevučen trening postaje predlog „samo ovaj put“ (17:00 → 18:00)');

await kao('tata');
await idi(`${BASE}/kalendar/`);
await cekajTekst('Pomeranje, samo jednom');
await ev(`(() => { const k = [...document.querySelectorAll('.zahtev')].find(k => k.innerText.includes('Pomeranje, samo jednom')); [...k.querySelectorAll('button')].find(b => b.innerText.trim() === 'Prihvati').click(); return true; })()`);
await cekajTekst('Kalendar je promenjen');
const fudbal = (await dogadjaji()).find((x) => x.id === 'demo-d1');
if (!fudbal.izuzeti?.includes(pomeranjeZ.jednom)) throw new Error('serija ne preskače pomeren dan');
ok('kalendar: posle prihvatanja serija preskače taj dan, a trening je u 18:00');

// Prevlačenje prelaska na drugo vreme
const preZahteva = (await demo()).zahtevi.length;
const prelazakOd = await ev(`(() => { const b = document.querySelector('button.prelazak'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 8 }; })()`);
await prevuciMisem(prelazakOd, { x: prelazakOd.x + 200, y: prelazakOd.y + 92 });
await cekajTekst('drugo vreme');
await klikniU('dialog[open]', 'Pošalji predlog');
await cekajTekst('Predlog je poslat');
const zPrelaz = (await demo()).zahtevi.slice(preZahteva)[0];
if (!zPrelaz || zPrelaz.boravci[0]?.vrsta !== 'izuzetak') throw new Error('prelazak: ' + JSON.stringify(zPrelaz));
ok('kalendar: prevučen prelazak je predlog jednokratne promene, ostaje u istom danu');

// „Danas“ radi u svakom prikazu
for (const prikaz of ['Mesec', 'Dan', 'Nedelja', 'Raspored']) {
  await ev(`[...document.querySelectorAll('.prikaz-dugme')].find(b => b.innerText.trim() === ${JSON.stringify(prikaz)}).click()`);
  await spavaj(150);
  const pre = await ev(`document.querySelector('.alati .mesec-naziv').innerText`);
  await ev(`document.querySelector('button[aria-label="Napred"]').click()`);
  await ev(`document.querySelector('button[aria-label="Napred"]').click()`);
  await spavaj(150);
  if ((await ev(`document.querySelector('.alati .mesec-naziv').innerText`)) === pre) throw new Error(`strelica ne pomera (${prikaz})`);
  await ev(`document.querySelector('.danas-dugme').click()`);
  await spavaj(150);
  if ((await ev(`document.querySelector('.alati .mesec-naziv').innerText`)) !== pre) throw new Error(`Danas ne vraća (${prikaz})`);
}
ok('kalendar: „Danas“ vraća na danas u prikazu dana, nedelje, meseca i rasporeda');

// Telefon: zadrži pa prevuci aktivnost prstom
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await ev(`localStorage.setItem('coparenting.kalendar.prikaz', 'nedelja')`);
await idi(`${BASE}/kalendar/`);
await cekajTekst('3 dana');
const blokPrst = await naBlok('Fudbal');
await prevuciPrstom(blokPrst, { x: blokPrst.x, y: blokPrst.y + 46 });
await cekajTekst('Pomeri: Fudbal');
await proveriSredinu('pomeri-telefon');
await klikniU('dialog[open]', 'Otkaži');
await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
ok('telefon: aktivnost u kalendaru se prevlači prstom (zadrži pa prevuci)');

// 10. Karton: izmena se beleži i drugi roditelj je vidi; istorija čuva zatvorene teme
await kao('mama');
await idi(`${BASE}/karton/`);
await cekajTekst('Mere i veličine');
await ev(`(() => { [...document.querySelectorAll('.unos')].find(u => u.innerText.includes('Obuća')).querySelector('.olovka').click(); return true; })()`);
await spavaj(200);
await upisi('form.uredi textarea', '35');
await klikniU('form.uredi', 'Sačuvaj');
await cekajTekst('Sačuvano');
await ev(`document.querySelector('details.promene').open = true`);
await cekajTekst('menja „Obuća“: 34 → 35');
ok('karton: izmena se čuva i ulazi u istoriju kartona');

await kao('tata');
await idi(`${BASE}/`);
await cekajTekst('Karton: Obuća');
await cekajTekst('34 → 35');
ok('karton: drugi roditelj vidi izmenu na početnoj pod „Novo“');

// Više aktivnosti: koliko god, svaka sa svojim detaljima
const dodajAktivnost = async (naziv, termini) => {
  await ev(`(() => { const g = document.getElementById('g-aktivnosti').closest('section'); [...g.querySelectorAll('button')].find(b => b.innerText.trim() === '+ Dodaj aktivnost').click(); return true; })()`);
  await spavaj(200);
  await upisi('form.uredi input', naziv);
  await upisi('form.uredi input[placeholder^="Npr. utorak"]', termini);
  await klikniU('form.uredi', 'Sačuvaj');
  await cekajTekst('Sačuvano');
};
await idi(`${BASE}/karton/`);
await cekajTekst('Vanškolske aktivnosti');
await dodajAktivnost('Plivanje', 'Ponedeljak 18h');
await dodajAktivnost('Šah', 'Sreda 16h');
const aktivnosti = await ev(`[...document.getElementById('g-aktivnosti').closest('section').querySelectorAll('.zapis h3')].map(h => h.innerText)`);
if (JSON.stringify(aktivnosti) !== JSON.stringify(['Fudbal', 'Engleski', 'Plivanje', 'Šah'])) throw new Error('aktivnosti: ' + JSON.stringify(aktivnosti));
ok('karton: može više aktivnosti, svaka sa svojim terminima');

// Dok je izmena otvorena, ostala dugmad su zaključana, pa se nacrt ne gubi
await ev(`(() => { const g = document.getElementById('g-aktivnosti').closest('section'); [...g.querySelectorAll('button')].find(b => b.innerText.trim() === '+ Dodaj aktivnost').click(); return true; })()`);
await spavaj(200);
await upisi('form.uredi input', 'Gitara');
const zakljucano = await ev(`[...document.querySelectorAll('.olovka')].every(b => b.disabled)`);
if (!zakljucano) throw new Error('druga dugmad nisu zaključana dok je nacrt otvoren');
if ((await ev(`document.querySelector('form.uredi input').value`)) !== 'Gitara') throw new Error('nacrt je izgubljen');
await cekajTekst('Prvo sačuvaj ili otkaži');
await klikniU('form.uredi', 'Otkaži');
ok('karton: otvoren nacrt zaključava ostalo, ništa se ne gubi');

// Škola: nastavnici; Drugari: broj roditelja; Zdravlje: samo „+ Dodaj“ sa predlozima
const kliknuUGrupi = (grupa, tekst) => ev(`(() => { const g = document.getElementById('g-${grupa}').closest('section'); [...g.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(tekst)}).click(); return true; })()`);
await idi(`${BASE}/karton/`);
await cekajTekst('Nastavnici');
await kliknuUGrupi('skola', '+ Dodaj nastavnika');
await spavaj(150);
await upisi('form.uredi input', 'Jelena Ilić');
await upisi('form.uredi input[placeholder^="Npr. učiteljica"]', 'Veronauka');
await klikniU('form.uredi', 'Sačuvaj');
await cekajTekst('Jelena Ilić');
await kliknuUGrupi('drugari', '+ Dodaj drugara');
await spavaj(150);
await upisi('form.uredi input', 'Mila');
await upisi('form.uredi input[placeholder="Ime mame ili tate"]', 'Tata Zoran');
await upisi('form.uredi input[type=tel]', '064 123 4567');
await klikniU('form.uredi', 'Sačuvaj');
await cekajTekst('Tata Zoran');
if (!(await ev(`!!document.querySelector('#g-drugari') && [...document.getElementById('g-drugari').closest('section').querySelectorAll('a[href^="tel:"]')].some(a => a.getAttribute('href') === 'tel:0641234567')`))) {
  throw new Error('telefon roditelja nije link za poziv');
}
ok('karton: dodat nastavnik u Školu i drugarica sa brojem roditelja (klik poziva)');

const zdravljeDugmad = await ev(`[...document.getElementById('g-zdravlje').closest('section').querySelectorAll('.dodaj button')].map(b => b.innerText.trim())`);
if (JSON.stringify(zdravljeDugmad) !== JSON.stringify(['+ Dodaj'])) throw new Error('zdravlje dugmad: ' + JSON.stringify(zdravljeDugmad));
await kliknuUGrupi('zdravlje', '+ Dodaj');
await spavaj(150);
const predlozi = await ev(`[...document.querySelectorAll('form.uredi datalist option')].map(o => o.value)`);
if (!predlozi.includes('Vakcine') || predlozi.includes('Pedijatar')) throw new Error('predlozi: ' + JSON.stringify(predlozi));
await upisi('form.uredi input', 'Vakcine');
await upisi('form.uredi textarea', 'Sve po kalendaru, knjižica kod mame');
await klikniU('form.uredi', 'Sačuvaj');
await cekajTekst('Sve po kalendaru');
ok('karton: Zdravlje ima samo „+ Dodaj“, predlozi se nude dok se kuca');

// Raspored časova: uvoz CSV-a iz Excela, pregled, čuvanje; slika
const { resolve: putanjaDo } = await import('node:path');
const naFajl = async (selektor, fajl) => {
  const { root } = (await cdp('DOM.getDocument', { depth: -1 })).result;
  const { nodeId } = (await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: selektor })).result;
  await cdp('DOM.setFileInputFiles', { nodeId, files: [putanjaDo('scripts/fixtures', fajl)] });
};
await naFajl('section.raspored input[accept^=".csv"]', 'raspored.csv');
await cekajTekst('Uvezeno iz „raspored.csv“');
const prvaCelija = await ev(`document.querySelector('section.raspored table.uredjivanje tbody tr td:nth-child(4) input').value`);
if (prvaCelija !== 'Hor') throw new Error('uvoz CSV: ' + prvaCelija);
await klikniU('section.raspored', 'Sačuvaj');
await cekajTekst('Raspored časova je sačuvan');
await cekajTekst('Hor');
ok('raspored časova: CSV iz srpskog Excela se uvozi, pregleda i čuva');

await naFajl('section.raspored input[accept="image/*"]', 'raspored.png');
await cekajTekst('Slika rasporeda je sačuvana');
if (!(await ev(`document.querySelector('section.raspored img')?.src.startsWith('data:image/jpeg')`))) throw new Error('slika nije prikazana');
ok('raspored časova: slika se smanji, sačuva i prikaže');

await idi(`${BASE}/stavke/?prikaz=istorija`);
await cekajTekst('Istorija dogovora');
await cekajTekst('Test: rođendanska zabava');
await cekajTekst('Subota u 12h, organizuje mama.');
await upisi('.arhiva-filteri input', 'pozorištu');
await cekajTekst('Nijedan dogovor ne odgovara pretrazi.');
ok('istorija dogovora je kod stavki: zatvorene teme sa odlukama, pretraga radi');

// ---- Documents --------------------------------------------------------------
const klikniKarticu = (tekst) => ev(`(() => { const b = [...document.querySelectorAll('button.dok')].find(b => b.innerText.includes(${JSON.stringify(tekst)})); if (!b) throw new Error('nema kartice ' + ${JSON.stringify(tekst)}); b.click(); return true; })()`);
const cekajUslov = async (izraz, opis, ms = 5000) => {
  for (let i = 0; i < ms / 100; i++) { if (await ev(izraz)) return; await spavaj(100); }
  throw new Error(`nije ispunjeno: ${opis}`);
};

await idi(`${BASE}/dokumenti/`);
await cekajTekst('Lekarsko uverenje za sport');
await cekajTekst('Potvrda o upisu');
await cekajTekst('Obrisani · 1');
await cekajUslov(`[...document.querySelectorAll('button.dok img')].some(i => i.complete && i.naturalWidth > 0)`, 'sličice slika');
ok('dokumenti: primeri se vide sa sličicama, obrisani su posebno');

await klikniKarticu('Lekarsko uverenje za sport');
await proveriSredinu('pregled dokumenta');
await cekajUslov(`(() => { const i = document.querySelector('dialog[open] .prikaz img'); return i && i.complete && i.naturalWidth > 0; })()`, 'slika u pregledu');
await cekajTekst('Mama je dodala');
await ev(`document.querySelector('dialog[open]').close()`);
await spavaj(200);
ok('dokumenti: pregled se otvara na sredini, sa slikom i tragom');

await klikni('Dodaj dokument');
await proveriSredinu('novi dokument');
await naFajl('dialog[open] input[type=file]:not([capture])', 'raspored.png');
await cekajUslov(`!!document.querySelector('dialog[open] .izabran img')`, 'pregled izabrane slike');
if ((await ev(`document.querySelector('dialog[open] input[placeholder^="Npr. Nalaz"]').value`)) !== 'Raspored') throw new Error('naziv iz imena fajla');
await upisi('dialog[open] input[placeholder^="Npr. Nalaz"]', 'Test: nalaz alergologa');
await klikniU('dialog[open]', 'Zdravlje');
await klikniU('dialog[open]', 'Sačuvaj dokument');
await cekajTekst('„Test: nalaz alergologa“ je dodat.');
await idi(`${BASE}/dokumenti/`);
await cekajTekst('Test: nalaz alergologa');
ok('dokumenti: dodavanje slike, naziv iz fajla, ostaje posle osvežavanja');

await klikniKarticu('Test: nalaz alergologa');
await cekajTekst('Dodao si');
await klikniU('dialog[open]', 'Obriši');
await cekajTekst('Mama će videti da si ga obrisao');
await klikniU('dialog[open]', 'Da, obriši');
await cekajTekst('Obrisao si');
await cekajTekst('Fajl je sačuvan i dokument može da se vrati.');
await ev(`document.querySelector('dialog[open]').close()`);
await cekajTekst('Obrisani · 2');
await ev(`document.querySelector('details.obrisani').open = true`);
await ev(`(() => { const li = [...document.querySelectorAll('details.obrisani li')].find(l => l.innerText.includes('Test: nalaz alergologa')); li.querySelector('button.vrati').click(); return true; })()`);
await cekajTekst('„Test: nalaz alergologa“ je vraćen.');
await cekajTekst('Obrisani · 1');
ok('dokumenti: brisanje samo označi, vraćanje radi');

await ev(`[...document.querySelectorAll('.alati button')].find(b => b.innerText.startsWith('Zdravlje')).click()`);
await spavaj(200);
const vidljivi = await ev(`[...document.querySelectorAll('button.dok .naziv')].map(n => n.innerText)`);
if (vidljivi.length !== 2 || !vidljivi.includes('Test: nalaz alergologa')) throw new Error('filter Zdravlje: ' + vidljivi.join(', '));
await upisi('.pretraga input', 'alergolog');
await spavaj(200);
if ((await ev(`document.querySelectorAll('button.dok').length`)) !== 1) throw new Error('pretraga');
ok('dokumenti: filter po kategoriji i pretraga');

// Permanent deletion: mama proposed it in the demo data; tata declines, then
// proposes himself, and mama confirms.
await idi(`${BASE}/dokumenti/`);
await cekajTekst('Mama predlaže trajno brisanje');
await klikniU('.ceka-te', 'Pogledaj');
await cekajUslov(`document.querySelector('details.obrisani').open`, 'obrisani otvoreni');
await klikniU('details.obrisani', 'Odbij');
await cekajTekst('Trajno brisanje je odbijeno');
await cekajTekst('Odbio si trajno brisanje');
await klikniU('details.obrisani', 'Trajno obriši…');
await cekajTekst('Fajl nestaje zauvek tek kad i Mama potvrdi.');
await klikniU('details.obrisani', 'Predloži trajno brisanje');
await cekajTekst('Čeka se da Mama potvrdi.');
if (await ev(`[...document.querySelectorAll('details.obrisani button')].some(b => b.innerText.trim() === 'Potvrdi trajno brisanje')`)) throw new Error('predlagač ne sme da potvrdi sam sebi');
ok('dokumenti: tata odbija mamin predlog za trajno brisanje, pa predlaže sam; ne može sebi da potvrdi');

await ev(`localStorage.setItem('coparenting.demo.ja', 'mama')`);
await idi(`${BASE}/`);
await cekajTekst('Dokumenti: trajno brisanje „Račun za patike (duplikat)“');
await idi(`${BASE}/dokumenti/?obrisani=1`);
await cekajTekst('Tata predlaže da se trajno obriše.');
await klikniU('details.obrisani', 'Potvrdi trajno brisanje');
await cekajTekst('„Račun za patike (duplikat)“ je trajno obrisan.');
await cekajTekst('TRAJNO OBRISANO');
await cekajTekst('predložio Tata, potvrdila Mama');
await idi(`${BASE}/dokumenti/`);
await cekajTekst('Obrisani · 0');
await ev(`localStorage.setItem('coparenting.demo.ja', 'tata')`);
ok('dokumenti: mama vidi predlog na početnoj, potvrđuje, a ostaje zapis ko je predložio i ko potvrdio');

// ---- Parent profile -----------------------------------------------------------
await idi(`${BASE}/`);
await ev(`document.querySelector('a.nalog').click()`);
await spavaj(1200);
await cekajTekst('Moj profil');
await cekajTekst('Još ništa nisi upisao.');
await cekajTekst('Njegoševa 12, Beograd');
if ((await ev(`document.querySelector('a[href^="tel:"]').getAttribute('href')`)) !== 'tel:0647654321') throw new Error('mamin telefon nije link za poziv');
await klikni('Popuni profil');
await upisi('input[autocomplete=name]', 'Tata (demo)');
await upisi('input[autocomplete=tel]', 'zovi me');
await klikni('Sačuvaj profil');
await cekajTekst('Telefon sme da ima samo cifre');
await upisi('input[autocomplete=tel]', '064 111 2222');
await upisi('input[autocomplete=street-address]', 'Kralja Petra 5, Beograd');
await klikni('Sačuvaj profil');
await cekajTekst('Profil je sačuvan.');
await cekajTekst('Kralja Petra 5, Beograd');
ok('profil: kružić gore vodi na profil; tata upisuje telefon i adresu, loš telefon se odbija; vidi mamin telefon kao link');

await ev(`localStorage.setItem('coparenting.demo.ja', 'mama')`);
await idi(`${BASE}/podesavanja/`);
await cekajTekst('Povezani ste: Tata je u prostoru.');
await cekajTekst('064 111 2222');
await cekajTekst('Kralja Petra 5, Beograd');
await ev(`localStorage.setItem('coparenting.demo.ja', 'tata')`);
ok('profil: mama vidi tatin telefon i adresu');

if (greske.length) throw new Error('JS greške: ' + greske.join('; '));
ok('bez JS grešaka');
ws.close();
kraj(0);
