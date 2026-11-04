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
