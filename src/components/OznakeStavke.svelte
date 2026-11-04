<script lang="ts">
  import type { Oblast, Stavka } from '../lib/tipovi';
  import { jeHitno } from '../lib/domen';
  import { doDatuma, datumKratko } from '../lib/format';

  interface Props {
    stavka: Stavka;
    oblasti: Oblast[];
    sada: Date;
    oblast?: boolean;
    stanje?: boolean;
  }

  let { stavka, oblasti, sada, oblast = true, stanje = true }: Props = $props();

  const NAZIV_STANJA = { neodgovoreno: 'Neodgovoreno', otvoreno: 'Otvoreno', zatvoreno: 'Zatvoreno' };
  const KLASA_STANJA = { neodgovoreno: 'chip-warn', otvoreno: 'chip-bio', zatvoreno: '' };

  let nazivOblasti = $derived(oblasti.find((o) => o.kljuc === stavka.oblast)?.naziv ?? stavka.oblast);
  let hitno = $derived(jeHitno(stavka, sada));
</script>

<span class="chips">
  {#if stanje}
    <span class="chip {KLASA_STANJA[stavka.stanje]}">{NAZIV_STANJA[stavka.stanje]}</span>
  {/if}
  {#if hitno}<span class="chip chip-hitno">Hitno</span>{/if}
  {#if stavka.vazno && stavka.stanje !== 'zatvoreno'}<span class="chip chip-ai">Važno</span>{/if}
  {#if oblast}<span class="chip">{nazivOblasti}</span>{/if}
  {#if stavka.datum}
    <span class="chip" title={doDatuma(stavka.datum, sada)}>⏱ {datumKratko(stavka.datum)}</span>
  {/if}
</span>
