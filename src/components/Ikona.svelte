<script lang="ts">
  // Line icons for the areas. Drawn on a 24px grid, stroke follows the text colour.
  interface Props {
    ime: string;
    velicina?: number;
  }

  let { ime, velicina = 18 }: Props = $props();
</script>

<svg
  width={velicina}
  height={velicina}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if ime === 'skola'}
    <path d="M2.5 5.5C5 4.4 8 4.5 12 6.2c4-1.7 7-1.8 9.5-.7v13.3c-2.5-1.1-5.5-1-9.5.7-4-1.7-7-1.8-9.5-.7z" />
    <path d="M12 6.2v13.3" />
  {:else if ime === 'zdravlje'}
    <path d="M19.6 13.2 12 20.5l-7.6-7.3A4.8 4.8 0 0 1 12 7.1a4.8 4.8 0 0 1 7.6 6.1z" />
    <path d="M3 12h4.2l1.6-2.6 2.6 5 1.7-2.4H21" />
  {:else if ime === 'vanskolske'}
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 3.4v3.2M12 17.4v3.2M3.4 12h3.2M17.4 12h3.2" />
    <path d="m12 8.6 3.2 2.3-1.2 3.8h-4l-1.2-3.8z" />
  {:else if ime === 'potrebe'}
    <path d="M8.5 3.5 3.5 6.3l1.8 4 2.7-1.2v11.4h8V9.1l2.7 1.2 1.8-4-5-2.8c-.6 1.5-1.9 2.4-3.5 2.4s-2.9-.9-3.5-2.4z" />
  {:else if ime === 'hitno'}
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9.5V13l2.3 1.6M9.5 2.8h5M12 2.8v2.7" />
  {:else if ime === 'vazno'}
    <path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.5l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  {:else if ime === 'pocetna'}
    <path d="M3.5 10.5 12 3.8l8.5 6.7V20a.5.5 0 0 1-.5.5h-5.2v-6h-5.6v6H4a.5.5 0 0 1-.5-.5z" />
  {:else if ime === 'tabla'}
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
    <path d="M9.2 4v16M14.8 4v16" />
  {:else if ime === 'karton'}
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="11" r="2.2" />
    <path d="M5.8 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13.5h3.5" />
  {:else if ime === 'kontakt'}
    <path d="M6.6 3.8h2.6l1.4 4.1-1.9 1.3a10.6 10.6 0 0 0 5.9 5.9l1.3-1.9 4.1 1.4v2.6a1.9 1.9 0 0 1-2.1 1.9A15.6 15.6 0 0 1 4.7 5.9a1.9 1.9 0 0 1 1.9-2.1z" />
  {:else if ime === 'dokument'}
    <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
    <path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5" />
  {:else if ime === 'istorija'}
    <path d="M3.8 12a8.2 8.2 0 1 0 2.4-5.8L3.8 8.6" />
    <path d="M3.8 3.8v4.8h4.8M12 7.5V12l3 2" />
  {:else if ime === 'olovka'}
    <path d="m14.5 5.5 4 4L8.8 19.2l-4.6.6.6-4.6z" />
  {:else if ime === 'drugari'}
    <circle cx="8.5" cy="8.5" r="3" />
    <circle cx="16.5" cy="9.5" r="2.5" />
    <path d="M3 19c.6-3 2.8-4.6 5.5-4.6S13.4 16 14 19M14.5 14.6c.6-.2 1.3-.3 2-.3 2.3 0 4 1.4 4.5 4.2" />
  {:else if ime === 'tabela'}
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M3.5 14.5h17M9.2 4.5v15M14.8 4.5v15" />
  {:else if ime === 'slika'}
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />
  {:else if ime === 'otpremi'}
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  {:else if ime === 'prelazak'}
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  {:else if ime === 'kalendar'}
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  {:else if ime === 'strelica'}
    <path d="M5 12h14M13 6l6 6-6 6" />
  {:else if ime === 'racun'}
    <path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5z" />
    <path d="M9 8h6M9 11.5h6M9 15h3.5" />
  {:else if ime === 'kamera'}
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.5-2.2h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="12.8" r="3.3" />
  {:else if ime === 'preuzmi'}
    <path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  {:else if ime === 'spolja'}
    <path d="M13.5 4.5h6v6M19.5 4.5 11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10" />
  {:else if ime === 'kanta'}
    <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7M10.2 10.5v6M13.8 10.5v6" />
  {:else if ime === 'vrati'}
    <path d="M9 14 4.5 9.5 9 5" />
    <path d="M4.5 9.5H15a4.5 4.5 0 0 1 0 9h-3" />
  {:else if ime === 'pretraga'}
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  {:else}
    <circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" />
  {/if}
</svg>
