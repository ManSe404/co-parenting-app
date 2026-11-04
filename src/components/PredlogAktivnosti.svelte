<script lang="ts" module>
  import type { Dogadjaj } from '../lib/dogadjaji';

  export type RezimAktivnosti =
    | { vrsta: 'dodaj'; datum: string; od?: string }
    | { vrsta: 'izmeni'; dogadjaj: Dogadjaj }
    | { vrsta: 'obrisi'; dogadjaj: Dogadjaj };
</script>

<script lang="ts">
  // Propose an activity (or a change to one). Like everything in the calendar,
  // it only takes effect when the other parent accepts.
  import { onMount } from 'svelte';
  import { plusDana } from '../lib/domen';
  import {
    DANI_KRATKO,
    type NoviZahtevDogadjajaUlaz,
    type PredlogDogadjaja,
    VRSTE_DOGADJAJA,
    type VrstaDogadjaja,
    danUNedelji,
  } from '../lib/dogadjaji';
  import { opisDogadjaja } from '../lib/kalendar-opis';
  import type { Podaci } from '../lib/tipovi';

  interface Props {
    rezim: RezimAktivnosti;
    podaci: Podaci;
    onPosalji: (ulaz: NoviZahtevDogadjajaUlaz) => Promise<void>;
    onZatvori: () => void;
  }

  let { rezim, podaci, onPosalji, onZatvori }: Props = $props();

  let dijalog: HTMLDialogElement;

  function sat(hhmm: string, plus: number): string {
    const m = Math.min(23 * 60 + 30, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + plus);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  // svelte-ignore state_referenced_locally
  const pocetak: PredlogDogadjaja =
    rezim.vrsta === 'dodaj'
      ? {
          naziv: '',
          vrsta: 'trening',
          datum: rezim.datum,
          ceoDan: false,
          od: rezim.od ?? '17:00',
          do: sat(rezim.od ?? '17:00', 60),
          ponavljanje: { tip: 'ne' },
          vodi: null,
          mesto: '',
          napomena: '',
        }
      : { ...rezim.dogadjaj };

  let naziv = $state(pocetak.naziv);
  let vrsta = $state<VrstaDogadjaja>(pocetak.vrsta);
  let datum = $state(pocetak.datum);
  let ceoDan = $state(pocetak.ceoDan);
  let od = $state(pocetak.od);
  let doV = $state(pocetak.do);
  let ponavlja = $state<'ne' | '1' | '2'>(pocetak.ponavljanje.tip === 'ne' ? 'ne' : pocetak.ponavljanje.svakih === 1 ? '1' : '2');
  let dani = $state<number[]>(pocetak.ponavljanje.tip === 'ne' ? [danUNedelji(pocetak.datum)] : [...pocetak.ponavljanje.dani]);
  let ponavljaDo = $state(pocetak.ponavljanje.tip === 'ne' ? '' : (pocetak.ponavljanje.do ?? ''));
  let vodi = $state<string | null>(pocetak.vodi);
  let mesto = $state(pocetak.mesto);
  let napomena = $state(pocetak.napomena);
  let poruka = $state('');
  let greska = $state<string | null>(null);
  let salje = $state(false);

  // svelte-ignore state_referenced_locally
  const naslov = { dodaj: 'Predloži aktivnost', izmeni: 'Predloži izmenu aktivnosti', obrisi: 'Predloži brisanje aktivnosti' }[rezim.vrsta];
  let roditelji = $derived([podaci.ja, podaci.drugi]);

  onMount(() => dijalog.showModal());

  function prebaciDan(d: number) {
    dani = dani.includes(d) ? dani.filter((x) => x !== d) : [...dani, d].sort();
  }

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    greska = null;
    salje = true;
    try {
      const dogadjaj: PredlogDogadjaja = {
        naziv,
        vrsta,
        datum,
        ceoDan,
        od: ceoDan ? '' : od,
        do: ceoDan ? '' : doV,
        ponavljanje:
          ponavlja === 'ne' ? { tip: 'ne' } : { tip: 'nedeljno', svakih: ponavlja === '1' ? 1 : 2, dani, do: ponavljaDo || null },
        vodi,
        mesto,
        napomena,
        ...(pocetak.izuzeti?.length ? { izuzeti: pocetak.izuzeti } : {}),
      };
      await onPosalji({
        vrsta: rezim.vrsta,
        dogadjajId: rezim.vrsta === 'dodaj' ? null : rezim.dogadjaj.id,
        dogadjaj: rezim.vrsta === 'obrisi' ? null : dogadjaj,
        poruka,
      });
      dijalog.close();
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      salje = false;
    }
  }
</script>

<dialog bind:this={dijalog} class="dijalog" style="--sirina-dijaloga: 36rem" onclose={onZatvori}>
  <form method="dialog" onsubmit={posalji}>
    <p class="eyebrow">Kalendar · aktivnost</p>
    <h2>{naslov}</h2>

    {#if rezim.vrsta === 'obrisi'}
      <p class="postojeci">{opisDogadjaja(podaci, rezim.dogadjaj)}</p>
    {:else}
      <label class="field">
        <span class="label">Naziv</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" bind:value={naziv} placeholder="Npr. Fudbal, Rođendan kod Luke" required autofocus />
      </label>

      <div class="field">
        <span class="label">Vrsta</span>
        <div class="chips">
          {#each VRSTE_DOGADJAJA as v (v.kljuc)}
            <button type="button" class="chip chip-toggle vrsta" style="--boja: {v.boja}" aria-pressed={vrsta === v.kljuc} onclick={() => (vrsta = v.kljuc)}>
              <i class="dot"></i>{v.naziv}
            </button>
          {/each}
        </div>
      </div>

      <div class="red-polja">
        <label class="field">
          <span class="label">Datum</span>
          <input class="input" type="date" bind:value={datum} required />
        </label>
        <label class="field ceo-dan">
          <input type="checkbox" bind:checked={ceoDan} />
          <span>Ceo dan</span>
        </label>
      </div>

      {#if !ceoDan}
        <div class="red-polja">
          <label class="field">
            <span class="label">Od</span>
            <input class="input" type="time" bind:value={od} required />
          </label>
          <label class="field">
            <span class="label">Do</span>
            <input class="input" type="time" bind:value={doV} required />
          </label>
        </div>
      {/if}

      <div class="field">
        <span class="label">Ponavljanje</span>
        <div class="chips">
          <button type="button" class="chip chip-toggle" aria-pressed={ponavlja === 'ne'} onclick={() => (ponavlja = 'ne')}>Jednom</button>
          <button type="button" class="chip chip-toggle" aria-pressed={ponavlja === '1'} onclick={() => (ponavlja = '1')}>Svake nedelje</button>
          <button type="button" class="chip chip-toggle" aria-pressed={ponavlja === '2'} onclick={() => (ponavlja = '2')}>Svake druge</button>
        </div>
      </div>

      {#if ponavlja !== 'ne'}
        <div class="field">
          <span class="label">Dani</span>
          <div class="dani">
            {#each DANI_KRATKO as d, i (d)}
              <button type="button" class="dan-dugme" aria-pressed={dani.includes(i)} onclick={() => prebaciDan(i)}>{d}</button>
            {/each}
          </div>
        </div>
        <label class="field">
          <span class="label">Ponavlja se do <span class="faint">prazno = bez kraja</span></span>
          <input class="input" type="date" bind:value={ponavljaDo} min={datum} max={plusDana(datum, 730)} />
        </label>
      {/if}

      <div class="field">
        <span class="label">Ko vodi <span class="faint">nije obavezno</span></span>
        <div class="chips">
          <button type="button" class="chip chip-toggle" aria-pressed={vodi === null} onclick={() => (vodi = null)}>Nije dogovoreno</button>
          {#each roditelji as r (r.id)}
            <button type="button" class="chip chip-toggle roditelj" style="--boja: var(--{r.boja})" aria-pressed={vodi === r.id} onclick={() => (vodi = r.id)}>
              <i class="dot"></i>{r.oznaka}
            </button>
          {/each}
        </div>
      </div>

      <label class="field">
        <span class="label">Gde <span class="faint">nije obavezno</span></span>
        <input class="input" bind:value={mesto} placeholder="Npr. sala kod škole" />
      </label>

      <label class="field">
        <span class="label">Napomena <span class="faint">nije obavezno</span></span>
        <input class="input" bind:value={napomena} placeholder="Npr. poklon, oprema, ko vraća" />
      </label>
    {/if}

    <label class="field">
      <span class="label">Poruka za {podaci.drugi.oznakaAkuzativ} <span class="faint">nije obavezno</span></span>
      <textarea class="input" rows="2" bind:value={poruka} placeholder="Ukratko, zašto"></textarea>
    </label>

    <p class="info">
      {podaci.drugi.oznaka} mora da prihvati. Do tada se aktivnost vidi isprekidano, kao „čeka potvrdu“.
    </p>

    {#if greska}<p class="error">{greska}</p>{/if}

    <div class="akcije">
      <button class="btn" type="submit" disabled={salje}>Pošalji predlog</button>
      <button class="btn btn-ghost" type="button" onclick={() => dijalog.close()}>Otkaži</button>
    </div>
  </form>
</dialog>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.4rem;
  }

  h2 {
    font-size: 1.35rem;
  }

  .label .faint {
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .vrsta .dot,
  .roditelj .dot {
    background: var(--boja);
  }

  .vrsta[aria-pressed='true'],
  .roditelj[aria-pressed='true'] {
    color: var(--boja);
    border-color: var(--boja);
    background: color-mix(in srgb, var(--boja) 10%, transparent);
  }

  .red-polja {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.6rem;
    align-items: end;
  }

  .red-polja .input {
    min-width: 0;
  }

  .ceo-dan {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.8rem;
    cursor: pointer;
  }

  .ceo-dan input {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--bio);
  }

  .dani {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.3rem;
  }

  .dan-dugme {
    padding: 0.45rem 0;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--text-dim);
  }

  .dan-dugme[aria-pressed='true'] {
    color: var(--bio);
    border-color: var(--bio);
    background: var(--bio-soft);
  }

  .postojeci {
    font-weight: 500;
  }

  .info {
    font-size: 0.88rem;
    color: var(--warn);
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--warn-line);
    background: var(--warn-soft);
  }

  .akcije {
    display: flex;
    gap: 0.6rem;
  }
</style>
