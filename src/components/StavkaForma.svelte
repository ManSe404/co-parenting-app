<script lang="ts">
  import type { NovaStavkaUlaz, Oblast } from '../lib/tipovi';

  interface Props {
    pocetno: NovaStavkaUlaz;
    oblasti: Oblast[];
    dugme: string;
    onSacuvaj: (ulaz: NovaStavkaUlaz) => Promise<void>;
    onOtkazi?: () => void;
  }

  let { pocetno, oblasti, dugme, onSacuvaj, onOtkazi }: Props = $props();

  // A form edits its own copy; the parent only sees the result on save.
  // svelte-ignore state_referenced_locally
  let u = $state<NovaStavkaUlaz>({ ...pocetno });
  let greska = $state<string | null>(null);
  let salje = $state(false);

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    greska = null;
    salje = true;
    try {
      await onSacuvaj({ ...u, datum: u.datum || null });
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      salje = false;
    }
  }
</script>

<form class="forma" onsubmit={posalji}>
  <label class="field">
    <span class="label">Naslov</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input" bind:value={u.naslov} required maxlength="140" placeholder="Npr. Saglasnost za izlet" autofocus />
  </label>

  <div class="field">
    <span class="label">Oblast</span>
    <div class="chips" role="radiogroup" aria-label="Oblast">
      {#each oblasti as o (o.kljuc)}
        <button
          type="button"
          class="chip chip-toggle"
          role="radio"
          aria-checked={u.oblast === o.kljuc}
          class:is-active={u.oblast === o.kljuc}
          onclick={() => (u.oblast = o.kljuc)}>{o.naziv}</button
        >
      {/each}
    </div>
  </div>

  <div class="dva">
    <div class="field">
      <span class="label">Oznake</span>
      <div class="chips">
        <button type="button" class="chip chip-toggle" aria-pressed={u.vazno} onclick={() => (u.vazno = !u.vazno)}>Važno</button>
        <button type="button" class="chip chip-toggle" aria-pressed={u.hitno} onclick={() => (u.hitno = !u.hitno)}>Hitno</button>
      </div>
    </div>

    <label class="field">
      <span class="label">Datum <span class="faint">rok ili termin, nije obavezno</span></span>
      <input class="input" type="date" bind:value={u.datum} />
    </label>
  </div>

  <label class="field">
    <span class="label">Opis</span>
    <textarea class="input" bind:value={u.opis} rows="4" placeholder="Šta treba odlučiti, do kada, šta već znamo."></textarea>
  </label>

  {#if greska}<p class="error">{greska}</p>{/if}

  <div class="akcije">
    <button class="btn" type="submit" disabled={salje}>{dugme}</button>
    {#if onOtkazi}<button class="btn btn-ghost" type="button" onclick={onOtkazi}>Otkaži</button>{/if}
  </div>
</form>

<style>
  .forma {
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
  }

  .dva {
    display: grid;
    gap: 1.15rem;
  }

  @media (min-width: 620px) {
    .dva {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }

  .label .faint {
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .akcije {
    display: flex;
    gap: 0.6rem;
  }
</style>
