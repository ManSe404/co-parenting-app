<script lang="ts">
  // History of agreements: closed items with their decision, by month.
  import { kaoDatum } from '../lib/domen';
  import { istorija } from '../lib/istorija';
  import { roditeljPoId } from '../lib/kalendar-opis';
  import { datumKratko, mesecGodina, pre } from '../lib/format';
  import { preuzmi, uCsv } from '../lib/izvoz';
  import { putanje } from '../lib/putanje';
  import type { OblastKljuc, Podaci } from '../lib/tipovi';
  import Ikona from './Ikona.svelte';

  interface Props {
    podaci: Podaci;
  }

  let { podaci }: Props = $props();

  const sada = new Date();
  let oblast = $state<OblastKljuc | ''>('');
  let q = $state('');

  let arhiva = $derived(istorija(podaci.stavke, { oblast, q }));
  let ukupno = $derived(podaci.stavke.filter((s) => s.stanje === 'zatvoreno').length);
  let nadjeno = $derived(arhiva.reduce((n, g) => n + g.stavke.length, 0));

  /** Who confirmed the closing: the author of the last "zatvoreno" entry. */
  function potvrdio(id: string): string | null {
    const u = podaci.unosi.filter((x) => x.stavkaId === id && x.vrsta === 'zatvoreno').at(-1);
    return u ? (roditeljPoId(podaci, u.autor)?.oznaka ?? null) : null;
  }

  function oznaka(id: string): string {
    return roditeljPoId(podaci, id)?.oznaka ?? '?';
  }

  function nazivMeseca(m: string): string {
    const n = mesecGodina(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1);
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  function izvezi() {
    preuzmi(`istorija-dogovora-${kaoDatum(sada)}.csv`, uCsv(arhiva.flatMap((g) => g.stavke), podaci));
  }
</script>

<section class="arhiva">
  <p class="pomoc">
    Svaka zatvorena tema i dogovor koji ste zapisali, najnovije prvo. Ništa se ne briše. Ako dogovor više ne važi, temu
    ponovo otvoriš iz same stavke.
  </p>

  <div class="arhiva-filteri card">
    <input class="input" type="search" placeholder="Pretraga naslova i dogovora" bind:value={q} />
    <div class="chips">
      <button class="chip chip-toggle" aria-pressed={oblast === ''} onclick={() => (oblast = '')}>Sve oblasti</button>
      {#each podaci.oblasti as o (o.kljuc)}
        <button class="chip chip-toggle" aria-pressed={oblast === o.kljuc} onclick={() => (oblast = oblast === o.kljuc ? '' : o.kljuc)}>
          {o.naziv}
        </button>
      {/each}
    </div>
    <div class="traka">
      <span class="faint">{nadjeno} od {ukupno} dogovora</span>
      <button class="btn btn-ghost mali" onclick={izvezi} disabled={nadjeno === 0}>Izvezi CSV</button>
    </div>
  </div>

  {#each arhiva as grupa (grupa.mesec)}
    <h2 class="mesec">{nazivMeseca(grupa.mesec)}</h2>
    <ol class="vremenska">
      {#each grupa.stavke as s (s.id)}
        {@const ko = potvrdio(s.id)}
        <li class="odluka" style="--boja: var(--oblast-{s.oblast})">
          <span class="tacka" aria-hidden="true"></span>
          <a class="card odluka-kartica" href={putanje.stavka(s.id)}>
            <span class="odluka-vrh">
              <span class="oblast"><Ikona ime={s.oblast} velicina={14} />{podaci.oblasti.find((o) => o.kljuc === s.oblast)?.naziv}</span>
              <span class="faint">{s.zatvoreno ? datumKratko(s.zatvoreno.slice(0, 10)) : ''}</span>
            </span>
            <span class="odluka-naslov">{s.naslov}</span>
            {#if s.odluka}<span class="odluka-tekst">{s.odluka}</span>{/if}
            <span class="faint odluka-meta">
              pitanje: {oznaka(s.otvorio)}{#if ko}&nbsp;· potvrda: {ko}{/if} · {s.zatvoreno ? pre(s.zatvoreno, sada) : ''}
            </span>
          </a>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="card prazno">{ukupno ? 'Nijedan dogovor ne odgovara pretrazi.' : 'Još nema zatvorenih tema.'}</p>
  {/each}
</section>

<style>
  .pomoc {
    font-size: 0.88rem;
    color: var(--text-faint);
    margin-bottom: 0.9rem;
    max-width: 62ch;
  }

  .arhiva-filteri {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-bottom: 0.4rem;
  }

  .traka {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }

  .mali {
    padding: 0.4rem 0.8rem;
    font-size: 0.74rem;
  }

  .mesec {
    font-size: 1rem;
    margin: 1.4rem 0 0.6rem;
    color: var(--text-dim);
  }

  .vremenska {
    list-style: none;
    padding: 0 0 0 1.1rem;
    margin: 0;
    border-left: 1px solid var(--border-strong);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .odluka {
    position: relative;
  }

  .tacka {
    position: absolute;
    left: calc(-1.1rem - 5px);
    top: 1.2rem;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--boja);
    box-shadow: 0 0 0 3px var(--bg);
  }

  .odluka-kartica {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .odluka-vrh {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.8rem;
  }

  .oblast {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--text-dim);
  }

  .oblast :global(svg) {
    color: var(--boja);
  }

  .odluka-naslov {
    font-weight: 600;
    font-size: 1.02rem;
  }

  .odluka-kartica:hover .odluka-naslov {
    color: var(--bio);
  }

  .odluka-tekst {
    padding: 0.45rem 0.7rem;
    border-left: 2px solid var(--bio);
    background: var(--bio-soft);
    border-radius: 0 6px 6px 0;
  }

  .odluka-meta {
    font-size: 0.78rem;
  }

  .prazno {
    color: var(--text-faint);
  }
</style>
