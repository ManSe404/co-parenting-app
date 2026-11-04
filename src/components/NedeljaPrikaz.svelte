<script lang="ts" module>
  import type { Dogadjaj as D, PredlogDogadjaja as PD } from '../lib/dogadjaji';
  import type { ZahtevKalendara as Z } from '../lib/kalendar';

  export interface Izbor {
    dogadjaj: D | PD;
    datum: string;
    zahtev: Z | null;
  }
</script>

<script lang="ts">
  // Week (or 3-day on phones) time grid, in the style of a calendar app.
  // Each day column is tinted by who has the child; handovers are marked
  // across the column; activities sit on top as blocks.
  import { onMount } from 'svelte';
  import { uDan } from '../lib/domen';
  import { type PrimopredajaDana, VRSTE_DOGADJAJA, primopredajeDana, rasporediKolone } from '../lib/dogadjaji';
  import { segmentiDana } from '../lib/kalendar';
  import { type Blok, blokovi, hhmm } from '../lib/kalendar-prikaz';
  import { type Tacka, prevlacenje } from '../lib/prevlacenje';
  import { prelazak, roditeljPoId } from '../lib/kalendar-opis';
  import Ikona from './Ikona.svelte';
  import type { Podaci, Stavka } from '../lib/tipovi';

  interface Props {
    podaci: Podaci;
    dani: string[];
    danas: string;
    sada: Date;
    izabran: string;
    onDan: (datum: string) => void;
    onPojava: (izbor: Izbor) => void;
    onSlot: (datum: string, vreme: string) => void;
    onStavka: (s: Stavka) => void;
    onPrelazak: (datum: string, p: PrimopredajaDana) => void;
    /** An activity block dropped on a day and start time (minutes). */
    onPomeriAktivnost: (blok: Blok, datum: string, odMin: number) => void;
    /** A handover box dragged to another time on its day. */
    onPomeriPrelazak: (datum: string, p: PrimopredajaDana, novMin: number) => void;
    /** Changes when the parent asks to scroll to the current hour ("Danas"). */
    skrolKljuc?: number;
  }

  let {
    podaci,
    dani,
    danas,
    sada,
    izabran,
    onDan,
    onPojava,
    onSlot,
    onStavka,
    onPrelazak,
    onPomeriAktivnost,
    onPomeriPrelazak,
    skrolKljuc = 0,
  }: Props = $props();

  const SAT = 46; // px per hour
  const nazivDana = new Intl.DateTimeFormat('sr-Latn-RS', { weekday: 'short' });
  let telo: HTMLDivElement;

  onMount(() => {
    telo.scrollTop = 7 * SAT - 6;
  });

  // "Danas": scroll so the current hour sits near the top, with an hour above it.
  $effect(() => {
    if (skrolKljuc > 0 && telo) {
      const min = sada.getHours() * 60 + sada.getMinutes();
      telo.scrollTo({ top: Math.max(0, ((min - 60) / 60) * SAT), behavior: 'smooth' });
    }
  });

  let svi = $derived(dani.length ? blokovi(podaci, dani[0], dani[dani.length - 1]) : []);

  // A handover box takes this much room in the grid, so it can hold two lines.
  const PRELAZAK_MIN = 45;

  function zaDan(datum: string) {
    const dana = svi.filter((b) => b.datum === datum);
    const primopredaje = primopredajeDana(datum, podaci.boravci);
    // Activities and handovers share the width when they overlap in time.
    const raspored = rasporediKolone([
      ...dana.filter((b) => !b.ceoDan).map((b) => ({ ...b, tip: 'akt' as const, pp: null })),
      ...primopredaje.map((p) => ({
        kljuc: `pp-${datum}-${p.min}`,
        tip: 'prelazak' as const,
        pp: p,
        odMin: p.min,
        doMin: Math.min(1440, p.min + PRELAZAK_MIN),
      })),
    ]);
    return {
      ceoDan: dana.filter((b) => b.ceoDan),
      vremenski: raspored,
      stavke: podaci.stavke.filter((s) => s.datum === datum),
      segmenti: segmentiDana(datum, podaci.boravci),
      primopredaje,
    };
  }

  function boja(kod: string | null): string {
    const r = roditeljPoId(podaci, kod);
    return r ? `var(--${r.boja})` : 'transparent';
  }

  function bojaVrste(v: string): string {
    return VRSTE_DOGADJAJA.find((x) => x.kljuc === v)?.boja ?? 'var(--text-faint)';
  }

  function klikNaKolonu(e: MouseEvent, datum: string) {
    if ((e.target as HTMLElement).closest('.blok, .prelazak')) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const min = Math.max(0, Math.min(23 * 60, Math.floor(((e.clientY - r.top) / SAT) * 2) * 30));
    onSlot(datum, hhmm(min));
  }

  let sadaMin = $derived(sada.getHours() * 60 + sada.getMinutes());

  // ---- Dragging: where would the block land? ----
  let mreza: HTMLDivElement;
  let senka = $state<{ datum: string; odMin: number; trajanje: number; boja: string } | null>(null);

  function gdeSlece(datum: string | null, t: Tacka): { datum: string; min: number } | null {
    if (!datum) return null;
    const kol = mreza?.querySelector<HTMLElement>(`.kolona[data-dan="${datum}"]`);
    if (!kol) return null;
    const vrh = t.y - t.pomakY - kol.getBoundingClientRect().top;
    const min = Math.round(((vrh / SAT) * 60) / 15) * 15;
    return { datum, min: Math.max(0, Math.min(24 * 60 - 15, min)) };
  }

  function vucenjeAktivnosti(b: Blok) {
    const trajanje = b.doMin - b.odMin;
    return {
      id: b.kljuc,
      atribut: 'dan',
      iskljuceno: b.stanje !== 'potvrdjen',
      onPreko: () => {},
      onPomeraj: (t: Tacka, datum: string | null) => {
        const g = gdeSlece(datum, t);
        senka = g ? { datum: g.datum, odMin: g.min, trajanje, boja: bojaVrste(b.dogadjaj.vrsta) } : null;
      },
      onPusti: (_id: string, datum: string, t: Tacka) => {
        const g = gdeSlece(datum, t);
        if (g && (g.datum !== b.datum || g.min !== b.odMin)) onPomeriAktivnost(b, g.datum, g.min);
      },
      onKraj: () => (senka = null),
    };
  }

  function vucenjePrelaska(datum: string, pp: PrimopredajaDana) {
    return {
      id: `pp-${datum}-${pp.min}`,
      atribut: 'dan',
      osa: 'y' as const,
      onPreko: () => {},
      onPomeraj: (t: Tacka) => {
        const g = gdeSlece(datum, t);
        senka = g ? { datum, odMin: g.min, trajanje: PRELAZAK_MIN, boja: boja(pp.ka) } : null;
      },
      onPusti: (_id: string, _d: string, t: Tacka) => {
        const g = gdeSlece(datum, t);
        if (g && g.min !== pp.min) onPomeriPrelazak(datum, pp, g.min);
      },
      onKraj: () => (senka = null),
    };
  }
</script>

<div class="nedelja" style="--n: {dani.length}; --sat: {SAT}px">
  <!-- Day headers -->
  <div class="glava">
    <span class="ugao"></span>
    {#each dani as datum (datum)}
      <button class="dan-glava" class:danas={datum === danas} class:izabran={datum === izabran} onclick={() => onDan(datum)}>
        <span class="dg-ime">{nazivDana.format(uDan(datum))}</span>
        <span class="dg-broj">{uDan(datum).getDate()}</span>
      </button>
    {/each}
  </div>

  <!-- All-day row: all-day activities and items with a date -->
  <div class="ceo-dan-red">
    <span class="ugao mono">ceo dan</span>
    {#each dani as datum (datum)}
      {@const z = zaDan(datum)}
      <div class="ceo-dan-celija">
        {#each z.ceoDan as b (b.kljuc)}
          <button
            class="cip"
            class:predlog={b.stanje === 'predlog'}
            class:brise={b.stanje === 'brisanje' || b.stanje === 'izmena'}
            style="--boja: {bojaVrste(b.dogadjaj.vrsta)}"
            onclick={() => onPojava({ dogadjaj: b.dogadjaj, datum: b.datum, zahtev: b.zahtev })}>{b.dogadjaj.naziv}</button
          >
        {/each}
        {#each z.stavke as s (s.id)}
          <button class="cip stavka" onclick={() => onStavka(s)} title="Stavka sa datumom">◆ {s.naslov}</button>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Time grid -->
  <div class="telo" bind:this={telo}>
    <div class="mreza" bind:this={mreza}>
      <div class="sati" aria-hidden="true">
        {#each Array.from({ length: 24 }, (_, i) => i) as h (h)}
          <span class="sat" style="top: {h * SAT}px">{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>
        {/each}
      </div>

      {#each dani as datum (datum)}
        {@const z = zaDan(datum)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="kolona" data-dan={datum} class:danas={datum === danas} onclick={(e) => klikNaKolonu(e, datum)}>
          {#each z.segmenti as s, i (i)}
            <span
              class="boravak"
              style="top: {(s.od / 60) * SAT}px; height: {((s.do - s.od) / 60) * SAT}px; --boja: {boja(s.kod)}"
              class:izuzetak={s.izuzetak}
            ></span>
          {/each}

          {#each z.primopredaje as p (p.min)}
            <span class="primopredaja-linija" style="top: {(p.min / 60) * SAT}px; --boja: {boja(p.ka)}" aria-hidden="true"></span>
          {/each}

          {#each z.vremenski as b (b.kljuc)}
            {#if b.tip === 'prelazak' && b.pp}
              {@const pp = b.pp}
              {@const t = prelazak(podaci, pp.ka)}
              <button
                class="prelazak"
                class:moj={t.moj}
                style="top: {(pp.min / 60) * SAT}px; height: {(PRELAZAK_MIN / 60) * SAT - 3}px;
                  left: calc({(b.kolona / b.kolona_ukupno) * 100}% + 8px); width: calc({100 / b.kolona_ukupno}% - 10px);
                  --boja: {boja(pp.ka)}"
                onclick={() => onPrelazak(datum, pp)}
                use:prevlacenje={vucenjePrelaska(datum, pp)}
                aria-label="{hhmm(pp.min)}, {t.naslov}, {t.ko}. Prevuci gore ili dole za drugo vreme."
              >
                <span class="pr-vrh"><Ikona ime="prelazak" velicina={13} /> {hhmm(pp.min)}<span class="pr-siroko">&nbsp;· {t.naslov}</span></span>
                <span class="pr-ko pr-siroko">{t.ko}</span>
                <span class="pr-usko">{t.naslov.replace(/^Ide /, '')}</span>
              </button>
            {:else if b.tip === 'akt'}
            <button
              class="blok"
              class:predlog={b.stanje === 'predlog'}
              class:brise={b.stanje === 'brisanje' || b.stanje === 'izmena'}
              class:kratak={b.doMin - b.odMin < 45}
              style="top: {(b.odMin / 60) * SAT}px; height: {Math.max(20, ((b.doMin - b.odMin) / 60) * SAT - 2)}px;
                left: calc({(b.kolona / b.kolona_ukupno) * 100}% + 8px); width: calc({100 / b.kolona_ukupno}% - 10px);
                --boja: {bojaVrste(b.dogadjaj.vrsta)}"
              onclick={() => onPojava({ dogadjaj: b.dogadjaj, datum: b.datum, zahtev: b.zahtev })}
              use:prevlacenje={vucenjeAktivnosti(b)}
            >
              <span class="b-naziv">{b.dogadjaj.naziv}</span>
              <span class="b-vreme">
                {hhmm(b.odMin)}–{hhmm(b.doMin)}{#if b.dogadjaj.vodi}&nbsp;· {roditeljPoId(podaci, b.dogadjaj.vodi)?.oznaka}{/if}
              </span>
              {#if b.stanje === 'predlog'}<span class="b-ceka">čeka potvrdu</span>{/if}
              {#if b.stanje === 'izmena'}<span class="b-ceka">predlog izmene</span>{/if}
              {#if b.stanje === 'brisanje'}<span class="b-ceka">predlog brisanja</span>{/if}
            </button>
            {/if}
          {/each}

          {#if datum === danas}
            <span class="sada" style="top: {(sadaMin / 60) * SAT}px" aria-hidden="true"></span>
          {/if}

          {#if senka?.datum === datum}
            <span
              class="senka"
              style="top: {(senka.odMin / 60) * SAT}px; height: {(senka.trajanje / 60) * SAT - 2}px; --boja: {senka.boja}"
              aria-hidden="true"
            >
              {hhmm(senka.odMin)}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .nedelja {
    --kolone: 3.1rem repeat(var(--n), minmax(0, 1fr));
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }

  .glava,
  .ceo-dan-red,
  .mreza {
    display: grid;
    grid-template-columns: var(--kolone);
  }

  .glava {
    border-bottom: 1px solid var(--border);
  }

  .ugao {
    font-size: 0.6rem;
    color: var(--text-faint);
    display: grid;
    place-items: center;
    text-align: center;
  }

  .dan-glava {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    padding: 0.5rem 0 0.45rem;
    border-left: 1px solid var(--border);
  }

  .dg-ime {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .dg-broj {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 50%;
    font-size: 1.15rem;
    font-weight: 600;
  }

  .dan-glava.danas .dg-ime {
    color: var(--bio);
  }

  .dan-glava.danas .dg-broj {
    background: var(--bio);
    color: var(--on-accent);
  }

  .dan-glava.izabran:not(.danas) .dg-broj {
    background: var(--surface-hover);
    box-shadow: inset 0 0 0 1px var(--bio);
  }

  .ceo-dan-red {
    border-bottom: 1px solid var(--border-strong);
    min-height: 1.9rem;
  }

  .ceo-dan-celija {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 3px;
    border-left: 1px solid var(--border);
    min-width: 0;
  }

  .cip {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 0.72rem;
    padding: 0.15rem 0.4rem;
    border-radius: 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text);
    background: color-mix(in srgb, var(--boja) 22%, var(--bg-raised));
    border-left: 3px solid var(--boja);
  }

  .cip.stavka {
    --boja: var(--warn);
    background: var(--warn-soft);
    color: var(--warn);
  }

  .telo {
    max-height: min(68vh, 40rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .mreza {
    position: relative;
    height: calc(24 * var(--sat));
  }

  .sati {
    position: relative;
  }

  .sat {
    position: absolute;
    right: 0.4rem;
    transform: translateY(-50%);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--text-faint);
  }

  .kolona {
    position: relative;
    border-left: 1px solid var(--border);
    background-image: linear-gradient(var(--border) 1px, transparent 1px);
    background-size: 100% var(--sat);
    cursor: copy;
  }

  .kolona.danas {
    background-color: color-mix(in srgb, var(--bio) 3%, transparent);
  }

  /* Who has the child: a tint over the column and a solid strip on its left. */
  .boravak {
    position: absolute;
    left: 0;
    right: 0;
    background: color-mix(in srgb, var(--boja) 7%, transparent);
    border-left: 5px solid var(--boja);
    pointer-events: none;
  }

  .boravak.izuzetak {
    border-left-style: dashed;
  }

  /* The exact moment of a handover, across the whole day column. */
  .primopredaja-linija {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 2px solid var(--boja);
    z-index: 2;
    pointer-events: none;
  }

  /* The handover box: "15:00 · Ide kod tate / ti preuzimaš". */
  .prelazak {
    position: absolute;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 0.05rem;
    padding: 0.15rem 0.45rem;
    border-radius: 7px;
    text-align: left;
    overflow: hidden;
    color: var(--on-accent);
    background: var(--boja);
    box-shadow: 0 6px 16px -10px var(--boja);
    cursor: pointer;
  }

  /* Narrow columns (3-day view on phones): time, then "kod tate". */
  .prelazak {
    container-type: inline-size;
  }

  .pr-usko {
    display: none;
    font-size: 0.66rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  @container (max-width: 150px) {
    .pr-siroko {
      display: none;
    }

    .pr-usko {
      display: block;
    }
  }

  .prelazak.moj {
    box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--boja), 0 8px 20px -8px var(--boja);
  }

  .pr-vrh {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pr-ko {
    font-size: 0.66rem;
    font-weight: 500;
    opacity: 0.9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .blok {
    position: absolute;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.05rem;
    padding: 0.2rem 0.35rem;
    border-radius: 6px;
    text-align: left;
    overflow: hidden;
    color: var(--text);
    background: color-mix(in srgb, var(--boja) 26%, var(--bg-raised));
    border: 1px solid color-mix(in srgb, var(--boja) 45%, transparent);
    border-left: 3px solid var(--boja);
    box-shadow: 0 4px 12px -8px rgba(0, 0, 0, 0.6);
    cursor: pointer;
  }

  .blok:hover {
    filter: brightness(1.08);
  }

  .blok.predlog,
  .cip.predlog {
    background: color-mix(in srgb, var(--boja) 10%, var(--bg-raised));
    border: 1.5px dashed var(--warn);
    border-left: 3px dashed var(--boja);
  }

  .blok.brise,
  .cip.brise {
    opacity: 0.6;
    text-decoration: line-through;
  }

  .b-naziv {
    font-size: 0.74rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .b-vreme,
  .b-ceka {
    font-size: 0.64rem;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .b-ceka {
    color: var(--warn);
    text-decoration: none;
  }

  .blok.kratak {
    flex-direction: row;
    gap: 0.3rem;
    align-items: center;
  }

  .blok.kratak .b-ceka {
    display: none;
  }

  /* Where a dragged block would land. */
  .senka {
    position: absolute;
    left: 6px;
    right: 4px;
    z-index: 5;
    padding: 0.1rem 0.4rem;
    border-radius: 7px;
    border: 2px dashed var(--boja);
    background: color-mix(in srgb, var(--boja) 14%, transparent);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text);
    pointer-events: none;
  }

  .blok,
  .prelazak {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: auto;
  }

  :global(.blok.se-vuce),
  :global(.prelazak.se-vuce) {
    opacity: 0.35;
  }

  .sada {
    position: absolute;
    left: -1px;
    right: 0;
    height: 2px;
    background: var(--hitno);
    z-index: 4;
    pointer-events: none;
  }

  .sada::before {
    content: '';
    position: absolute;
    left: -5px;
    top: -4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--hitno);
  }
</style>
