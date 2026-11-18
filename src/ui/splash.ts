// ── Splash dialogs ───────────────────────────────────────────────────────────
// A card over a dimmed game: the how-to-play tutorial (paged) and what a
// bottle brought home (one page). Unlike the full-screen moments, a splash
// is for reading: it waits for the keeper, never closes on its own, and
// pages with Back / Next, the arrow keys or the dots.
//
// Accessible: role="dialog" + aria-modal, labelled by the page title, Tab
// stays inside the card, Escape closes, and focus goes back to wherever it
// was when the splash opened.

export interface SplashPage {
  /** Inline SVG (or emoji) shown above the title. */
  art?: string;
  eyebrow?: string;
  title: string;
  /** Trusted HTML built by the game (never player-typed text). */
  html: string;
}

export interface SplashOptions {
  /** A modifier for styling ("tutorial", "bottle"). */
  kind: string;
  /** The last page's button. */
  finishLabel?: string;
  onClose?: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export class Splash {
  private readonly root: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private pages: SplashPage[] = [];
  private index = 0;
  private options: SplashOptions = { kind: "" };
  private returnFocus: Element | null = null;

  constructor(host: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "splash hidden";
    this.root.innerHTML = `<div class="splash-card" role="dialog" aria-modal="true" aria-labelledby="splash-title"></div>`;
    this.card = this.root.querySelector<HTMLDivElement>(".splash-card")!;
    host.appendChild(this.root);
    // A click on the dim backdrop (not the card) closes it.
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.close();
    });
    this.root.addEventListener("keydown", (e) => this.onKey(e));
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  open(pages: SplashPage[], options: SplashOptions): void {
    if (pages.length === 0) return;
    if (!this.isOpen) this.returnFocus = document.activeElement;
    this.pages = pages;
    this.options = options;
    this.index = 0;
    this.root.dataset.kind = options.kind;
    this.root.classList.remove("hidden");
    this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.classList.add("hidden");
    this.card.innerHTML = "";
    const done = this.options.onClose;
    this.options = { kind: "" };
    if (this.returnFocus instanceof HTMLElement) this.returnFocus.focus({ preventScroll: true });
    done?.();
  }

  private go(index: number): void {
    const next = Math.max(0, Math.min(this.pages.length - 1, index));
    if (next === this.index) return;
    this.index = next;
    this.render();
  }

  private render(): void {
    const page = this.pages[this.index];
    const many = this.pages.length > 1;
    const last = this.index === this.pages.length - 1;
    const dots = many
      ? `<div class="splash-dots" role="tablist" aria-label="Pages">${this.pages
          .map((p, i) => `<button class="splash-dot${i === this.index ? " current" : ""}" data-page="${i}" role="tab" aria-selected="${i === this.index}" aria-label="Page ${i + 1}: ${p.title}"></button>`)
          .join("")}</div>`
      : "";
    this.card.innerHTML = `
      <button class="splash-close" aria-label="Close">×</button>
      <div class="splash-page" data-page="${this.index}">
        ${page.art ? `<div class="splash-art">${page.art}</div>` : ""}
        ${page.eyebrow ? `<div class="splash-eyebrow">${page.eyebrow}</div>` : ""}
        <h2 id="splash-title">${page.title}</h2>
        <div class="splash-body">${page.html}</div>
      </div>
      <div class="splash-nav">
        ${many ? `<button class="buy splash-back"${this.index === 0 ? " disabled" : ""}>Back</button>` : "<span></span>"}
        ${dots}
        <button class="buy affordable splash-next">${last ? this.options.finishLabel ?? "Close" : "Next"}</button>
      </div>`;
    this.card.querySelector(".splash-close")?.addEventListener("click", () => this.close());
    this.card.querySelector(".splash-back")?.addEventListener("click", () => this.go(this.index - 1));
    this.card.querySelector(".splash-next")?.addEventListener("click", () => (last ? this.close() : this.go(this.index + 1)));
    this.card.querySelectorAll<HTMLButtonElement>(".splash-dot").forEach((dot) =>
      dot.addEventListener("click", () => this.go(Number(dot.dataset.page))),
    );
    this.card.querySelector<HTMLElement>(".splash-next")?.focus({ preventScroll: true });
    this.card.scrollTop = 0;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      this.close();
    } else if (e.key === "ArrowRight" && !(e.target instanceof HTMLSelectElement)) {
      this.go(this.index + 1);
    } else if (e.key === "ArrowLeft" && !(e.target instanceof HTMLSelectElement)) {
      this.go(this.index - 1);
    } else if (e.key === "Tab") {
      // Keep focus inside the card.
      const items = [...this.card.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}
