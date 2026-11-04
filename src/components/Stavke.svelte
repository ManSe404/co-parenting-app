<script lang="ts">
  import { onMount } from 'svelte';
  import { izvor as dajIzvor, type Izvor } from '../lib/izvor';
  import { cekaDrugog, jeHitno, jeVazno, kaoDatum, naPotezu, poHitnosti } from '../lib/domen';
  import { brojStavki } from '../lib/format';
  import { preuzmi, uCsv } from '../lib/izvoz';
  import type { Podaci, Stavka } from '../lib/tipovi';
  import IstorijaDogovora from './IstorijaDogovora.svelte';
  import ListaStavki from './ListaStavki.svelte';
  import Tabla from './Tabla.svelte';

  type Prikaz = 'tabla' | 'lista' | 'istorija';
  type Filter = { stanje: string; oblast: string; oznaka: string; ceka: string; q: string };

  const KLJUC_PRIKAZA = 'coparenting.prikaz';
  const sada = new Date();

  // Rendered client-only, so the URL is readable during setup.
  const u = new URLSearchParams(location.search);

  const PRIKAZI: Prikaz[] = ['tabla', 'lista', 'istorija'];
  const jePrikaz = (v: string | null): v is Prikaz => PRIKAZI.includes(v as Prikaz);

  // The board or the list is remembered per device; history is opened on purpose.
  function sacuvaniPrikaz(): Prikaz {
    try {
      return localStorage.getItem(KLJUC_PRIKAZA) === 'lista' ? 'lista' : 'tabla';
    } catch {
      return 'tabla';
    }
  }

  const izUrl = u.get('prikaz');
  let prikaz = $state<Prikaz>(jePrikaz(izUrl) ? izUrl : u.get('stanje') ? 'lista' : sacuvaniPrikaz());
  let f = $state<Filter>({
    stanje: u.get('stanje') ?? '',
    oblast: u.get('oblast') ?? '',
    oznaka: u.get('oznaka') ?? '',
    ceka: u.get('ceka') ?? '',
    q: u.get('q') ?? '',
  });

  let iz: Izvor | null = $state(null);
  let podaci = $state<Podaci | null>(null);
  let greska = $state<string | null>(null);

  async function ucitaj() {
    iz ??= await dajIzvor();
    podaci = await iz.ucitaj();
  }

  onMount(async () => {
    try {
      await ucitaj();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  });

  // Keep the URL in sync so a filtered view can be bookmarked or shared.
  $effect(() => {
    const par = new URLSearchParams();
    if (prikaz !== 'tabla') par.set('prikaz', prikaz);
    if (prikaz !== 'istorija') {
      for (const [k, v] of Object.entries(f)) {
        if (v && !(k === 'stanje' && prikaz === 'tabla')) par.set(k, v);
      }
    }
    const q = par.toString();
    history.replaceState(null, '', q ? `?${q}` : location.pathname);
    if (prikaz === 'istorija') return;
    try {
      localStorage.setItem(KLJUC_PRIKAZA, prikaz);
    } catch {
      /* per-device convenience only */
    }
  });

  function prolazi(s: Stavka, d: Podaci): boolean {
    if (prikaz === 'lista' && (f.stanje ? s.stanje !== f.stanje : s.stanje === 'zatvoreno')) return false;
    if (f.oblast && s.oblast !== f.oblast) return false;
    if (f.oznaka === 'hitno' && !jeHitno(s, sada)) return false;
    if (f.oznaka === 'vazno' && !jeVazno(s)) return false;
    if (f.ceka === 'ja' && !naPotezu(s, d.ja.id)) return false;
    if (f.ceka === 'drugi' && !cekaDrugog(s, d.ja.id)) return false;
    if (f.q) {
      const q = f.q.toLocaleLowerCase('sr');
      const tekst = `${s.naslov} ${s.opis} ${s.odluka ?? ''}`.toLocaleLowerCase('sr');
      if (!tekst.includes(q)) return false;
    }
    return true;
  }

  let rezultat = $derived.by(() => {
    if (!podaci) return [];
    const d = podaci;
    const r = d.stavke.filter((s) => prolazi(s, d));
    return f.stanje === 'zatvoreno'
      ? r.sort((a, b) => (b.zatvoreno ?? '').localeCompare(a.zatvoreno ?? ''))
      : r.sort(poHitnosti(sada));
  });

  let aktivnihFiltera = $derived([f.oblast, f.oznaka, f.ceka, f.q].filter(Boolean).length);
  // Open at start when the URL already filters; afterwards the user decides.
  let filteriOtvoreni = $state(Boolean(u.get('oblast') || u.get('oznaka') || u.get('ceka') || u.get('q') || u.get('stanje')));

  function prebaci(kljuc: keyof Filter, vrednost: string) {
    f[kljuc] = f[kljuc] === vrednost ? '' : vrednost;
  }

  function ocistiFiltere() {
    f = { stanje: f.stanje, oblast: '', oznaka: '', ceka: '', q: '' };
  }

  function izvezi() {
    if (podaci) preuzmi(`stavke-${kaoDatum(sada)}.csv`, uCsv(rezultat, podaci));
  }

  const STANJA = [
    ['', 'Aktivne'],
    ['neodgovoreno', 'Neodgovoreno'],
    ['otvoreno', 'Otvoreno'],
    ['zatvoreno', 'Zatvoreno'],
  ] as const;
</script>

<header class="glava">
  <div class="naslovi">
    <p class="eyebrow">Stavke</p>
    <h1>{{ tabla: 'Tabla', lista: 'Lista', istorija: 'Istorija dogovora' }[prikaz]}</h1>
  </div>
  <div class="prekidac" role="group" aria-label="Prikaz">
    <button class="chip chip-toggle" aria-pressed={prikaz === 'tabla'} onclick={() => (prikaz = 'tabla')}>Tabla</button>
    <button class="chip chip-toggle" aria-pressed={prikaz === 'lista'} onclick={() => (prikaz = 'lista')}>Lista</button>
    <button class="chip chip-toggle" aria-pressed={prikaz === 'istorija'} onclick={() => (prikaz = 'istorija')}>Istorija</button>
  </div>
</header>

{#if greska}
  <p class="error">Podaci nisu učitani: {greska}</p>
{:else if !podaci || !iz}
  <p class="loading">Učitavam…</p>
{:else}
  {@const d = podaci}
  {#if prikaz === 'istorija'}
    <IstorijaDogovora podaci={d} />
  {:else}
  <details class="filteri card" bind:open={filteriOtvoreni}>
    <summary>
      <span>Filteri{#if aktivnihFiltera}<span class="mehur">{aktivnihFiltera}</span>{/if}</span>
      {#if aktivnihFiltera}
        <button
          class="ocisti"
          onclick={(e) => {
            e.preventDefault();
            ocistiFiltere();
          }}>očisti</button
        >
      {/if}
    </summary>
    <div class="filteri-telo">
      <input class="input pretraga" type="search" placeholder="Pretraga naslova, opisa i odluka" bind:value={f.q} />

      {#if prikaz === 'lista'}
        <div class="red-filtera">
          <span class="label">Stanje</span>
          <div class="chips">
            {#each STANJA as [v, naziv] (v)}
              <button class="chip chip-toggle" aria-pressed={f.stanje === v} onclick={() => (f.stanje = v)}>{naziv}</button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="red-filtera">
        <span class="label">Oblast</span>
        <div class="chips">
          {#each d.oblasti as o (o.kljuc)}
            <button class="chip chip-toggle" aria-pressed={f.oblast === o.kljuc} onclick={() => prebaci('oblast', o.kljuc)}>
              {o.naziv}
            </button>
          {/each}
        </div>
      </div>

      <div class="red-filtera">
        <span class="label">Još</span>
        <div class="chips">
          <button class="chip chip-toggle" aria-pressed={f.oznaka === 'hitno'} onclick={() => prebaci('oznaka', 'hitno')}>Hitno</button>
          <button class="chip chip-toggle" aria-pressed={f.oznaka === 'vazno'} onclick={() => prebaci('oznaka', 'vazno')}>Važno</button>
          <button class="chip chip-toggle" aria-pressed={f.ceka === 'ja'} onclick={() => prebaci('ceka', 'ja')}>Čeka mene</button>
          <button class="chip chip-toggle" aria-pressed={f.ceka === 'drugi'} onclick={() => prebaci('ceka', 'drugi')}>
            Čeka {d.drugi.oznakaAkuzativ}
          </button>
        </div>
      </div>
    </div>
  </details>

  {#if prikaz === 'tabla'}
    <Tabla podaci={d} stavke={rezultat} izvor={iz} onPromena={ucitaj} />
  {:else}
    <div class="traka">
      <span class="faint">{brojStavki(rezultat.length)}</span>
      <button class="btn btn-ghost izvoz" onclick={izvezi} disabled={rezultat.length === 0}>Izvezi CSV</button>
    </div>
    <ListaStavki podaci={d} stavke={rezultat} />
  {/if}
  {/if}
{/if}

<style>
  .glava {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.1rem;
  }

  .naslovi {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .prekidac {
    display: flex;
    gap: 0.3rem;
  }

  .filteri {
    margin-bottom: 1rem;
    padding: 0;
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.1rem;
    cursor: pointer;
    font-size: 0.92rem;
    color: var(--text-dim);
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary > span {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  summary > span::before {
    content: '▸';
    color: var(--text-faint);
    transition: transform 0.2s var(--ease);
  }

  .filteri[open] summary > span::before {
    transform: rotate(90deg);
  }

  .mehur {
    display: inline-grid;
    place-items: center;
    min-width: 1.3rem;
    height: 1.3rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    font-size: 0.72rem;
    background: var(--bio-soft);
    color: var(--bio);
    border: 1px solid var(--bio-line);
  }

  .ocisti {
    font-size: 0.8rem;
    color: var(--text-faint);
  }

  .ocisti:hover {
    color: var(--text);
  }

  .filteri-telo {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0 1.1rem 1.1rem;
  }

  .red-filtera {
    display: grid;
    grid-template-columns: 4.5rem 1fr;
    align-items: baseline;
    gap: 0.5rem;
  }

  .red-filtera .label {
    font-size: 0.64rem;
  }

  @media (max-width: 520px) {
    .red-filtera {
      grid-template-columns: 1fr;
    }
  }

  .traka {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.7rem;
    font-size: 0.85rem;
  }

  .izvoz {
    padding: 0.4rem 0.8rem;
    font-size: 0.74rem;
  }
</style>
