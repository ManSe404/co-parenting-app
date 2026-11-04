<script lang="ts">
  // First time after signing up: create the family space (or follow an
  // invitation link), invite the other parent, and protect the account.
  import { onMount } from 'svelte';
  import { type Porodica, type Uloga, kreirajPorodicu, mogudaOtvorimProstor, odjava, pristup } from '../lib/nalog';
  import { REPO } from '../lib/osnova';
  import { putanja } from '../lib/putanje';
  import MfaPodesavanje from './MfaPodesavanje.svelte';
  import PozoviRoditelja from './PozoviRoditelja.svelte';

  let korak = $state<'izbor' | 'poziv' | 'zastita'>('izbor');
  let uloga = $state<Uloga | null>(null);
  let link = $state('');
  let porodica = $state<Porodica | null>(null);
  let email = $state('');
  let greska = $state<string | null>(null);
  let radi = $state(false);
  let spreman = $state(false);
  // A private copy (owner list in the database) lets only listed accounts open a space.
  let smeDaOtvori = $state(true);

  onMount(async () => {
    try {
      const p = await pristup();
      if (p.stanje === 'odjavljen') return location.replace(putanja('/prijava/'));
      if (p.stanje === 'mfa') return location.replace(putanja('/mfa/?dalje=/dobrodosli/'));
      if (p.stanje === 'spreman') {
        porodica = p.porodica;
        korak = p.porodica.drugi ? 'zastita' : 'poziv';
      } else {
        email = p.email;
        smeDaOtvori = await mogudaOtvorimProstor();
      }
      spreman = true;
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
      spreman = true;
    }
  });

  async function napravi(e: SubmitEvent) {
    e.preventDefault();
    if (!uloga) return;
    greska = null;
    radi = true;
    try {
      // The app never shows the child's name; the database still wants a value.
      await kreirajPorodicu('Dete', uloga);
      const p = await pristup();
      if (p.stanje === 'spreman') porodica = p.porodica;
      korak = 'poziv';
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      radi = false;
    }
  }

  function otvoriLink(e: SubmitEvent) {
    e.preventDefault();
    const m = /[?&]t=([a-f0-9]{64})/.exec(link) ?? /^([a-f0-9]{64})$/.exec(link.trim());
    if (!m) {
      greska = 'To ne liči na link za poziv. Kopiraj ceo link koji ti je stigao.';
      return;
    }
    location.href = putanja(`/poziv/?t=${m[1]}`);
  }

  async function izlaz() {
    await odjava();
    location.replace(putanja('/prijava/'));
  }
</script>

{#if spreman}
  {#if korak === 'izbor'}
    <section class="card kutija">
      <p class="eyebrow">Dobrodošli</p>
      <h1>Porodični prostor</h1>
      <p class="dim">Prostor dele dva roditelja. Jedan ga napravi i pozove drugog.</p>

      {#if smeDaOtvori}
        <form class="deo" onsubmit={napravi}>
          <h2>Pravim novi prostor</h2>
          <div class="field">
            <span class="label">Ja sam</span>
            <div class="uloge">
              <button type="button" class="uloga" style="--boja: var(--bio)" aria-pressed={uloga === 'tata'} onclick={() => (uloga = 'tata')}>
                <i></i>Tata
              </button>
              <button type="button" class="uloga" style="--boja: var(--ai)" aria-pressed={uloga === 'mama'} onclick={() => (uloga = 'mama')}>
                <i></i>Mama
              </button>
            </div>
          </div>
          <button class="btn" type="submit" disabled={radi || !uloga}>Napravi prostor</button>
        </form>

        <p class="ili"><span>ili</span></p>
      {:else}
        <div class="deo privatno">
          <h2>Ovaj sajt je privatan</h2>
          <p class="dim">
            Ovde nove porodične prostore otvara samo vlasnik sajta. Ako ti je drugi roditelj poslao link za poziv, nalepi ga
            ispod.
          </p>
          <p class="dim">
            Aplikacija je otvorenog koda, pa možeš da podigneš svoju kopiju za svoju porodicu: <a href={REPO} target="_blank" rel="noopener">{REPO.replace('https://', '')}</a>.
          </p>
        </div>

        <p class="ili"><span>poziv</span></p>
      {/if}

      <form class="deo" onsubmit={otvoriLink}>
        <h2>Imam link od drugog roditelja</h2>
        <input class="input" bind:value={link} placeholder="Nalepi link koji ti je stigao" />
        <button class="btn btn-ghost" type="submit">Otvori poziv</button>
      </form>

      {#if greska}<p class="error">{greska}</p>{/if}
      <p class="faint malo">Prijavljen si kao {email}. <button class="tekst" onclick={izlaz}>Odjavi se</button></p>
    </section>
  {:else if korak === 'poziv' && porodica}
    <section class="card kutija">
      <p class="eyebrow">Korak 2 od 3</p>
      <h1>Pozovi {porodica.ja.uloga === 'tata' ? 'mamu' : 'tatu'}</h1>
      <p class="dim">
        Napravi link i pošalji ga. Kad ga {porodica.ja.uloga === 'tata' ? 'mama' : 'tata'} otvori i prihvati, povezani ste i
        vidite iste podatke.
      </p>
      <PozoviRoditelja koga={porodica.ja.uloga === 'tata' ? 'mamu' : 'tatu'} />
      <button class="btn btn-ghost" onclick={() => (korak = 'zastita')}>Dalje</button>
    </section>
  {:else}
    <section class="card kutija">
      <p class="eyebrow">Korak 3 od 3</p>
      <h1>Zaštiti nalog</h1>
      <p class="dim">
        Dvostepena prijava traži i kod iz aplikacije na telefonu. Ovde su podaci o detetu i zdravlju, pa je preporučujemo.
      </p>
      <MfaPodesavanje />
      <a class="btn" href={putanja('/')}>Uđi u aplikaciju</a>
    </section>
  {/if}
{/if}

<style>
  .kutija {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.6rem;
  }

  h1 {
    font-size: 1.6rem;
  }

  h2 {
    font-size: 1.02rem;
  }

  .deo {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .uloge {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .uloga {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    font-weight: 600;
  }

  .uloga i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--boja);
  }

  .uloga[aria-pressed='true'] {
    border-color: var(--boja);
    color: var(--boja);
    background: color-mix(in srgb, var(--boja) 10%, transparent);
  }

  .ili {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
    color: var(--text-faint);
  }

  .ili::before,
  .ili::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .malo {
    font-size: 0.82rem;
  }

  .tekst {
    color: var(--text-dim);
    text-decoration: underline;
    text-underline-offset: 0.25em;
  }
</style>
