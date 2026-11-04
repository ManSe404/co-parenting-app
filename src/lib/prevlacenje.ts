// Drag a board card between columns with mouse or finger, without a library.
//
// Mouse: the drag starts after the pointer moves a few pixels, so a plain click
// still opens the card. Touch: the drag starts after a short press-and-hold, so
// a normal swipe still scrolls the page. Columns are found under the pointer by
// their [data-kolona] attribute.

/** Pointer position, and where inside the dragged element it was grabbed. */
export interface Tacka {
  x: number;
  y: number;
  pomakX: number;
  pomakY: number;
}

export interface OpcijePrevlacenja {
  id: string;
  onPreko: (kolona: string | null) => void;
  onPusti: (id: string, kolona: string, tacka: Tacka) => void;
  /** Called whenever a drag ends, dropped or not. */
  onKraj?: () => void;
  /** Called on every move while dragging (e.g. to draw a drop preview). */
  onPomeraj?: (tacka: Tacka, kolona: string | null) => void;
  /** Drop targets are found by [data-<atribut>]; the board uses "kolona". */
  atribut?: string;
  /** "y": the ghost only moves up and down (a handover stays on its day). */
  osa?: 'obe' | 'y';
  /** Not draggable right now (e.g. an activity with a pending change). */
  iskljuceno?: boolean;
}

const PRAG_MIS = 6;
const ZADRZI_MS = 260;
const PRAG_DODIR = 10;
const IVICA = 70;

export function prevlacenje(node: HTMLElement, pocetne: OpcijePrevlacenja) {
  let o = pocetne;
  let start: { x: number; y: number } | null = null;
  let pomak = { x: 0, y: 0 };
  let tajmer: ReturnType<typeof setTimeout> | null = null;
  let duh: HTMLElement | null = null;
  let tekuca: string | null = null;
  let poslednji = { x: 0, y: 0 };
  let skrol = 0;
  let pointerId = -1;

  const vuce = () => duh !== null;

  let startX = 0;

  function kolonaIspod(x: number, y: number): string | null {
    const atr = o.atribut ?? 'kolona';
    const el = document.elementFromPoint(o.osa === 'y' ? startX : x, y);
    return (el?.closest(`[data-${atr}]`) as HTMLElement | null)?.dataset[atr] ?? null;
  }

  function tacka(x: number, y: number): Tacka {
    return { x: o.osa === 'y' ? startX : x, y, pomakX: pomak.x, pomakY: pomak.y };
  }

  function pocni(x: number, y: number) {
    // Measure the grab point where the pointer went down, not where the drag
    // was recognised a few pixels later; otherwise every drop lands short.
    const r = node.getBoundingClientRect();
    const hvat = start ?? { x, y };
    pomak = { x: hvat.x - r.left, y: hvat.y - r.top };
    startX = hvat.x;
    duh = node.cloneNode(true) as HTMLElement;
    duh.classList.add('kartica-duh');
    duh.setAttribute('aria-hidden', 'true');
    Object.assign(duh.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${r.width}px`,
      pointerEvents: 'none',
      zIndex: '1000',
      margin: '0',
    });
    document.body.appendChild(duh);
    node.classList.add('se-vuce');
    document.documentElement.classList.add('tabla-vuce');
    navigator.vibrate?.(12);
    pomeri(x, y);
    skrol = requestAnimationFrame(autoSkrol);
  }

  function pomeri(x: number, y: number) {
    poslednji = { x, y };
    if (!duh) return;
    const gx = o.osa === 'y' ? startX : x;
    duh.style.transform = `translate(${gx - pomak.x}px, ${y - pomak.y}px)${o.osa === 'y' ? '' : ' rotate(-1.5deg)'}`;
    const k = kolonaIspod(x, y);
    if (k !== tekuca) {
      tekuca = k;
      o.onPreko(k);
    }
    o.onPomeraj?.(tacka(x, y), k);
  }

  // Scroll the page while the card is held near the top or bottom edge.
  function autoSkrol() {
    if (!duh) return;
    const { y } = poslednji;
    const dole = window.innerHeight - y;
    if (y < IVICA) window.scrollBy(0, -Math.ceil((IVICA - y) / 6));
    else if (dole < IVICA) window.scrollBy(0, Math.ceil((IVICA - dole) / 6));
    pomeri(poslednji.x, poslednji.y);
    skrol = requestAnimationFrame(autoSkrol);
  }

  function ocisti() {
    const bilaVucena = duh !== null;
    if (tajmer) clearTimeout(tajmer);
    tajmer = null;
    start = null;
    pointerId = -1;
    cancelAnimationFrame(skrol);
    window.removeEventListener('pointermove', naPomeraj);
    window.removeEventListener('pointerup', naPusti);
    window.removeEventListener('pointercancel', naOtkazi);
    if (duh) {
      duh.remove();
      duh = null;
      node.classList.remove('se-vuce');
      document.documentElement.classList.remove('tabla-vuce');
      // The click that follows a drag must not do anything: not open the card,
      // and not reach whatever lies under the drop point (e.g. an empty slot
      // in the calendar, which would start a second dialog).
      window.addEventListener('click', progutajKlik, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', progutajKlik, { capture: true }), 0);
    }
    if (tekuca !== null) o.onPreko(null);
    tekuca = null;
    if (bilaVucena) o.onKraj?.();
  }

  function progutajKlik(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  function naDole(e: PointerEvent) {
    if (o.iskljuceno || e.button !== 0 || pointerId !== -1) return;
    // Buttons inside the dragged element keep their click; the element itself
    // may be a button (calendar blocks), and that is fine.
    const kontrola = (e.target as HTMLElement).closest('button, input, textarea, select');
    if (kontrola && kontrola !== node && node.contains(kontrola)) return;
    pointerId = e.pointerId;
    start = { x: e.clientX, y: e.clientY };
    poslednji = start;
    window.addEventListener('pointermove', naPomeraj);
    window.addEventListener('pointerup', naPusti);
    window.addEventListener('pointercancel', naOtkazi);
    if (e.pointerType !== 'mouse') {
      tajmer = setTimeout(() => {
        tajmer = null;
        if (start) pocni(poslednji.x, poslednji.y);
      }, ZADRZI_MS);
    }
  }

  function naPomeraj(e: PointerEvent) {
    if (e.pointerId !== pointerId || !start) return;
    if (vuce()) {
      pomeri(e.clientX, e.clientY);
      return;
    }
    const d = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    poslednji = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse') {
      if (d > PRAG_MIS) pocni(e.clientX, e.clientY);
    } else if (d > PRAG_DODIR) {
      // The finger moved before the hold finished: it is a scroll, not a drag.
      ocisti();
    }
  }

  function naPusti(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    const k = vuce() ? kolonaIspod(e.clientX, e.clientY) : null;
    const t = tacka(e.clientX, e.clientY);
    const id = o.id;
    ocisti();
    if (k) o.onPusti(id, k, t);
  }

  function naOtkazi() {
    ocisti();
  }

  // Once a touch drag has started, the page must not scroll under the finger.
  function naTouchMove(e: TouchEvent) {
    if (vuce()) e.preventDefault();
  }

  function naKontekst(e: Event) {
    if (pointerId !== -1) e.preventDefault();
  }

  node.addEventListener('pointerdown', naDole);
  node.addEventListener('touchmove', naTouchMove, { passive: false });
  node.addEventListener('contextmenu', naKontekst);
  node.addEventListener('dragstart', (e) => e.preventDefault());

  return {
    update(novo: OpcijePrevlacenja) {
      o = novo;
    },
    destroy() {
      ocisti();
      node.removeEventListener('pointerdown', naDole);
      node.removeEventListener('touchmove', naTouchMove);
      node.removeEventListener('contextmenu', naKontekst);
    },
  };
}
