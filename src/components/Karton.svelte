<script lang="ts">
  import { onMount } from 'svelte';
  import { izvor as dajIzvor, type Izvor } from '../lib/izvor';
  import { pratiPromene } from '../lib/osvezavanje';
  import {
    GRUPE,
    type GrupaKartona,
    type UnosKartona,
    ZAPISI,
    detaljiZapisa,
    godine,
    godineTekst,
    jeSpisak,
    nedostaje,
  } from '../lib/karton';
  import { roditeljPoId } from '../lib/kalendar-opis';
  import { datumKratko, pre } from '../lib/format';
  import { opisPonavljanja } from '../lib/dogadjaji';
  import { putanje } from '../lib/putanje';
  import type { Podaci } from '../lib/tipovi';
  import Ikona from './Ikona.svelte';
  import RasporedCasova from './RasporedCasova.svelte';

  type Nacrt = { id: string | null; grupa: GrupaKartona; naziv: string; vrednost: string; detalji: Record<string, string> };

  const sada = new Date();
  let iz = $state<Izvor | null>(null);
  let podaci = $state<Podaci | null>(null);
  let greska = $state<string | null>(null);
  let poruka = $state<string | null>(null);

  // One open form at a time. While it is open, every other edit/add button is
  // locked, so nothing typed can be thrown away by a stray click.
  let nacrt = $state<Nacrt | null>(null);
  let rasporedOtvoren = $state(false);
  let zauzeto = $derived(nacrt !== null || rasporedOtvoren);
  let salje = $state(false);
  let greskaForme = $state<string | null>(null);

  async function ucitaj() {
    iz ??= await dajIzvor();
    podaci = await iz.ucitaj();
  }

  onMount(() => {
    ucitaj().catch((e) => (greska = e instanceof Error ? e.message : String(e)));
    // The other parent's changes show up without a refresh; an open form
    // keeps what is typed (it is separate state).
    return pratiPromene(dajIzvor(), () => ucitaj());
  });

  function javi(t: string) {
    poruka = t;
    setTimeout(() => (poruka = null), 3000);
  }

  function oznaka(id: string): string {
    return (podaci && roditeljPoId(podaci, id)?.oznaka) ?? '?';
  }

  let rodjen = $derived(podaci?.karton.find((u) => u.naziv.toLocaleLowerCase('sr') === 'datum rođenja'));
  let starost = $derived(rodjen ? godine(rodjen.vrednost, sada) : null);
  let odeljenje = $derived(podaci?.karton.find((u) => u.grupa === 'skola' && u.naziv === 'Razred i odeljenje'));
  let poGrupi = $derived.by(() => {
    const m = new Map<GrupaKartona, UnosKartona[]>();
    for (const g of GRUPE) m.set(g.kljuc, []);
    for (const u of podaci?.karton ?? []) m.get(u.grupa)?.push(u);
    return m;
  });
  // Layout (2026-11-04): Škola, Zdravlje, Važni kontakti, Mere i
  // veličine in the grid; activities last; basic facts in the header.
  const GLAVNE: GrupaKartona[] = ['skola', 'zdravlje', 'kontakti', 'mere'];

  function grupa(kljuc: GrupaKartona) {
    return GRUPE.find((g) => g.kljuc === kljuc)!;
  }

  /** "uto, čet · svake nedelje · 17:00–18:00" when the activity is in the calendar. */
  function uKalendaru(d: Podaci, naziv: string): string | null {
    const n = naziv.trim().toLocaleLowerCase('sr');
    const dog = d.dogadjaji.find((x) => x.naziv.trim().toLocaleLowerCase('sr') === n);
    if (!dog) return null;
    const vreme = dog.ceoDan ? 'ceo dan' : `${dog.od}–${dog.do}`;
    return dog.ponavljanje.tip === 'ne' ? `${datumKratko(dog.datum)} ${vreme}` : `${opisPonavljanja(dog.ponavljanje)} · ${vreme}`;
  }

  let promene = $derived(podaci ? [...podaci.izmeneKartona].sort((a, b) => b.kada.localeCompare(a.kada)).slice(0, 20) : []);

  function otvori(n: Nacrt) {
    nacrt = n;
    greskaForme = null;
  }

  function izmeni(u: UnosKartona) {
    otvori({
      id: u.id,
      grupa: u.grupa,
      naziv: u.naziv,
      vrednost: jeSpisak(u.grupa) ? '' : u.vrednost,
      detalji: jeSpisak(u.grupa) ? detaljiZapisa(u) : {},
    });
  }

  function dodaj(grupa: GrupaKartona, naziv = '') {
    otvori({ id: null, grupa, naziv, vrednost: '', detalji: {} });
  }

  async function sacuvaj(e: SubmitEvent) {
    e.preventDefault();
    if (!iz || !nacrt) return;
    salje = true;
    greskaForme = null;
    try {
      await iz.sacuvajKarton({ ...nacrt, detalji: { ...nacrt.detalji } });
      nacrt = null;
      await ucitaj();
      javi('Sačuvano. Promena se vidi u „Promenama u kartonu“.');
    } catch (err) {
      greskaForme = err instanceof Error ? err.message : String(err);
    } finally {
      salje = false;
    }
  }

  async function obrisi(id: string) {
    if (!iz) return;
    try {
      await iz.obrisiKarton(id);
      nacrt = null;
      await ucitaj();
      javi('Obrisano. Stara vrednost ostaje u promenama.');
    } catch (err) {
      greskaForme = err instanceof Error ? err.message : String(err);
    }
  }

  function telefonLink(t: string): string {
    return `tel:${t.replace(/[^\d+]/g, '')}`;
  }

  function jeTelefon(t: string): boolean {
    return /^[+\d][\d\s/().-]{5,}$/.test(t.trim());
  }
</script>

{#snippet forma(n: Nacrt)}
  {@const sablon = ZAPISI[n.grupa]}
  <form class="uredi" onsubmit={sacuvaj}>
    {#if sablon}
      <label class="field">
        <span class="label">{sablon.naslov}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" bind:value={n.naziv} placeholder={sablon.placeholder} required autofocus />
      </label>
      {#each sablon.polja as p (p.kljuc)}
        <label class="field">
          <span class="label">{p.naziv}</span>
          {#if p.viseRedova}
            <textarea class="input" rows="2" bind:value={n.detalji[p.kljuc]} placeholder={p.placeholder}></textarea>
          {:else}
            <input class="input" type={p.telefon ? 'tel' : 'text'} bind:value={n.detalji[p.kljuc]} placeholder={p.placeholder} />
          {/if}
        </label>
      {/each}
    {:else}
      {@const predlozi = n.id === null ? nedostaje(n.grupa, podaci?.karton ?? []) : []}
      <input
        class="input"
        bind:value={n.naziv}
        placeholder={predlozi.length ? `Naziv, npr. ${predlozi.slice(0, 3).join(', ')}` : 'Naziv'}
        list={predlozi.length ? `predlozi-${n.grupa}` : undefined}
        required
        aria-label="Naziv polja"
      />
      {#if predlozi.length}
        <datalist id="predlozi-{n.grupa}">
          {#each predlozi as p (p)}<option value={p}></option>{/each}
        </datalist>
      {/if}
      <!-- svelte-ignore a11y_autofocus -->
      <textarea class="input" rows="2" bind:value={n.vrednost} placeholder="Vrednost" required aria-label="Vrednost" autofocus></textarea>
    {/if}
    {#if greskaForme}<p class="error">{greskaForme}</p>{/if}
    <div class="akcije">
      <button class="btn mali" type="submit" disabled={salje}>Sačuvaj</button>
      <button class="btn btn-ghost mali" type="button" onclick={() => (nacrt = null)}>Otkaži</button>
      {#if n.id}
        {@const id = n.id}
        <button class="btn btn-danger mali obrisi" type="button" onclick={() => obrisi(id)}>Obriši</button>
      {/if}
    </div>
  </form>
{/snippet}

{#snippet spisak(d: Podaci, kljuc: GrupaKartona, siroka: boolean)}
  <!-- A list of records: teachers, contacts, friends, activities. As many as needed. -->
  {@const unosi = poGrupi.get(kljuc) ?? []}
  {@const sablon = ZAPISI[kljuc]!}
  <ul class="zapisi" class:mreza-zapisa={siroka}>
    {#each unosi as u (u.id)}
      <li>
        {#if nacrt?.id === u.id}
          {@render forma(nacrt)}
        {:else}
          {@const det = detaljiZapisa(u)}
          <article class="zapis">
            <header class="zapis-glava">
              <h3>{u.naziv}</h3>
              <button class="olovka" aria-label="Izmeni {u.naziv}" disabled={zauzeto} onclick={() => izmeni(u)}>
                <Ikona ime="olovka" velicina={15} />
              </button>
            </header>
            <dl class="zapis-polja">
              {#each sablon.polja as p (p.kljuc)}
                {#if det[p.kljuc]}
                  <div>
                    <dt>{p.naziv}</dt>
                    <dd>
                      {#if p.telefon && jeTelefon(det[p.kljuc])}<a href={telefonLink(det[p.kljuc])}>{det[p.kljuc]}</a>{:else}{det[p.kljuc]}{/if}
                    </dd>
                  </div>
                {/if}
              {/each}
            </dl>
            {#if kljuc === 'aktivnosti' && uKalendaru(d, u.naziv)}
              <a class="kal-veza" href={putanje.kalendar()}><Ikona ime="kalendar" velicina={13} /> U kalendaru: {uKalendaru(d, u.naziv)}</a>
            {/if}
            <span class="meta">{oznaka(u.izmenio)} · {pre(u.izmenjeno, sada)}</span>
          </article>
        {/if}
      </li>
    {/each}
  </ul>
  {#if nacrt?.id === null && nacrt.grupa === kljuc}
    <div class="zapis novi">{@render forma(nacrt)}</div>
  {:else}
    <button class="btn btn-ghost dodaj-zapis" disabled={zauzeto} onclick={() => dodaj(kljuc)}>{sablon.dugme}</button>
  {/if}
{/snippet}

{#snippet grupaSekcija(d: Podaci, g: (typeof GRUPE)[number], i: number, siroka: boolean)}
  {@const unosi = poGrupi.get(g.kljuc) ?? []}
  {@const sablon = ZAPISI[g.kljuc]}
  <section class="card grupa rise" class:siroka style="--i: {1 + i}" aria-labelledby="g-{g.kljuc}">
    <header class="grupa-glava">
      <span class="krug"><Ikona ime={g.ikona} velicina={17} /></span>
      <h2 id="g-{g.kljuc}">{g.naziv}</h2>
      {#if sablon && unosi.length}<span class="broj">{unosi.length}</span>{/if}
      {#if g.kljuc === 'aktivnosti'}
        <a class="u-kalendar" href={putanje.kalendar()}>termini su u kalendaru <Ikona ime="strelica" velicina={13} /></a>
      {/if}
    </header>

    {#if sablon}
      {@render spisak(d, g.kljuc, siroka)}
    {:else}
      <!-- Single facts: one value per field. -->
      {#if unosi.length}
        <dl class="unosi">
          {#each unosi as u (u.id)}
            {#if nacrt?.id === u.id}
              {@render forma(nacrt)}
            {:else}
              <div class="unos">
                <dt>{u.naziv}</dt>
                <dd>
                  <span class="vrednost">{u.vrednost}</span>
                  <span class="meta">{oznaka(u.izmenio)} · {pre(u.izmenjeno, sada)}</span>
                </dd>
                <button class="olovka" aria-label="Izmeni {u.naziv}" disabled={zauzeto} onclick={() => izmeni(u)}>
                  <Ikona ime="olovka" velicina={15} />
                </button>
              </div>
            {/if}
          {/each}
        </dl>
      {:else}
        <p class="prazno">Još ništa upisano.</p>
      {/if}

      {#if nacrt?.id === null && nacrt.grupa === g.kljuc}
        {@render forma(nacrt)}
      {:else}
        <div class="dodaj">
          {#if g.predloziKao === 'lista'}
            <button class="btn btn-ghost dodaj-zapis" disabled={zauzeto} onclick={() => dodaj(g.kljuc)}>+ Dodaj</button>
          {:else}
            {#each nedostaje(g.kljuc, d.karton) as naziv (naziv)}
              <button class="chip chip-toggle" disabled={zauzeto} onclick={() => dodaj(g.kljuc, naziv)}>+ {naziv}</button>
            {/each}
            <button class="chip chip-toggle" disabled={zauzeto} onclick={() => dodaj(g.kljuc)}>+ drugo</button>
          {/if}
        </div>
      {/if}

      {#if g.kljuc === 'skola'}
        <h3 class="podgrupa">Nastavnici</h3>
        {@render spisak(d, 'nastavnici', false)}
      {/if}
    {/if}
  </section>
{/snippet}

{#if greska}
  <p class="error">Podaci nisu učitani: {greska}</p>
{:else if !podaci}
  <p class="loading">Učitavam…</p>
{:else}
  {@const d = podaci}
  <header class="glava card rise" class:zakljucano={zauzeto}>
    <span class="avatar-veliki" aria-hidden="true"><Ikona ime="karton" velicina={26} /></span>
    <span class="glava-tekst">
      <p class="eyebrow">Karton</p>
      <h1>Karton deteta</h1>
      <p class="dim">
        {[starost !== null ? godineTekst(starost) : '', odeljenje ? `odeljenje ${odeljenje.vrednost}` : ''].filter(Boolean).join(' · ')}
      </p>
      <!-- Basic facts (birth date, full name) belong next to the name. -->
      <span class="osnovno">
        {#each poGrupi.get('osnovno') ?? [] as u (u.id)}
          {#if nacrt?.id !== u.id}
            <span class="osnovno-polje">
              <span class="faint">{u.naziv}:</span> <b>{u.vrednost}</b>
              <button class="olovka" aria-label="Izmeni {u.naziv}" disabled={zauzeto} onclick={() => izmeni(u)}>
                <Ikona ime="olovka" velicina={13} />
              </button>
            </span>
          {/if}
        {/each}
        {#if nacrt?.grupa !== 'osnovno'}
          {#each nedostaje('osnovno', d.karton) as naziv (naziv)}
            <button class="chip chip-toggle" disabled={zauzeto} onclick={() => dodaj('osnovno', naziv)}>+ {naziv}</button>
          {/each}
        {/if}
      </span>
      {#if nacrt?.grupa === 'osnovno'}
        <span class="osnovno-forma">{@render forma(nacrt)}</span>
      {/if}
    </span>
  </header>

  <p class="pomoc">
    Oba roditelja mogu da menjaju karton. Svaka promena pamti ko je i kada je napravio, a drugi roditelj je vidi na
    početnoj pod „Novo“.
  </p>

  <div class="grupe" class:zakljucano={zauzeto}>
    {#each GLAVNE as kljuc, i (kljuc)}
      {@render grupaSekcija(d, grupa(kljuc), i, false)}
    {/each}
  </div>

  <!-- Full width below the grid: the timetable, friends, and activities last
       (their times live in the calendar). -->
  <div class="grupe-dno">
    {#if iz}
      <RasporedCasova
        podaci={d}
        izvor={iz}
        zakljucano={nacrt !== null}
        onUredjuje={(o) => (rasporedOtvoren = o)}
        onSacuvano={async (t) => {
          await ucitaj();
          javi(t);
        }}
      />
    {/if}
    <div class:zakljucano={zauzeto}>{@render grupaSekcija(d, grupa('drugari'), GLAVNE.length, true)}</div>
    <div class:zakljucano={zauzeto}>{@render grupaSekcija(d, grupa('aktivnosti'), GLAVNE.length + 1, true)}</div>
  </div>

  {#if zauzeto}
    <p class="zakljucano-poruka" role="status">Prvo sačuvaj ili otkaži otvorenu izmenu.</p>
  {/if}

  {#if promene.length}
    <details class="card promene">
      <summary>Promene u kartonu <span class="faint">poslednjih {promene.length}</span></summary>
      <ul>
        {#each promene as z (z.id)}
          <li>
            <b>{oznaka(z.autor)}</b>
            <span class="dim">
              {#if z.staro === null}
                dodaje „{z.naziv}“: {z.novo}
              {:else if z.novo === null}
                briše „{z.naziv}“ (bilo: {z.staro})
              {:else}
                menja „{z.naziv}“: {z.staro} → {z.novo}
              {/if}
            </span>
            <span class="faint">{pre(z.kada, sada)}</span>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
{/if}

{#if poruka}<div class="poruka" role="status">{poruka}</div>{/if}

<style>
  .glava {
    display: flex;
    align-items: center;
    gap: 1.1rem;
    margin-bottom: 1rem;
  }

  .glava-tekst {
    min-width: 0;
    flex: 1;
  }

  .glava-tekst {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .glava h1 {
    font-size: clamp(2rem, 6vw, 2.8rem);
  }

  /* The site's gradient, as a ring around the child's initial. */
  .avatar-veliki {
    display: grid;
    place-items: center;
    width: clamp(4rem, 14vw, 5.2rem);
    height: clamp(4rem, 14vw, 5.2rem);
    flex-shrink: 0;
    border-radius: 50%;
    font-size: clamp(1.8rem, 6vw, 2.3rem);
    font-weight: 700;
    color: var(--text);
    background:
      linear-gradient(var(--bg-raised), var(--bg-raised)) padding-box,
      linear-gradient(135deg, var(--bio), var(--ai)) border-box;
    border: 3px solid transparent;
  }

  .pomoc {
    font-size: 0.88rem;
    color: var(--text-faint);
    margin-bottom: 1rem;
    max-width: 62ch;
  }

  .grupe {
    display: grid;
    gap: 0.9rem;
    grid-template-columns: minmax(0, 1fr);
  }

  @media (min-width: 860px) {
    .grupe {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }
  }

  .grupa {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .grupe-dno {
    margin-top: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .podgrupa {
    font-size: 0.95rem;
    margin-top: 0.4rem;
    padding-top: 0.7rem;
    border-top: 1px solid var(--border);
  }

  /* Activities: cards side by side across the full width. */
  .zapisi.mreza-zapisa {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
    gap: 0.6rem;
  }

  .mreza-zapisa .zapis-polja div {
    grid-template-columns: 6.6rem 1fr;
  }

  .u-kalendar {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.82rem;
    color: var(--text-dim);
  }

  @media (max-width: 520px) {
    .grupa-glava {
      flex-wrap: wrap;
    }

    .u-kalendar {
      flex-basis: 100%;
      margin-left: 2.6rem;
    }
  }

  .u-kalendar:hover,
  .kal-veza:hover {
    color: var(--bio);
  }

  .kal-veza {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .osnovno {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 1rem;
    margin-top: 0.35rem;
    font-size: 0.9rem;
  }

  .osnovno-polje {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .osnovno-polje b {
    font-weight: 600;
  }

  .osnovno-forma {
    display: block;
    max-width: 32rem;
  }

  .grupa-glava {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .grupa-glava h2 {
    font-size: 1.08rem;
  }

  .broj {
    font-size: 0.8rem;
    color: var(--text-faint);
  }

  .krug {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    color: var(--bio);
    background: var(--bio-soft);
    border: 1px solid var(--bio-line);
    flex-shrink: 0;
  }

  /* ---------- Single facts ---------- */

  .unosi {
    display: flex;
    flex-direction: column;
    margin: 0;
  }

  .unos {
    display: grid;
    grid-template-columns: minmax(6.5rem, 0.6fr) 1fr auto;
    gap: 0.2rem 0.9rem;
    align-items: start;
    padding: 0.6rem 0;
  }

  .unos + .unos,
  .unosi > :global(form) {
    border-top: 1px solid var(--border);
  }

  @media (max-width: 520px) {
    .unos {
      grid-template-columns: 1fr auto;
    }

    .unos dt {
      grid-column: 1 / -1;
    }
  }

  dt {
    font-size: 0.86rem;
    color: var(--text-dim);
  }

  dd {
    margin: 0;
  }

  .unos dd {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .vrednost {
    white-space: pre-wrap;
    font-weight: 500;
  }

  .meta {
    font-size: 0.74rem;
    color: var(--text-faint);
  }

  .olovka {
    color: var(--text-faint);
    padding: 0.2rem;
    border-radius: 6px;
  }

  .olovka:hover:not(:disabled) {
    color: var(--bio);
    background: var(--bio-soft);
  }

  /* ---------- Records (activities, contacts) ---------- */

  .zapisi {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .zapis {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-raised);
  }

  .zapis.novi {
    border-color: var(--bio-line);
  }

  .zapis-glava {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .zapis-glava h3 {
    font-size: 1rem;
  }

  .zapis-polja {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
  }

  .zapis-polja div {
    display: grid;
    grid-template-columns: 7.5rem 1fr;
    gap: 0.6rem;
    font-size: 0.9rem;
  }

  @media (max-width: 520px) {
    .zapis-polja div {
      grid-template-columns: 1fr;
      gap: 0;
    }
  }

  .zapis-polja dd {
    white-space: pre-wrap;
  }

  .zapis-polja a {
    color: var(--bio);
  }

  .dodaj-zapis {
    align-self: flex-start;
    padding: 0.5rem 0.9rem;
    font-size: 0.78rem;
  }

  /* ---------- Forms and locking ---------- */

  .uredi {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.6rem 0;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .obrisi {
    margin-left: auto;
  }

  .mali {
    padding: 0.4rem 0.8rem;
    font-size: 0.74rem;
  }

  .dodaj {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .zakljucano :is(.olovka, .chip-toggle, .dodaj-zapis):disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .zakljucano-poruka {
    position: fixed;
    left: 50%;
    bottom: calc(1.2rem + var(--donja-traka));
    transform: translateX(-50%);
    z-index: 50;
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    font-size: 0.82rem;
    color: var(--warn);
    background: var(--bg-raised);
    border: 1px solid var(--warn-line);
    box-shadow: 0 10px 30px -14px rgba(0, 0, 0, 0.6);
  }

  .prazno {
    color: var(--text-faint);
    font-size: 0.9rem;
  }

  .promene {
    margin-top: 1rem;
  }

  .promene summary {
    cursor: pointer;
    font-weight: 600;
  }

  .promene summary .faint {
    font-weight: 400;
    font-size: 0.85rem;
    margin-left: 0.4rem;
  }

  .promene ul {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-top: 0.8rem;
    font-size: 0.9rem;
  }

  .promene li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.5rem;
  }

  .poruka {
    position: fixed;
    left: 50%;
    bottom: calc(1.5rem + var(--donja-traka));
    transform: translateX(-50%);
    z-index: 1100;
    max-width: min(92vw, 28rem);
    padding: 0.7rem 1rem;
    border-radius: var(--radius-sm);
    background: var(--text);
    color: var(--bg);
    font-size: 0.9rem;
    box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.6);
  }
</style>
