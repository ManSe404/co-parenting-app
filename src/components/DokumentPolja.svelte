<script lang="ts" module>
  import type { KategorijaKljuc } from '../lib/dokumenti';

  export interface PoljaDokumenta {
    naziv: string;
    kategorija: KategorijaKljuc | null;
    datum: string;
    napomena: string;
  }
</script>

<script lang="ts">
  // The editable fields of a document: title, category, date, note.
  import { KATEGORIJE, kategorija as uKategoriju } from '../lib/dokumenti';
  import Ikona from './Ikona.svelte';

  let { polja = $bindable() }: { polja: PoljaDokumenta } = $props();

  const izabrana = $derived(polja.kategorija ? uKategoriju(polja.kategorija) : null);
</script>

<label class="field">
  <span class="label">Naziv</span>
  <input class="input" bind:value={polja.naziv} maxlength="120" placeholder="Npr. Nalaz alergologa" required />
</label>

<div class="field">
  <span class="label" id="kategorija-oznaka">Kategorija</span>
  <div class="kategorije" role="group" aria-labelledby="kategorija-oznaka">
    {#each KATEGORIJE as k (k.kljuc)}
      <button
        type="button"
        class="chip chip-toggle kat"
        aria-pressed={polja.kategorija === k.kljuc}
        style="--boja: {k.boja}"
        onclick={() => (polja.kategorija = k.kljuc)}
      >
        <Ikona ime={k.ikona} velicina={14} />
        {k.naziv}
      </button>
    {/each}
  </div>
  <span class="faint pomoc">{izabrana ? `Npr. ${izabrana.primeri}.` : 'Izaberi gde dokument pripada.'}</span>
</div>

<div class="dva">
  <label class="field">
    <span class="label">Datum na dokumentu</span>
    <input class="input" type="date" bind:value={polja.datum} />
  </label>
  <label class="field">
    <span class="label">Napomena</span>
    <input class="input" bind:value={polja.napomena} maxlength="500" placeholder="Npr. original je kod mame" />
  </label>
</div>

<style>
  .kategorije {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .kat {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
  }

  .kat :global(svg) {
    color: var(--boja);
  }

  .kat[aria-pressed='true'] {
    color: var(--text);
    border-color: var(--boja);
    background: color-mix(in srgb, var(--boja) 14%, transparent);
  }

  .pomoc {
    font-size: 0.8rem;
  }

  .dva {
    display: grid;
    grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
    gap: 0.8rem;
  }

  @media (max-width: 480px) {
    .dva {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
