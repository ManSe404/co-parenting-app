// Where to go after signing in, confirming an e-mail, or entering an MFA code.

import { pristup } from './nalog';
import { putanja } from './putanje';

/** The "dalje" target from the URL; only paths inside this app (no open redirect). */
export function daljeIzUrl(): string {
  const d = new URLSearchParams(location.search).get('dalje') ?? '/';
  return d.startsWith('/') && !d.startsWith('//') && !d.includes('\\') ? d : '/';
}

export async function posleUlaska(dalje: string = daljeIzUrl()): Promise<void> {
  const p = await pristup();
  const kaPozivu = dalje.startsWith('/poziv/');
  if (p.stanje === 'odjavljen') return;
  if (p.stanje === 'mfa') location.replace(putanja(`/mfa/?dalje=${encodeURIComponent(dalje)}`));
  else if (p.stanje === 'bez-porodice') location.replace(putanja(kaPozivu ? dalje : '/dobrodosli/'));
  else location.replace(putanja(kaPozivu ? '/' : dalje));
}
