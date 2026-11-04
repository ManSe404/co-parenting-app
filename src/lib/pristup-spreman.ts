// With real accounts, the screens must not read data before the guard (Cuvar)
// knows who is signed in; otherwise a parent on a new device would first see
// the app from the other parent's side. The guard resolves this once it has
// stored the family; in the demo it resolves at once.

let pusti: () => void = () => {};

export const pristupSpreman: Promise<void> = new Promise((r) => (pusti = r));

export function oznaciPristupSpreman(): void {
  pusti();
}
