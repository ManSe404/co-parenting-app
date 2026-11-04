/**
 * A "go on to" target from the address: only a path inside this app. The
 * browser drops tabs and newlines from addresses, so "/\t/x" would become
 * "//x", another site; anything with control characters is refused, and the
 * rest must resolve to this same origin.
 */
export function bezbednoDalje(d: string | null | undefined): string {
  if (!d || !d.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(d)) return '/';
  try {
    const u = new URL(d, 'https://ova.aplikacija');
    return u.origin === 'https://ova.aplikacija' ? u.pathname + u.search + u.hash : '/';
  } catch {
    return '/';
  }
}

/** Prefix an app path with Astro's `base`, so links work under a sub-path too. */
export function putanja(p: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}

export const putanje = {
  pocetna: () => putanja('/'),
  stavke: (filter: Record<string, string> = {}) => {
    const q = new URLSearchParams(filter).toString();
    return putanja(`/stavke/${q ? `?${q}` : ''}`);
  },
  stavka: (id: string) => putanja(`/stavka/?id=${encodeURIComponent(id)}`),
  nova: () => putanja('/nova/'),
  kalendar: (sidro = '') => putanja(`/kalendar/${sidro ? `#${sidro}` : ''}`),
  karton: () => putanja('/karton/'),
  dokumenti: () => putanja('/dokumenti/'),
  prijava: () => putanja('/prijava/'),
  podesavanja: () => putanja('/podesavanja/'),
};
