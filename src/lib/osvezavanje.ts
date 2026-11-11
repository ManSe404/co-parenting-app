// Re-reading a screen when the shared data changes (the other parent, or
// another device of yours). The source reports "something changed"; this
// turns a burst of such signals into one refresh, and never runs two
// refreshes at once.

export interface Promenljiv {
  /** Calls `cb` whenever shared data changes; returns the unsubscribe. */
  naPromenu(cb: () => void): () => void;
}

/**
 * Subscribes to `iz` (or to the source it resolves to) and runs `osvezi` at
 * most once per `ms` after the last signal (trailing debounce). A signal that
 * arrives while a refresh is running queues exactly one more refresh. Returns
 * the stop function; stopping before the source resolves is safe.
 */
export function pratiPromene(iz: Promenljiv | Promise<Promenljiv>, osvezi: () => unknown, ms = 500): () => void {
  let tajmer: ReturnType<typeof setTimeout> | null = null;
  let radi = false;
  let ponovo = false;
  let gotovo = false;
  let odjava: (() => void) | null = null;

  async function pokreni() {
    tajmer = null;
    if (gotovo) return;
    if (radi) {
      ponovo = true;
      return;
    }
    radi = true;
    try {
      await osvezi();
    } catch {
      /* the screen keeps what it has; the next change tries again */
    } finally {
      radi = false;
    }
    if (ponovo && !gotovo) {
      ponovo = false;
      void pokreni();
    }
  }

  function signal() {
    if (gotovo) return;
    if (tajmer) clearTimeout(tajmer);
    tajmer = setTimeout(() => void pokreni(), ms);
  }

  Promise.resolve(iz)
    .then((i) => {
      if (gotovo) return;
      odjava = i.naPromenu(signal);
    })
    .catch(() => {
      /* no source (e.g. not signed in): nothing to follow */
    });

  return () => {
    gotovo = true;
    if (tajmer) clearTimeout(tajmer);
    tajmer = null;
    odjava?.();
    odjava = null;
  };
}
