<script lang="ts">
  // Documents: scans, certificates, findings, PDFs and photos. Both parents add;
  // nothing disappears (deleted documents wait under "Obrisani").
  import { onMount } from 'svelte';
  import {
    type Dokument,
    KATEGORIJE,
    type KategorijaKljuc,
    type ZahtevBrisanja,
    aktivni,
    brojDokumenata,
    brojPoKategoriji,
    cekajuMene,
    kategorija,
    obrisani,
    otvorenZahtev,
    velicinaTekst,
  } from '../lib/dokumenti';
  import { type DokumentiIzvor, dokumentiIzvor } from '../lib/dokumenti-izvor';
  import { datumSaGodinom, pre } from '../lib/format';
  import { izvor } from '../lib/izvor';
  import DokumentDodaj from './DokumentDodaj.svelte';
  import DokumentPregled from './DokumentPregled.svelte';
  import Ikona from './Ikona.svelte';
  import ObrisaniDokumenti from './ObrisaniDokumenti.svelte';

  let iz = $state<DokumentiIzvor | null>(null);
  let lista = $state<Dokument[]>([]);
  let zahtevi = $state<ZahtevBrisanja[]>([]);
  let obrisaniOtvoreni = $state(false);
  let adrese = $state<Map<string, string>>(new Map());
  let ucitano = $state(false);
  let greska = $state<string | null>(null);

  let ja = $state('tata');
  let oznake = $state<Record<string, string>>({ tata: 'Tata', mama: 'Mama' });
  let drugi = $state('Mama');
  let videoOd = $state<string | null>(null);

  let filter = $state<KategorijaKljuc | null>(null);
  let upit = $state('');
  let dodaje = $state(false);
  let otvorenId = $state<string | null>(null);
  let poruka = $state<string | null>(null);
  let tajmer: ReturnType<typeof setTimeout> | undefined;

  const prikazani = $derived(aktivni(lista, { kategorija: filter, upit }));
  const izbrisani = $derived(obrisani(lista));
  const brojevi = $derived(brojPoKategoriji(lista));
  const ukupno = $derived(lista.filter((d) => !d.obrisan).length);
  const otvoren = $derived(lista.find((d) => d.id === otvorenId) ?? null);
  const naMeni = $derived(cekajuMene(zahtevi, ja));
  const sada = new Date();

  function javi(tekst: string) {
    poruka = tekst;
    clearTimeout(tajmer);
    tajmer = setTimeout(() => (poruka = null), 4500);
  }

  async function osvezi() {
    if (!iz) return;
    [lista, zahtevi] = await Promise.all([iz.lista(), iz.brisanja()]);
    const slike = lista.filter((d) => d.tip.startsWith('image/'));
    try {
      adrese = await iz.adrese(slike);
    } catch {
      /* thumbnails are optional; the viewer fetches its own address */
    }
  }

  onMount(async () => {
    try {
      const [d, podaci] = await Promise.all([dokumentiIzvor(), izvor().then((i) => i.ucitaj())]);
      ja = podaci.ja.id;
      drugi = podaci.drugi.oznaka;
      oznake = { [podaci.ja.id]: podaci.ja.oznaka, [podaci.drugi.id]: podaci.drugi.oznaka };
      videoOd = podaci.videoOd;
      iz = d;
      await osvezi();
      const trazen = new URLSearchParams(location.search).get('d');
      if (trazen && lista.some((x) => x.id === trazen)) otvorenId = trazen;
      if (new URLSearchParams(location.search).has('obrisani')) pokaziObrisane();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      ucitano = true;
    }
  });

  function otvori(id: string | null) {
    otvorenId = id;
    const url = new URL(location.href);
    if (id) url.searchParams.set('d', id);
    else url.searchParams.delete('d');
    history.replaceState(null, '', url);
  }

  const novo = (d: Dokument) => d.otpremio !== ja && videoOd !== null && d.otpremljeno > videoOd;

  function pokaziObrisane() {
    obrisaniOtvoreni = true;
    requestAnimationFrame(() => document.getElementById('obrisani')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
</script>

<header class="glava rise">
  <div class="naslov">
    <p class="eyebrow">Dokumenti</p>
    <h1>Potvrde, nalazi, skenovi</h1>
    {#if ucitano && !greska}
      <p class="dim">{brojDokumenata(ukupno)} · vidite ih samo vas dvoje</p>
    {/if}
  </div>
  {#if iz}
    <button class="btn dodaj" onclick={() => (dodaje = true)}>
      <Ikona ime="otpremi" velicina={16} />
      Dodaj dokument
    </button>
  {/if}
</header>

{#if poruka}
  <p class="poruka" role="status">{poruka}</p>
{/if}

{#if naMeni.length}
  <div class="ceka-te" role="status">
    <span>
      {#if naMeni.length === 1}
        <b>{oznake[naMeni[0].predlozio] ?? '?'} predlaže trajno brisanje</b> dokumenta „{naMeni[0].naziv}“. Čeka tvoju potvrdu.
      {:else}
        <b>{oznake[naMeni[0].predlozio] ?? '?'} predlaže trajno brisanje {naMeni.length} dokumenta.</b> Čeka tvoju potvrdu.
      {/if}
    </span>
    <button class="btn btn-ghost" onclick={pokaziObrisane}>Pogledaj</button>
  </div>
{/if}

{#if !ucitano}
  <p class="loading">Učitavam dokumente…</p>
{:else if greska}
  <p class="error" role="alert">{greska}</p>
{:else if ukupno === 0 && izbrisani.length === 0 && !zahtevi.some((z) => z.stanje === 'obrisano')}
  <section class="card prazno rise" style="--i: 1">
    <span class="krug"><Ikona ime="dokument" velicina={26} /></span>
    <h2>Još nema dokumenata</h2>
    <p class="dim">
      Ovde stoje potvrde iz škole, lekarski nalazi, računi i ostali papiri, da ih oboje imate pri ruci. Na telefonu
      potvrdu možeš odmah da slikaš.
    </p>
    <button class="btn" onclick={() => (dodaje = true)}><Ikona ime="otpremi" velicina={16} />Dodaj prvi dokument</button>
  </section>
{:else}
  <div class="alati rise" style="--i: 1">
    <label class="pretraga">
      <Ikona ime="pretraga" velicina={16} />
      <input class="input" type="search" bind:value={upit} placeholder="Pretraži naziv ili napomenu" aria-label="Pretraga dokumenata" />
    </label>
    <div class="chips" role="group" aria-label="Kategorije">
      <button class="chip chip-toggle" aria-pressed={filter === null} onclick={() => (filter = null)}>Sve · {ukupno}</button>
      {#each KATEGORIJE.filter((k) => brojevi.get(k.kljuc) || filter === k.kljuc) as k (k.kljuc)}
        <button class="chip chip-toggle kat" style="--boja: {k.boja}" aria-pressed={filter === k.kljuc} onclick={() => (filter = filter === k.kljuc ? null : k.kljuc)}>
          <span class="tacka"></span>{k.naziv} · {brojevi.get(k.kljuc) ?? 0}
        </button>
      {/each}
    </div>
  </div>

  {#if prikazani.length}
    <ul class="mreza rise" style="--i: 2">
      {#each prikazani as d (d.id)}
        {@const k = kategorija(d.kategorija)}
        <li>
          <button class="dok" style="--boja: {k.boja}" onclick={() => otvori(d.id)}>
            <span class="slicica">
              {#if d.tip.startsWith('image/') && adrese.get(d.id)}
                <img src={adrese.get(d.id)} alt="" loading="lazy" />
              {:else}
                <span class="pdf"><Ikona ime={d.tip === 'application/pdf' ? 'dokument' : 'slika'} velicina={30} /><span class="mono">{d.tip === 'application/pdf' ? 'PDF' : ''}</span></span>
              {/if}
              {#if novo(d)}
                <span class="chip chip-warn novo">novo</span>
              {/if}
            </span>
            <span class="telo">
              <span class="naziv">{d.naziv}</span>
              <span class="meta"><span class="tacka"></span>{k.naziv}{d.datum ? ` · ${datumSaGodinom(d.datum)}` : ''}</span>
              <span class="ko faint">{oznake[d.otpremio] ?? '?'} · {pre(d.otpremljeno, sada)} · {velicinaTekst(d.velicina)}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="nema">
      <p class="dim">Nijedan dokument ne odgovara.</p>
      <button class="btn btn-ghost" onclick={() => ((filter = null), (upit = ''))}>Prikaži sve</button>
    </div>
  {/if}

  {#if iz}
    <ObrisaniDokumenti
      {iz}
      {izbrisani}
      {zahtevi}
      {ja}
      {oznake}
      {drugi}
      bind:otvoreno={obrisaniOtvoreni}
      onPromena={async (tekst) => {
        await osvezi();
        javi(tekst);
      }}
      onOtvori={otvori}
    />
  {/if}
{/if}

{#if dodaje && iz}
  <DokumentDodaj
    {iz}
    pocetnaKategorija={filter}
    onDodat={async (d) => {
      await osvezi();
      javi(`„${d.naziv}“ je dodat. ${drugi} ga sada vidi.`);
    }}
    onZatvori={() => (dodaje = false)}
  />
{/if}

{#if otvoren && iz}
  <DokumentPregled
    {iz}
    dokument={otvoren}
    zahtev={otvorenZahtev(zahtevi, otvoren.id)}
    {ja}
    {oznake}
    {drugi}
    onPromena={async (tekst) => {
      await osvezi();
      javi(tekst);
    }}
    onZatvori={() => otvori(null)}
  />
{/if}

<style>
  .glava {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.3rem;
  }

  .naslov {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .poruka {
    margin-bottom: 1rem;
    padding: 0.6rem 0.9rem;
    font-size: 0.9rem;
    color: var(--bio);
    background: var(--bio-soft);
    border: 1px solid var(--bio-line);
    border-radius: var(--radius-sm);
  }

  .prazno {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.8rem;
    max-width: 40rem;
    border-style: dashed;
  }

  .krug {
    display: grid;
    place-items: center;
    width: 3.2rem;
    height: 3.2rem;
    border-radius: 50%;
    color: var(--bio);
    background: var(--bio-soft);
    border: 1px solid var(--bio-line);
  }

  .alati {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    margin-bottom: 1.2rem;
  }

  .pretraga {
    position: relative;
    max-width: 26rem;
    color: var(--text-faint);
  }

  .pretraga :global(svg) {
    position: absolute;
    left: 0.8rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .pretraga .input {
    padding-left: 2.3rem;
  }

  .kat {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .tacka {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--boja);
  }

  .mreza {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
    gap: 0.9rem;
  }

  .dok {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 0;
    text-align: left;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 0.2s var(--ease), transform 0.2s var(--ease);
  }

  .dok:hover {
    border-color: var(--boja);
    transform: translateY(-2px);
  }

  .dok:focus-visible {
    outline: 2px solid var(--boja);
    outline-offset: 2px;
  }

  .slicica {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    height: 9rem;
    overflow: hidden;
    background: color-mix(in srgb, var(--boja) 9%, transparent);
    border-bottom: 1px solid var(--border);
  }

  .slicica img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }

  .pdf {
    display: grid;
    justify-items: center;
    gap: 0.2rem;
    color: var(--boja);
    font-size: 0.7rem;
    letter-spacing: 0.1em;
  }

  .novo {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--bg-raised);
  }

  .telo {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.8rem 0.9rem 0.9rem;
  }

  .naziv {
    font-weight: 500;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: var(--text-dim);
  }

  .ko {
    font-size: 0.78rem;
  }

  .nema {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.8rem;
    padding: 1.5rem 0;
  }

  .ceka-te {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 1rem;
    margin-bottom: 1.2rem;
    padding: 0.75rem 1rem;
    font-size: 0.92rem;
    border: 1px solid var(--warn-line);
    border-radius: var(--radius-sm);
    background: var(--warn-soft);
  }

  .ceka-te b {
    color: var(--warn);
  }

  .ceka-te .btn {
    padding: 0.45rem 0.85rem;
  }

  @media (max-width: 680px) {
    .dodaj {
      width: 100%;
    }

    .mreza {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
    }

    .slicica {
      height: 7rem;
    }

    .telo {
      padding: 0.65rem 0.7rem 0.75rem;
    }

    .ko {
      font-size: 0.72rem;
    }
  }
</style>
