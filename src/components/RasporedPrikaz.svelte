<script lang="ts">
  // Schedule view: day by day, who has the child, handovers, and activities.
  // The handiest view on a phone.
  import { danaDo, plusDana } from '../lib/domen';
  import { VRSTE_DOGADJAJA, primopredajeDana } from '../lib/dogadjaji';
  import { segmentiDana } from '../lib/kalendar';
  import { prelazak, roditeljPoId } from '../lib/kalendar-opis';
  import { blokovi, hhmm } from '../lib/kalendar-prikaz';
  import { danDugo } from '../lib/format';
  import type { Podaci, Stavka } from '../lib/tipovi';
  import type { Izbor } from './NedeljaPrikaz.svelte';

  interface Props {
    podaci: Podaci;
    od: string;
    brojDana: number;
    sada: Date;
    onPojava: (izbor: Izbor) => void;
    onStavka: (s: Stavka) => void;
  }

  let { podaci, od, brojDana, sada, onPojava, onStavka }: Props = $props();

  let dani = $derived(Array.from({ length: brojDana }, (_, i) => plusDana(od, i)));
  let svi = $derived(blokovi(podaci, od, plusDana(od, brojDana - 1)));

  function boja(kod: string | null): string {
    const r = roditeljPoId(podaci, kod);
    return r ? `var(--${r.boja})` : 'var(--text-faint)';
  }

  function genitiv(kod: string | null): string {
    return roditeljPoId(podaci, kod)?.oznakaGenitiv ?? 'nikoga upisanog';
  }

  function bojaVrste(v: string): string {
    return VRSTE_DOGADJAJA.find((x) => x.kljuc === v)?.boja ?? 'var(--text-faint)';
  }

  function naslovDana(datum: string): string {
    const d = danaDo(datum, sada);
    const dugo = danDugo(datum);
    return d === 0 ? `Danas · ${dugo}` : d === 1 ? `Sutra · ${dugo}` : dugo.charAt(0).toUpperCase() + dugo.slice(1);
  }

  function kodKoga(datum: string): string {
    const seg = segmentiDana(datum, podaci.boravci).filter((s) => s.do - s.od > 0);
    if (seg.length === 1) return seg[0].kod ? `Ceo dan kod ${genitiv(seg[0].kod)}` : 'Nije upisano kod koga je';
    return seg
      .map((s, i) => (i === 0 ? `do ${hhmm(s.do)} kod ${genitiv(s.kod)}` : `od ${hhmm(s.od)} kod ${genitiv(s.kod)}`))
      .join(' · ');
  }
</script>

<ol class="raspored">
  {#each dani as datum (datum)}
    {@const seg = segmentiDana(datum, podaci.boravci)}
    {@const pp = primopredajeDana(datum, podaci.boravci)}
    {@const dana = svi.filter((b) => b.datum === datum)}
    {@const stavke = podaci.stavke.filter((s) => s.datum === datum)}
    <li class="dan" class:danas={danaDo(datum, sada) === 0}>
      <header class="dan-glava">
        <h3>{naslovDana(datum)}</h3>
        <span class="kod" style="--boja: {boja(seg[0]?.kod ?? null)}">
          <span class="traka" aria-hidden="true">
            {#each seg as s, i (i)}
              <i style="width: {((s.do - s.od) / 1440) * 100}%; background: {boja(s.kod)}"></i>
            {/each}
          </span>
          {kodKoga(datum)}
        </span>
      </header>

      <ul class="stvari">
        {#each pp as p (p.min)}
          {@const t = prelazak(podaci, p.ka)}
          <li class="red primopredaja" class:moja={p.ka === podaci.ja.id} style="--boja: {boja(p.ka)}">
            <span class="vreme mono">{hhmm(p.min)}</span>
            <span class="telo">
              <b>⇄ {t.naslov}</b>
              <span class="faint">{t.ko} · do tada kod {genitiv(p.od)}</span>
            </span>
          </li>
        {/each}
        {#each dana as b (b.kljuc)}
          <li>
            <button
              class="red aktivnost"
              class:predlog={b.stanje === 'predlog'}
              class:menja={b.stanje === 'izmena' || b.stanje === 'brisanje'}
              style="--boja: {bojaVrste(b.dogadjaj.vrsta)}"
              onclick={() => onPojava({ dogadjaj: b.dogadjaj, datum: b.datum, zahtev: b.zahtev })}
            >
              <span class="vreme mono">{b.ceoDan ? 'ceo dan' : `${hhmm(b.odMin)}–${hhmm(b.doMin)}`}</span>
              <span class="telo">
                <b>{b.dogadjaj.naziv}</b>
                <span class="faint">
                  {[b.dogadjaj.mesto, b.dogadjaj.vodi ? `vodi ${roditeljPoId(podaci, b.dogadjaj.vodi)?.oznaka.toLocaleLowerCase('sr')}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {#if b.stanje === 'predlog'}<span class="ceka">čeka potvrdu</span>{/if}
                {#if b.stanje === 'izmena'}<span class="ceka">predlog izmene</span>{/if}
                {#if b.stanje === 'brisanje'}<span class="ceka">predlog brisanja</span>{/if}
              </span>
            </button>
          </li>
        {/each}
        {#each stavke as s (s.id)}
          <li>
            <button class="red stavka" onclick={() => onStavka(s)}>
              <span class="vreme mono">stavka</span>
              <span class="telo"><b>{s.naslov}</b></span>
            </button>
          </li>
        {/each}
        {#if !pp.length && !dana.length && !stavke.length}
          <li class="prazno">Nema aktivnosti.</li>
        {/if}
      </ul>
    </li>
  {/each}
</ol>

<style>
  .raspored {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .dan {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 0.85rem 1rem;
  }

  .dan.danas {
    border-color: var(--bio-line);
  }

  .dan-glava {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }

  .dan-glava h3 {
    font-size: 1rem;
  }

  .danas h3 {
    color: var(--bio);
  }

  .kod {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.84rem;
    color: var(--text-dim);
  }

  .traka {
    display: flex;
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface-hover);
  }

  .traka i {
    display: block;
    height: 100%;
  }

  .stvari {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .red {
    display: grid;
    grid-template-columns: 6.6rem 1fr;
    gap: 0.6rem;
    align-items: start;
    width: 100%;
    text-align: left;
    padding: 0.45rem 0.6rem;
    border-radius: 8px;
    border-left: 3px solid var(--boja);
    background: color-mix(in srgb, var(--boja) 9%, transparent);
  }

  .vreme {
    font-size: 0.78rem;
    color: var(--text-dim);
    padding-top: 0.1rem;
  }

  .telo {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    font-size: 0.92rem;
  }

  .telo .faint {
    font-size: 0.8rem;
  }

  .primopredaja b {
    color: var(--boja);
  }

  .primopredaja.moja {
    background: color-mix(in srgb, var(--boja) 16%, transparent);
  }

  .aktivnost:hover b {
    color: var(--bio);
  }

  .aktivnost.predlog {
    border: 1.5px dashed var(--warn);
    border-left: 3px dashed var(--boja);
  }

  .aktivnost.menja {
    opacity: 0.7;
  }

  .ceka {
    font-size: 0.74rem;
    color: var(--warn);
  }

  .stavka {
    --boja: var(--warn);
  }

  .prazno {
    font-size: 0.84rem;
    color: var(--text-faint);
    padding: 0.2rem 0.6rem;
  }

  @media (max-width: 520px) {
    .red {
      grid-template-columns: 4.6rem 1fr;
    }
  }
</style>
