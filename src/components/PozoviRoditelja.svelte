<script lang="ts">
  // Make an invitation link for the other parent and send it (copy, share
  // sheet on phones, Viber, WhatsApp, e-mail).
  import { onMount } from 'svelte';
  import { type Pozivnica, mojaPozivnica, napraviPozivnicu } from '../lib/nalog';
  import { pre } from '../lib/format';

  interface Props {
    /** "Mamu" / "tatu": who is being invited, for the wording. */
    koga: string;
  }

  let { koga }: Props = $props();

  let email = $state('');
  let poziv = $state<Pozivnica | null>(null);
  let prethodna = $state<{ email: string | null; istice: string; iskoriscena: string | null } | null>(null);
  let greska = $state<string | null>(null);
  let radi = $state(false);
  let kopirano = $state(false);
  const sada = new Date();

  onMount(async () => {
    try {
      prethodna = await mojaPozivnica();
    } catch {
      /* not essential */
    }
  });

  let tekst = $derived(
    poziv ? `Pozivam te u naš zajednički prostor za dete u aplikaciji coparenting. Otvori link i prihvati: ${poziv.link}` : '',
  );

  async function napravi() {
    greska = null;
    radi = true;
    try {
      poziv = await napraviPozivnicu(email.trim() || null);
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      radi = false;
    }
  }

  async function kopiraj() {
    if (!poziv) return;
    try {
      await navigator.clipboard.writeText(poziv.link);
      kopirano = true;
      setTimeout(() => (kopirano = false), 2000);
    } catch {
      greska = 'Kopiranje nije uspelo; označi link i kopiraj ga ručno.';
    }
  }

  async function podeli() {
    if (!poziv) return;
    try {
      await navigator.share({ title: 'Poziv u coparenting', text: tekst });
    } catch {
      /* closed */
    }
  }

  const mozeDeljenje = typeof navigator !== 'undefined' && 'share' in navigator;
</script>

<div class="poziv">
  {#if !poziv}
    {#if prethodna && !prethodna.iskoriscena && Date.parse(prethodna.istice) > Date.now()}
      <p class="dim">
        Već postoji link koji važi još {pre(prethodna.istice, sada).replace('za ', '')}{prethodna.email ? ` (samo za ${prethodna.email})` : ''}.
        Novi link poništava stari.
      </p>
    {/if}
    <label class="field">
      <span class="label">Mejl drugog roditelja <span class="faint">nije obavezno</span></span>
      <input class="input" type="email" bind:value={email} placeholder="Ako ga upišeš, samo ta adresa može da prihvati" />
    </label>
    <button class="btn" onclick={napravi} disabled={radi}>Napravi link za {koga}</button>
  {:else}
    <p class="dim">Link važi 7 dana i radi samo jednom. Pošalji ga kako ti je najlakše:</p>
    <div class="link">
      <input class="input" readonly value={poziv.link} aria-label="Link za poziv" onfocus={(e) => e.currentTarget.select()} />
      <button class="btn mali" onclick={kopiraj}>{kopirano ? 'Kopirano' : 'Kopiraj'}</button>
    </div>
    <div class="deli">
      {#if mozeDeljenje}<button class="btn btn-ghost mali" onclick={podeli}>Podeli…</button>{/if}
      <a class="btn btn-ghost mali" href={`viber://forward?text=${encodeURIComponent(tekst)}`}>Viber</a>
      <a class="btn btn-ghost mali" href={`https://wa.me/?text=${encodeURIComponent(tekst)}`} target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn btn-ghost mali" href={`mailto:${email}?subject=${encodeURIComponent('Poziv u coparenting')}&body=${encodeURIComponent(tekst)}`}>Mejl</a>
    </div>
  {/if}
  {#if greska}<p class="error">{greska}</p>{/if}
</div>

<style>
  .poziv {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .label .faint {
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .link {
    display: flex;
    gap: 0.4rem;
  }

  .link .input {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    min-width: 0;
  }

  .deli {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .mali {
    padding: 0.45rem 0.85rem;
    font-size: 0.76rem;
  }
</style>
