<script lang="ts">
  // How often this parent gets e-mail about the other parent's changes.
  import { onMount } from 'svelte';
  import { type ObavestenjaIzvor, REZIMI, type RezimObavestenja, obavestenjaIzvor } from '../lib/obavestenja';

  let iz = $state<ObavestenjaIzvor | null>(null);
  let rezim = $state<RezimObavestenja | null>(null);
  let greska = $state<string | null>(null);
  let sacuvano = $state(false);
  let radi = $state(false);

  onMount(async () => {
    try {
      iz = await obavestenjaIzvor();
      rezim = await iz.rezim();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  });

  async function izaberi(r: RezimObavestenja) {
    if (!iz || radi || r === rezim) return;
    const pre = rezim;
    rezim = r;
    greska = null;
    sacuvano = false;
    radi = true;
    try {
      await iz.postavi(r);
      sacuvano = true;
    } catch (e) {
      rezim = pre;
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      radi = false;
    }
  }
</script>

<p class="dim">
  Mejl stiže kad drugi roditelj nešto promeni: nova stavka ili odgovor, predlog za kalendar, dokument, karton.
  Hitne stvari (oznaka Hitno, promena u naredna 48 h) stižu odmah, osim uz „Nikad“.
</p>

{#if rezim}
  <div class="izbor" role="radiogroup" aria-label="Obaveštenja mejlom">
    {#each REZIMI as r (r.kljuc)}
      <label class="opcija" class:aktivna={rezim === r.kljuc}>
        <input type="radio" name="obavestenja" value={r.kljuc} checked={rezim === r.kljuc} disabled={radi} onchange={() => izaberi(r.kljuc)} />
        <span>
          <b>{r.naziv}</b>
          <span class="opis">{r.opis}</span>
        </span>
      </label>
    {/each}
  </div>
{/if}

{#if greska}<p class="error" role="alert">{greska}</p>{/if}
{#if sacuvano}<p class="ok" role="status">Sačuvano.</p>{/if}
{#if iz?.demo}<p class="faint mala">U demou se mejlovi ne šalju.</p>{/if}

<style>
  .izbor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .opcija {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    padding: 0.65rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .opcija:hover {
    background: var(--surface-hover);
  }

  .opcija.aktivna {
    border-color: var(--bio-line);
    background: var(--bio-soft);
  }

  .opcija input {
    margin-top: 0.25rem;
    accent-color: var(--bio);
  }

  .opcija > span {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .opis {
    font-size: 0.85rem;
    color: var(--text-dim);
  }

  .ok {
    color: var(--bio);
    font-size: 0.88rem;
  }

  .mala {
    font-size: 0.8rem;
  }
</style>
