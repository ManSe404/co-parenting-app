<script lang="ts">
  // Deleting the family space (both parents must ask) and then one's own account.
  import { onMount } from 'svelte';
  import { type StanjeBrisanja, obrisiNalog, obrisiPorodicu, odustaniOdBrisanja, stanjeBrisanja } from '../lib/nalog';
  import { putanja } from '../lib/putanje';

  interface Props {
    /** The other parent's label, or null while not linked. */
    drugi: string | null;
  }

  const { drugi }: Props = $props();

  let st = $state<StanjeBrisanja | null>(null);
  let greska = $state<string | null>(null);
  let radi = $state(false);
  let obrisano = $state(false);

  onMount(async () => {
    try {
      st = await stanjeBrisanja();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    }
  });

  async function uradi(fn: () => Promise<void>) {
    greska = null;
    radi = true;
    try {
      await fn();
    } catch (e) {
      greska = e instanceof Error ? e.message : String(e);
    } finally {
      radi = false;
    }
  }

  function zatrazi() {
    const poruka = drugi
      ? `Brisanje briše sve: stavke, kalendar, karton, profile, dokumente. Izvršava se tek kad i ${drugi} zatraži. Nastavi?`
      : 'Brisanje briše sve: stavke, kalendar, karton, profile, dokumente, bez kopije. Nastavi?';
    if (!confirm(poruka)) return;
    uradi(async () => {
      const r = await obrisiPorodicu();
      if (r === 'obrisano') obrisano = true;
      else st = await stanjeBrisanja();
    });
  }

  function odustani() {
    uradi(async () => {
      await odustaniOdBrisanja();
      st = await stanjeBrisanja();
    });
  }

  function obrisiSvojNalog() {
    if (!confirm('Obrisati i nalog (mejl, lozinku, MFA)? Posle toga nema prijave.')) return;
    uradi(async () => {
      await obrisiNalog();
      sessionStorage.removeItem('coparenting.porodica');
      location.replace(putanja('/prijava/'));
    });
  }
</script>

{#if obrisano}
  <p class="ok" role="status">Porodični prostor je obrisan, zajedno sa svim dokumentima.</p>
  <p class="dim">Nalog (mejl i lozinka) još postoji. Možeš da ga obrišeš, ili da ga zadržiš i otvoriš nov prostor.</p>
  <div class="akcije">
    <button class="btn btn-ghost mali opasno" onclick={obrisiSvojNalog} disabled={radi}>Obriši i nalog</button>
    <a class="btn btn-ghost mali" href={putanja('/dobrodosli/')}>Zadrži nalog</a>
  </div>
{:else if st}
  {#if st.odobreno}
    <p class="dim">Oba roditelja su zatražila brisanje. Ostalo je da se završi.</p>
    <button class="btn btn-ghost mali opasno" onclick={zatrazi} disabled={radi}>Završi brisanje</button>
  {:else if st.jaZatrazio}
    <p class="dim">
      Zatražio si brisanje. Prostor se briše kad i {drugi ?? 'drugi roditelj'} zatraži; do tada možeš da odustaneš.
    </p>
    <button class="btn btn-ghost mali" onclick={odustani} disabled={radi}>Odustani od brisanja</button>
  {:else}
    <p class="dim">
      {#if st.drugiZatrazio}
        <b>{drugi ?? 'Drugi roditelj'} je zatražio brisanje prostora.</b> Ako i ti zatražiš, briše se sve, bez kopije.
      {:else if drugi}
        Prostor pripada oboma: briše se tek kad i ti i {drugi} zatražite. Briše se sve, bez kopije.
      {:else}
        Prostor je samo tvoj dok se ne poveže drugi roditelj; brisanje ga uklanja odmah, bez kopije.
      {/if}
    </p>
    <button class="btn btn-ghost mali opasno" onclick={zatrazi} disabled={radi}>Zatraži brisanje</button>
  {/if}
{/if}
{#if greska}<p class="error" role="alert">{greska}</p>{/if}

<style>
  .akcije {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .mali {
    padding: 0.45rem 0.85rem;
    font-size: 0.76rem;
    align-self: flex-start;
  }

  .opasno {
    border-color: var(--hitno-line);
    color: var(--hitno);
  }

  .opasno:hover {
    background: var(--hitno-soft);
  }

  .ok {
    color: var(--bio);
    font-size: 0.88rem;
  }
</style>
