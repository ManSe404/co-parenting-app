<script lang="ts">
  // One document: the picture or PDF, its details and trail, and the actions
  // (open, download, edit, delete or restore).
  import { onMount } from 'svelte';
  import { type Dokument, TIPOVI, type ZahtevBrisanja, glagol, imeFajla, kategorija, opisTraga, velicinaTekst } from '../lib/dokumenti';
  import type { DokumentiIzvor } from '../lib/dokumenti-izvor';
  import { datumSaGodinom, pre, trenutakSaGodinom } from '../lib/format';
  import DokumentPolja, { type PoljaDokumenta } from './DokumentPolja.svelte';
  import Ikona from './Ikona.svelte';

  interface Props {
    iz: DokumentiIzvor;
    dokument: Dokument;
    /** An open proposal to delete it for good, if any. */
    zahtev: ZahtevBrisanja | null;
    ja: string;
    oznake: Record<string, string>;
    drugi: string;
    onPromena: (poruka: string) => Promise<void>;
    onZatvori: () => void;
  }

  let { iz, dokument: d, zahtev, ja, oznake, drugi, onPromena, onZatvori }: Props = $props();

  let dijalog: HTMLDialogElement;
  let adresa = $state<string | null>(null);
  let rezim = $state<'pregled' | 'izmena' | 'brisanje'>('pregled');
  let polja = $state<PoljaDokumenta>({ naziv: '', kategorija: null, datum: '', napomena: '' });
  let radi = $state(false);
  let greska = $state<string | null>(null);

  const k = $derived(kategorija(d.kategorija));
  const slika = $derived(d.tip.startsWith('image/'));
  const ko = (id: string | null) => (id ? (oznake[id] ?? '?') : '?');

  onMount(async () => {
    dijalog.showModal();
    try {
      adresa = await iz.adresa(d);
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  });

  async function uradi(posao: () => Promise<void>, poruka: string) {
    radi = true;
    greska = null;
    try {
      await posao();
      rezim = 'pregled';
      await onPromena(poruka);
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      radi = false;
    }
  }

  function pocniIzmenu() {
    polja = { naziv: d.naziv, kategorija: d.kategorija, datum: d.datum ?? '', napomena: d.napomena };
    greska = null;
    rezim = 'izmena';
  }

  function sacuvajIzmenu(e: SubmitEvent) {
    e.preventDefault();
    if (!polja.kategorija) return;
    const kat = polja.kategorija;
    uradi(() => iz.izmeni(d.id, { naziv: polja.naziv, kategorija: kat, datum: polja.datum || null, napomena: polja.napomena }), 'Izmene su sačuvane.');
  }

  async function preuzmi() {
    try {
      const a = document.createElement('a');
      a.href = await iz.adresa(d, true);
      a.download = imeFajla(d);
      a.rel = 'noopener';
      document.body.append(a);
      a.click();
      a.remove();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<dialog bind:this={dijalog} class="dijalog pregled" style="--sirina-dijaloga: 62rem" onclose={onZatvori}>
  <div class="glava">
    <div class="naslov">
      <span class="kat" style="--boja: {k.boja}"><Ikona ime={k.ikona} velicina={14} />{k.naziv}</span>
      <h2>{d.naziv}</h2>
    </div>
    <button class="zatvori" type="button" aria-label="Zatvori" onclick={() => dijalog.close()}>×</button>
  </div>

  {#if d.obrisan}
    <div class="obrisan-traka" role="status">
      <span>
        {opisTraga('obrisan', d.obrisao ?? '?', ja, ko(d.obrisao))}
        {pre(d.obrisan, new Date())}.
        {#if zahtev?.stanje === 'odobreno'}
          Oboje ste potvrdili trajno brisanje.
        {:else if zahtev}
          {ko(zahtev.predlozio)} je {glagol('otpremljen', zahtev.predlozio).replace('dodal', 'predložil')} trajno brisanje; odgovara se u „Obrisani“.
        {:else}
          Fajl je sačuvan i dokument može da se vrati.
        {/if}
      </span>
      {#if zahtev?.stanje !== 'odobreno'}
        <button class="btn" disabled={radi} onclick={() => uradi(() => iz.vrati(d.id), 'Dokument je vraćen.')}>
          <Ikona ime="vrati" velicina={15} />
          Vrati
        </button>
      {/if}
    </div>
  {/if}

  <div class="sadrzaj">
    <div class="prikaz" class:slika>
      {#if !adresa}
        <p class="loading">Otvaram…</p>
      {:else if slika}
        <img src={adresa} alt={d.naziv} />
      {:else}
        <iframe class="pdf-okvir" src={`${adresa}#navpanes=0`} title={d.naziv}></iframe>
        <div class="pdf-telefon">
          <Ikona ime="dokument" velicina={40} />
          <p>PDF se otvara u novoj kartici.</p>
          <a class="btn" href={adresa} target="_blank" rel="noopener">Otvori PDF</a>
        </div>
      {/if}
    </div>

    <aside class="detalji">
      {#if rezim === 'izmena'}
        <form class="izmena" onsubmit={sacuvajIzmenu}>
          <DokumentPolja bind:polja />
          <div class="akcije">
            <button class="btn" type="submit" disabled={radi || !polja.naziv.trim() || !polja.kategorija}>Sačuvaj</button>
            <button class="btn btn-ghost" type="button" onclick={() => (rezim = 'pregled')}>Otkaži</button>
          </div>
        </form>
      {:else}
        <dl>
          {#if d.datum}
            <div><dt>Datum na dokumentu</dt><dd>{datumSaGodinom(d.datum)}</dd></div>
          {/if}
          {#if d.napomena}
            <div><dt>Napomena</dt><dd>{d.napomena}</dd></div>
          {/if}
          <div><dt>Fajl</dt><dd class="mono">{TIPOVI[d.tip].naziv} · {velicinaTekst(d.velicina)}</dd></div>
        </dl>

        <div class="trag">
          <span class="label">Trag</span>
          <ol>
            {#each [...d.trag].reverse() as t, i (i)}
              <li>
                <span class="tacka" class:moje={t.ko === ja}></span>
                <span>{opisTraga(t.vrsta, t.ko, ja, ko(t.ko))}</span>
                <span class="faint">{trenutakSaGodinom(t.kada)}</span>
              </li>
            {/each}
          </ol>
        </div>

        {#if rezim === 'brisanje'}
          <div class="potvrda" role="alert">
            <p>
              Obrisati „{d.naziv}“? {drugi} će videti da si ga {glagol('obrisan', ja)} i moći će da ga vrati. Fajl ostaje sačuvan.
            </p>
            <div class="akcije">
              <button class="btn btn-danger" disabled={radi} onclick={() => uradi(() => iz.obrisi(d.id), 'Dokument je obrisan. Može da se vrati iz „Obrisani“.')}>
                Da, obriši
              </button>
              <button class="btn btn-ghost" onclick={() => (rezim = 'pregled')}>Ne</button>
            </div>
          </div>
        {:else}
          <div class="dugmad">
            {#if adresa}
              <a class="btn btn-ghost" href={adresa} target="_blank" rel="noopener"><Ikona ime="spolja" velicina={15} />Otvori</a>
            {/if}
            <button class="btn btn-ghost" onclick={preuzmi}><Ikona ime="preuzmi" velicina={15} />Preuzmi</button>
            {#if !d.obrisan}
              <button class="btn btn-ghost" onclick={pocniIzmenu}><Ikona ime="olovka" velicina={15} />Izmeni</button>
              <button class="btn btn-danger" onclick={() => (rezim = 'brisanje')}><Ikona ime="kanta" velicina={15} />Obriši</button>
            {/if}
          </div>
        {/if}
      {/if}

      {#if greska}
        <p class="error" role="alert">{greska}</p>
      {/if}
    </aside>
  </div>
</dialog>

<style>
  .glava {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.2rem 1.4rem 0.9rem;
    border-bottom: 1px solid var(--border);
  }

  .naslov {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  h2 {
    font-size: 1.3rem;
    overflow-wrap: anywhere;
  }

  .kat {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .kat :global(svg) {
    color: var(--boja);
  }

  .zatvori {
    font-size: 1.6rem;
    line-height: 1;
    color: var(--text-dim);
    padding: 0.1rem 0.5rem;
  }

  .obrisan-traka {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 1rem;
    padding: 0.7rem 1.4rem;
    font-size: 0.9rem;
    color: var(--warn);
    background: var(--warn-soft);
    border-bottom: 1px solid var(--warn-line);
  }

  .sadrzaj {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 19rem;
  }

  .prikaz {
    display: grid;
    place-items: center;
    min-height: 20rem;
    background: color-mix(in srgb, var(--text) 4%, transparent);
    border-right: 1px solid var(--border);
  }

  .prikaz img {
    max-width: 100%;
    max-height: 72dvh;
    object-fit: contain;
  }

  .pdf-okvir {
    width: 100%;
    height: 72dvh;
    border: 0;
    background: #fff;
  }

  .pdf-telefon {
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    padding: 2rem 1rem;
    color: var(--text-dim);
    text-align: center;
  }

  .detalji {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    padding: 1.2rem 1.4rem 1.4rem;
  }

  dl {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  dt {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin-bottom: 0.15rem;
  }

  dd {
    font-size: 0.95rem;
    overflow-wrap: anywhere;
  }

  .trag {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .trag ol {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    font-size: 0.85rem;
  }

  .trag li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 0.55rem;
    align-items: baseline;
  }

  .trag li .faint {
    grid-column: 2;
    font-size: 0.78rem;
  }

  .tacka {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ai);
    transform: translateY(-1px);
  }

  .tacka.moje {
    background: var(--bio);
  }

  .dugmad {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .dugmad .btn {
    padding: 0.55rem 0.85rem;
  }

  .potvrda {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 0.9rem;
    font-size: 0.9rem;
    border: 1px solid var(--hitno-line);
    border-radius: var(--radius-sm);
    background: var(--hitno-soft);
  }

  .izmena {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  /* Narrow screens: picture on top, details below. Phones show PDFs in their
     own viewer, so the frame becomes an "Open PDF" button. */
  @media (max-width: 760px) {
    .sadrzaj {
      grid-template-columns: minmax(0, 1fr);
    }

    .prikaz {
      min-height: 12rem;
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    .prikaz img {
      max-height: 55dvh;
    }

    .pdf-okvir {
      display: none;
    }

    .pdf-telefon {
      display: flex;
    }
  }
</style>
