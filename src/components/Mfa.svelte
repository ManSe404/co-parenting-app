<script lang="ts">
  // Second step of sign-in: the 6-digit code from the authenticator app.
  import { onMount } from 'svelte';
  import { mfaPotvrdi, mfaStanje, odjava } from '../lib/nalog';
  import { putanja } from '../lib/putanje';
  import { posleUlaska } from '../lib/usmeri';

  let kod = $state('');
  let faktor = $state<string | null>(null);
  let greska = $state<string | null>(null);
  let radi = $state(false);

  onMount(async () => {
    try {
      faktor = (await mfaStanje()).faktorId;
      if (!faktor) await posleUlaska();
    } catch {
      location.replace(putanja('/prijava/'));
    }
  });

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    if (!faktor) return;
    greska = null;
    radi = true;
    try {
      await mfaPotvrdi(faktor, kod);
      await posleUlaska();
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
      kod = '';
    } finally {
      radi = false;
    }
  }

  async function izlaz() {
    await odjava();
    location.replace(putanja('/prijava/'));
  }
</script>

<section class="card kutija">
  <h1>Kod za prijavu</h1>
  <p class="dim">Otvori aplikaciju za kodove (Google Authenticator, Authy, 1Password…) i upiši šestocifreni kod za coparenting.</p>
  <form onsubmit={posalji}>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="input kod"
      bind:value={kod}
      inputmode="numeric"
      autocomplete="one-time-code"
      pattern="[0-9 ]{'{'}6,7{'}'}"
      maxlength="7"
      placeholder="123 456"
      aria-label="Šestocifreni kod"
      required
      autofocus
    />
    {#if greska}<p class="error">{greska}</p>{/if}
    <button class="btn" type="submit" disabled={radi || !faktor}>Potvrdi</button>
  </form>
  <button class="tekst" onclick={izlaz}>Odjavi se</button>
</section>

<style>
  .kutija {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.6rem;
  }

  h1 {
    font-size: 1.6rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .kod {
    font-family: var(--font-mono);
    font-size: 1.6rem;
    letter-spacing: 0.25em;
    text-align: center;
  }

  .tekst {
    align-self: center;
    font-size: 0.85rem;
    color: var(--text-dim);
    text-decoration: underline;
    text-underline-offset: 0.25em;
  }
</style>
