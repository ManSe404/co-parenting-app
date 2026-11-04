<script lang="ts">
  // A small link to the profile and settings in the top bar (also in the demo).
  import { onMount } from 'svelte';
  import { putanja } from '../lib/putanje';
  import { jeDemo } from '../lib/supabase';
  import Ikona from './Ikona.svelte';

  let vidljiv = $state(false);
  let slovo = $state('');

  onMount(() => {
    vidljiv = true;
    try {
      if (jeDemo()) {
        slovo = localStorage.getItem('coparenting.demo.ja') === 'mama' ? 'M' : 'T';
      } else {
        const p = JSON.parse(sessionStorage.getItem('coparenting.porodica') ?? 'null');
        slovo = p?.ja?.oznaka?.charAt(0) ?? '';
      }
    } catch {
      /* not yet known */
    }
  });
</script>

{#if vidljiv}
  <a class="nalog" href={putanja('/podesavanja/')} title="Profil i nalog" aria-label="Profil i nalog">
    {#if slovo}<span class="slovo">{slovo}</span>{:else}<Ikona ime="karton" velicina={18} />{/if}
  </a>
{/if}

<style>
  .nalog {
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    border: 1px solid var(--border-strong);
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .nalog:hover {
    border-color: var(--bio);
    color: var(--bio);
  }

  .slovo {
    font-weight: 600;
  }
</style>
