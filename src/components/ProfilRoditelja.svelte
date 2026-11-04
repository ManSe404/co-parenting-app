<script lang="ts">
  // My profile (editable) and the other parent's (to read): name, phone,
  // address, e-mail and a note, so each of you has the other's details at hand.
  import { onMount } from 'svelte';
  import { pre } from '../lib/format';
  import { type Profil, type ProfilRoditelja, mapaLink, popunjen, telLink } from '../lib/profil';
  import { type ProfilIzvor, profilIzvor } from '../lib/profil-izvor';
  import Ikona from './Ikona.svelte';

  let iz = $state<ProfilIzvor | null>(null);
  let ja = $state<ProfilRoditelja | null>(null);
  let drugi = $state<ProfilRoditelja | null>(null);
  let greska = $state<string | null>(null);
  let izmena = $state(false);
  let polja = $state<Omit<Profil, 'izmenjen'>>({ ime: '', telefon: '', adresa: '', kontaktEmail: '', napomena: '' });
  let radi = $state(false);
  let sacuvano = $state(false);
  const sada = new Date();

  async function ucitaj() {
    const p = await iz!.profili();
    ja = p.ja;
    drugi = p.drugi;
  }

  onMount(async () => {
    try {
      iz = await profilIzvor();
      await ucitaj();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  });

  function pocni() {
    if (!ja) return;
    polja = { ime: ja.ime, telefon: ja.telefon, adresa: ja.adresa, kontaktEmail: ja.kontaktEmail, napomena: ja.napomena };
    greska = null;
    sacuvano = false;
    izmena = true;
  }

  async function sacuvaj(e: SubmitEvent) {
    e.preventDefault();
    radi = true;
    greska = null;
    try {
      await iz!.sacuvaj(polja);
      await ucitaj();
      izmena = false;
      sacuvano = true;
    } catch (err) {
      greska = err instanceof Error ? err.message : String(err);
    } finally {
      radi = false;
    }
  }

  const zenski = (p: ProfilRoditelja) => p.uloga === 'mama';
</script>

{#snippet podaci(p: ProfilRoditelja)}
  <dl>
    {#if p.ime}<div><dt>Ime i prezime</dt><dd>{p.ime}</dd></div>{/if}
    {#if p.telefon}
      <div>
        <dt>Telefon</dt>
        <dd><a class="veza" href={telLink(p.telefon)}><Ikona ime="kontakt" velicina={14} />{p.telefon}</a></dd>
      </div>
    {/if}
    {#if p.adresa}
      <div>
        <dt>Adresa</dt>
        <dd><a class="veza" href={mapaLink(p.adresa)} target="_blank" rel="noopener">{p.adresa}<Ikona ime="spolja" velicina={13} /></a></dd>
      </div>
    {/if}
    {#if p.kontaktEmail}
      <div><dt>Mejl</dt><dd><a class="veza" href={`mailto:${p.kontaktEmail}`}>{p.kontaktEmail}</a></dd></div>
    {/if}
    {#if p.napomena}<div><dt>Napomena</dt><dd>{p.napomena}</dd></div>{/if}
  </dl>
{/snippet}

{#if greska && !ja}
  <p class="error" role="alert">{greska}</p>
{:else if ja}
  <section class="card deo profil" style="--boja: var(--{ja.uloga === 'tata' ? 'bio' : 'ai'})">
    <div class="glava-kartice">
      <span class="krug">{ja.oznaka.charAt(0)}</span>
      <div>
        <h2>Moj profil</h2>
        <p class="dim">Ovo vidi i {drugi?.oznaka ?? 'drugi roditelj'}. Ti menjaš samo svoj profil.</p>
      </div>
    </div>

    {#if izmena}
      <form onsubmit={sacuvaj}>
        <label class="field">
          <span class="label">Ime i prezime</span>
          <input class="input" bind:value={polja.ime} maxlength="80" autocomplete="name" />
        </label>
        <div class="dva">
          <label class="field">
            <span class="label">Telefon</span>
            <input class="input" type="tel" bind:value={polja.telefon} maxlength="40" autocomplete="tel" placeholder="064 123 4567" />
          </label>
          <label class="field">
            <span class="label">Mejl za kontakt</span>
            <input class="input" type="email" bind:value={polja.kontaktEmail} maxlength="120" autocomplete="email" />
          </label>
        </div>
        <label class="field">
          <span class="label">Adresa</span>
          <input class="input" bind:value={polja.adresa} maxlength="200" autocomplete="street-address" placeholder="Gde je dete kod tebe, za primopredaju" />
        </label>
        <label class="field">
          <span class="label">Napomena</span>
          <textarea class="input" bind:value={polja.napomena} maxlength="300" rows="2" placeholder="Npr. radno vreme, kad je najlakše da me dobiješ"></textarea>
        </label>
        {#if greska}<p class="error" role="alert">{greska}</p>{/if}
        <div class="akcije">
          <button class="btn" type="submit" disabled={radi}>{radi ? 'Čuvam…' : 'Sačuvaj profil'}</button>
          <button class="btn btn-ghost" type="button" onclick={() => (izmena = false)}>Otkaži</button>
        </div>
      </form>
    {:else}
      {#if popunjen(ja)}
        {@render podaci(ja)}
      {:else}
        <p class="dim prazno">
          Još ništa nisi upisa{zenski(ja) ? 'la' : 'o'}. Upiši bar telefon i adresu, da ih {drugi?.oznaka ?? 'drugi roditelj'} ima pri ruci.
        </p>
      {/if}
      <div class="akcije">
        <button class="btn btn-ghost" onclick={pocni}><Ikona ime="olovka" velicina={14} />{popunjen(ja) ? 'Izmeni profil' : 'Popuni profil'}</button>
        {#if sacuvano}<span class="ok" role="status">Profil je sačuvan.</span>{/if}
      </div>
    {/if}
  </section>

  {#if drugi}
    <section class="card deo profil" style="--boja: var(--{drugi.uloga === 'tata' ? 'bio' : 'ai'})">
      <div class="glava-kartice">
        <span class="krug">{drugi.oznaka.charAt(0)}</span>
        <div>
          <h2>{drugi.oznaka}</h2>
          <p class="ok">Povezani ste: <b>{drugi.oznaka}</b> je u prostoru.</p>
        </div>
      </div>
      {#if popunjen(drugi)}
        {@render podaci(drugi)}
        {#if drugi.izmenjen}<p class="faint mala">Profil je izmenjen {pre(drugi.izmenjen, sada)}.</p>{/if}
      {:else}
        <p class="dim prazno">{drugi.oznaka} još nije popuni{zenski(drugi) ? 'la' : 'o'} profil.</p>
      {/if}
    </section>
  {/if}
{/if}

<style>
  .deo {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    max-width: 40rem;
    margin-bottom: 0.9rem;
  }

  .glava-kartice {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .krug {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    font-weight: 600;
    color: var(--boja);
    background: color-mix(in srgb, var(--boja) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--boja) 40%, transparent);
  }

  h2 {
    font-size: 1.1rem;
  }

  .glava-kartice p {
    font-size: 0.88rem;
  }

  dl {
    display: grid;
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
    gap: 0.6rem 1rem;
  }

  dl > div {
    display: contents;
  }

  dt {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
    padding-top: 0.2rem;
  }

  dd {
    overflow-wrap: anywhere;
  }

  .veza {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--boja);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .dva {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }

  .akcije .btn {
    padding: 0.5rem 0.9rem;
  }

  .ok {
    color: var(--bio);
    font-size: 0.88rem;
  }

  .mala {
    font-size: 0.8rem;
  }

  @media (max-width: 520px) {
    dl {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.15rem;
    }

    dd {
      margin-bottom: 0.5rem;
    }

    .dva {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
