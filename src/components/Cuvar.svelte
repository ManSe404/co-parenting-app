<script lang="ts">
  // Gatekeeper for the app screens with real accounts: not signed in → sign-in,
  // MFA pending → code, no family yet → welcome. Demo mode passes straight through.
  import { onMount } from 'svelte';
  import { pristup } from '../lib/nalog';
  import { putanja } from '../lib/putanje';
  import { oznaciPristupSpreman } from '../lib/pristup-spreman';
  import { jeDemo } from '../lib/supabase';

  function idi(p: string) {
    const dalje = encodeURIComponent(location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '') + location.search);
    location.replace(putanja(`${p}${p.includes('?') ? '&' : '?'}dalje=${dalje}`));
  }

  onMount(async () => {
    if (jeDemo()) {
      document.documentElement.dataset.pristup = 'ok';
      oznaciPristupSpreman();
      return;
    }
    try {
      const p = await pristup();
      if (p.stanje === 'odjavljen') return idi('/prijava/');
      if (p.stanje === 'mfa') return idi('/mfa/');
      if (p.stanje === 'bez-porodice') return idi('/dobrodosli/');
      // The top bar's profile circle reads the family from here.
      sessionStorage.setItem('coparenting.porodica', JSON.stringify(p.porodica));
      document.documentElement.dataset.pristup = 'ok';
      oznaciPristupSpreman();
    } catch {
      idi('/prijava/');
    }
  });
</script>

