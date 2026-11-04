<script lang="ts">
  import { onMount } from 'svelte';
  import { izvor, type Izvor } from '../lib/izvor';
  import { naPotezu } from '../lib/domen';
  import { doDatuma, datumKratko, pre } from '../lib/format';
  import { putanje } from '../lib/putanje';
  import type { NovaStavkaUlaz, Podaci, Unos, VrstaUnosa } from '../lib/tipovi';
  import OznakeStavke from './OznakeStavke.svelte';
  import StavkaForma from './StavkaForma.svelte';

  type Rezim = 'odgovor' | 'predlog' | 'odbij' | 'ponovo' | 'izmena';

  const id = new URLSearchParams(location.search).get('id') ?? '';
  const sada = new Date();

  let iz: Izvor | null = null;
  let podaci = $state<Podaci | null>(null);
  let greska = $state<string | null>(null);
  let rezim = $state<Rezim>('odgovor');
  let tekst = $state('');
  let salje = $state(false);

  let s = $derived(podaci?.stavke.find((x) => x.id === id) ?? null);
  let tok = $derived(
    podaci ? podaci.unosi.filter((u) => u.stavkaId === id).sort((a, b) => a.kreirano.localeCompare(b.kreirano)) : [],
  );

  async function ucitaj() {
    iz ??= await izvor();
    podaci = await iz.ucitaj();
  }

  onMount(async () => {
    try {
      await ucitaj();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  });

  function ime(rid: string): string {
    if (!podaci) return rid;
    return rid === podaci.ja.id ? 'Ti' : podaci.drugi.oznaka;
  }

  async function uradi(fn: (iz: Izvor) => Promise<void>) {
    if (!iz) return;
    greska = null;
    salje = true;
    try {
      await fn(iz);
      tekst = '';
      rezim = 'odgovor';
      await ucitaj();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      salje = false;
    }
  }

  function posalji(e: SubmitEvent) {
    e.preventDefault();
    const t = tekst;
    if (rezim === 'odgovor') uradi((iz) => iz.odgovori(id, t));
    else if (rezim === 'predlog') uradi((iz) => iz.predloziZatvaranje(id, t));
    else if (rezim === 'odbij') uradi((iz) => iz.odbijZatvaranje(id, t));
    else if (rezim === 'ponovo') uradi((iz) => iz.ponovoOtvori(id, t));
  }

  function prebaci(r: Rezim) {
    rezim = r;
    tekst = '';
    greska = null;
  }

  // [when you did it, when the other parent did]
  const OZNAKA_UNOSA: Record<VrstaUnosa, [string, string]> = {
    odgovor: ['', ''],
    aktivirano: ['pomeraš u Aktivno', 'pomera u Aktivno'],
    predlog_zatvaranja: ['predlažeš zatvaranje', 'predlaže zatvaranje'],
    povucen_predlog: ['povlačiš predlog zatvaranja', 'povlači predlog zatvaranja'],
    odbijeno_zatvaranje: ['ne slažeš se sa zatvaranjem', 'ne slaže se sa zatvaranjem'],
    zatvoreno: ['potvrđuješ zatvaranje', 'potvrđuje zatvaranje'],
    ponovo_otvoreno: ['ponovo otvaraš', 'ponovo otvara'],
  };

  const FORMA: Record<Exclude<Rezim, 'izmena'>, { label: string; placeholder: string; dugme: string }> = {
    odgovor: { label: 'Odgovor', placeholder: 'Napiši odgovor…', dugme: 'Pošalji' },
    predlog: {
      label: 'Odluka',
      placeholder: 'Šta je dogovoreno? Npr. „Vodi tata, termin u 17h.“',
      dugme: 'Predloži zatvaranje',
    },
    odbij: { label: 'Zašto ne', placeholder: 'Šta još treba da se dogovori?', dugme: 'Ne slažem se' },
    ponovo: { label: 'Razlog', placeholder: 'Zašto se tema ponovo otvara?', dugme: 'Ponovo otvori' },
  };

  function klasaUnosa(u: Unos): string {
    return u.vrsta === 'odgovor' ? '' : 'dogadjaj';
  }
</script>

<a class="nazad mono" href={putanje.stavke()}>← Sve stavke</a>

{#if !podaci && !greska}
  <p class="loading">Učitavam…</p>
{:else if podaci && !s}
  <p class="card prazno">Ova stavka ne postoji.</p>
{:else if podaci && s}
  {@const d = podaci}
  <article class="stavka">
    <header class="glava">
      <OznakeStavke stavka={s} oblasti={d.oblasti} {sada} />
      <h1>{s.naslov}</h1>
      <p class="meta mono">
        {ime(s.otvorio)} · {pre(s.kreirano, sada)}
        {#if s.datum}· ⏱ {datumKratko(s.datum)} ({doDatuma(s.datum, sada)}){/if}
      </p>
    </header>

    {#if rezim === 'izmena'}
      <div class="card">
        <StavkaForma
          pocetno={{ naslov: s.naslov, opis: s.opis, oblast: s.oblast, vazno: s.vazno, hitno: s.hitno, datum: s.datum }}
          oblasti={d.oblasti}
          dugme="Sačuvaj"
          onSacuvaj={(u: NovaStavkaUlaz) => uradi((iz) => iz.izmeniStavku(id, u))}
          onOtkazi={() => prebaci('odgovor')}
        />
      </div>
    {:else if s.opis}
      <p class="opis">{s.opis}</p>
    {/if}

    {#if s.zatvaranjePredlozio}
      <section class="card odluka predlog">
        <p class="label">{ime(s.zatvaranjePredlozio)} {s.zatvaranjePredlozio === d.ja.id ? 'predlažeš' : 'predlaže'} zatvaranje</p>
        <p class="odluka-tekst">{s.odluka}</p>
        <div class="akcije">
          {#if naPotezu(s, d.ja.id)}
            <button class="btn" disabled={salje} onclick={() => uradi((iz) => iz.potvrdiZatvaranje(id))}>Potvrdi i zatvori</button>
            <button class="btn btn-ghost" onclick={() => prebaci('odbij')}>Ne slažem se</button>
          {:else}
            <span class="dim">Čeka da {d.drugi.oznaka.toLocaleLowerCase('sr')} potvrdi.</span>
            <button class="btn btn-ghost" disabled={salje} onclick={() => uradi((iz) => iz.povuciPredlog(id))}>Povuci predlog</button>
          {/if}
        </div>
      </section>
    {:else if s.stanje === 'zatvoreno'}
      <section class="card odluka">
        <p class="label">Odluka · zatvoreno {s.zatvoreno ? pre(s.zatvoreno, sada) : ''}</p>
        <p class="odluka-tekst">{s.odluka}</p>
      </section>
    {/if}

    <section class="tok" aria-label="Tok">
      <h2 class="label">Tok</h2>
      <ol>
        <li class="unos dogadjaj">
          <span class="ko">{ime(s.otvorio)}</span>
          <span class="sta">{s.otvorio === d.ja.id ? 'postavljaš' : 'postavlja'} pitanje</span>
          <span class="kada mono">{pre(s.kreirano, sada)}</span>
        </li>
        {#each tok as u (u.id)}
          <li class="unos {klasaUnosa(u)}" class:moj={u.autor === d.ja.id}>
            <span class="ko">{ime(u.autor)}</span>
            {#if u.vrsta !== 'odgovor'}<span class="sta">{OZNAKA_UNOSA[u.vrsta][u.autor === d.ja.id ? 0 : 1]}</span>{/if}
            <span class="kada mono">{pre(u.kreirano, sada)}</span>
            {#if u.tekst}<p class="tekst">{u.tekst}</p>{/if}
          </li>
        {/each}
      </ol>
    </section>

    {#if rezim !== 'izmena'}
      <section class="card pisanje">
        {#if s.stanje === 'zatvoreno' && rezim !== 'ponovo'}
          <div class="akcije">
            <button class="btn btn-ghost" onclick={() => prebaci('ponovo')}>Ponovo otvori</button>
          </div>
        {:else}
          {@const forma = FORMA[rezim]}
          <form onsubmit={posalji} class="forma">
            <label class="field">
              <span class="label">{forma.label}</span>
              <textarea class="input" bind:value={tekst} rows="3" placeholder={forma.placeholder} required></textarea>
            </label>
            {#if greska}<p class="error">{greska}</p>{/if}
            <div class="akcije">
              <button class="btn" type="submit" disabled={salje || !tekst.trim()}>{forma.dugme}</button>
              {#if rezim !== 'odgovor'}
                <button class="btn btn-ghost" type="button" onclick={() => prebaci('odgovor')}>Otkaži</button>
              {:else if !s.zatvaranjePredlozio}
                <button class="btn btn-ghost" type="button" onclick={() => prebaci('predlog')}>Predloži zatvaranje…</button>
              {/if}
            </div>
          </form>
        {/if}
        {#if rezim === 'odgovor' && s.stanje !== 'zatvoreno'}
          <button class="izmeni mono" onclick={() => prebaci('izmena')}>Izmeni naslov, oblast, oznake ili datum</button>
        {/if}
      </section>
    {/if}
  </article>
{/if}

{#if greska && rezim === 'izmena'}<p class="error">{greska}</p>{/if}
{#if greska && !podaci}<p class="error">Podaci nisu učitani: {greska}</p>{/if}

<style>
  .nazad {
    display: inline-block;
    font-size: 0.78rem;
    color: var(--text-dim);
    margin-bottom: 1.1rem;
  }

  .nazad:hover {
    color: var(--bio);
  }

  .stavka {
    max-width: 46rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .glava {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .meta {
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  .opis {
    font-size: 1.05rem;
    white-space: pre-wrap;
  }

  .odluka {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .predlog {
    border-color: var(--warn-line);
    background: var(--warn-soft);
  }

  .predlog .label {
    color: var(--warn);
  }

  .odluka-tekst {
    font-size: 1.05rem;
    font-weight: 500;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }

  .tok ol {
    list-style: none;
    padding: 0;
    margin-top: 0.6rem;
    border-left: 1px solid var(--border-strong);
  }

  .unos {
    position: relative;
    padding: 0.2rem 0 1rem 1.1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.55rem;
  }

  .unos::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 0.62rem;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ai);
  }

  .unos.moj::before {
    background: var(--bio);
  }

  .unos.dogadjaj::before {
    background: var(--bg);
    border: 1px solid var(--text-faint);
  }

  .ko {
    font-weight: 600;
  }

  .sta {
    color: var(--text-dim);
  }

  .kada {
    font-size: 0.72rem;
    color: var(--text-faint);
  }

  .tekst {
    flex-basis: 100%;
    white-space: pre-wrap;
    color: var(--text);
  }

  .dogadjaj .tekst {
    color: var(--text-dim);
    font-style: italic;
  }

  .pisanje {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .forma {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .izmeni {
    align-self: flex-start;
    font-size: 0.74rem;
    color: var(--text-faint);
  }

  .izmeni:hover {
    color: var(--text);
  }

  .prazno {
    color: var(--text-faint);
  }
</style>
