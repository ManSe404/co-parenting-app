<script lang="ts">
  // School timetable card: a table (typed in, or imported from Excel/CSV and
  // reviewed before saving) and/or a photo of the printed timetable.
  import { danUNedelji } from '../lib/dogadjaji';
  import { danas as danasDatum } from '../lib/kalendar';
  import { roditeljPoId } from '../lib/kalendar-opis';
  import { pre } from '../lib/format';
  import type { Izvor } from '../lib/izvor';
  import { DANI_SKOLE, type UlazRasporeda, imaTabelu, prazanRaspored, uveziFajl } from '../lib/raspored-casova';
  import type { Podaci } from '../lib/tipovi';
  import Ikona from './Ikona.svelte';

  interface Props {
    podaci: Podaci;
    izvor: Izvor;
    /** Another karton form is open: this card's buttons wait. */
    zakljucano: boolean;
    onUredjuje: (otvoreno: boolean) => void;
    onSacuvano: (poruka: string) => Promise<void>;
  }

  let { podaci, izvor, zakljucano, onUredjuje, onSacuvano }: Props = $props();

  const sada = new Date();
  const danasDan = danUNedelji(danasDatum(sada));

  let nacrt = $state<UlazRasporeda | null>(null);
  let izFajla = $state<string | null>(null);
  let greska = $state<string | null>(null);
  let radi = $state(false);
  let ulazFajl: HTMLInputElement;
  let ulazSlika: HTMLInputElement;
  let uvecana = $state<HTMLDialogElement | null>(null);

  let r = $derived(podaci.rasporedCasova);

  function otvori(n: UlazRasporeda, fajl: string | null = null) {
    nacrt = n;
    izFajla = fajl;
    greska = null;
    onUredjuje(true);
  }

  function zatvori() {
    nacrt = null;
    izFajla = null;
    onUredjuje(false);
  }

  function rucno() {
    const osnova = r && imaTabelu(r) ? { casovi: [...r.casovi], tabela: r.tabela.map((x) => [...x]) } : prazanRaspored();
    otvori({ ...osnova, slika: r?.slika ?? null, napomena: r?.napomena ?? '' });
  }

  async function naFajl(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!f) return;
    greska = null;
    try {
      const t = await uveziFajl(f);
      otvori({ ...t, slika: r?.slika ?? null, napomena: r?.napomena ?? '' }, f.name);
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    }
  }

  /** Shrink a photo before saving: phones take 10+ MB pictures. */
  async function smanji(f: File, max = 1600): Promise<string> {
    const slika = await createImageBitmap(f);
    const k = Math.min(1, max / Math.max(slika.width, slika.height));
    const c = document.createElement('canvas');
    c.width = Math.round(slika.width * k);
    c.height = Math.round(slika.height * k);
    c.getContext('2d')!.drawImage(slika, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }

  async function naSliku(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!f) return;
    greska = null;
    radi = true;
    try {
      const slika = await smanji(f);
      if (nacrt) {
        nacrt.slika = slika;
      } else {
        const osnova = r ?? { ...prazanRaspored(), slika: null, napomena: '' };
        await izvor.sacuvajRasporedCasova({ casovi: osnova.casovi, tabela: osnova.tabela, slika, napomena: osnova.napomena });
        await onSacuvano('Slika rasporeda je sačuvana.');
      }
    } catch {
      greska = 'Ova slika ne može da se otvori. Probaj JPG ili PNG.';
    } finally {
      radi = false;
    }
  }

  async function sacuvaj() {
    if (!nacrt) return;
    radi = true;
    try {
      await izvor.sacuvajRasporedCasova({ ...nacrt, casovi: nacrt.casovi.map((c, i) => c.trim() || `${i + 1}.`) });
      zatvori();
      await onSacuvano('Raspored časova je sačuvan.');
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      radi = false;
    }
  }

  async function obrisi() {
    radi = true;
    try {
      await izvor.sacuvajRasporedCasova(null);
      zatvori();
      await onSacuvano('Raspored časova je obrisan; stari ostaje u promenama kartona.');
    } finally {
      radi = false;
    }
  }

  function dodajCas() {
    if (!nacrt) return;
    nacrt.casovi.push(`${nacrt.casovi.length + 1}.`);
    nacrt.tabela.push(DANI_SKOLE.map(() => ''));
  }

  function skiniCas() {
    if (!nacrt || nacrt.casovi.length <= 1) return;
    nacrt.casovi.pop();
    nacrt.tabela.pop();
  }

  let iskljuceno = $derived(zakljucano && !nacrt);

  // Phones: one day at a time; today by default, Monday on weekends.
  let izabranDan = $state(danasDan <= 4 ? danasDan : 0);
</script>

<section class="card raspored" aria-labelledby="h-raspored">
  <header class="glava">
    <span class="krug"><Ikona ime="tabela" velicina={17} /></span>
    <h2 id="h-raspored">Raspored časova</h2>
    {#if r && !nacrt}<span class="meta">{roditeljPoId(podaci, r.izmenio)?.oznaka} · {pre(r.izmenjeno, sada)}</span>{/if}
  </header>

  <input bind:this={ulazFajl} type="file" accept=".csv,.xlsx,.txt,text/csv" hidden onchange={naFajl} />
  <input bind:this={ulazSlika} type="file" accept="image/*" hidden onchange={naSliku} />

  {#if nacrt}
    <!-- Editing: by hand, or reviewing an import before saving -->
    {#if izFajla}<p class="uvezeno">Uvezeno iz „{izFajla}“. Proveri i ispravi pre čuvanja.</p>{/if}
    <div class="skrol">
      <table class="tabela uredjivanje">
        <thead>
          <tr>
            <th>Čas</th>
            {#each DANI_SKOLE as dan (dan)}<th>{dan}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each nacrt.casovi as _, i (i)}
            <tr>
              <td><input class="input cas" bind:value={nacrt.casovi[i]} aria-label="Oznaka časa" /></td>
              {#each DANI_SKOLE as dan, d (dan)}
                <td><input class="input" bind:value={nacrt.tabela[i][d]} aria-label="{dan}, {nacrt.casovi[i]}" /></td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="red-dugmadi">
      <button class="chip chip-toggle" onclick={dodajCas}>+ čas</button>
      <button class="chip chip-toggle" onclick={skiniCas} disabled={nacrt.casovi.length <= 1}>− poslednji čas</button>
    </div>

    <label class="field">
      <span class="label">Napomena <span class="faint">nije obavezno</span></span>
      <input class="input" bind:value={nacrt.napomena} placeholder="Npr. smene se menjaju svake nedelje" />
    </label>

    <div class="slika-red">
      {#if nacrt.slika}
        <img class="mala-slika" src={nacrt.slika} alt="Slika rasporeda" />
        <button class="btn btn-ghost mali" onclick={() => (nacrt!.slika = null)}>Ukloni sliku</button>
      {/if}
      <button class="btn btn-ghost mali" onclick={() => ulazSlika.click()} disabled={radi}>
        <Ikona ime="slika" velicina={14} />{nacrt.slika ? 'Zameni sliku' : 'Dodaj sliku'}
      </button>
    </div>

    {#if greska}<p class="error">{greska}</p>{/if}
    <div class="akcije">
      <button class="btn mali" onclick={sacuvaj} disabled={radi}>Sačuvaj</button>
      <button class="btn btn-ghost mali" onclick={zatvori}>Otkaži</button>
      {#if r}<button class="btn btn-danger mali obrisi" onclick={obrisi} disabled={radi}>Obriši raspored</button>{/if}
    </div>
  {:else}
    {#if r && imaTabelu(r)}
      <div class="po-danu">
        <div class="dani-izbor" role="tablist" aria-label="Dan">
          {#each DANI_SKOLE as dan, d (dan)}
            <button role="tab" class="dan-dugme" class:danas={d === danasDan} aria-selected={izabranDan === d} onclick={() => (izabranDan = d)}>
              {dan.slice(0, 3)}
            </button>
          {/each}
        </div>
        <ol class="casovi-dana">
          {#each r.casovi as cas, i (i)}
            {#if r.tabela[i]?.[izabranDan]}
              <li><span class="cas-oznaka">{cas}</span><span>{r.tabela[i][izabranDan]}</span></li>
            {/if}
          {/each}
        </ol>
      </div>
      <div class="skrol cela-tabela">
        <table class="tabela">
          <thead>
            <tr>
              <th></th>
              {#each DANI_SKOLE as dan, d (dan)}<th class:danas={d === danasDan}>{dan}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each r.casovi as cas, i (i)}
              <tr>
                <th scope="row" class="cas-oznaka">{cas}</th>
                {#each DANI_SKOLE as dan, d (dan)}<td class:danas={d === danasDan}>{r.tabela[i]?.[d] ?? ''}</td>{/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    {#if r?.slika}
      <button class="slika-dugme" onclick={() => uvecana?.showModal()} aria-label="Uvećaj sliku rasporeda">
        <img class="mala-slika" src={r.slika} alt="Slika rasporeda" />
      </button>
    {/if}
    {#if r?.napomena}<p class="napomena">{r.napomena}</p>{/if}
    {#if !r}
      <p class="prazno">Još nema rasporeda. Upiši ga ručno, uvezi iz Excela ili CSV-a, ili slikaj odštampan raspored.</p>
    {/if}

    {#if greska}<p class="error">{greska}</p>{/if}
    <div class="red-dugmadi">
      <button class="btn btn-ghost mali" disabled={iskljuceno} onclick={rucno}>
        <Ikona ime="olovka" velicina={14} />{r && imaTabelu(r) ? 'Izmeni ručno' : 'Upiši ručno'}
      </button>
      <button class="btn btn-ghost mali" disabled={iskljuceno} onclick={() => ulazFajl.click()}>
        <Ikona ime="tabela" velicina={14} />Uvezi Excel / CSV
      </button>
      <button class="btn btn-ghost mali" disabled={iskljuceno || radi} onclick={() => ulazSlika.click()}>
        <Ikona ime="slika" velicina={14} />{r?.slika ? 'Nova slika' : 'Slikaj / otpremi sliku'}
      </button>
    </div>
  {/if}
</section>

{#if r?.slika}
  <dialog bind:this={uvecana} class="dijalog" style="--sirina-dijaloga: 60rem">
    <div class="uvecano">
      <img src={r.slika} alt="Raspored časova" />
      <button class="btn btn-ghost mali" onclick={() => uvecana?.close()}>Zatvori</button>
    </div>
  </dialog>
{/if}

<style>
  .raspored {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .glava {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .glava h2 {
    font-size: 1.08rem;
  }

  .meta {
    margin-left: auto;
    font-size: 0.74rem;
    color: var(--text-faint);
  }

  .krug {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    color: var(--bio);
    background: var(--bio-soft);
    border: 1px solid var(--bio-line);
    flex-shrink: 0;
  }

  .skrol {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid var(--border);
  }

  .tabela {
    width: 100%;
    min-width: 34rem;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 0.88rem;
  }

  .tabela thead th:first-child {
    width: 3.4rem;
  }

  .uredjivanje thead th:first-child {
    width: 5rem;
  }

  .tabela th,
  .tabela td {
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
  }

  .tabela thead th {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
    background: var(--surface-hover);
  }

  .tabela tbody tr:last-child :is(th, td) {
    border-bottom: none;
  }

  .cas-oznaka {
    width: 3.2rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text-faint);
    font-weight: 400;
  }

  /* Today's column, so "what does he have today" is one glance. */
  .tabela .danas {
    background: var(--bio-soft);
  }

  .tabela thead th.danas {
    color: var(--bio);
  }

  /* Phone: day buttons and that day's lessons; the full table from 620px up. */
  .po-danu {
    display: none;
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (max-width: 619px) {
    .po-danu {
      display: flex;
    }

    .cela-tabela {
      display: none;
    }
  }

  .dani-izbor {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.3rem;
  }

  .dan-dugme {
    padding: 0.45rem 0;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--text-dim);
  }

  .dan-dugme.danas {
    border-color: var(--bio-line);
  }

  .dan-dugme[aria-selected='true'] {
    color: var(--on-accent);
    background: var(--bio);
    border-color: var(--bio);
  }

  .casovi-dana {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .casovi-dana li {
    display: grid;
    grid-template-columns: 2.6rem 1fr;
    gap: 0.5rem;
    padding: 0.55rem 0.7rem;
  }

  .casovi-dana li + li {
    border-top: 1px solid var(--border);
  }

  .uredjivanje td {
    padding: 0.25rem;
  }

  .uredjivanje .input {
    padding: 0.4rem 0.5rem;
    font-size: 0.86rem;
    min-width: 0;
  }

  .uredjivanje .cas {
    width: 100%;
  }

  .uvezeno {
    font-size: 0.88rem;
    color: var(--warn);
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--warn-line);
    background: var(--warn-soft);
  }

  .red-dugmadi,
  .akcije,
  .slika-red {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
  }

  .red-dugmadi .btn,
  .slika-red .btn {
    gap: 0.35rem;
  }

  .mali {
    padding: 0.4rem 0.8rem;
    font-size: 0.74rem;
  }

  .obrisi {
    margin-left: auto;
  }

  .slika-dugme {
    align-self: flex-start;
    padding: 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .mala-slika {
    max-height: 14rem;
    max-width: 100%;
    border-radius: 8px;
    object-fit: contain;
  }

  .uvecano {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.6rem;
    padding: 0.8rem;
  }

  .uvecano img {
    width: 100%;
    border-radius: 8px;
  }

  .napomena {
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .prazno {
    font-size: 0.9rem;
    color: var(--text-faint);
  }

  .label .faint {
    text-transform: none;
    letter-spacing: 0.02em;
  }
</style>
