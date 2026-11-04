<script lang="ts" module>
  import type { Dogadjaj, PrimopredajaDana } from '../lib/dogadjaji';

  export type Pomeranje =
    | { tip: 'aktivnost'; dogadjaj: Dogadjaj; saDatum: string; naDatum: string; naOdMin: number | null }
    | { tip: 'prelazak'; datum: string; pp: PrimopredajaDana; novMin: number };
</script>

<script lang="ts">
  // Confirms a drag in the calendar and turns it into a proposal.
  import { onMount } from 'svelte';
  import { pomeriDogadjaj } from '../lib/dogadjaji';
  import { pomeriPrelazak } from '../lib/kalendar';
  import { opisDogadjaja, prelazak, roditeljPoId } from '../lib/kalendar-opis';
  import { hhmm } from '../lib/kalendar-prikaz';
  import { danDugo, datumKratko } from '../lib/format';
  import type { Izvor } from '../lib/izvor';
  import type { Podaci } from '../lib/tipovi';

  interface Props {
    pomeranje: Pomeranje;
    podaci: Podaci;
    izvor: Izvor;
    onGotovo: (poruka: string) => void;
    onZatvori: () => void;
  }

  let { pomeranje, podaci, izvor, onGotovo, onZatvori }: Props = $props();

  let dijalog: HTMLDialogElement;
  let svakiPut = $state(false);
  let poruka = $state('');
  let greska = $state<string | null>(null);
  let salje = $state(false);

  onMount(() => dijalog.showModal());

  let ponavlja = $derived(pomeranje.tip === 'aktivnost' && pomeranje.dogadjaj.ponavljanje.tip !== 'ne');

  // What it was and what it becomes, in plain words.
  let opis = $derived.by(() => {
    const p = pomeranje;
    if (p.tip === 'prelazak') {
      const t = prelazak(podaci, p.pp.ka);
      return {
        naslov: `${t.naslov}: drugo vreme`,
        bilo: `${danDugo(p.datum)} u ${hhmm(p.pp.min)}`,
        postaje: `${danDugo(p.datum)} u ${hhmm(p.novMin)}`,
        napomena:
          p.novMin > p.pp.min
            ? `Ostaje duže kod ${roditeljPoId(podaci, p.pp.od)?.oznakaGenitiv ?? '?'}. Samo tog dana; redovan raspored se ne menja.`
            : `${roditeljPoId(podaci, p.pp.ka)?.oznaka ?? '?'} preuzima ranije. Samo tog dana; redovan raspored se ne menja.`,
      };
    }
    const d = p.dogadjaj;
    const trajanje = d.ceoDan ? '' : ` ${d.od}–${d.do}`;
    let novo = '';
    try {
      const ulaz = pomeriDogadjaj(d, p.saDatum, p.naDatum, p.naOdMin, svakiPut || !ponavlja);
      novo = ulaz.dogadjaj ? opisDogadjaja(podaci, ulaz.dogadjaj) : '';
    } catch (e) {
      novo = e instanceof Error ? e.message : String(e);
    }
    return { naslov: `Pomeri: ${d.naziv}`, bilo: `${datumKratko(p.saDatum)}${trajanje}`, postaje: novo, napomena: '' };
  });

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    greska = null;
    salje = true;
    try {
      const p = pomeranje;
      if (p.tip === 'prelazak') {
        await izvor.predloziKalendar({
          vrsta: 'dodaj',
          boravakId: null,
          boravci: [pomeriPrelazak(p.datum, p.pp, p.novMin)],
          poruka,
        });
      } else {
        const ulaz = pomeriDogadjaj(p.dogadjaj, p.saDatum, p.naDatum, p.naOdMin, svakiPut || !ponavlja);
        await izvor.predloziDogadjaj({ ...ulaz, poruka });
      }
      dijalog.close();
      onGotovo(`Predlog je poslat. Čeka da ${podaci.drugi.oznaka.toLocaleLowerCase('sr')} prihvati.`);
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      salje = false;
    }
  }
</script>

<dialog bind:this={dijalog} class="dijalog" style="--sirina-dijaloga: 28rem" onclose={onZatvori}>
  <form method="dialog" onsubmit={posalji}>
    <p class="eyebrow">Kalendar · pomeranje</p>
    <h2>{opis.naslov}</h2>

    <dl class="promena">
      <div><dt>Bilo</dt><dd class="bilo">{opis.bilo}</dd></div>
      <div><dt>Postaje</dt><dd>{opis.postaje}</dd></div>
    </dl>
    {#if opis.napomena}<p class="dim">{opis.napomena}</p>{/if}

    {#if ponavlja}
      <div class="field">
        <span class="label">Ponavlja se. Šta pomeraš?</span>
        <div class="chips">
          <button type="button" class="chip chip-toggle" aria-pressed={!svakiPut} onclick={() => (svakiPut = false)}>Samo ovaj put</button>
          <button type="button" class="chip chip-toggle" aria-pressed={svakiPut} onclick={() => (svakiPut = true)}>Svaki put</button>
        </div>
      </div>
    {/if}

    <label class="field">
      <span class="label">Poruka za {podaci.drugi.oznakaAkuzativ} <span class="faint">nije obavezno</span></span>
      <textarea class="input" rows="2" bind:value={poruka} placeholder="Ukratko, zašto"></textarea>
    </label>

    <p class="info">{podaci.drugi.oznaka} mora da prihvati. Do tada se u kalendaru ništa ne menja.</p>
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
    gap: 0.9rem;
    padding: 1.4rem;
  }

  h2 {
    font-size: 1.3rem;
  }

  .label .faint {
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .promena {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0;
  }

  .promena div {
    display: grid;
    grid-template-columns: 5rem 1fr;
    gap: 0.5rem;
  }

  .promena dt {
    color: var(--text-dim);
    font-size: 0.88rem;
  }

  .promena dd {
    margin: 0;
    font-weight: 500;
  }

  .promena dd::first-letter {
    text-transform: uppercase;
  }

  .bilo {
    color: var(--text-dim);
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
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
