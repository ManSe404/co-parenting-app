<script lang="ts">
  // Demo only: act as either parent to try the whole flow on one device.
  import { onMount } from 'svelte';
  import { izvor } from '../lib/izvor';

  let demo = $state(false);
  let ja = $state('tata');
  let mock: typeof import('../lib/mock/izvor-mock') | null = null;

  onMount(async () => {
    demo = (await izvor()).demo;
    if (!demo) return;
    mock = await import('../lib/mock/izvor-mock');
    ja = mock.trenutniRoditelj();
  });

  function izaberi(id: string) {
    if (!mock || id === ja) return;
    mock.postaviRoditelja(id);
    location.reload();
  }

  async function resetuj() {
    mock?.resetujDemo();
    try {
      localStorage.removeItem('coparenting.demo.profili');
    } catch {
      /* ignore */
    }
    await (await import('../lib/mock/dokumenti-mock')).resetujDemoDokumente();
    location.reload();
  }
</script>

{#if demo}
  <div class="demo" role="group" aria-label="Demo: ko si">
    <span class="demo-label mono">demo</span>
    {#each [['tata', 'Tata'], ['mama', 'Mama']] as [id, naziv] (id)}
      <button class="chip chip-toggle" aria-pressed={ja === id} onclick={() => izaberi(id)}>{naziv}</button>
    {/each}
    <button class="reset mono" title="Vrati demo podatke na početak" onclick={resetuj}>↺</button>
  </div>
{/if}

<style>
  .demo {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding-left: clamp(0.5rem, 2vw, 1rem);
    border-left: 1px dashed var(--border-strong);
  }

  .demo-label {
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--warn);
    margin-right: 0.2rem;
  }

  .reset {
    color: var(--text-faint);
    font-size: 0.95rem;
    padding: 0 0.25rem;
  }

  .reset:hover {
    color: var(--text);
  }

  @media (max-width: 520px) {
    .demo {
      width: 100%;
      justify-content: flex-end;
      border-left: none;
      padding: 0.45rem 0 0;
      border-top: 1px dashed var(--border);
    }
  }
</style>
