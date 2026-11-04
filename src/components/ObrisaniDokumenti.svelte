<script lang="ts">
  // The trash: deleted documents wait here. Either parent restores one; to
  // delete it for good, one proposes and the other confirms. What was deleted
  // for good stays listed (name, who proposed, who confirmed).
  import {
    type Dokument,
    type ZahtevBrisanja,
    opisTraga,
    otvorenZahtev,
    poslednjeOdbijanje,
    trajnoObrisani,
  } from '../lib/dokumenti';
  import type { DokumentiIzvor } from '../lib/dokumenti-izvor';
  import { pre, trenutakSaGodinom } from '../lib/format';
  import Ikona from './Ikona.svelte';

  interface Props {
    iz: DokumentiIzvor;
    izbrisani: Dokument[];
    zahtevi: ZahtevBrisanja[];
    ja: string;
    oznake: Record<string, string>;
    drugi: string;
    otvoreno: boolean;
    onPromena: (poruka: string) => Promise<void>;
    onOtvori: (id: string) => void;
  }

  let { iz, izbrisani, zahtevi, ja, oznake, drugi, otvoreno = $bindable(), onPromena, onOtvori }: Props = $props();

  let pitam = $state<string | null>(null);
  let radi = $state<string | null>(null);
  let greska = $state<{ id: string; tekst: string } | null>(null);

  const sada = new Date();
  const ko = (id: string | null) => (id ? (oznake[id] ?? '?') : '?');
  const zapis = $derived(trajnoObrisani(zahtevi));

  /** "Mama je odbila" or, when it was you, "Odbio si". */
  function odbio(id: string | null): string {
    const r = id === 'mama' ? 'odbila' : 'odbio';
    return id === ja ? `${r.charAt(0).toUpperCase()}${r.slice(1)} si` : `${ko(id)} je ${r}`;
  }

  async function uradi(id: string, posao: () => Promise<void>, poruka: string) {
    radi = id;
    greska = null;
    try {
      await posao();
      pitam = null;
      await onPromena(poruka);
    } catch (e) {
      greska = { id, tekst: e instanceof Error ? e.message : String(e) };
    } finally {
      radi = null;
    }
  }
</script>

{#if izbrisani.length || zapis.length}
  <details class="obrisani" bind:open={otvoreno} id="obrisani">
    <summary><Ikona ime="kanta" velicina={15} />Obrisani · {izbrisani.length}</summary>
    <p class="faint uvod">
      Obrisani dokumenti ostaju sačuvani i svako od vas može da ih vrati. Trajno se briše samo ako se oboje složite: jedno
      predloži, drugo potvrdi.
    </p>

    <ul>
      {#each izbrisani as d (d.id)}
        {@const z = otvorenZahtev(zahtevi, d.id)}
        {@const odbijeno = z ? null : poslednjeOdbijanje(zahtevi, d.id)}
        <li class:ceka-mene={z?.stanje === 'ceka' && z.predlozio !== ja}>
          <div class="red">
            <button class="ime" onclick={() => onOtvori(d.id)}>{d.naziv}</button>
            <span class="faint">{opisTraga('obrisan', d.obrisao ?? '?', ja, ko(d.obrisao))} {pre(d.obrisan ?? '', sada)}</span>
          </div>

          {#if z?.stanje === 'ceka' && z.predlozio !== ja}
            <p class="predlog">
              <b>{ko(z.predlozio)} predlaže da se trajno obriše.</b> Posle tvoje potvrde fajl nestaje zauvek i ne može da se vrati.
            </p>
            <div class="akcije">
              <button class="btn btn-danger" disabled={radi === d.id} onclick={() => uradi(d.id, () => iz.potvrdiTrajnoBrisanje(z.id), `„${d.naziv}“ je trajno obrisan.`)}>
                Potvrdi trajno brisanje
              </button>
              <button class="btn btn-ghost" disabled={radi === d.id} onclick={() => uradi(d.id, () => iz.odbijTrajnoBrisanje(z.id), 'Trajno brisanje je odbijeno; dokument ostaje u obrisanima.')}>
                Odbij
              </button>
              <button class="btn btn-ghost" disabled={radi === d.id} onclick={() => uradi(d.id, () => iz.vrati(d.id), `„${d.naziv}“ je vraćen.`)}>
                <Ikona ime="vrati" velicina={14} />Vrati
              </button>
            </div>
          {:else if z?.stanje === 'ceka'}
            <p class="predlog moj">Predloži{ja === 'mama' ? 'la' : 'o'} si trajno brisanje. Čeka se da {drugi} potvrdi.</p>
            <div class="akcije">
              <button class="btn btn-ghost" disabled={radi === d.id} onclick={() => uradi(d.id, () => iz.povuciTrajnoBrisanje(z.id), 'Predlog za trajno brisanje je povučen.')}>
                Povuci predlog
              </button>
              <button class="btn btn-ghost" disabled={radi === d.id} onclick={() => uradi(d.id, () => iz.vrati(d.id), `„${d.naziv}“ je vraćen.`)}>
                <Ikona ime="vrati" velicina={14} />Vrati
              </button>
            </div>
          {:else if z?.stanje === 'odobreno'}
            <p class="predlog">Oboje ste potvrdili trajno brisanje, ali nije završeno (verovatno je pukla veza).</p>
            <div class="akcije">
              <button class="btn btn-danger" disabled={radi === d.id} onclick={() => uradi(d.id, () => iz.zavrsiTrajnoBrisanje(z.id), `„${d.naziv}“ je trajno obrisan.`)}>
                Završi brisanje
              </button>
            </div>
          {:else if pitam === d.id}
            <p class="predlog">
              Predložiti trajno brisanje? Fajl nestaje zauvek tek kad i {drugi} potvrdi. Do tada dokument ostaje ovde i može da
              se vrati.
            </p>
            <div class="akcije">
              <button class="btn btn-danger" disabled={radi === d.id} onclick={() => uradi(d.id, () => iz.predloziTrajnoBrisanje(d.id), `Predlog je poslat. Čeka se da ${drugi} potvrdi.`)}>
                Predloži trajno brisanje
              </button>
              <button class="btn btn-ghost" onclick={() => (pitam = null)}>Ne</button>
            </div>
          {:else}
            {#if odbijeno}
              <p class="faint napomena">
                {odbio(odbijeno.odgovorio)} trajno brisanje {pre(odbijeno.odgovoreno ?? '', sada)}.
              </p>
            {/if}
            <div class="akcije">
              <button class="btn btn-ghost vrati" disabled={radi === d.id} onclick={() => uradi(d.id, () => iz.vrati(d.id), `„${d.naziv}“ je vraćen.`)}>
                <Ikona ime="vrati" velicina={14} />Vrati
              </button>
              <button class="btn btn-ghost trajno" onclick={() => ((pitam = d.id), (greska = null))}>Trajno obriši…</button>
            </div>
          {/if}

          {#if greska?.id === d.id}
            <p class="error" role="alert">{greska.tekst}</p>
          {/if}
        </li>
      {/each}
    </ul>

    {#if zapis.length}
      <div class="zapis">
        <span class="label">Trajno obrisano</span>
        <ul>
          {#each zapis as z (z.id)}
            <li>
              <span class="ime-zapisa">{z.naziv}</span>
              <span class="faint">
                predloži{z.predlozio === 'mama' ? 'la' : 'o'}
                {ko(z.predlozio)}, potvrdi{z.odgovorio === 'mama' ? 'la' : 'o'}
                {ko(z.odgovorio)} · {trenutakSaGodinom(z.zavrseno ?? z.odgovoreno ?? z.predlozeno)}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </details>
{/if}

<style>
  .obrisani {
    margin-top: 2rem;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
    scroll-margin-top: 5rem;
  }

  summary {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }

  .uvod {
    margin: 0.6rem 0 0.8rem;
    font-size: 0.85rem;
    max-width: 44rem;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.7rem 0.85rem;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
  }

  li.ceka-mene {
    border-style: solid;
    border-color: var(--warn-line);
    background: var(--warn-soft);
  }

  .red {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.9rem;
  }

  .ime {
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
    text-align: left;
    font-weight: 500;
  }

  .predlog {
    font-size: 0.88rem;
  }

  .predlog.moj {
    color: var(--text-dim);
  }

  .napomena {
    font-size: 0.82rem;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .akcije .btn {
    padding: 0.45rem 0.8rem;
  }

  .trajno {
    color: var(--hitno);
    border-color: transparent;
  }

  .zapis {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1.2rem;
  }

  .zapis li {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.8rem;
    border-style: solid;
    border-color: var(--border);
    font-size: 0.84rem;
  }

  .ime-zapisa {
    color: var(--text-dim);
  }
</style>
