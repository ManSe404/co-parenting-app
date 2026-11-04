<script lang="ts">
  import { onMount } from 'svelte';
  import { izvor } from '../lib/izvor';
  import { putanje } from '../lib/putanje';
  import type { NovaStavkaUlaz, Oblast } from '../lib/tipovi';
  import StavkaForma from './StavkaForma.svelte';

  let oblasti = $state<Oblast[] | null>(null);
  let greska = $state<string | null>(null);

  // ?oblast=skola preselects the area when coming from an area card.
  const zadata = new URLSearchParams(location.search).get('oblast');
  const pocetno: NovaStavkaUlaz = {
    naslov: '',
    opis: '',
    oblast: 'skola',
    vazno: false,
    hitno: false,
    datum: null,
  };

  onMount(async () => {
    try {
      const p = await (await izvor()).ucitaj();
      if (zadata && p.oblasti.some((o) => o.kljuc === zadata)) pocetno.oblast = zadata as NovaStavkaUlaz['oblast'];
      oblasti = p.oblasti;
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  });

  async function sacuvaj(ulaz: NovaStavkaUlaz) {
    const id = await (await izvor()).novaStavka(ulaz);
    location.href = putanje.stavka(id);
  }
</script>

<header class="glava">
  <p class="eyebrow">Nova stavka</p>
  <h1>Novo pitanje ili tema</h1>
  <p class="dim">Drugi roditelj je vidi kao „čeka tvoj odgovor“.</p>
</header>

{#if greska}
  <p class="error">{greska}</p>
{:else if !oblasti}
  <p class="loading">Učitavam…</p>
{:else}
  <div class="card telo">
    <StavkaForma {pocetno} {oblasti} dugme="Postavi" onSacuvaj={sacuvaj} onOtkazi={() => history.back()} />
  </div>
{/if}

<style>
  .glava {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 1.25rem;
  }

  .telo {
    max-width: 46rem;
  }
</style>
