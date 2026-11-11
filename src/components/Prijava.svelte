<script lang="ts">
  import { onMount } from 'svelte';
  import { novaLozinka, poruka, prijavaGoogle, prijavaLozinkom, registracija, zaboravljenaLozinka } from '../lib/nalog';
  import { putanja } from '../lib/putanje';
  import { supabase } from '../lib/supabase';
  import { daljeIzUrl, posleUlaska } from '../lib/usmeri';

  type Rezim = 'prijava' | 'registracija' | 'zaboravljena' | 'nova-lozinka';

  const q = new URLSearchParams(location.search);
  const dalje = daljeIzUrl();
  let rezim = $state<Rezim>(q.get('nova-lozinka') ? 'nova-lozinka' : q.get('rezim') === 'registracija' ? 'registracija' : 'prijava');
  let email = $state('');
  let lozinka = $state('');
  let vidiLozinku = $state(false);
  let greska = $state<string | null>(null);
  let info = $state<string | null>(null);
  let radi = $state(false);
  let spreman = $state(false);
  const lokalno = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const poPozivu = dalje.startsWith('/poziv/');

  onMount(async () => {
    // Coming back from Google or from the confirmation e-mail: the session is
    // picked up from the URL; then go on.
    try {
      const { data } = await supabase().auth.getSession();
      if (data.session && rezim !== 'nova-lozinka') {
        await posleUlaska(dalje);
        return;
      }
    } catch (err) {
      greska = poruka(err);
    }
    // A link from an e-mail that was already used or has expired comes back
    // with the error in the address (#error_code=otp_expired…): say so, in
    // our own words only (the address can be crafted by anyone).
    const h = new URLSearchParams(location.hash.slice(1));
    const kod = h.get('error_code') ?? q.get('error_code');
    if (kod) {
      greska =
        kod === 'otp_expired'
          ? 'Link iz mejla je istekao ili je već iskorišćen. Ako si nalog već potvrdio, samo se prijavi; inače napravi nalog ponovo i stići će nov link.'
          : 'Link iz mejla nije prošao. Probaj ponovo ili zatraži nov link.';
      history.replaceState(null, '', location.pathname + location.search);
    }
    spreman = true;
  });

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    greska = null;
    info = null;
    radi = true;
    try {
      if (rezim === 'prijava') {
        await prijavaLozinkom(email, lozinka);
        await posleUlaska(dalje);
      } else if (rezim === 'registracija') {
        const trebaPotvrda = await registracija(email, lozinka, dalje);
        if (trebaPotvrda) {
          info = `Poslali smo mejl na ${email}. Otvori link u njemu da potvrdiš nalog, pa se vrati ovde.`;
          rezim = 'prijava';
        } else {
          await posleUlaska(dalje);
        }
      } else if (rezim === 'zaboravljena') {
        await zaboravljenaLozinka(email);
        info = 'Ako nalog postoji, stigao ti je mejl sa linkom za novu lozinku.';
        rezim = 'prijava';
      } else {
        await novaLozinka(lozinka);
        info = 'Lozinka je promenjena.';
        await posleUlaska('/');
      }
    } catch (err) {
      greska = err instanceof Error ? err.message : poruka(err);
    } finally {
      radi = false;
    }
  }

  async function google() {
    greska = null;
    try {
      await prijavaGoogle(dalje);
    } catch (err) {
      greska = err instanceof Error ? err.message : poruka(err);
    }
  }

  const NASLOVI: Record<Rezim, string> = {
    prijava: 'Prijava',
    registracija: 'Nov nalog',
    zaboravljena: 'Zaboravljena lozinka',
    'nova-lozinka': 'Nova lozinka',
  };
</script>

{#if spreman}
  <section class="card kutija">
    {#if poPozivu}<p class="poziv-info">Pozvan si u porodični prostor. Prijavi se ili napravi nalog, pa prihvati poziv.</p>{/if}
    <h1>{NASLOVI[rezim]}</h1>

    {#if rezim === 'prijava' || rezim === 'registracija'}
      <div class="tabovi" role="tablist">
        <button role="tab" aria-selected={rezim === 'prijava'} onclick={() => (rezim = 'prijava')}>Prijava</button>
        <button role="tab" aria-selected={rezim === 'registracija'} onclick={() => (rezim = 'registracija')}>Nov nalog</button>
      </div>

      <button class="btn btn-ghost google" onclick={google}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12S6.6 21.7 12 21.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        Nastavi preko Google-a
      </button>
      <p class="ili"><span>ili mejlom</span></p>
    {/if}

    <form onsubmit={posalji}>
      {#if rezim !== 'nova-lozinka'}
        <label class="field">
          <span class="label">Mejl</span>
          <input class="input" type="email" bind:value={email} autocomplete="email" required />
        </label>
      {/if}
      {#if rezim !== 'zaboravljena'}
        <label class="field">
          <span class="label">{rezim === 'nova-lozinka' ? 'Nova lozinka' : 'Lozinka'}</span>
          <span class="lozinka">
            <input
              class="input"
              type={vidiLozinku ? 'text' : 'password'}
              bind:value={lozinka}
              autocomplete={rezim === 'prijava' ? 'current-password' : 'new-password'}
              minlength={rezim === 'prijava' ? undefined : 10}
              required
            />
            <button type="button" class="vidi" onclick={() => (vidiLozinku = !vidiLozinku)}>{vidiLozinku ? 'sakrij' : 'prikaži'}</button>
          </span>
          {#if rezim !== 'prijava'}<span class="pomoc">Bar 10 znakova, slova i brojevi.</span>{/if}
        </label>
      {/if}

      {#if greska}<p class="error">{greska}</p>{/if}
      {#if info}
        <p class="info">
          {info}
          {#if lokalno}<br /><span class="faint">Lokalno: mejlovi su na http://127.0.0.1:8044</span>{/if}
        </p>
      {/if}

      <button class="btn" type="submit" disabled={radi}>
        {{ prijava: 'Prijavi se', registracija: 'Napravi nalog', zaboravljena: 'Pošalji link', 'nova-lozinka': 'Sačuvaj lozinku' }[rezim]}
      </button>
    </form>

    <div class="linkovi">
      {#if rezim === 'prijava'}
        <button class="tekst" onclick={() => (rezim = 'zaboravljena')}>Zaboravljena lozinka?</button>
      {:else if rezim === 'zaboravljena'}
        <button class="tekst" onclick={() => (rezim = 'prijava')}>Nazad na prijavu</button>
      {/if}
    </div>
  </section>

  <p class="demo">
    Samo gledaš? <a href={`${putanja('/')}?demo=1`}>Isprobaj bez naloga</a>, na probnim podacima.
  </p>
  <p class="demo">
    <a href={putanja('/privatnost/')}>Šta se čuva, ko to vidi i kako se briše</a>
  </p>
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

  .poziv-info {
    font-size: 0.9rem;
    color: var(--bio);
    padding: 0.55rem 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--bio-soft);
    border: 1px solid var(--bio-line);
  }

  .tabovi {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0.25rem;
    border-radius: 999px;
    background: var(--surface-hover);
    border: 1px solid var(--border);
  }

  .tabovi button {
    padding: 0.45rem;
    border-radius: 999px;
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .tabovi button[aria-selected='true'] {
    background: var(--bg-raised);
    color: var(--text);
    box-shadow: 0 2px 10px -4px rgba(0, 0, 0, 0.4);
  }

  .google {
    gap: 0.6rem;
    padding: 0.75rem;
    font-family: var(--font-body);
    font-size: 0.95rem;
    letter-spacing: 0;
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

  form {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .lozinka {
    position: relative;
    display: block;
  }

  .vidi {
    position: absolute;
    right: 0.6rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: var(--text-faint);
  }

  .pomoc {
    font-size: 0.78rem;
    color: var(--text-faint);
  }

  .info {
    font-size: 0.9rem;
    color: var(--bio);
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bio-line);
    background: var(--bio-soft);
  }

  .linkovi {
    display: flex;
    justify-content: center;
  }

  .tekst {
    font-size: 0.85rem;
    color: var(--text-dim);
    text-decoration: underline;
    text-underline-offset: 0.25em;
  }

  .demo {
    text-align: center;
    font-size: 0.86rem;
    color: var(--text-faint);
  }

  .demo a {
    color: var(--bio);
  }
</style>
