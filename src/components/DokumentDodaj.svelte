<script lang="ts">
  // Adding a document: take a photo (phone) or pick a PDF or picture, then
  // name it and file it under a category.
  import { onDestroy, onMount } from 'svelte';
  import { type Dokument, type KategorijaKljuc, type TipFajla, TIPOVI, nazivIzFajla, velicinaTekst } from '../lib/dokumenti';
  import type { DokumentiIzvor } from '../lib/dokumenti-izvor';
  import { pripremi } from '../lib/slike';
  import DokumentPolja, { type PoljaDokumenta } from './DokumentPolja.svelte';
  import Ikona from './Ikona.svelte';

  interface Props {
    iz: DokumentiIzvor;
    pocetnaKategorija: KategorijaKljuc | null;
    onDodat: (d: Dokument) => void;
    onZatvori: () => void;
  }

  let { iz, pocetnaKategorija, onDodat, onZatvori }: Props = $props();

  let dijalog: HTMLDialogElement;
  let fajl = $state<{ blob: Blob; tip: TipFajla; ime: string; pregled: string | null } | null>(null);
  let polja = $state<PoljaDokumenta>({ naziv: '', kategorija: null, datum: '', napomena: '' });
  let radi = $state<'priprema' | 'slanje' | null>(null);
  let greska = $state<string | null>(null);
  let iznad = $state(false);

  onMount(() => {
    polja.kategorija = pocetnaKategorija;
    dijalog.showModal();
  });

  onDestroy(() => {
    if (fajl?.pregled) URL.revokeObjectURL(fajl.pregled);
  });

  async function uzmi(f: File | undefined) {
    if (!f) return;
    greska = null;
    radi = 'priprema';
    try {
      const { fajl: blob, tip } = await pripremi(f);
      if (fajl?.pregled) URL.revokeObjectURL(fajl.pregled);
      fajl = { blob, tip, ime: f.name, pregled: tip.startsWith('image/') ? URL.createObjectURL(blob) : null };
      if (!polja.naziv.trim()) polja.naziv = nazivIzFajla(f.name);
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      radi = null;
    }
  }

  function naIzbor(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    uzmi(f);
  }

  function naSpustanje(e: DragEvent) {
    e.preventDefault();
    iznad = false;
    uzmi(e.dataTransfer?.files?.[0]);
  }

  async function sacuvaj(e: SubmitEvent) {
    e.preventDefault();
    if (!fajl || !polja.kategorija) return;
    greska = null;
    radi = 'slanje';
    try {
      const d = await iz.otpremi(fajl.blob, fajl.tip, {
        naziv: polja.naziv,
        kategorija: polja.kategorija,
        datum: polja.datum || null,
        napomena: polja.napomena,
      });
      onDodat(d);
      dijalog.close();
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      radi = null;
    }
  }

  const spremno = $derived(Boolean(fajl && polja.naziv.trim() && polja.kategorija && !radi));
</script>

<dialog bind:this={dijalog} class="dijalog" style="--sirina-dijaloga: 36rem" onclose={onZatvori}>
  <form method="dialog" onsubmit={sacuvaj}>
    <div class="glava">
      <h2>Novi dokument</h2>
      <button class="zatvori" type="button" aria-label="Zatvori" onclick={() => dijalog.close()}>×</button>
    </div>

    {#if fajl}
      <div class="izabran">
        {#if fajl.pregled}
          <img src={fajl.pregled} alt="Izabrana slika" />
        {:else}
          <span class="pdf"><Ikona ime="dokument" velicina={26} /><span class="mono">PDF</span></span>
        {/if}
        <div class="o-fajlu">
          <span class="ime">{fajl.ime}</span>
          <span class="faint mono">{TIPOVI[fajl.tip].naziv} · {velicinaTekst(fajl.blob.size)}</span>
        </div>
        <label class="btn btn-ghost promeni">
          Promeni
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.heic,.heif" hidden onchange={naIzbor} />
        </label>
      </div>
    {:else}
      <div
        class="zona"
        class:iznad
        role="region"
        aria-label="Izbor fajla"
        ondragover={(e) => {
          e.preventDefault();
          iznad = true;
        }}
        ondragleave={() => (iznad = false)}
        ondrop={naSpustanje}
      >
        <span class="krug"><Ikona ime="otpremi" velicina={24} /></span>
        <p class="prevuci">Prevuci PDF ili sliku ovde, ili</p>
        <div class="izbor">
          <label class="btn slikaj">
            <Ikona ime="kamera" velicina={16} />
            Slikaj
            <input type="file" accept="image/*" capture="environment" hidden onchange={naIzbor} />
          </label>
          <label class="btn btn-ghost">
            <Ikona ime="dokument" velicina={16} />
            Izaberi fajl
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.heic,.heif" hidden onchange={naIzbor} />
          </label>
        </div>
        <p class="faint mala">PDF ili slika, najviše 10 MB. Velike fotografije se same smanje.</p>
      </div>
    {/if}

    {#if radi === 'priprema'}
      <p class="loading" role="status">Pripremam fajl…</p>
    {/if}

    <DokumentPolja bind:polja />

    {#if greska}
      <p class="error" role="alert">{greska}</p>
    {/if}

    <div class="akcije">
      <button class="btn" type="submit" disabled={!spremno}>{radi === 'slanje' ? 'Čuvam…' : 'Sačuvaj dokument'}</button>
      <button class="btn btn-ghost" type="button" onclick={() => dijalog.close()}>Otkaži</button>
    </div>
  </form>
</dialog>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.4rem;
  }

  .glava {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    font-size: 1.3rem;
  }

  .zatvori {
    font-size: 1.5rem;
    line-height: 1;
    color: var(--text-dim);
    padding: 0.2rem 0.5rem;
  }

  .zona {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    padding: 1.4rem 1rem;
    text-align: center;
    border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius);
    transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
  }

  .zona.iznad {
    border-color: var(--bio);
    background: var(--bio-soft);
  }

  .krug {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    color: var(--bio);
    background: var(--bio-soft);
    border: 1px solid var(--bio-line);
  }

  .izbor {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .izbor label,
  .promeni {
    cursor: pointer;
  }

  .mala {
    font-size: 0.8rem;
  }

  /* The camera button only makes sense on a phone or tablet; dragging only with a mouse. */
  .slikaj {
    display: none;
  }

  @media (pointer: coarse) {
    .slikaj {
      display: inline-flex;
    }

    .prevuci {
      display: none;
    }
  }

  .izabran {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.7rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }

  .izabran img,
  .pdf {
    width: 4rem;
    height: 4rem;
    flex-shrink: 0;
    border-radius: 6px;
    object-fit: cover;
  }

  .pdf {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.1rem;
    color: var(--hitno);
    background: var(--hitno-soft);
    font-size: 0.65rem;
  }

  .o-fajlu {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .ime {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .o-fajlu .mono {
    font-size: 0.75rem;
  }

  .akcije {
    display: flex;
    gap: 0.6rem;
  }
</style>
