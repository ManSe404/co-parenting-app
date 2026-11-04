<script lang="ts" module>
  export type VrstaDijaloga = 'aktiviraj' | 'predlozi' | 'potvrdi' | 'odbij' | 'povuci' | 'ponovo';
</script>

<script lang="ts">
  // Confirms a board move and asks for what the rule needs: a decision when
  // proposing "rešeno", a reason when disagreeing or reopening.
  import { onMount } from 'svelte';
  import type { Stavka } from '../lib/tipovi';

  interface Props {
    vrsta: VrstaDijaloga;
    stavka: Stavka;
    drugi: string;
    onPotvrdi: (tekst: string) => Promise<void>;
    onZatvori: () => void;
  }

  let { vrsta, stavka, drugi, onPotvrdi, onZatvori }: Props = $props();

  let dijalog: HTMLDialogElement;
  let tekst = $state('');
  let greska = $state<string | null>(null);
  let salje = $state(false);

  const TEKSTOVI: Record<
    VrstaDijaloga,
    { naslov: string; opis: (s: Stavka) => string; polje?: string; placeholder?: string; obavezno?: boolean; dugme: string }
  > = {
    aktiviraj: {
      naslov: 'Pomeri u Aktivno',
      opis: () => 'Ako ste se već dogovorili usmeno, kratko zapiši šta.',
      polje: 'Napomena (nije obavezno)',
      placeholder: 'Npr. Pričali smo telefonom, vidimo se u petak.',
      dugme: 'Pomeri',
    },
    predlozi: {
      naslov: 'Predloži da je rešeno',
      opis: () => `${drugi} treba da potvrdi. Do tada stavka stoji pod Rešeno kao predlog.`,
      polje: 'Šta je dogovoreno?',
      placeholder: 'Npr. Vodi tata, termin u 17h.',
      obavezno: true,
      dugme: 'Predloži',
    },
    potvrdi: {
      naslov: 'Potvrdi da je rešeno',
      opis: (s) => `Dogovor: „${s.odluka ?? ''}“`,
      dugme: 'Potvrdi',
    },
    odbij: {
      naslov: 'Ne slažeš se da je rešeno?',
      opis: (s) => `Predlog je bio: „${s.odluka ?? ''}“. Stavka se vraća u Aktivno.`,
      polje: 'Šta još treba da se dogovori?',
      obavezno: true,
      dugme: 'Vrati u Aktivno',
    },
    povuci: {
      naslov: 'Povuci svoj predlog?',
      opis: () => 'Stavka se vraća u Aktivno.',
      dugme: 'Povuci predlog',
    },
    ponovo: {
      naslov: 'Ponovo otvori temu?',
      opis: (s) => `Odluka je bila: „${s.odluka ?? ''}“.`,
      polje: 'Zašto se ponovo otvara?',
      obavezno: true,
      dugme: 'Ponovo otvori',
    },
  };

  // svelte-ignore state_referenced_locally
  const t = TEKSTOVI[vrsta];

  onMount(() => {
    dijalog.showModal();
  });

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    if (t.obavezno && !tekst.trim()) return;
    greska = null;
    salje = true;
    try {
      await onPotvrdi(tekst);
      dijalog.close();
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      salje = false;
    }
  }
</script>

<dialog bind:this={dijalog} class="dijalog" onclose={onZatvori}>
  <form method="dialog" onsubmit={posalji}>
    <p class="eyebrow">{stavka.naslov}</p>
    <h2>{t.naslov}</h2>
    <p class="dim opis">{t.opis(stavka)}</p>

    {#if t.polje}
      <label class="field">
        <span class="label">{t.polje}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <textarea class="input" bind:value={tekst} rows="3" placeholder={t.placeholder} required={t.obavezno} autofocus
        ></textarea>
      </label>
    {/if}

    {#if greska}<p class="error">{greska}</p>{/if}

    <div class="akcije">
      <button class="btn" type="submit" disabled={salje || (t.obavezno && !tekst.trim())}>{t.dugme}</button>
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

  .eyebrow {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  h2 {
    font-size: 1.35rem;
  }

  .opis {
    font-size: 0.95rem;
  }

  .akcije {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.3rem;
  }
</style>
