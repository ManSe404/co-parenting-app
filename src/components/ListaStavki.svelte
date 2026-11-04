<script lang="ts">
  import { cekaDrugog, naPotezu } from '../lib/domen';
  import { pre } from '../lib/format';
  import { putanje } from '../lib/putanje';
  import type { Podaci, Stavka } from '../lib/tipovi';
  import OznakeStavke from './OznakeStavke.svelte';

  interface Props {
    podaci: Podaci;
    stavke: Stavka[];
  }

  let { podaci, stavke }: Props = $props();
  const sada = new Date();
</script>

{#if stavke.length}
  <ul class="lista">
    {#each stavke as s (s.id)}
      <li>
        <a class="card red" href={putanje.stavka(s.id)}>
          <span class="red-glava">
            <span class="dot dot-{s.stanje}" aria-hidden="true"></span>
            <span class="red-naslov">{s.naslov}</span>
          </span>
          <OznakeStavke stavka={s} oblasti={podaci.oblasti} {sada} />
          <span class="red-meta">
            {#if naPotezu(s, podaci.ja.id)}<span class="potez">na tebi je</span> ·{/if}
            {#if cekaDrugog(s, podaci.ja.id)}čeka {podaci.drugi.oznakaAkuzativ} ·{/if}
            {s.stanje === 'zatvoreno' && s.odluka ? s.odluka : `izmenjeno ${pre(s.izmenjeno, sada)}`}
          </span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <p class="prazno card">Nijedna stavka ne odgovara filterima.</p>
{/if}

<style>
  .lista {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .red {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.9rem 1.1rem;
  }

  .red-glava {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }

  .red-naslov {
    font-weight: 500;
  }

  .red:hover .red-naslov {
    color: var(--bio);
  }

  .red-meta {
    font-size: 0.82rem;
    color: var(--text-dim);
  }

  .potez {
    color: var(--warn);
  }

  .prazno {
    color: var(--text-faint);
  }
</style>
