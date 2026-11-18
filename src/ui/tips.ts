// ── Tips: information on demand ──────────────────────────────────────────────
// Not everything needs to be on screen all the time. Any element with a
// `data-tip` shows that text in a small bubble:
//   mouse     — hover (after a short pause)
//   keyboard  — focus
//   touch     — press and hold; the tap that ends a hold doesn't count as a
//               click, so holding a Buy button explains it without buying.
// An ⓘ mark (`tip-i`, from infoTip) opens its tip with a plain tap too.
// One bubble for the whole page, positioned above its target (below when
// there's no room), kept inside the screen, gone on scroll.
//
// Screen readers get the same words: tipAttr also writes aria-description.

const HOVER_DELAY_MS = 260;
const HOLD_MS = 420;

/** Escape text for an HTML attribute value. */
function attr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** ` data-tip="…" aria-description="…"` for building markup. */
export function tipAttr(text: string): string {
  const v = attr(text);
  return ` data-tip="${v}" aria-description="${v}"`;
}

/** Give an existing element a tip (or change it). */
export function setTip(el: Element, text: string): void {
  if (el.getAttribute("data-tip") === text) return;
  el.setAttribute("data-tip", text);
  el.setAttribute("aria-description", text);
  if (el === current && bubble) bubble.textContent = text; // live while shown
}

/** A small ⓘ mark that opens its tip on hover, focus or tap. */
export function infoTip(text: string, label = "More about this"): string {
  return `<span class="tip-i" tabindex="0" role="button" aria-label="${attr(label)}"${tipAttr(text)}>ⓘ</span>`;
}

let bubble: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
/** The element a hover timer is waiting on (the UI rewrites text often, re-firing pointerover). */
let pending: HTMLElement | null = null;
let hoverTimer: number | undefined;
let holdTimer: number | undefined;
let swallowClick = false;
/** When the bubble last opened: a scroll right after (a browser settling focus) doesn't close it. */
let shownAt = 0;

function ensureBubble(): HTMLDivElement {
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.className = "tip-bubble";
    bubble.setAttribute("role", "tooltip");
    bubble.hidden = true;
    document.body.appendChild(bubble);
  }
  return bubble;
}

function tipTarget(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? node.closest<HTMLElement>("[data-tip]") : null;
}

function show(el: HTMLElement): void {
  const text = el.getAttribute("data-tip");
  if (!text) return;
  const b = ensureBubble();
  b.textContent = text;
  b.hidden = false;
  current = el;
  shownAt = performance.now();
  const r = el.getBoundingClientRect();
  const bw = b.offsetWidth;
  const bh = b.offsetHeight;
  const margin = 8;
  let left = r.left + r.width / 2 - bw / 2;
  left = Math.max(margin, Math.min(window.innerWidth - bw - margin, left));
  let top = r.top - bh - 8;
  let below = false;
  if (top < margin) {
    top = r.bottom + 8;
    below = true;
  }
  b.style.left = `${Math.round(left)}px`;
  b.style.top = `${Math.round(top)}px`;
  b.classList.toggle("below", below);
}

export function hideTip(): void {
  window.clearTimeout(hoverTimer);
  pending = null;
  window.clearTimeout(holdTimer);
  if (bubble) bubble.hidden = true;
  current = null;
}

/** Wire the page once. */
export function initTips(): void {
  // Mouse: hover.
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const el = tipTarget(e.target);
    if (!el || el === current || el === pending) return;
    window.clearTimeout(hoverTimer);
    pending = el;
    hoverTimer = window.setTimeout(() => {
      pending = null;
      show(el);
    }, HOVER_DELAY_MS);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const el = tipTarget(e.target);
    if (!el) return;
    const to = tipTarget(e.relatedTarget);
    if (to === el) return;
    hideTip();
  });
  // Keyboard: focus.
  document.addEventListener("focusin", (e) => {
    const el = tipTarget(e.target);
    if (el && (e.target as HTMLElement).matches?.(":focus-visible")) show(el);
  });
  document.addEventListener("focusout", (e) => {
    // Only the element whose tip is showing closes it (a tap moves focus off something else first).
    if (current && tipTarget(e.target) === current) hideTip();
  });
  // Touch: press and hold (or a tap on an ⓘ).
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    const el = tipTarget(e.target);
    if (current && el !== current) hideTip();
    if (!el) return;
    if (el.classList.contains("tip-i")) {
      if (current === el) hideTip();
      else show(el);
      return;
    }
    window.clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      show(el);
      swallowClick = true;
    }, HOLD_MS);
  });
  const cancelHold = () => window.clearTimeout(holdTimer);
  document.addEventListener("pointerup", cancelHold);
  document.addEventListener("pointercancel", cancelHold);
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" && (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6)) cancelHold();
  });
  // The click that ends a hold explains; it doesn't act.
  document.addEventListener(
    "click",
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  // A held press opens the browser's context menu on some phones: not over a tip.
  document.addEventListener("contextmenu", (e) => {
    if (tipTarget(e.target)) e.preventDefault();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (performance.now() - shownAt > 250) hideTip();
    },
    { passive: true },
  );
  window.addEventListener("resize", hideTip);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideTip();
  });
}
