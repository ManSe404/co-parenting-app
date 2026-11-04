<script lang="ts">
  import { onMount } from 'svelte';
  import { izvor } from '../lib/izvor';
  import { danaDo, napraviPregled, uDan } from '../lib/domen';
  import { danasDugo, kada, pozdrav, pre, recenicaHitno, recenicaNaTebi, rok } from '../lib/format';
  import { putanje } from '../lib/putanje';
  import { trenutnoKod } from '../lib/kalendar';
  import { opisZahteva, prelazak, roditeljPoId } from '../lib/kalendar-opis';
  import type { Podaci, Stavka } from '../lib/tipovi';
  import { type ZahtevBrisanja, cekajuMene } from '../lib/dokumenti';
  import Ikona from './Ikona.svelte';

  const sada = new Date();
  let podaci = $state<Podaci | null>(null);
  // Proposals to delete a document for good (they need the other parent).
  let brisanja = $state<ZahtevBrisanja[]>([]);
  let dokNaTebi = $derived(podaci ? cekajuMene(brisanja, podaci.ja.id) : []);
  let dokCekaDrugog = $derived(podaci ? brisanja.filter((z) => z.stanje === 'ceka' && z.predlozio === podaci!.ja.id) : []);
  let greska = $state<string | null>(null);
  let p = $derived(podaci ? napraviPregled(podaci, sada) : null);

  // Calendar: where the child is, and requests that wait for a parent.
  let kal = $derived.by(() => {
    if (!podaci) return null;
    const d = podaci;
    const cekaju = d.zahtevi.filter((z) => z.stanje === 'ceka');
    return {
      ...trenutnoKod(d.boravci, sada),
      naTebi: cekaju.filter((z) => z.predlozio !== d.ja.id),
      cekaDrugog: cekaju.filter((z) => z.predlozio === d.ja.id),
    };
  });
  // "Novo": the other parent's item activity plus their karton changes.
  let novo = $derived.by(() => {
    if (!podaci || !p) return [];
    const d = podaci;
    const od = d.videoOd ?? '';
    const izStavki = p.novo.map((a) => ({
      kljuc: `s-${a.stavka.id}`,
      naslov: a.stavka.naslov,
      opis: a.opis,
      kada: a.kada,
      href: putanje.stavka(a.stavka.id),
      karton: false,
    }));
    const izKartona = d.izmeneKartona
      .filter((z) => z.autor === d.drugi.id && z.kada > od)
      .map((z) => ({
        kljuc: `k-${z.id}`,
        naslov: `Karton: ${z.naziv}`,
        opis: z.staro === null ? `dodato: ${z.novo}` : z.novo === null ? 'obrisano' : `${z.staro} → ${z.novo}`,
        kada: z.kada,
        href: putanje.karton(),
        karton: true,
      }));
    return [...izStavki, ...izKartona].sort((a, b) => b.kada.localeCompare(a.kada)).slice(0, 8);
  });

  let cekaTebe = $derived((p?.naPotezu.length ?? 0) + (kal?.naTebi.length ?? 0) + dokNaTebi.length);
  let cekaDrugog = $derived((p?.cekaDrugog.length ?? 0) + (kal?.cekaDrugog.length ?? 0) + dokCekaDrugog.length);

  onMount(async () => {
    try {
      podaci = await (await izvor()).ucitaj();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
    try {
      brisanja = await (await (await import('../lib/dokumenti-izvor')).dokumentiIzvor()).brisanja();
    } catch {
      /* documents are optional on the dashboard */
    }
  });

  const dan = new Intl.DateTimeFormat('sr-Latn-RS', { weekday: 'short' });
  const mesec = new Intl.DateTimeFormat('sr-Latn-RS', { month: 'short' });

  function nazivOblasti(d: Podaci, kljuc: string): string {
    return d.oblasti.find((o) => o.kljuc === kljuc)?.naziv ?? kljuc;
  }

  /** One calm sentence instead of a wall of numbers. */
  function sazetak(): string {
    if (!p) return '';
    const delovi: string[] = [];
    if (p.hitno.length) delovi.push(recenicaHitno(p.hitno.length));
    if (cekaTebe) delovi.push(recenicaNaTebi(cekaTebe));
    if (!delovi.length) return 'Ništa nije hitno i niko ne čeka tvoj odgovor. Mirno je.';
    return delovi.join(' ');
  }

  function klasaRoka(s: Stavka): string {
    if (!s.datum) return 'rucno';
    const d = danaDo(s.datum, sada);
    return d <= 0 ? 'gori' : d === 1 ? 'blizu' : '';
  }

  function udeo(n: number): string {
    if (!p) return '0%';
    const ukupno = p.kolone.stavke + p.kolone.aktivno + p.kolone.reseno;
    return ukupno ? `${(n / ukupno) * 100}%` : '0%';
  }
</script>

{#snippet oblastMini(d: Podaci, s: Stavka)}
  <span class="oblast-mini" style="--boja: var(--oblast-{s.oblast})">
    <Ikona ime={s.oblast} velicina={13} />
    {nazivOblasti(d, s.oblast)}
  </span>
{/snippet}

{#if greska}
  <p class="error">Podaci nisu učitani: {greska}</p>
{:else if !podaci || !p}
  <p class="loading">Učitavam…</p>
{:else}
  {@const d = podaci}
  <header class="glava rise">
    <p class="eyebrow">{danasDugo(sada)}</p>
    <h1>{pozdrav(sada)}, <span class="ime">{d.ja.oznaka}</span></h1>
    <p class="sazetak">{sazetak()}</p>
    {#if kal}
      {@const sad = roditeljPoId(d, kal.kod)}
      <a class="gde" href={putanje.kalendar()} style="--boja: {sad ? `var(--${sad.boja})` : 'var(--text-faint)'}">
        <i class="gde-tacka"></i>
        <span>Sada je kod <b>{sad?.oznakaGenitiv ?? 'nikoga upisanog'}</b></span>
        {#if kal.sledeca?.ka}
          {@const t = prelazak(d, kal.sledeca.ka)}
          <span class="gde-dalje">· {kada(kal.sledeca.kada, sada)} {t.naslov.toLocaleLowerCase('sr')} ({t.ko})</span>
        {/if}
      </a>
    {/if}
  </header>

  <div class="mreza">
    <!-- 1. Hitno: always first and always visible -->
    <section class="hitno-kartica rise" style="--i: 1" class:prazna={p.hitno.length === 0} aria-labelledby="h-hitno">
      <header class="kartica-glava">
        <span class="krug krug-hitno"><Ikona ime="hitno" velicina={20} /></span>
        <h2 id="h-hitno">Hitno</h2>
        {#if p.hitno.length}<span class="mehur mehur-hitno">{p.hitno.length}</span>{/if}
        <a class="sve" href={putanje.stavke({ oznaka: 'hitno' })}>sve <Ikona ime="strelica" velicina={14} /></a>
      </header>
      {#if p.hitno.length}
        <ul class="redovi">
          {#each p.hitno as s (s.id)}
            <li>
              <a class="red red-hitno" href={putanje.stavka(s.id)}>
                <span class="rok {klasaRoka(s)}">{s.datum ? rok(s.datum, sada) : 'hitno'}</span>
                <span class="telo">
                  <span class="naslov">{s.naslov}</span>
                  {@render oblastMini(d, s)}
                </span>
                <span class="strelica"><Ikona ime="strelica" velicina={16} /></span>
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mirno">Ništa nije hitno.</p>
      {/if}
    </section>

    <section class="vazno-kartica card rise" style="--i: 2" aria-labelledby="h-vazno">
      <header class="kartica-glava">
        <span class="krug krug-vazno"><Ikona ime="vazno" velicina={18} /></span>
        <h2 id="h-vazno">Važno</h2>
        {#if p.vazno.length}<span class="mehur mehur-vazno">{p.vazno.length}</span>{/if}
        <a class="sve" href={putanje.stavke({ oznaka: 'vazno' })}>sve <Ikona ime="strelica" velicina={14} /></a>
      </header>
      {#if p.vazno.length}
        <ul class="redovi">
          {#each p.vazno as s (s.id)}
            <li>
              <a class="red" href={putanje.stavka(s.id)}>
                <span class="telo">
                  <span class="naslov">{s.naslov}</span>
                  <span class="meta-red">
                    {@render oblastMini(d, s)}
                    {#if s.datum}<span class="datum-mini">{rok(s.datum, sada)}</span>{/if}
                  </span>
                </span>
                <span class="strelica"><Ikona ime="strelica" velicina={16} /></span>
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mirno">Nema otvorenih važnih tema.</p>
      {/if}
    </section>

    <!-- 2. Ko je na potezu -->
    <section class="potez rise" style="--i: 3" aria-label="Ko je na potezu">
      <a class="card plocica plocica-ti" class:ima={cekaTebe > 0} href={cekaTebe ? '#na-tebi' : putanje.stavke({ ceka: 'ja' })}>
        <span class="broj">{cekaTebe}</span>
        <span class="opis">čeka tebe</span>
      </a>
      <a class="card plocica" href={putanje.stavke({ ceka: 'drugi' })}>
        <span class="broj">{cekaDrugog}</span>
        <span class="opis">čeka {d.drugi.oznakaAkuzativ}</span>
      </a>
      <a class="card plocica" href="#novo">
        <span class="broj">{novo.length}</span>
        <span class="opis">novo</span>
      </a>
    </section>

    <!-- 3. Na tebi je -->
    {#if cekaTebe > 0}
      <section class="card na-tebi rise" style="--i: 4" id="na-tebi" aria-labelledby="h-natebi">
        <header class="kartica-glava">
          <h2 id="h-natebi">Na tebi je</h2>
        </header>
        <ul class="redovi">
          {#each kal?.naTebi ?? [] as z (z.id)}
            {@const o = opisZahteva(d, z)}
            <li>
              <a class="red" href={putanje.kalendar('zahtevi')}>
                <span class="avatar avatar-kal"><Ikona ime="kalendar" velicina={16} /></span>
                <span class="telo">
                  <span class="naslov">Kalendar: {o.naslov.toLocaleLowerCase('sr')}</span>
                  <span class="razlog">{d.drugi.oznaka} predlaže · {o.redovi[0]}</span>
                </span>
                <span class="akcija">Pogledaj</span>
              </a>
            </li>
          {/each}
          {#each dokNaTebi as z (z.id)}
            <li>
              <a class="red" href={`${putanje.dokumenti()}?obrisani=1`}>
                <span class="avatar avatar-dok"><Ikona ime="kanta" velicina={16} /></span>
                <span class="telo">
                  <span class="naslov">Dokumenti: trajno brisanje „{z.naziv}“</span>
                  <span class="razlog">{d.drugi.oznaka} predlaže · bez tvoje potvrde se ništa ne briše</span>
                </span>
                <span class="akcija">Pogledaj</span>
              </a>
            </li>
          {/each}
          {#each p.naPotezu as s (s.id)}
            <li>
              <a class="red" href={putanje.stavka(s.id)}>
                <span class="avatar">{d.drugi.oznaka.charAt(0)}</span>
                <span class="telo">
                  <span class="naslov">{s.naslov}</span>
                  <span class="razlog">
                    {#if s.zatvaranjePredlozio}
                      {d.drugi.oznaka} predlaže da se zatvori: „{s.odluka}“
                    {:else}
                      {d.drugi.oznaka} čeka tvoj odgovor
                    {/if}
                  </span>
                </span>
                <span class="akcija">{s.zatvaranjePredlozio ? 'Pogledaj' : 'Odgovori'}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- 4. Ostalo -->
    <a class="card tabla-pregled rise" style="--i: 5" href={putanje.stavke()}>
      <header class="kartica-glava">
        <h2>Tabla</h2>
        <span class="sve">otvori <Ikona ime="strelica" velicina={14} /></span>
      </header>
      <span class="traka" aria-hidden="true">
        <span class="deo deo-stavke" style="width: {udeo(p.kolone.stavke)}"></span>
        <span class="deo deo-aktivno" style="width: {udeo(p.kolone.aktivno)}"></span>
        <span class="deo deo-reseno" style="width: {udeo(p.kolone.reseno)}"></span>
      </span>
      <span class="legenda">
        <span><i class="dot dot-neodgovoreno"></i><b>{p.kolone.stavke}</b> Stavke</span>
        <span><i class="dot dot-otvoreno"></i><b>{p.kolone.aktivno}</b> Aktivno</span>
        <span><i class="dot dot-zatvoreno"></i><b>{p.kolone.reseno}</b> Rešeno <em>30 dana</em></span>
      </span>
    </a>

    <section class="oblasti" aria-label="Oblasti">
      {#each p.poOblasti as o, i (o.kljuc)}
        <a class="card oblast rise" style="--i: {6 + i}; --boja: var(--oblast-{o.kljuc})" href={putanje.stavke({ oblast: o.kljuc })}>
          <span class="oblast-glava">
            <span class="krug krug-oblast"><Ikona ime={o.kljuc} velicina={19} /></span>
            <span class="broj-oblast">{o.broj}</span>
          </span>
          <span class="oblast-naziv">{o.naziv}</span>
          {#if o.prve.length}
            <ul class="oblast-prve">
              {#each o.prve as s (s.id)}<li>{s.naslov}</li>{/each}
            </ul>
          {:else}
            <span class="mirno">Ništa otvoreno.</span>
          {/if}
        </a>
      {/each}
    </section>

    <section class="card predstojece rise" style="--i: 11" aria-labelledby="h-pred">
      <header class="kartica-glava">
        <h2 id="h-pred">Predstojeće</h2>
        <span class="podnaslov">sledeće dve nedelje</span>
      </header>
      {#if p.predstojece.length}
        <ul class="redovi">
          {#each p.predstojece as s (s.id)}
            {@const dd = uDan(s.datum!)}
            <li>
              <a class="red" href={putanje.stavka(s.id)}>
                <span class="kalendar">
                  <span class="k-dan">{dan.format(dd)}</span>
                  <span class="k-broj">{dd.getDate()}</span>
                  <span class="k-mesec">{mesec.format(dd)}</span>
                </span>
                <span class="telo">
                  <span class="naslov">{s.naslov}</span>
                  <span class="razlog">
                    {rok(s.datum!, sada)}{#if s.stanje === 'zatvoreno' && s.odluka}&nbsp;· {s.odluka}{/if}
                  </span>
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mirno">Ništa u naredne dve nedelje.</p>
      {/if}
    </section>

    <section class="card novo rise" style="--i: 12" id="novo" aria-labelledby="h-novo">
      <header class="kartica-glava">
        <h2 id="h-novo">Novo od poslednje posete</h2>
      </header>
      {#if novo.length}
        <ul class="redovi">
          {#each novo as a (a.kljuc)}
            <li>
              <a class="red" href={a.href}>
                {#if a.karton}
                  <span class="avatar avatar-karton"><Ikona ime="karton" velicina={16} /></span>
                {:else}
                  <span class="avatar">{d.drugi.oznaka.charAt(0)}</span>
                {/if}
                <span class="telo">
                  <span class="naslov">{a.naslov}</span>
                  <span class="razlog">{d.drugi.oznaka} · {a.opis} · {pre(a.kada, sada)}</span>
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mirno">{d.videoOd ? 'Ništa novo od tvoje poslednje posete.' : 'Ovo je tvoja prva poseta.'}</p>
      {/if}
    </section>
  </div>
{/if}

<style>
  /* ---------- Header ---------- */

  .glava {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-bottom: clamp(1.4rem, 3.5vw, 2.2rem);
  }

  .glava h1 {
    font-size: clamp(2rem, 6vw, 3rem);
    font-weight: 700;
  }

  .ime {
    background: linear-gradient(120deg, var(--bio) 10%, var(--ai) 90%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .gde {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
    align-self: flex-start;
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    font-size: 0.92rem;
    border: 1px solid color-mix(in srgb, var(--boja) 40%, transparent);
    background: color-mix(in srgb, var(--boja) 9%, transparent);
    transition: border-color 0.2s var(--ease);
  }

  .gde:hover {
    border-color: var(--boja);
  }

  .gde b {
    font-weight: 600;
    color: var(--boja);
  }

  .gde-tacka {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--boja);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--boja) 18%, transparent);
  }

  .gde-dalje {
    color: var(--text-dim);
  }

  .avatar-karton {
    color: var(--bio);
    background: var(--bio-soft);
    border-color: var(--bio-line);
  }

  .avatar-kal {
    color: var(--warn);
    background: var(--warn-soft);
    border-color: var(--warn-line);
  }

  .avatar-dok {
    color: var(--hitno);
    background: var(--hitno-soft);
    border-color: var(--hitno-line);
  }

  .sazetak {
    color: var(--text-dim);
    font-size: clamp(1rem, 2.4vw, 1.12rem);
    max-width: 48ch;
  }

  /* ---------- Grid: same order on phone and desktop ---------- */

  .mreza {
    display: grid;
    gap: 0.9rem;
    grid-template-columns: minmax(0, 1fr);
  }

  @media (min-width: 860px) {
    .mreza {
      gap: 1.1rem;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      grid-template-areas:
        'hitno vazno'
        'potez potez'
        'natebi natebi'
        'tabla tabla'
        'oblasti oblasti'
        'predstojece novo';
    }

    .hitno-kartica {
      grid-area: hitno;
    }
    .vazno-kartica {
      grid-area: vazno;
    }
    .potez {
      grid-area: potez;
    }
    .na-tebi {
      grid-area: natebi;
    }
    .tabla-pregled {
      grid-area: tabla;
    }
    .oblasti {
      grid-area: oblasti;
    }
    .predstojece {
      grid-area: predstojece;
    }
    .novo {
      grid-area: novo;
    }
  }

  /* ---------- Shared card pieces ---------- */

  .kartica-glava {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.4rem;
  }

  .kartica-glava h2 {
    font-size: 1.12rem;
  }

  .podnaslov {
    font-size: 0.82rem;
    color: var(--text-faint);
  }

  .sve {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.82rem;
    color: var(--text-dim);
    transition: color 0.2s var(--ease);
  }

  .sve:hover {
    color: var(--bio);
  }

  .krug {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .mehur {
    display: grid;
    place-items: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .redovi {
    display: flex;
    flex-direction: column;
  }

  .redovi li + li {
    border-top: 1px solid var(--border);
  }

  .red {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding-block: 0.75rem;
  }

  .telo {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .naslov {
    font-weight: 500;
    font-size: 1.02rem;
    line-height: 1.3;
    transition: color 0.2s var(--ease);
  }

  .red:hover .naslov {
    color: var(--bio);
  }

  .razlog {
    font-size: 0.86rem;
    color: var(--text-dim);
  }

  .meta-red {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.8rem;
    align-items: center;
  }

  .oblast-mini {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .oblast-mini :global(svg) {
    color: var(--boja);
  }

  .datum-mini {
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .strelica {
    color: var(--text-faint);
    transition: transform 0.25s var(--ease), color 0.25s var(--ease);
  }

  .red:hover .strelica {
    color: var(--bio);
    transform: translateX(3px);
  }

  .mirno {
    color: var(--text-faint);
    font-size: 0.92rem;
    padding-block: 0.35rem;
  }

  /* ---------- Hitno ---------- */

  .hitno-kartica {
    position: relative;
    border-radius: var(--radius);
    padding: clamp(1.05rem, 2.4vw, 1.45rem);
    border: 1px solid var(--hitno-line);
    background:
      linear-gradient(140deg, var(--hitno-soft), transparent 70%),
      var(--surface);
    box-shadow: 0 18px 50px -32px var(--hitno);
    overflow: hidden;
  }

  /* A bright rule along the top edge, like the site's lit card edges. */
  .hitno-kartica::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 3px;
    background: linear-gradient(90deg, var(--hitno), color-mix(in srgb, var(--hitno) 25%, transparent));
  }

  .hitno-kartica.prazna {
    border-color: var(--border);
    box-shadow: none;
    background: var(--surface);
  }

  .hitno-kartica.prazna::before {
    background: var(--border-strong);
  }

  .hitno-kartica h2 {
    font-size: 1.3rem;
  }

  .krug-hitno {
    color: var(--hitno);
    background: var(--hitno-soft);
    border: 1px solid var(--hitno-line);
  }

  .hitno-kartica:not(.prazna) .krug-hitno {
    animation: kuca 2.4s var(--ease) infinite;
  }

  @keyframes kuca {
    0%,
    60%,
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--hitno) 45%, transparent);
    }
    30% {
      box-shadow: 0 0 0 7px transparent;
    }
  }

  .mehur-hitno {
    background: var(--hitno);
    color: var(--on-accent);
  }

  .red-hitno .naslov {
    font-size: 1.08rem;
  }

  .rok {
    flex-shrink: 0;
    min-width: 5.6rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    padding: 0.3rem 0.55rem;
    border-radius: 999px;
    color: var(--hitno);
    border: 1px solid var(--hitno-line);
    background: var(--hitno-soft);
  }

  .rok.gori {
    background: var(--hitno);
    border-color: var(--hitno);
    color: var(--on-accent);
    font-weight: 500;
  }

  .rok.blizu {
    border-color: var(--hitno);
  }

  @media (max-width: 520px) {
    .rok {
      min-width: 4.7rem;
      font-size: 0.68rem;
      padding-inline: 0.4rem;
    }
  }

  /* ---------- Važno ---------- */

  .vazno-kartica h2 {
    font-size: 1.12rem;
  }

  .krug-vazno {
    color: var(--ai);
    background: var(--ai-soft);
    border: 1px solid var(--ai-line);
    width: 1.9rem;
    height: 1.9rem;
  }

  .mehur-vazno {
    background: var(--ai-soft);
    color: var(--ai);
    border: 1px solid var(--ai-line);
  }

  /* ---------- Ko je na potezu ---------- */

  .potez {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: inherit;
  }

  .plocica {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: clamp(0.85rem, 2vw, 1.15rem) clamp(0.9rem, 2.2vw, 1.3rem);
  }

  .broj {
    font-size: clamp(1.8rem, 5vw, 2.4rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.03em;
  }

  .opis {
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .plocica-ti.ima {
    border-color: var(--warn-line);
    background: linear-gradient(140deg, var(--warn-soft), transparent 80%), var(--surface);
  }

  .plocica-ti.ima .broj {
    color: var(--warn);
  }

  /* ---------- Na tebi je ---------- */

  .na-tebi {
    border-color: var(--warn-line);
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 50%;
    flex-shrink: 0;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--ai);
    background: var(--ai-soft);
    border: 1px solid var(--ai-line);
  }

  .akcija {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    padding: 0.35rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bio-line);
    color: var(--bio);
    background: var(--bio-soft);
  }

  @media (max-width: 520px) {
    .akcija {
      display: none;
    }
  }

  /* ---------- Tabla preview ---------- */

  .tabla-pregled {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .traka {
    display: flex;
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface-hover);
    gap: 3px;
  }

  .deo {
    display: block;
    height: 100%;
    border-radius: 999px;
    transition: width 0.6s var(--ease);
  }

  .deo-stavke {
    background: var(--warn);
  }

  .deo-aktivno {
    background: var(--bio);
  }

  .deo-reseno {
    background: var(--text-faint);
  }

  .legenda {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .legenda span {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .legenda b {
    color: var(--text);
    font-weight: 600;
  }

  .legenda em {
    font-style: normal;
    color: var(--text-faint);
    font-size: 0.8rem;
  }

  /* ---------- Oblasti ---------- */

  .oblasti {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: inherit;
  }

  @media (min-width: 860px) {
    .oblasti {
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    }
  }

  .oblast {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .oblast:hover {
    border-color: color-mix(in srgb, var(--boja) 45%, transparent);
  }

  .oblast-glava {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .krug-oblast {
    color: var(--boja);
    background: color-mix(in srgb, var(--boja) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--boja) 30%, transparent);
  }

  .broj-oblast {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .oblast-naziv {
    font-weight: 600;
    font-size: 0.98rem;
  }

  .oblast-prve {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.86rem;
    color: var(--text-dim);
  }

  .oblast-prve li {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ---------- Predstojeće ---------- */

  .kalendar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 3.2rem;
    flex-shrink: 0;
    padding: 0.3rem 0;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    background: var(--bg-raised);
    line-height: 1.1;
  }

  .k-dan,
  .k-mesec {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }

  .k-dan {
    color: var(--bio);
  }

  .k-broj {
    font-size: 1.25rem;
    font-weight: 600;
  }
</style>
