<script lang="ts">
  // Profile and account: both parents' details, MFA, inviting the other parent, sign out.
  import { onMount } from 'svelte';
  import { type Pristup, odjava, pristup } from '../lib/nalog';
  import { putanja } from '../lib/putanje';
  import { izadjiIzDemoa, jeDemo } from '../lib/supabase';
  import MfaPodesavanje from './MfaPodesavanje.svelte';
  import ObavestenjaPodesavanje from './ObavestenjaPodesavanje.svelte';
  import PozoviRoditelja from './PozoviRoditelja.svelte';
  import ProfilRoditelja from './ProfilRoditelja.svelte';

  let p = $state<Pristup | null>(null);
  let demo = $state(false);

  onMount(async () => {
    demo = jeDemo();
    if (!demo) p = await pristup();
  });

  async function izlaz() {
    await odjava();
    sessionStorage.removeItem('coparenting.porodica');
    location.replace(putanja('/prijava/'));
  }
</script>

<header class="glava">
  <p class="eyebrow">Podešavanja</p>
  <h1>Profil i nalog</h1>
</header>

{#if demo}
  <ProfilRoditelja />
  <section class="card deo">
    <h2>Obaveštenja mejlom</h2>
    <ObavestenjaPodesavanje />
  </section>
  <section class="card deo">
    <h2>Demo</h2>
    <p class="dim">Gledaš probne podatke, bez naloga.</p>
    <a class="btn" href={putanja('/prijava/')} onclick={() => izadjiIzDemoa()}>Izađi iz demoa i prijavi se</a>
  </section>
{:else if p?.stanje === 'spreman'}
  {@const f = p.porodica}
  <ProfilRoditelja />

  {#if !f.drugi}
    <section class="card deo">
      <h2>Drugi roditelj</h2>
      <p class="dim">Još niste povezani.</p>
      <PozoviRoditelja koga={f.ja.uloga === 'tata' ? 'mamu' : 'tatu'} />
    </section>
  {/if}

  <section class="card deo">
    <h2>Nalog</h2>
    <p>Prijavljen si kao <b>{p.email}</b>; u zajedničkom prostoru si <b>{f.ja.oznaka}</b>.</p>
    <button class="btn btn-ghost mali" onclick={izlaz}>Odjavi se</button>
  </section>

  <section class="card deo">
    <h2>Obaveštenja mejlom</h2>
    <ObavestenjaPodesavanje />
  </section>

  <section class="card deo">
    <h2>Dvostepena prijava (MFA)</h2>
    <MfaPodesavanje />
  </section>

{/if}

<style>
  .glava {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 1.2rem;
  }

  .deo {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 40rem;
    margin-bottom: 0.9rem;
  }

  h2 {
    font-size: 1.1rem;
  }

  .mali {
    padding: 0.45rem 0.85rem;
    font-size: 0.76rem;
    align-self: flex-start;
  }
</style>
