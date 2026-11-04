<script lang="ts">
  // The invitation link: who invites, for which child, in which role; then
  // sign up or sign in, and accept.
  import { onMount } from 'svelte';
  import { type PregledPozivnice, pogledajPozivnicu, prihvatiPozivnicu, pristup } from '../lib/nalog';
  import { putanja } from '../lib/putanje';

  const token = new URLSearchParams(location.search).get('t') ?? '';
  const ovde = `/poziv/?t=${token}`;

  let pregled = $state<PregledPozivnice | null>(null);
  let stanje = $state<'odjavljen' | 'mfa' | 'bez-porodice' | 'spreman' | null>(null);
  let greska = $state<string | null>(null);
  let radi = $state(false);

  onMount(async () => {
    try {
      pregled = await pogledajPozivnicu(token);
      const p = await pristup();
      stanje = p.stanje;
      if (p.stanje === 'mfa') location.replace(putanja(`/mfa/?dalje=${encodeURIComponent(ovde)}`));
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  });

  async function prihvati() {
    greska = null;
    radi = true;
    try {
      await prihvatiPozivnicu(token);
      location.replace(putanja('/'));
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      radi = false;
    }
  }

  const ULOGA = { tata: 'Tata', mama: 'Mama' } as const;
</script>

<section class="card kutija">
  <p class="eyebrow">Poziv</p>
  {#if !pregled && !greska}
    <p class="loading">Učitavam…</p>
  {:else if pregled && !pregled.vazi}
    <h1>Ovaj link više ne radi</h1>
    <p class="dim">{pregled.razlog ?? 'Zatraži novi link od drugog roditelja.'}</p>
  {:else if pregled}
    <h1>{pregled.pozvao} te poziva</h1>
    <p class="uvod">
      u zajednički prostor za vaše dete. Tu su pitanja i dogovori, kalendar sa boravkom i aktivnostima, karton i dokumenti.
    </p>
    <p class="uloga">U prostoru ćeš biti: <b>{pregled.uloga ? ULOGA[pregled.uloga] : ''}</b></p>

    {#if stanje === 'odjavljen'}
      <a class="btn" href={putanja(`/prijava/?rezim=registracija&dalje=${encodeURIComponent(ovde)}`)}>Napravi nalog</a>
      <a class="btn btn-ghost" href={putanja(`/prijava/?dalje=${encodeURIComponent(ovde)}`)}>Već imam nalog: prijavi me</a>
    {:else if stanje === 'bez-porodice'}
      <button class="btn" onclick={prihvati} disabled={radi}>Prihvati i poveži nas</button>
    {:else if stanje === 'spreman'}
      <p class="dim">Tvoj nalog je već u porodičnom prostoru. Jedan nalog može biti samo u jednom prostoru.</p>
      <a class="btn btn-ghost" href={putanja('/')}>Idi u aplikaciju</a>
    {/if}
  {/if}
  {#if greska}<p class="error">{greska}</p>{/if}
</section>

<style>
  .kutija {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1.6rem;
  }

  h1 {
    font-size: 1.6rem;
  }

  .uvod {
    color: var(--text-dim);
  }

  .uloga b {
    color: var(--text);
  }

  .uloga {
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-hover);
  }
</style>
