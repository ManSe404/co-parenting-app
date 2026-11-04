<script lang="ts">
  import { DANA_ZATVORENO, type Kolona, KOLONE, jeHitno, kolona, naPotezu, poHitnosti, potezZaKolonu } from '../lib/domen';
  import type { Izvor } from '../lib/izvor';
  import { rok } from '../lib/format';
  import { prevlacenje } from '../lib/prevlacenje';
  import { putanje } from '../lib/putanje';
  import type { Podaci, Stavka } from '../lib/tipovi';
  import Ikona from './Ikona.svelte';
  import PotezDijalog, { type VrstaDijaloga } from './PotezDijalog.svelte';

  interface Props {
    podaci: Podaci;
    stavke: Stavka[];
    izvor: Izvor;
    onPromena: () => Promise<void>;
  }

  let { podaci, stavke, izvor, onPromena }: Props = $props();

  const sada = new Date();
  const granica = sada.getTime() - DANA_ZATVORENO * 86_400_000;

  const ZAGLAVLJA: Record<Kolona, { naziv: string; opis: string }> = {
    stavke: { naziv: 'Stavke', opis: 'čeka odgovor' },
    aktivno: { naziv: 'Aktivno', opis: 'u dogovoru' },
    reseno: { naziv: 'Rešeno', opis: 'odluka zapisana' },
  };

  let preko = $state<Kolona | null>(null);
  let izvorKolona = $state<Kolona | null>(null);
  let dijalog = $state<{ vrsta: VrstaDijaloga; stavka: Stavka; uAktivno?: boolean } | null>(null);
  let poruka = $state<string | null>(null);
  let porukaTajmer: ReturnType<typeof setTimeout> | undefined;

  let kolone = $derived.by(() => {
    const red = poHitnosti(sada);
    const k: Record<Kolona, Stavka[]> = { stavke: [], aktivno: [], reseno: [] };
    for (const s of stavke) k[kolona(s)].push(s);
    k.stavke.sort(red);
    k.aktivno.sort(red);
    // Rešeno: pending proposals first, then what closed in the last 30 days.
    const predlozi = k.reseno.filter((s) => s.stanje !== 'zatvoreno').sort(red);
    const zatvorene = k.reseno
      .filter((s) => s.stanje === 'zatvoreno' && s.zatvoreno !== null && Date.parse(s.zatvoreno) >= granica)
      .sort((a, b) => (b.zatvoreno ?? '').localeCompare(a.zatvoreno ?? ''));
    k.reseno = [...predlozi, ...zatvorene];
    return k;
  });

  let starijih = $derived(
    stavke.filter((s) => s.stanje === 'zatvoreno' && (s.zatvoreno === null || Date.parse(s.zatvoreno) < granica)).length,
  );

  function nazivOblasti(kljuc: string): string {
    return podaci.oblasti.find((o) => o.kljuc === kljuc)?.naziv ?? kljuc;
  }

  function javi(tekst: string) {
    poruka = tekst;
    clearTimeout(porukaTajmer);
    porukaTajmer = setTimeout(() => (poruka = null), 3500);
  }

  function pusti(id: string, cilj: string) {
    izvorKolona = null;
    const s = stavke.find((x) => x.id === id);
    if (!s || !KOLONE.includes(cilj as Kolona)) return;
    const potez = potezZaKolonu(s, cilj as Kolona, podaci.ja.id);
    switch (potez.vrsta) {
      case 'nista':
        return;
      case 'zabranjeno':
        javi(potez.razlog);
        return;
      case 'povuci':
        dijalog = { vrsta: 'povuci', stavka: s, uAktivno: true };
        return;
      default:
        dijalog = { vrsta: potez.vrsta, stavka: s };
    }
  }

  async function izvrsi(tekst: string) {
    if (!dijalog) return;
    const { vrsta, stavka, uAktivno } = dijalog;
    const id = stavka.id;
    if (vrsta === 'aktiviraj') await izvor.aktiviraj(id, tekst);
    else if (vrsta === 'predlozi') await izvor.predloziZatvaranje(id, tekst);
    else if (vrsta === 'potvrdi') await izvor.potvrdiZatvaranje(id);
    else if (vrsta === 'odbij') await izvor.odbijZatvaranje(id, tekst);
    else if (vrsta === 'povuci') await izvor.povuciPredlog(id, uAktivno);
    else if (vrsta === 'ponovo') await izvor.ponovoOtvori(id, tekst);
    await onPromena();
  }

  function opcije(s: Stavka) {
    return {
      id: s.id,
      onPreko: (k: string | null) => {
        izvorKolona = kolona(s);
        preko = (k as Kolona | null) ?? null;
      },
      onPusti: pusti,
      onKraj: () => {
        izvorKolona = null;
        preko = null;
      },
    };
  }
</script>

<p class="uputstvo">
  Prevuci karticu u drugu kolonu. Na telefonu je prvo zadrži prstom.
</p>

<div class="tabla" class:vuce={izvorKolona !== null}>
  {#each KOLONE as k (k)}
    {@const z = ZAGLAVLJA[k]}
    <section
      class="kolona kolona-{k}"
      data-kolona={k}
      class:preko={preko === k && izvorKolona !== k}
      class:zabranjena={preko === k && k === 'stavke' && izvorKolona !== 'stavke'}
      aria-label={z.naziv}
    >
      <header class="kolona-glava">
        <span class="kolona-naziv"><i class="dot dot-{k === 'stavke' ? 'neodgovoreno' : k === 'aktivno' ? 'otvoreno' : 'zatvoreno'}"></i>{z.naziv}</span>
        <span class="kolona-broj">{kolone[k].length}</span>
        <span class="kolona-opis">{z.opis}</span>
      </header>

      <ul class="kartice">
        {#each kolone[k] as s (s.id)}
          {@const hitno = jeHitno(s, sada)}
          {@const mojPotez = naPotezu(s, podaci.ja.id)}
          <li>
            <article
              class="kartica"
              class:hitna={hitno}
              class:predlog={s.zatvaranjePredlozio !== null}
              class:zatvorena={s.stanje === 'zatvoreno'}
              data-stavka={s.id}
              use:prevlacenje={opcije(s)}
            >
              {#if hitno || (s.vazno && s.stanje !== 'zatvoreno')}
                <span class="znakovi">
                  {#if hitno}<span class="znak znak-hitno">Hitno</span>{/if}
                  {#if s.vazno && s.stanje !== 'zatvoreno'}<span class="znak znak-vazno">Važno</span>{/if}
                </span>
              {/if}

              <a class="k-naslov" href={putanje.stavka(s.id)} draggable="false">{s.naslov}</a>

              <span class="k-meta">
                <span class="k-oblast" style="--boja: var(--oblast-{s.oblast})" title={nazivOblasti(s.oblast)}>
                  <Ikona ime={s.oblast} velicina={13} /><span class="k-oblast-ime">{nazivOblasti(s.oblast)}</span>
                </span>
                {#if s.datum && s.stanje !== 'zatvoreno'}<span class="k-rok" class:gori={hitno}>{rok(s.datum, sada)}</span>{/if}
              </span>

              {#if s.zatvaranjePredlozio}
                <span class="k-predlog">
                  <span class="k-odluka">„{s.odluka}“</span>
                  {#if mojPotez}
                    <span class="k-dugmad">
                      <button class="btn mini" onclick={() => (dijalog = { vrsta: 'potvrdi', stavka: s })}>Potvrdi</button>
                      <button class="btn btn-ghost mini" onclick={() => (dijalog = { vrsta: 'odbij', stavka: s })}>Odbij</button>
                    </span>
                  {:else}
                    <span class="k-ceka">čeka da {podaci.drugi.oznaka.toLocaleLowerCase('sr')} potvrdi</span>
                  {/if}
                </span>
              {:else if s.stanje === 'zatvoreno' && s.odluka}
                <span class="k-odluka">{s.odluka}</span>
              {:else if mojPotez}
                <span class="k-potez">na tebi je</span>
              {/if}
            </article>
          </li>
        {/each}
      </ul>

      {#if kolone[k].length === 0}
        <p class="prazno">{k === 'reseno' ? 'Ništa rešeno u poslednjih 30 dana.' : 'Prazno.'}</p>
      {/if}

      {#if k === 'reseno' && starijih > 0}
        <a class="starije" href={putanje.stavke({ prikaz: 'istorija' })}>
          Starije rešene ({starijih}) u istoriji <Ikona ime="strelica" velicina={13} />
        </a>
      {/if}
    </section>
  {/each}
</div>

{#if dijalog}
  <PotezDijalog
    vrsta={dijalog.vrsta}
    stavka={dijalog.stavka}
    drugi={podaci.drugi.oznaka}
    onPotvrdi={izvrsi}
    onZatvori={() => (dijalog = null)}
  />
{/if}

{#if poruka}
  <div class="poruka" role="status">{poruka}</div>
{/if}

<style>
  .uputstvo {
    font-size: 0.84rem;
    color: var(--text-faint);
    margin-bottom: 0.75rem;
  }

  .tabla {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(0.4rem, 1.6vw, 1rem);
    align-items: stretch;
  }

  .kolona {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-height: 60vh;
    padding: clamp(0.45rem, 1.4vw, 0.85rem);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--surface-hover) 70%, transparent);
    border: 1px dashed transparent;
    transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
  }

  .vuce .kolona {
    border-color: var(--border);
  }

  .kolona.preko {
    border-color: var(--bio);
    background: var(--bio-soft);
  }

  .kolona.zabranjena {
    border-color: var(--hitno-line);
    background: var(--hitno-soft);
  }

  .kolona-glava {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.1rem 0.4rem;
    padding: 0.2rem 0.25rem 0.35rem;
  }

  .kolona-naziv {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 600;
    font-size: clamp(0.88rem, 2.4vw, 1.05rem);
  }

  .kolona-broj {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  .kolona-opis {
    grid-column: 1 / -1;
    font-size: 0.74rem;
    color: var(--text-faint);
  }

  .kartice {
    display: flex;
    flex-direction: column;
    gap: clamp(0.4rem, 1.2vw, 0.6rem);
  }

  .kartica {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: clamp(0.55rem, 1.6vw, 0.85rem) clamp(0.55rem, 1.6vw, 0.9rem);
    border-radius: 11px;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    box-shadow: 0 6px 18px -14px rgba(0, 0, 0, 0.6);
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    transition: border-color 0.2s var(--ease), transform 0.2s var(--ease), opacity 0.2s var(--ease);
  }

  .kartica:hover {
    border-color: var(--border-strong);
  }

  .kartica.hitna {
    border-color: var(--hitno-line);
    box-shadow: inset 3px 0 0 var(--hitno), 0 6px 18px -14px rgba(0, 0, 0, 0.6);
  }

  .kartica.predlog {
    border-style: dashed;
    border-color: var(--warn-line);
  }

  .kartica.zatvorena {
    opacity: 0.78;
  }

  :global(.kartica.se-vuce) {
    opacity: 0.35;
  }

  :global(.kartica-duh) {
    cursor: grabbing;
    box-shadow: 0 24px 50px -18px rgba(0, 0, 0, 0.7) !important;
    border-color: var(--bio) !important;
    opacity: 0.96;
  }

  :global(html.tabla-vuce),
  :global(html.tabla-vuce *) {
    cursor: grabbing !important;
  }

  /* The title link covers the whole card, so a tap anywhere opens it. */
  .k-naslov {
    font-weight: 500;
    font-size: clamp(0.82rem, 2.3vw, 0.98rem);
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .k-naslov::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  .kartica:hover .k-naslov {
    color: var(--bio);
  }

  .znakovi {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .znak {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.08rem 0.4rem;
    border-radius: 4px;
  }

  .znak-hitno {
    color: var(--on-accent);
    background: var(--hitno);
  }

  .znak-vazno {
    color: var(--ai);
    background: var(--ai-soft);
    border: 1px solid var(--ai-line);
  }

  .k-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.6rem;
    font-size: 0.74rem;
    color: var(--text-dim);
  }

  .k-oblast {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .k-oblast :global(svg) {
    color: var(--boja);
  }

  .k-rok {
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }

  .k-rok.gori {
    color: var(--hitno);
  }

  .k-potez {
    font-size: 0.74rem;
    color: var(--warn);
  }

  .k-predlog {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-top: 0.4rem;
    border-top: 1px dashed var(--warn-line);
  }

  .k-odluka {
    font-size: 0.78rem;
    color: var(--text-dim);
    font-style: italic;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .k-ceka {
    font-size: 0.72rem;
    color: var(--warn);
  }

  .k-dugmad {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .mini {
    padding: 0.3rem 0.55rem;
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .prazno {
    font-size: 0.8rem;
    color: var(--text-faint);
    text-align: center;
    padding: 1.2rem 0.3rem;
  }

  .starije {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-top: auto;
    padding: 0.3rem;
  }

  .starije:hover {
    color: var(--bio);
  }

  .poruka {
    position: fixed;
    left: 50%;
    bottom: calc(1.5rem + var(--donja-traka));
    transform: translateX(-50%);
    z-index: 1100;
    max-width: min(92vw, 28rem);
    padding: 0.7rem 1rem;
    border-radius: var(--radius-sm);
    background: var(--text);
    color: var(--bg);
    font-size: 0.9rem;
    box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.6);
  }

  /* Phone: three narrow columns that all fit, so a card never has far to go. */
  @media (max-width: 620px) {
    .kolona {
      min-height: 50vh;
    }

    .kolona-opis,
    .k-oblast-ime {
      display: none;
    }

    .znak {
      font-size: 0.56rem;
    }

    .k-dugmad {
      flex-direction: column;
    }

    .mini {
      width: 100%;
    }
  }
</style>
