// Where to go after signing in, confirming an e-mail, or entering an MFA code.

import { pristup } from './nalog';
import { bezbednoDalje, putanja } from './putanje';
import { izadjiIzDemoa } from './supabase';

/** The "dalje" target from the URL; only paths inside this app (no open redirect). */
export function daljeIzUrl(): string {
  return bezbednoDalje(new URLSearchParams(location.search).get('dalje'));
}

export async function posleUlaska(dalje: string = daljeIzUrl()): Promise<void> {
  // A real sign-in ends any demo left open in this tab.
  izadjiIzDemoa();
  dalje = bezbednoDalje(dalje);
  const p = await pristup();
  const kaPozivu = dalje.startsWith('/poziv/');
  if (p.stanje === 'odjavljen') return;
  if (p.stanje === 'mfa') location.replace(putanja(`/mfa/?dalje=${encodeURIComponent(dalje)}`));
  else if (p.stanje === 'bez-porodice') location.replace(putanja(kaPozivu ? dalje : '/dobrodosli/'));
  else location.replace(putanja(kaPozivu ? '/' : dalje));
}
