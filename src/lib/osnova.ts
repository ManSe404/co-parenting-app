// Fixed labels shared by the demo and the database source: the areas of an
// item and the two parent roles (with the Serbian case forms the app needs).

import type { Oblast, Roditelj } from './tipovi';

/** The source code, for anyone who wants their own copy of the app. */
export const REPO = 'https://github.com/ManSe404/co-parenting-app';

export const OBLASTI: Oblast[] = [
  { kljuc: 'skola', naziv: 'Škola' },
  { kljuc: 'zdravlje', naziv: 'Zdravlje' },
  { kljuc: 'vanskolske', naziv: 'Vanškolske aktivnosti' },
  { kljuc: 'potrebe', naziv: 'Detetove potrebe' },
  { kljuc: 'ostalo', naziv: 'Ostalo' },
];

export const RODITELJI: Record<string, Omit<Roditelj, 'poslednjaPoseta'>> = {
  tata: { id: 'tata', oznaka: 'Tata', oznakaAkuzativ: 'tatu', oznakaGenitiv: 'tate', boja: 'bio' },
  mama: { id: 'mama', oznaka: 'Mama', oznakaAkuzativ: 'mamu', oznakaGenitiv: 'mame', boja: 'ai' },
};
