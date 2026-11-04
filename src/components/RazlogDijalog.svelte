<script lang="ts">
  // A small dialog that asks for a required reason, e.g. when declining.
  import { onMount } from 'svelte';

  interface Props {
    naslov: string;
    opis: string;
    polje: string;
    dugme: string;
    onPotvrdi: (tekst: string) => Promise<void>;
    onZatvori: () => void;
  }

  let { naslov, opis, polje, dugme, onPotvrdi, onZatvori }: Props = $props();

  let dijalog: HTMLDialogElement;
  let tekst = $state('');
  let salje = $state(false);

  onMount(() => dijalog.showModal());

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    if (!tekst.trim()) return;
    salje = true;
    try {
      await onPotvrdi(tekst);
      dijalog.close();
    } finally {
      salje = false;
    }
  }
</script>

<dialog bind:this={dijalog} class="dijalog" onclose={onZatvori}>
  <form method="dialog" onsubmit={posalji}>
    <h2>{naslov}</h2>
    <p class="dim">{opis}</p>
    <label class="field">
      <span class="label">{polje}</span>
      <!-- svelte-ignore a11y_autofocus -->
      <textarea class="input" rows="3" bind:value={tekst} required autofocus></textarea>
    </label>
    <div class="akcije">
      <button class="btn" type="submit" disabled={salje || !tekst.trim()}>{dugme}</button>
      <button class="btn btn-ghost" type="button" onclick={() => dijalog.close()}>Otkaži</button>
    </div>
  </form>
</dialog>

<style>


  form {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1.4rem;
  }

  h2 {
    font-size: 1.3rem;
  }

  .akcije {
    display: flex;
    gap: 0.6rem;
  }
</style>
