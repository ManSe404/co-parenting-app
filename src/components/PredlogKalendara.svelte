<script lang="ts" module>
  import type { Boravak } from '../lib/kalendar';

  export type RezimPredloga =
    | { vrsta: 'dodaj'; datum: string }
    | { vrsta: 'izmeni'; boravak: Boravak }
    | { vrsta: 'obrisi'; boravak: Boravak };
</script>

<script lang="ts">
  // The form for proposing a calendar change. Nothing changes until the other
  // parent accepts, and the form says so.
  import { onMount } from 'svelte';
  import { plusDana } from '../lib/domen';
  import { type NoviZahtevUlaz, type PredlogBoravka, type VrstaBoravka, datumDela, ponovi, vremeDela } from '../lib/kalendar';
  import { opseg } from '../lib/format';
  import type { Roditelj } from '../lib/tipovi';

  interface Props {
    rezim: RezimPredloga;
    ja: Roditelj;
    drugi: Roditelj;
    onPosalji: (ulaz: NoviZahtevUlaz) => Promise<void>;
    onZatvori: () => void;
  }

  let { rezim, ja, drugi, onPosalji, onZatvori }: Props = $props();

  let dijalog: HTMLDialogElement;

  // svelte-ignore state_referenced_locally
  const pocetak: PredlogBoravka =
    rezim.vrsta === 'dodaj'
      ? { vrsta: 'izuzetak', kod: ja.id, od: `${rezim.datum}T08:00`, do: `${rezim.datum}T20:00`, napomena: '' }
      : { ...rezim.boravak };

  let vrstaBoravka = $state<VrstaBoravka>(pocetak.vrsta);
  let kod = $state(pocetak.kod);
  let odDatum = $state(datumDela(pocetak.od));
  let odVreme = $state(vremeDela(pocetak.od));
  let doDatum = $state(datumDela(pocetak.do));
  let doVreme = $state(vremeDela(pocetak.do));
  let napomena = $state(pocetak.napomena);
  let korak = $state(0);
  let ponavljajDo = $state(plusDana(datumDela(pocetak.od), 56));
  let poruka = $state('');
  let greska = $state<string | null>(null);
  let salje = $state(false);

  let roditelji = $derived([ja, drugi]);
  // svelte-ignore state_referenced_locally
  const naslov = { dodaj: 'Predloži promenu u kalendaru', izmeni: 'Predloži izmenu', obrisi: 'Predloži brisanje' }[rezim.vrsta];

  let predlozi = $derived.by(() => {
    const p: PredlogBoravka = {
      vrsta: vrstaBoravka,
      kod,
      od: `${odDatum}T${odVreme}`,
      do: `${doDatum}T${doVreme}`,
      napomena,
    };
    return rezim.vrsta === 'dodaj' && vrstaBoravka === 'redovno' && korak > 0 ? ponovi(p, korak, ponavljajDo) : [p];
  });

  onMount(() => dijalog.showModal());

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    greska = null;
    salje = true;
    try {
      await onPosalji({
        vrsta: rezim.vrsta,
        boravakId: rezim.vrsta === 'dodaj' ? null : rezim.boravak.id,
        boravci: rezim.vrsta === 'obrisi' ? [] : predlozi,
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

<dialog bind:this={dijalog} class="dijalog" style="--sirina-dijaloga: 34rem" onclose={onZatvori}>
  <form method="dialog" onsubmit={posalji}>
    <p class="eyebrow">Kalendar</p>
    <h2>{naslov}</h2>

    {#if rezim.vrsta === 'obrisi'}
      <p class="postojeci">
        <i class="dot" style="background: var(--{rezim.boravak.kod === ja.id ? ja.boja : drugi.boja})"></i>
        Kod {rezim.boravak.kod === ja.id ? ja.oznakaGenitiv : drugi.oznakaGenitiv} · {opseg(rezim.boravak.od, rezim.boravak.do)}
      </p>
    {:else}
      {#if rezim.vrsta === 'dodaj'}
        <div class="field">
          <span class="label">Vrsta</span>
          <div class="chips">
            <button type="button" class="chip chip-toggle" aria-pressed={vrstaBoravka === 'izuzetak'} onclick={() => (vrstaBoravka = 'izuzetak')}>
              Jednokratna promena
            </button>
            <button type="button" class="chip chip-toggle" aria-pressed={vrstaBoravka === 'redovno'} onclick={() => (vrstaBoravka = 'redovno')}>
              Redovan raspored
            </button>
          </div>
          <span class="pomoc">
            {vrstaBoravka === 'izuzetak'
              ? 'Važi preko redovnog rasporeda, npr. zamena vikenda.'
              : 'Stalni raspored; može da se ponavlja.'}
          </span>
        </div>
      {/if}

      <div class="field">
        <span class="label">Kod koga je dete</span>
        <div class="chips">
          {#each roditelji as r (r.id)}
            <button type="button" class="chip chip-toggle roditelj" aria-pressed={kod === r.id} style="--boja: var(--{r.boja})" onclick={() => (kod = r.id)}>
              <i class="dot"></i>{r.oznaka}
            </button>
          {/each}
        </div>
      </div>

      <div class="od-do">
        <label class="field">
          <span class="label">Od</span>
          <span class="par">
            <input class="input" type="date" bind:value={odDatum} required />
            <input class="input" type="time" bind:value={odVreme} required />
          </span>
        </label>
        <label class="field">
          <span class="label">Do</span>
          <span class="par">
            <input class="input" type="date" bind:value={doDatum} required />
            <input class="input" type="time" bind:value={doVreme} required />
          </span>
        </label>
      </div>

      {#if rezim.vrsta === 'dodaj' && vrstaBoravka === 'redovno'}
        <div class="vreme">
          <label class="field">
            <span class="label">Ponavljanje</span>
            <select class="input" bind:value={korak}>
              <option value={0}>Ne ponavlja se</option>
              <option value={7}>Svake nedelje</option>
              <option value={14}>Svake druge nedelje</option>
            </select>
          </label>
          {#if korak > 0}
            <label class="field">
              <span class="label">Do datuma</span>
              <input class="input" type="date" bind:value={ponavljajDo} />
            </label>
          {/if}
        </div>
        {#if korak > 0}<p class="pomoc">Ukupno {predlozi.length} termina u jednom zahtevu.</p>{/if}
      {/if}

      <label class="field">
        <span class="label">Napomena <span class="faint">nije obavezno</span></span>
        <input class="input" bind:value={napomena} placeholder="Npr. preuzimanje ispred škole" />
      </label>
    {/if}

    <label class="field">
      <span class="label">Poruka za {drugi.oznakaAkuzativ} <span class="faint">nije obavezno</span></span>
      <textarea class="input" rows="2" bind:value={poruka} placeholder="Zašto, ukratko"></textarea>
    </label>

    <p class="info">
      {drugi.oznaka} mora da prihvati. Do tada se u kalendaru ništa ne menja, a predlog se vidi kao „čeka potvrdu“.
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

  .pomoc {
    font-size: 0.82rem;
    color: var(--text-faint);
  }

  .roditelj .dot {
    background: var(--boja);
  }

  .roditelj[aria-pressed='true'] {
    color: var(--boja);
    border-color: var(--boja);
    background: color-mix(in srgb, var(--boja) 10%, transparent);
  }

  .vreme {
    display: grid;
    gap: 1rem;
  }

  @media (min-width: 560px) {
    .vreme {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* From and to each get a full row: date and time side by side always fit. */
  .od-do {
    display: grid;
    gap: 1rem;
  }

  .par {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(7rem, 9.5rem);
    gap: 0.4rem;
  }

  .par .input {
    min-width: 0;
  }

  .postojeci {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
