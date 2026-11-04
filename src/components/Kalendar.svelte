<script lang="ts">
  import { onMount } from 'svelte';
  import { izvor as dajIzvor, type Izvor } from '../lib/izvor';
  import { plusDana, uDan } from '../lib/domen';
  import {
    type Boravak,
    type ZahtevKalendara,
    daniZahteva,
    danas as danasDatum,
    efektivno,
    mesecnaMreza,
    segmentiDana,
    trenutnoKod,
  } from '../lib/kalendar';
  import { type Dogadjaj, type PrimopredajaDana, VRSTE_DOGADJAJA, danUNedelji, opisPonavljanja } from '../lib/dogadjaji';
  import { nazivVrste, opisZahteva, prelazak, roditeljPoId } from '../lib/kalendar-opis';
  import { blokovi, hhmm } from '../lib/kalendar-prikaz';
  import { danDugo, datumKratko, kada, mesecGodina, opseg, pre } from '../lib/format';
  import { putanje } from '../lib/putanje';
  import type { Podaci, Stavka } from '../lib/tipovi';
  import Ikona from './Ikona.svelte';
  import NedeljaPrikaz, { type Izbor } from './NedeljaPrikaz.svelte';
  import PredlogAktivnosti, { type RezimAktivnosti } from './PredlogAktivnosti.svelte';
  import PredlogKalendara, { type RezimPredloga } from './PredlogKalendara.svelte';
  import PomeriDijalog, { type Pomeranje } from './PomeriDijalog.svelte';
  import { prevlacenje } from '../lib/prevlacenje';
  import type { Blok } from '../lib/kalendar-prikaz';
  import RasporedPrikaz from './RasporedPrikaz.svelte';
  import RazlogDijalog from './RazlogDijalog.svelte';

  type Prikaz = 'dan' | 'nedelja' | 'mesec' | 'raspored';
  const KLJUC_PRIKAZA = 'coparenting.kalendar.prikaz';

  const sada = new Date();
  const danas = danasDatum(sada);
  const DANI = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned'];
  const RASPORED_DANA = 14;

  let iz = $state<Izvor | null>(null);
  let podaci = $state<Podaci | null>(null);
  let greska = $state<string | null>(null);
  let prikaz = $state<Prikaz>(sacuvaniPrikaz());
  let fokus = $state(danas);
  let izabran = $state(danas);
  let uski = $state(false);
  let predlog = $state<RezimPredloga | null>(null);
  let aktivnost = $state<RezimAktivnosti | null>(null);
  let pregled = $state<Izbor | null>(null);
  let odbijanje = $state<ZahtevKalendara | null>(null);
  let poruka = $state<string | null>(null);
  let pregledDijalog = $state<HTMLDialogElement | null>(null);
  let prelazakIzbor = $state<{ datum: string; pp: PrimopredajaDana } | null>(null);
  let pomeranje = $state<Pomeranje | null>(null);
  let prelazakDijalog = $state<HTMLDialogElement | null>(null);
  // Bumped by "Danas" so the time grid scrolls to the current hour.
  let skrolKljuc = $state(0);

  function sacuvaniPrikaz(): Prikaz {
    try {
      const v = localStorage.getItem(KLJUC_PRIKAZA);
      return v === 'dan' || v === 'mesec' || v === 'raspored' ? v : 'nedelja';
    } catch {
      return 'nedelja';
    }
  }

  function izaberiPrikaz(p: Prikaz) {
    prikaz = p;
    try {
      localStorage.setItem(KLJUC_PRIKAZA, p);
    } catch {
      /* per-device convenience only */
    }
  }

  async function ucitaj() {
    iz ??= await dajIzvor();
    podaci = await iz.ucitaj();
  }

  onMount(() => {
    // Phones show three days at a time in the week view, like calendar apps do.
    const mq = window.matchMedia('(max-width: 680px)');
    uski = mq.matches;
    const naPromenu = (e: MediaQueryListEvent) => (uski = e.matches);
    mq.addEventListener('change', naPromenu);
    ucitaj().catch((e) => (greska = e instanceof Error ? e.message : String(e)));
    return () => mq.removeEventListener('change', naPromenu);
  });

  $effect(() => {
    if (pregled && pregledDijalog && !pregledDijalog.open) pregledDijalog.showModal();
  });

  $effect(() => {
    if (prelazakIzbor && prelazakDijalog && !prelazakDijalog.open) prelazakDijalog.showModal();
  });

  let godina = $derived(uDan(fokus).getFullYear());
  let mesec = $derived(uDan(fokus).getMonth());
  let mreza = $derived(mesecnaMreza(godina, mesec));
  let daniNedelje = $derived(
    prikaz === 'dan'
      ? [fokus]
      : uski
        ? [0, 1, 2].map((i) => plusDana(fokus, i))
        : Array.from({ length: 7 }, (_, i) => plusDana(plusDana(fokus, -danUNedelji(fokus)), i)),
  );
  let naslovPrikaza = $derived.by(() => {
    if (prikaz === 'mesec') return mesecGodina(godina, mesec);
    if (prikaz === 'raspored') return `${datumKratko(fokus)} → ${datumKratko(plusDana(fokus, RASPORED_DANA - 1))}`;
    if (prikaz === 'dan') {
      const t = danDugo(fokus);
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    const prvi = daniNedelje[0];
    const poslednji = daniNedelje[daniNedelje.length - 1];
    return `${datumKratko(prvi)} – ${datumKratko(poslednji)}`;
  });

  let cekaju = $derived(podaci ? podaci.zahtevi.filter((z) => z.stanje === 'ceka') : []);
  let naTebi = $derived(podaci ? cekaju.filter((z) => z.predlozio !== podaci!.ja.id) : []);
  let tvoji = $derived(podaci ? cekaju.filter((z) => z.predlozio === podaci!.ja.id) : []);
  let istorija = $derived(
    podaci
      ? podaci.zahtevi
          .filter((z) => z.stanje !== 'ceka')
          .sort((a, b) => (b.reseno ?? '').localeCompare(a.reseno ?? ''))
          .slice(0, 8)
      : [],
  );
  let daniNaCekanju = $derived.by(() => {
    const s = new Set<string>();
    if (podaci) for (const z of cekaju) for (const d of daniZahteva(z, podaci.boravci, podaci.dogadjaji)) s.add(d);
    return s;
  });
  let stavkePoDanu = $derived.by(() => {
    const m = new Map<string, Podaci['stavke']>();
    if (podaci) for (const s of podaci.stavke) if (s.datum) m.set(s.datum, [...(m.get(s.datum) ?? []), s]);
    return m;
  });
  let aktivnostiMeseca = $derived(podaci ? blokovi(podaci, mreza[0][0], mreza[mreza.length - 1][6]) : []);
  let aktivnostiDana = $derived(podaci ? blokovi(podaci, izabran, izabran) : []);
  let status = $derived(podaci ? trenutnoKod(podaci.boravci, sada) : null);
  let danasAktivnosti = $derived(podaci ? blokovi(podaci, danas, danas).filter((b) => b.stanje !== 'predlog') : []);

  function boja(kod: string | null): string {
    const r = podaci ? roditeljPoId(podaci, kod) : null;
    return r ? `var(--${r.boja})` : 'transparent';
  }

  function bojaVrste(v: string): string {
    return VRSTE_DOGADJAJA.find((x) => x.kljuc === v)?.boja ?? 'var(--text-faint)';
  }

  function genitiv(kod: string | null): string {
    return (podaci && roditeljPoId(podaci, kod)?.oznakaGenitiv) ?? 'nikoga upisanog';
  }

  function oznaka(kod: string | null): string {
    return (podaci && roditeljPoId(podaci, kod)?.oznaka) ?? '?';
  }

  /** The next handover in the child's terms: "Danas u 15:00 ide kod tate · ti preuzimaš." */
  function sledecaTekst(): string {
    if (!podaci || !status?.sledeca) return '';
    const { kada: k, ka } = status.sledeca;
    if (!ka) return `Od ${kada(k, sada)} dalje nije upisano kod koga je.`;
    const t = prelazak(podaci, ka);
    const kad = kada(k, sada);
    return `${kad.charAt(0).toUpperCase()}${kad.slice(1)} ${t.naslov.toLocaleLowerCase('sr')} · ${t.ko}.`;
  }

  function pomeri(n: number) {
    if (prikaz === 'mesec') {
      const d = new Date(godina, mesec + n, 1);
      fokus = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (prikaz === 'raspored') {
      fokus = plusDana(fokus, n * RASPORED_DANA);
    } else if (prikaz === 'dan') {
      fokus = plusDana(fokus, n);
      izabran = fokus;
    } else {
      fokus = plusDana(fokus, n * (uski ? 3 : 7));
    }
  }

  /** Back to today in whatever view is open, and scroll the hours to now. */
  function idiNaDanas() {
    fokus = danas;
    izabran = danas;
    skrolKljuc++;
  }

  function izaberiDan(datum: string) {
    izabran = datum;
  }

  /** Like calendar apps: clicking a day in the week header opens that day. */
  function otvoriDan(datum: string) {
    izabran = datum;
    fokus = datum;
    izaberiPrikaz('dan');
  }

  let vidiDanas = $derived(
    prikaz === 'mesec' ? godina === sada.getFullYear() && mesec === sada.getMonth() : daniNedelje.includes(danas) || (prikaz === 'raspored' && fokus <= danas && danas < plusDana(fokus, RASPORED_DANA)),
  );

  /** The confirmed period behind each segment of the selected day. */
  let daniSegmenti = $derived.by(() => {
    if (!podaci) return [];
    const d = podaci;
    return segmentiDana(izabran, d.boravci).map((s) => ({
      ...s,
      boravak: s.kod ? (efektivno(d.boravci, `${izabran}T${hhmm(s.od)}`) as Boravak | null) : null,
    }));
  });

  let zahteviDana = $derived(podaci ? cekaju.filter((z) => daniZahteva(z, podaci!.boravci, podaci!.dogadjaji).has(izabran)) : []);

  function javi(t: string) {
    poruka = t;
    setTimeout(() => (poruka = null), 3500);
  }

  async function uradi(fn: (iz: Izvor) => Promise<void>, uspeh: string) {
    if (!iz) return;
    try {
      await fn(iz);
      await ucitaj();
      javi(uspeh);
    } catch (e) {
      javi(e instanceof Error ? e.message : String(e));
    }
  }

  /** A dragged activity becomes a proposal; only confirmed ones can be dragged. */
  function pomeriBlok(b: Blok, naDatum: string, naOdMin: number | null) {
    if (!podaci || b.stanje !== 'potvrdjen' || !('id' in b.dogadjaj)) return;
    const dog = podaci.dogadjaji.find((x) => x.id === (b.dogadjaj as Dogadjaj).id);
    if (dog) pomeranje = { tip: 'aktivnost', dogadjaj: dog, saDatum: b.datum, naDatum, naOdMin };
  }

  function vucenjeCipa(b: Blok) {
    return {
      id: b.kljuc,
      atribut: 'dan',
      iskljuceno: b.stanje !== 'potvrdjen',
      onPreko: () => {},
      onPusti: (_id: string, datum: string) => {
        if (datum !== b.datum) pomeriBlok(b, datum, null);
      },
    };
  }

  function otvoriStavku(s: Stavka) {
    location.href = putanje.stavka(s.id);
  }

  function zatvoriPregled() {
    pregledDijalog?.close();
  }

  const STANJE_ISTORIJE = {
    prihvacen: { znak: '✓', tekst: 'prihvaćeno' },
    odbijen: { znak: '✕', tekst: 'odbijeno' },
    povucen: { znak: '↩', tekst: 'povučeno' },
    ceka: { znak: '…', tekst: 'čeka' },
  };
</script>

{#snippet zahtevKartica(d: Podaci, z: ZahtevKalendara, moj: boolean)}
  {@const o = opisZahteva(d, z)}
  <article class="zahtev card" class:moj>
    <header class="zahtev-glava">
      <span class="avatar" style="--boja: var(--{roditeljPoId(d, z.predlozio)?.boja})">{oznaka(z.predlozio).charAt(0)}</span>
      <span class="zahtev-ko">
        <b>{moj ? 'Tvoj predlog' : `${oznaka(z.predlozio)} predlaže`}</b>
        <span class="faint">{o.naslov} · {pre(z.kreirano, sada)}</span>
      </span>
    </header>
    <ul class="zahtev-redovi">
      {#each o.redovi as r, i (i)}<li>{r}</li>{/each}
    </ul>
    {#if z.poruka}<p class="zahtev-poruka">„{z.poruka}“</p>{/if}
    <div class="akcije">
      {#if moj}
        <span class="faint">čeka da {d.drugi.oznaka.toLocaleLowerCase('sr')} prihvati</span>
        <button class="btn btn-ghost mali" onclick={() => uradi((iz) => iz.povuciZahtev(z.id), 'Predlog je povučen.')}>Povuci</button>
      {:else}
        <button class="btn mali" onclick={() => uradi((iz) => iz.prihvatiZahtev(z.id), 'Prihvaćeno. Kalendar je promenjen.')}>
          Prihvati
        </button>
        <button class="btn btn-ghost mali" onclick={() => (odbijanje = z)}>Odbij</button>
      {/if}
    </div>
  </article>
{/snippet}

{#if greska}
  <p class="error">Podaci nisu učitani: {greska}</p>
{:else if !podaci || !status}
  <p class="loading">Učitavam…</p>
{:else}
  {@const d = podaci}
  <header class="glava rise">
    <p class="eyebrow">Kalendar</p>
    <h1>Kod koga je dete</h1>
  </header>

  <section class="sada card rise" style="--i: 1; --boja: {boja(status.kod)}">
    <span class="sada-krug" aria-hidden="true"></span>
    <span class="sada-tekst">
      <span class="sada-glavno">Sada je kod {genitiv(status.kod)}</span>
      <span class="dim">{status.sledeca ? sledecaTekst() : 'Dalje u kalendaru nije ništa upisano.'}</span>
      {#if danasAktivnosti.length}
        <span class="danas-akt">
          Danas:
          {#each danasAktivnosti as b, i (b.kljuc)}{i ? ', ' : ' '}<b style="color: {bojaVrste(b.dogadjaj.vrsta)}">{b.dogadjaj.naziv}</b>
            {b.ceoDan ? '' : `u ${hhmm(b.odMin)}`}{/each}
        </span>
      {/if}
    </span>
  </section>

  {#if naTebi.length || tvoji.length}
    <section class="zahtevi rise" style="--i: 2" id="zahtevi" aria-label="Predlozi">
      {#if naTebi.length}
        <h2 class="naslov-sekcije"><span class="mehur">{naTebi.length}</span> Čeka tvoju potvrdu</h2>
        {#each naTebi as z (z.id)}{@render zahtevKartica(d, z, false)}{/each}
      {/if}
      {#if tvoji.length}
        <h2 class="naslov-sekcije">Čeka {d.drugi.oznakaAkuzativ}</h2>
        {#each tvoji as z (z.id)}{@render zahtevKartica(d, z, true)}{/each}
      {/if}
    </section>
  {/if}

  <section class="alati rise" style="--i: 3" aria-label="Kalendar">
    <div class="alati-red">
      <button class="nav-dugme" aria-label="Nazad" onclick={() => pomeri(-1)}>‹</button>
      <button class="nav-dugme" aria-label="Napred" onclick={() => pomeri(1)}>›</button>
      <h2 class="mesec-naziv">{naslovPrikaza}</h2>
      <button class="chip chip-toggle danas-dugme" class:is-active={vidiDanas && izabran === danas} onclick={idiNaDanas}>Danas</button>
    </div>
    <div class="alati-red">
      <div class="prikazi" role="tablist" aria-label="Prikaz">
        {#each [['dan', 'Dan'], ['nedelja', uski ? '3 dana' : 'Nedelja'], ['mesec', 'Mesec'], ['raspored', 'Raspored']] as [k, naziv] (k)}
          <button role="tab" class="prikaz-dugme" aria-selected={prikaz === k} onclick={() => izaberiPrikaz(k as Prikaz)}>{naziv}</button>
        {/each}
      </div>
      <span class="dodaj">
        <button class="btn mali" onclick={() => (aktivnost = { vrsta: 'dodaj', datum: izabran })}>+ Aktivnost</button>
        <button class="btn btn-ghost mali" onclick={() => (predlog = { vrsta: 'dodaj', datum: izabran })}>+ Boravak</button>
      </span>
    </div>
    <div class="legenda">
      {#each [d.ja, d.drugi] as r (r.id)}
        <span><i class="dot" style="background: var(--{r.boja})"></i>kod {r.oznakaGenitiv}</span>
      {/each}
      {#each VRSTE_DOGADJAJA as v (v.kljuc)}
        <span><i class="kvadrat" style="background: {v.boja}"></i>{v.naziv}</span>
      {/each}
      <span><i class="prelaz-legenda">⇄</i>ide kod drugog roditelja</span>
      <span><i class="uzorak ceka-uzorak"></i>čeka potvrdu</span>
    </div>
  </section>

  {#if prikaz === 'nedelja' || prikaz === 'dan'}
    <div class="rise" style="--i: 4">
      <NedeljaPrikaz
        podaci={d}
        dani={daniNedelje}
        {danas}
        {sada}
        {izabran}
        {skrolKljuc}
        onDan={prikaz === 'nedelja' ? otvoriDan : izaberiDan}
        onPojava={(x) => (pregled = x)}
        onSlot={(datum, vreme) => {
          izabran = datum;
          aktivnost = { vrsta: 'dodaj', datum, od: vreme };
        }}
        onStavka={otvoriStavku}
        onPrelazak={(datum, pp) => (prelazakIzbor = { datum, pp })}
        onPomeriAktivnost={(b, datum, odMin) => pomeriBlok(b, datum, odMin)}
        onPomeriPrelazak={(datum, pp, novMin) => (pomeranje = { tip: 'prelazak', datum, pp, novMin })}
      />
      <p class="pomoc">
        Klik na prazno mesto predlaže aktivnost u to vreme, a klik na aktivnost otvara detalje. Aktivnost ili prelazak
        možeš da prevučeš na drugo vreme; to je predlog.{#if prikaz === 'nedelja'}&nbsp;Klik na dan
          u zaglavlju otvara taj dan.{/if}
      </p>
    </div>
  {:else if prikaz === 'raspored'}
    <div class="rise" style="--i: 4">
      <RasporedPrikaz podaci={d} od={fokus} brojDana={RASPORED_DANA} {sada} onPojava={(x) => (pregled = x)} onStavka={otvoriStavku} />
    </div>
  {:else}
    <section class="mesec card rise" style="--i: 4" aria-label="Mesec">
      <div class="mreza" role="grid">
        {#each DANI as dan (dan)}<span class="dan-naziv" role="columnheader">{dan}</span>{/each}
        {#each mreza as nedelja, w (w)}
          {#each nedelja as datum (datum)}
            {@const seg = segmentiDana(datum, d.boravci)}
            {@const glavni = [...seg].sort((a, b) => b.do - b.od - (a.do - a.od))[0]}
            {@const primopredaja = seg.length > 1 ? seg.slice(1).find((s) => s.kod !== null) : undefined}
            {@const akt = aktivnostiMeseca.filter((b) => b.datum === datum)}
            <button
              class="dan"
              data-dan={datum}
              class:van={uDan(datum).getMonth() !== mesec}
              class:danas={datum === danas}
              class:izabran={datum === izabran}
              class:ceka={daniNaCekanju.has(datum)}
              style="--boja: {boja(glavni?.kod ?? null)}"
              role="gridcell"
              aria-label="{danDugo(datum)}, kod {genitiv(glavni?.kod ?? null)}{akt.length ? `, ${akt.length} aktivnosti` : ''}"
              onclick={() => izaberiDan(datum)}
            >
              <span class="dan-vrh">
                <span class="dan-broj">{uDan(datum).getDate()}</span>
                {#if primopredaja}
                  <span class="prelaz-pill" class:moj={primopredaja.kod === d.ja.id} style="--boja: {boja(primopredaja.kod)}"
                    title={prelazak(d, primopredaja.kod).naslov}>⇄ {hhmm(primopredaja.od)}</span
                  >
                {/if}
              </span>
              <span class="dan-akt">
                {#each akt.slice(0, 2) as b (b.kljuc)}
                  <span
                    class="akt-cip"
                    class:predlog={b.stanje === 'predlog'}
                    style="--boja: {bojaVrste(b.dogadjaj.vrsta)}"
                    use:prevlacenje={vucenjeCipa(b)}
                  >
                    {b.ceoDan ? '' : `${hhmm(b.odMin)} `}{b.dogadjaj.naziv}
                  </span>
                {/each}
                {#if akt.length > 2}<span class="akt-vise">+{akt.length - 2}</span>{/if}
              </span>
              <span class="akt-tacke" aria-hidden="true">
                {#each akt.slice(0, 4) as b (b.kljuc)}<i style="background: {bojaVrste(b.dogadjaj.vrsta)}"></i>{/each}
              </span>
              {#if stavkePoDanu.has(datum)}<span class="dan-stavka" title="Ima stavku sa datumom"></span>{/if}
              <span class="dan-traka" aria-hidden="true">
                {#each seg as s, i (i)}
                  <span class="dan-deo" class:izuzetak={s.izuzetak} style="width: {((s.do - s.od) / 1440) * 100}%; --boja: {boja(s.kod)}"
                  ></span>
                {/each}
              </span>
            </button>
          {/each}
        {/each}
      </div>
    </section>
  {/if}

  <section class="izabrani card rise" style="--i: 5" aria-labelledby="h-dan">
    <header class="kartica-glava">
      <h2 id="h-dan">{danDugo(izabran)}</h2>
      <span class="dodaj">
        {#if prikaz !== 'dan'}<button class="btn btn-ghost mali" onclick={() => otvoriDan(izabran)}>Prikaz dana</button>{/if}
        <button class="btn btn-ghost mali" onclick={() => (aktivnost = { vrsta: 'dodaj', datum: izabran })}>+ Aktivnost</button>
        <button class="btn btn-ghost mali" onclick={() => (predlog = { vrsta: 'dodaj', datum: izabran })}>+ Boravak</button>
      </span>
    </header>

    <h3 class="label podnaslov">Kod koga je</h3>
    <ul class="segmenti">
      {#each daniSegmenti as s, i (i)}
        <li class="segment" style="--boja: {boja(s.kod)}">
          <span class="seg-vreme mono">{hhmm(s.od)}–{s.do === 1440 ? '24:00' : hhmm(s.do)}</span>
          <span class="seg-telo">
            <span class="seg-ko"><i class="dot"></i>{s.kod ? `kod ${genitiv(s.kod)}` : 'nije upisano'}</span>
            {#if s.boravak}
              <span class="faint">
                {s.izuzetak ? 'jednokratna promena' : 'redovan raspored'} · {opseg(s.boravak.od, s.boravak.do)}{#if s.boravak.napomena}&nbsp;· {s.boravak.napomena}{/if}
              </span>
            {/if}
          </span>
          {#if s.boravak}
            {@const b = s.boravak}
            <span class="seg-akcije">
              <button class="tekst-dugme" onclick={() => (predlog = { vrsta: 'izmeni', boravak: b })}>Izmeni</button>
              <button class="tekst-dugme" onclick={() => (predlog = { vrsta: 'obrisi', boravak: b })}>Obriši</button>
            </span>
          {/if}
        </li>
      {/each}
    </ul>

    <h3 class="label podnaslov">Aktivnosti</h3>
    {#if aktivnostiDana.length}
      <ul class="segmenti">
        {#each aktivnostiDana as b (b.kljuc)}
          <li class="segment aktivnost-red" class:predlog={b.stanje === 'predlog'} style="--boja: {bojaVrste(b.dogadjaj.vrsta)}">
            <span class="seg-vreme mono">{b.ceoDan ? 'ceo dan' : `${hhmm(b.odMin)}–${hhmm(b.doMin)}`}</span>
            <span class="seg-telo">
              <span class="seg-ko">{b.dogadjaj.naziv}</span>
              <span class="faint">
                {[nazivVrste(b.dogadjaj.vrsta), b.dogadjaj.mesto, b.dogadjaj.vodi ? `vodi ${oznaka(b.dogadjaj.vodi).toLocaleLowerCase('sr')}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {#if b.stanje !== 'potvrdjen'}
                <span class="ceka-tekst">{{ predlog: 'čeka potvrdu', izmena: 'predlog izmene', brisanje: 'predlog brisanja' }[b.stanje]}</span>
              {/if}
            </span>
            <span class="seg-akcije">
              <button class="tekst-dugme" onclick={() => (pregled = { dogadjaj: b.dogadjaj, datum: b.datum, zahtev: b.zahtev })}>Detalji</button>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="pomoc">Nema aktivnosti ovog dana.</p>
    {/if}

    <p class="pomoc">Sve promene u kalendaru su predlozi. Važe tek kad ih {d.drugi.oznaka.toLocaleLowerCase('sr')} prihvati.</p>

    {#if zahteviDana.length}
      <h3 class="label podnaslov">Predlozi za ovaj dan</h3>
      {#each zahteviDana as z (z.id)}{@render zahtevKartica(d, z, z.predlozio === d.ja.id)}{/each}
    {/if}

    {#if stavkePoDanu.has(izabran)}
      <h3 class="label podnaslov">Stavke za ovaj dan</h3>
      <ul class="stavke-dana">
        {#each stavkePoDanu.get(izabran) ?? [] as s (s.id)}
          <li>
            <a href={putanje.stavka(s.id)}><Ikona ime={s.oblast} velicina={14} /> {s.naslov}</a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if istorija.length}
    <section class="istorija card rise" style="--i: 6" aria-labelledby="h-ist">
      <header class="kartica-glava"><h2 id="h-ist">Istorija promena</h2></header>
      <ul>
        {#each istorija as z (z.id)}
          {@const o = opisZahteva(d, z)}
          {@const st = STANJE_ISTORIJE[z.stanje]}
          <li class="ist-red ist-{z.stanje}">
            <span class="ist-znak">{st.znak}</span>
            <span class="ist-telo">
              <span>{o.naslov}: {o.redovi[0]}</span>
              <span class="faint">
                {oznaka(z.predlozio)} predlaže · {z.resio && z.stanje !== 'povucen' ? `${oznaka(z.resio)}: ` : ''}{st.tekst}
                · {pre(z.reseno ?? z.kreirano, sada)}{#if z.razlog}&nbsp;· „{z.razlog}“{/if}
              </span>
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if prelazakIzbor}
    {@const pi = prelazakIzbor}
    {@const t = prelazak(d, pi.pp.ka)}
    {@const posle = efektivno(d.boravci, `${pi.datum}T${hhmm(pi.pp.min)}`)}
    <dialog bind:this={prelazakDijalog} class="dijalog" style="--sirina-dijaloga: 26rem" onclose={() => (prelazakIzbor = null)}>
      <div class="pregled" style="--boja: {boja(pi.pp.ka)}">
        <span class="pregled-vrsta"><Ikona ime="prelazak" velicina={15} /> Prelazak</span>
        <h2>{t.naslov}</h2>
        <p class="pregled-kada">{danDugo(pi.datum)} · {hhmm(pi.pp.min)}</p>
        <dl>
          <div><dt>Do tada</dt><dd>kod {genitiv(pi.pp.od)}</dd></div>
          <div><dt>Preuzima</dt><dd>{t.moj ? 'ti' : oznaka(pi.pp.ka)}</dd></div>
          {#if posle}<div><dt>Boravak</dt><dd>{posle.vrsta === 'izuzetak' ? 'jednokratna promena' : 'redovan raspored'} · {opseg(posle.od, posle.do)}</dd></div>{/if}
          {#if posle?.napomena}<div><dt>Napomena</dt><dd>{posle.napomena}</dd></div>{/if}
        </dl>
        <p class="faint">Drugo vreme je predlog; važi kad ga {d.drugi.oznaka.toLocaleLowerCase('sr')} prihvati.</p>
        <div class="akcije">
          {#if posle}
            {@const b = posle}
            <button class="btn mali" onclick={() => { prelazakDijalog?.close(); predlog = { vrsta: 'izmeni', boravak: b }; }}>Predloži drugo vreme</button>
          {/if}
          <button class="btn btn-ghost mali zatvori" onclick={() => prelazakDijalog?.close()}>Zatvori</button>
        </div>
      </div>
    </dialog>
  {/if}

  {#if pregled}
    {@const p = pregled}
    {@const dog = p.dogadjaj}
    {@const potvrdjen = 'id' in dog && d.dogadjaji.some((x) => x.id === (dog as Dogadjaj).id)}
    {@const z = p.zahtev}
    <dialog bind:this={pregledDijalog} class="dijalog" style="--sirina-dijaloga: 26rem" onclose={() => (pregled = null)}>
      <div class="pregled" style="--boja: {bojaVrste(dog.vrsta)}">
        <span class="pregled-vrsta"><i class="kvadrat"></i>{nazivVrste(dog.vrsta)}</span>
        <h2>{dog.naziv}</h2>
        <p class="pregled-kada">
          {danDugo(p.datum)}{dog.ceoDan ? ' · ceo dan' : ` · ${dog.od}–${dog.do}`}
        </p>
        {#if dog.ponavljanje.tip !== 'ne'}<p class="faint">Ponavlja se: {opisPonavljanja(dog.ponavljanje)}</p>{/if}
        <dl>
          {#if dog.mesto}<div><dt>Gde</dt><dd>{dog.mesto}</dd></div>{/if}
          <div><dt>Ko vodi</dt><dd>{dog.vodi ? oznaka(dog.vodi) : 'nije dogovoreno'}</dd></div>
          {#if dog.napomena}<div><dt>Napomena</dt><dd>{dog.napomena}</dd></div>{/if}
        </dl>
        {#if z}
          <p class="pregled-ceka">
            {z.predlozio === d.ja.id ? 'Tvoj predlog' : `${oznaka(z.predlozio)} predlaže`}:
            {z.vrsta === 'dodaj' ? 'nova aktivnost' : z.vrsta === 'izmeni' ? 'izmena' : 'brisanje'} · čeka potvrdu
            {#if z.poruka}<br /><i>„{z.poruka}“</i>{/if}
          </p>
        {/if}
        <div class="akcije">
          {#if z && z.predlozio !== d.ja.id}
            <button class="btn mali" onclick={() => { zatvoriPregled(); uradi((iz) => iz.prihvatiZahtev(z.id), 'Prihvaćeno. Kalendar je promenjen.'); }}>Prihvati</button>
            <button class="btn btn-ghost mali" onclick={() => { zatvoriPregled(); odbijanje = z; }}>Odbij</button>
          {:else if z}
            <button class="btn btn-ghost mali" onclick={() => { zatvoriPregled(); uradi((iz) => iz.povuciZahtev(z.id), 'Predlog je povučen.'); }}>Povuci predlog</button>
          {:else if potvrdjen}
            {@const pravi = dog as Dogadjaj}
            <button class="btn btn-ghost mali" onclick={() => { zatvoriPregled(); aktivnost = { vrsta: 'izmeni', dogadjaj: pravi }; }}>Predloži izmenu</button>
            <button class="btn btn-danger mali" onclick={() => { zatvoriPregled(); aktivnost = { vrsta: 'obrisi', dogadjaj: pravi }; }}>Predloži brisanje</button>
          {/if}
          <button class="btn btn-ghost mali zatvori" onclick={zatvoriPregled}>Zatvori</button>
        </div>
      </div>
    </dialog>
  {/if}

  {#if pomeranje && iz}
    <PomeriDijalog
      pomeranje={pomeranje}
      podaci={d}
      izvor={iz}
      onGotovo={async (t) => {
        await ucitaj();
        javi(t);
      }}
      onZatvori={() => (pomeranje = null)}
    />
  {/if}

  {#if aktivnost}
    <PredlogAktivnosti
      rezim={aktivnost}
      podaci={d}
      onPosalji={async (ulaz) => {
        await iz!.predloziDogadjaj(ulaz);
        await ucitaj();
        javi(`Predlog je poslat. Čeka da ${d.drugi.oznaka.toLocaleLowerCase('sr')} prihvati.`);
      }}
      onZatvori={() => (aktivnost = null)}
    />
  {/if}

  {#if predlog}
    <PredlogKalendara
      rezim={predlog}
      ja={d.ja}
      drugi={d.drugi}
      onPosalji={async (ulaz) => {
        await iz!.predloziKalendar(ulaz);
        await ucitaj();
        javi(`Predlog je poslat. Čeka da ${d.drugi.oznaka.toLocaleLowerCase('sr')} prihvati.`);
      }}
      onZatvori={() => (predlog = null)}
    />
  {/if}

  {#if odbijanje}
    {@const z = odbijanje}
    <RazlogDijalog
      naslov="Odbij predlog"
      opis={opisZahteva(d, z).redovi.join(' · ')}
      polje={`Zašto ne? ${d.drugi.oznaka} će videti odgovor.`}
      dugme="Odbij"
      onPotvrdi={(razlog) => uradi((iz) => iz.odbijZahtev(z.id, razlog), 'Predlog je odbijen.')}
      onZatvori={() => (odbijanje = null)}
    />
  {/if}
{/if}

{#if poruka}<div class="poruka" role="status">{poruka}</div>{/if}

<style>
  .glava {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 1.2rem;
  }

  .glava h1 {
    font-size: clamp(1.8rem, 5.5vw, 2.6rem);
  }

  /* ---------- Now ---------- */

  .sada {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    border-color: color-mix(in srgb, var(--boja) 40%, transparent);
    background: linear-gradient(120deg, color-mix(in srgb, var(--boja) 10%, transparent), transparent 70%), var(--surface);
  }

  .sada-krug {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--boja);
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--boja) 18%, transparent);
  }

  .sada-tekst {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .sada-glavno {
    font-size: 1.2rem;
    font-weight: 600;
  }

  /* ---------- Requests ---------- */

  .zahtevi {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-bottom: 1rem;
  }

  .naslov-sekcije {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.05rem;
    margin-top: 0.3rem;
  }

  .mehur {
    display: grid;
    place-items: center;
    min-width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    background: var(--warn);
    color: var(--on-accent);
    font-size: 0.8rem;
  }

  .zahtev {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    border-color: var(--warn-line);
    background: linear-gradient(140deg, var(--warn-soft), transparent 75%), var(--surface);
  }

  .zahtev.moj {
    border-style: dashed;
    background: var(--surface);
  }

  .zahtev-glava {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    flex-shrink: 0;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--boja);
    background: color-mix(in srgb, var(--boja) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--boja) 35%, transparent);
  }

  .zahtev-ko {
    display: flex;
    flex-direction: column;
    font-size: 0.92rem;
  }

  .zahtev-ko .faint {
    font-size: 0.8rem;
  }

  .zahtev-redovi {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.92rem;
  }

  .zahtev-poruka {
    font-style: italic;
    color: var(--text-dim);
    font-size: 0.92rem;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .mali {
    padding: 0.4rem 0.8rem;
    font-size: 0.74rem;
  }

  /* ---------- Month ---------- */

  .mesec {
    margin-bottom: 1rem;
  }

  .mesec-glava {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }

  .mesec-naziv {
    font-size: 1.2rem;
    min-width: 9.5rem;
    text-align: center;
  }

  .nav-dugme {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 1px solid var(--border-strong);
    font-size: 1.1rem;
    line-height: 1;
    color: var(--text-dim);
  }

  .nav-dugme:hover {
    color: var(--text);
    border-color: var(--text-dim);
  }

  .predlozi {
    margin-left: auto;
    padding: 0.5rem 0.9rem;
  }

  @media (max-width: 560px) {
    .predlozi {
      width: 100%;
      margin-left: 0;
    }
  }

  .legenda {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1.1rem;
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-bottom: 0.8rem;
  }

  .legenda span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .uzorak {
    width: 0.9rem;
    height: 0.6rem;
    border-radius: 2px;
  }

  .izuzetak-uzorak {
    background: repeating-linear-gradient(135deg, var(--text-dim) 0 2px, transparent 2px 4px);
  }

  .ceka-uzorak {
    border: 1.5px dashed var(--warn);
  }

  .tacka-stavka {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warn);
  }

  .mreza {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: clamp(2px, 0.8vw, 6px);
  }

  .dan-naziv {
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
    padding-bottom: 0.3rem;
  }

  .dan {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    aspect-ratio: 1 / 1;
    min-height: 2.9rem;
    padding: clamp(0.25rem, 1vw, 0.5rem);
    border-radius: 9px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--boja) 13%, var(--bg-raised));
    overflow: hidden;
    text-align: left;
    transition: border-color 0.2s var(--ease), transform 0.2s var(--ease);
  }

  @media (min-width: 860px) {
    .dan {
      aspect-ratio: 1.35 / 1;
    }
  }

  .dan:hover {
    border-color: var(--border-strong);
  }

  .dan.van {
    opacity: 0.4;
  }

  .dan.danas .dan-broj {
    background: var(--text);
    color: var(--bg);
  }

  .dan.izabran {
    border-color: var(--bio);
    box-shadow: 0 0 0 1px var(--bio);
  }

  .dan.ceka {
    border: 1.5px dashed var(--warn);
  }

  .dan-broj {
    display: grid;
    place-items: center;
    min-width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    font-size: clamp(0.78rem, 2.2vw, 0.95rem);
    font-weight: 600;
  }

  .dan-vreme {
    font-family: var(--font-mono);
    font-size: clamp(0.55rem, 1.6vw, 0.68rem);
    color: var(--text-dim);
  }

  .dan-stavka {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warn);
  }

  /* The day as a strip from midnight to midnight, coloured by who has the child. */
  .dan-traka {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: clamp(5px, 1.3vw, 8px);
    display: flex;
  }

  .dan-deo {
    height: 100%;
    background: var(--boja);
  }

  .dan-deo.izuzetak {
    background: repeating-linear-gradient(135deg, var(--boja) 0 3px, color-mix(in srgb, var(--boja) 35%, transparent) 3px 6px);
  }

  /* ---------- Selected day ---------- */

  .izabrani {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .kartica-glava {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .kartica-glava h2 {
    font-size: 1.15rem;
  }

  .kartica-glava h2::first-letter {
    text-transform: uppercase;
  }

  .segmenti {
    display: flex;
    flex-direction: column;
  }

  .segment {
    display: grid;
    grid-template-columns: 6.6rem 1fr auto;
    align-items: center;
    gap: 0.7rem;
    padding: 0.65rem 0 0.65rem 0.7rem;
    border-left: 3px solid var(--boja);
  }

  .segment + .segment {
    border-top: 1px solid var(--border);
  }

  @media (max-width: 520px) {
    .segment {
      grid-template-columns: 1fr auto;
    }

    .seg-vreme {
      grid-column: 1 / -1;
    }
  }

  .seg-vreme {
    font-size: 0.82rem;
    color: var(--text-dim);
  }

  .seg-telo {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.86rem;
  }

  .seg-ko {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 600;
    font-size: 1rem;
  }

  .seg-ko .dot {
    background: var(--boja);
  }

  .seg-akcije {
    display: flex;
    gap: 0.7rem;
  }

  .tekst-dugme {
    font-size: 0.82rem;
    color: var(--text-dim);
    text-decoration: underline;
    text-underline-offset: 0.25em;
    text-decoration-color: var(--border-strong);
  }

  .tekst-dugme:hover {
    color: var(--bio);
  }

  .pomoc {
    font-size: 0.82rem;
    color: var(--text-faint);
  }

  .podnaslov {
    margin-top: 0.4rem;
  }

  .stavke-dana a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0;
  }

  .stavke-dana a:hover {
    color: var(--bio);
  }

  /* ---------- History ---------- */

  .istorija ul {
    display: flex;
    flex-direction: column;
    margin-top: 0.5rem;
  }

  .ist-red {
    display: flex;
    gap: 0.75rem;
    padding: 0.6rem 0;
    font-size: 0.9rem;
  }

  .ist-red + .ist-red {
    border-top: 1px solid var(--border);
  }

  .ist-znak {
    width: 1.5rem;
    height: 1.5rem;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 50%;
    font-size: 0.8rem;
    border: 1px solid var(--border-strong);
    color: var(--text-dim);
  }

  .ist-prihvacen .ist-znak {
    color: var(--bio);
    border-color: var(--bio-line);
  }

  .ist-odbijen .ist-znak {
    color: var(--hitno);
    border-color: var(--hitno-line);
  }

  .ist-telo {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .ist-telo .faint {
    font-size: 0.8rem;
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
  /* ---------- Toolbar and views ---------- */

  .alati {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-bottom: 0.8rem;
  }

  .alati-red {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .alati .mesec-naziv {
    min-width: 0;
    text-align: left;
    font-size: 1.15rem;
    margin-right: auto;
  }

  .prikazi {
    display: flex;
    gap: 0.2rem;
    padding: 0.25rem;
    border-radius: 999px;
    background: var(--surface-hover);
    border: 1px solid var(--border);
  }

  .prikaz-dugme {
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    font-size: 0.86rem;
    color: var(--text-dim);
  }

  .prikaz-dugme[aria-selected='true'] {
    background: var(--bg-raised);
    color: var(--text);
    box-shadow: 0 2px 10px -4px rgba(0, 0, 0, 0.4);
  }

  .dodaj {
    display: flex;
    gap: 0.4rem;
    margin-left: auto;
  }

  .kvadrat {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 3px;
  }

  .danas-akt {
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .danas-akt b {
    font-weight: 600;
  }

  /* Month cells: activities as small chips on wide screens, dots on phones. */
  .dan-vrh {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    width: 100%;
  }

  .dan-akt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    min-width: 0;
  }

  .akt-cip {
    display: block;
    font-size: 0.66rem;
    line-height: 1.35;
    padding: 0 0.3rem;
    border-radius: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: color-mix(in srgb, var(--boja) 24%, transparent);
    border-left: 2px solid var(--boja);
  }

  .akt-cip {
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }

  :global(.akt-cip.se-vuce) {
    opacity: 0.35;
  }

  .akt-cip.predlog {
    background: transparent;
    outline: 1px dashed var(--warn);
  }

  .akt-vise {
    font-size: 0.62rem;
    color: var(--text-faint);
  }

  .akt-tacke {
    display: none;
    gap: 3px;
  }

  .akt-tacke i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  @media (max-width: 680px) {
    .dan-akt {
      display: none;
    }

    .akt-tacke {
      display: flex;
    }
  }

  .aktivnost-red.predlog {
    border-left-style: dashed;
  }

  .ceka-tekst {
    font-size: 0.78rem;
    color: var(--warn);
  }

  /* ---------- Activity detail (like a calendar app's popover) ---------- */

  .pregled {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.3rem;
    border-top: 4px solid var(--boja);
  }

  .pregled-vrsta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .pregled-vrsta .kvadrat {
    background: var(--boja);
  }

  .pregled h2 {
    font-size: 1.35rem;
  }

  .pregled-kada::first-letter {
    text-transform: uppercase;
  }

  .pregled dl {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0.3rem 0;
  }

  .pregled dl div {
    display: grid;
    grid-template-columns: 6rem 1fr;
    gap: 0.5rem;
    font-size: 0.92rem;
  }

  .pregled dt {
    color: var(--text-dim);
  }

  .pregled dd {
    margin: 0;
  }

  .pregled-ceka {
    font-size: 0.88rem;
    color: var(--warn);
    padding: 0.55rem 0.75rem;
    border-radius: var(--radius-sm);
    border: 1px dashed var(--warn-line);
    background: var(--warn-soft);
  }

  .zatvori {
    margin-left: auto;
  }

  .prelaz-pill {
    margin-left: auto;
    padding: 0 0.35rem;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: clamp(0.55rem, 1.6vw, 0.66rem);
    font-weight: 600;
    white-space: nowrap;
    color: var(--on-accent);
    background: var(--boja);
  }

  .prelaz-legenda {
    font-style: normal;
    font-weight: 700;
    color: var(--text);
  }

  .prelaz-pill.moj {
    box-shadow: 0 0 0 1.5px var(--bg), 0 0 0 2.5px var(--boja);
  }
</style>
