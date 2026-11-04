<script lang="ts">
  // Turn MFA on (scan a QR code, confirm with a code) or off.
  import { onMount } from 'svelte';
  import { mfaIskljuci, mfaPotvrdi, mfaStanje, mfaZapocni } from '../lib/nalog';

  interface Props {
    onPromena?: (ukljucen: boolean) => void;
  }

  let { onPromena }: Props = $props();

  let ukljucen = $state(false);
  let faktorId = $state<string | null>(null);
  let upis = $state<{ faktorId: string; qr: string; tajna: string } | null>(null);
  let kod = $state('');
  let greska = $state<string | null>(null);
  let radi = $state(false);
  let ucitano = $state(false);
  let iskljucivanje = $state(false);

  async function osvezi() {
    const s = await mfaStanje();
    ukljucen = s.ukljucen;
    faktorId = s.faktorId;
    ucitano = true;
  }

  onMount(() => {
    osvezi().catch((e) => (greska = e instanceof Error ? e.message : String(e)));
  });

  async function zapocni() {
    greska = null;
    radi = true;
    try {
      upis = await mfaZapocni();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      radi = false;
    }
  }

  async function potvrdi(e: SubmitEvent) {
    e.preventDefault();
    if (!upis) return;
    greska = null;
    radi = true;
    try {
      await mfaPotvrdi(upis.faktorId, kod);
      upis = null;
      kod = '';
      await osvezi();
      onPromena?.(true);
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      radi = false;
    }
  }

  async function iskljuci(e: SubmitEvent) {
    e.preventDefault();
    if (!faktorId) return;
    greska = null;
    radi = true;
    try {
      await mfaIskljuci(faktorId, kod);
      kod = '';
      iskljucivanje = false;
      await osvezi();
      onPromena?.(false);
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      radi = false;
    }
  }
</script>

{#if ucitano}
  {#if ukljucen}
    <p class="stanje ok">Uključena. Posle lozinke ili Google-a tražiće se i kod iz aplikacije.</p>
    {#if iskljucivanje}
      <p class="stanje">Za isključivanje upiši trenutni kod iz aplikacije za kodove.</p>
      <form onsubmit={iskljuci}>
        <input
          class="input kod"
          bind:value={kod}
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="7"
          placeholder="123 456"
          aria-label="Kod za isključivanje"
          required
        />
        <button class="btn btn-ghost mali" type="submit" disabled={radi}>Isključi</button>
        <button class="btn btn-ghost mali" type="button" onclick={() => ((iskljucivanje = false), (kod = ''), (greska = null))}>Otkaži</button>
      </form>
    {:else}
      <button class="btn btn-ghost mali" onclick={() => (iskljucivanje = true)}>Isključi dvostepenu prijavu</button>
    {/if}
  {:else if upis}
    <ol class="koraci">
      <li>Otvori aplikaciju za kodove (Google Authenticator, Authy, 1Password…).</li>
      <li>Skeniraj QR kod, ili ručno upiši ključ.</li>
      <li>Upiši šestocifreni kod koji aplikacija pokaže.</li>
    </ol>
    <div class="qr">
      <img src={upis.qr} alt="QR kod za aplikaciju za kodove" width="180" height="180" />
      <code class="tajna">{upis.tajna}</code>
    </div>
    <form onsubmit={potvrdi}>
      <input
        class="input kod"
        bind:value={kod}
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="7"
        placeholder="123 456"
        aria-label="Šestocifreni kod"
        required
      />
      <button class="btn mali" type="submit" disabled={radi}>Potvrdi i uključi</button>
    </form>
  {:else}
    <p class="stanje">Nije uključena. Preporuka: uključi je, jer su ovde podaci o detetu i zdravlju.</p>
    <button class="btn mali" onclick={zapocni} disabled={radi}>Uključi dvostepenu prijavu</button>
  {/if}
  {#if greska}<p class="error">{greska}</p>{/if}
{/if}

<style>
  .stanje {
    font-size: 0.92rem;
    color: var(--text-dim);
  }

  .stanje.ok {
    color: var(--bio);
  }

  .koraci {
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .qr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  .qr img {
    background: #fff;
    border-radius: 10px;
    padding: 8px;
  }

  .tajna {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    word-break: break-all;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    background: var(--surface-hover);
    border: 1px solid var(--border);
    max-width: 100%;
  }

  form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .kod {
    max-width: 10rem;
    font-family: var(--font-mono);
    letter-spacing: 0.2em;
  }

  .mali {
    padding: 0.5rem 0.9rem;
    font-size: 0.78rem;
    align-self: flex-start;
  }
</style>
