// ── Shared canvas plumbing ───────────────────────────────────────────────────
// Every scene in the game (the Light view, the coast, the chain, the Shore
// meadow) is a Canvas 2D drawing that sizes itself to its element, draws at
// the device's pixel density (capped at 2×), animates on requestAnimationFrame
// only while started, and holds still under prefers-reduced-motion.

export abstract class AnimatedCanvas {
  protected readonly ctx: CanvasRenderingContext2D;
  protected w = 0;
  protected h = 0;
  protected readonly reducedMotion: MediaQueryList;
  private raf = 0;
  private running = false;
  private readonly resizeObserver: ResizeObserver;

  constructor(protected readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (tms: number): void => {
      if (!this.running) return;
      this.frame(tms);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Draw one frame now when the loop isn't running (e.g. after new data). */
  protected redraw(): void {
    if (!this.running) this.frame(performance.now());
  }

  private frame(tms: number): void {
    if (this.w === 0 || this.h === 0) return;
    const still = this.reducedMotion.matches;
    this.render(still ? 0 : tms / 1000, tms, still);
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  /**
   * Draw a frame. `t` is animation time in seconds (0 under reduced motion,
   * so everything holds still); `tms` is the raw rAF timestamp.
   */
  protected abstract render(t: number, tms: number, still: boolean): void;
}

// ── Drawing helpers shared by the scenes ─────────────────────────────────────

/** A small seeded PRNG so scenery (stars, cracks, positions) is stable. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft radial light. `rgb` is "r,g,b". */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, alpha: number): void {
  if (r <= 0 || alpha <= 0) return;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},${Math.min(1, alpha).toFixed(3)})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A four-point glint. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  if (alpha <= 0) return;
  ctx.strokeStyle = `rgba(255,250,235,${Math.min(1, alpha).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
}

/** A lantern moth: two flickering wings and a halo. */
export function drawMoth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  glowAlpha: number,
  wingPhase: number,
  still: boolean,
): void {
  glow(ctx, x, y, size * 4.5, "255,220,150", glowAlpha);
  const wing = still ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(wingPhase * 14));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x - size * 0.7, y, size * wing, size * 0.75, -0.4, 0, Math.PI * 2);
  ctx.ellipse(x + size * 0.7, y, size * wing, size * 0.75, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

export interface TowerSpec {
  x: number;
  /** y of the tower's foot. */
  base: number;
  height: number;
  /** Half-width at the foot. */
  halfWidth: number;
  lit: boolean;
}

/**
 * A banded lighthouse with gallery and lamp room. Lit towers are painted in
 * lamp-warmed whites and reds; dark ones are a cold silhouette. Returns the
 * lamp's centre, for glows and beams.
 */
export function drawTower(ctx: CanvasRenderingContext2D, spec: TowerSpec): { lampX: number; lampY: number } {
  const { x, base, height, halfWidth: wb, lit } = spec;
  const wt = wb * 0.62;
  const top = base - height;
  const lampH = height * 0.13;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - wb, base);
  ctx.lineTo(x - wt, top);
  ctx.lineTo(x + wt, top);
  ctx.lineTo(x + wb, base);
  ctx.closePath();
  if (lit) {
    const body = ctx.createLinearGradient(x - wb, 0, x + wb, 0);
    body.addColorStop(0, "#1f3149");
    body.addColorStop(0.55, "#e6dfcd");
    body.addColorStop(1, "#7f7d7a");
    ctx.fillStyle = body;
  } else {
    ctx.fillStyle = "#0f1a2a";
  }
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = lit ? "rgba(156,52,44,0.88)" : "rgba(30,44,64,0.9)";
  for (let i = 0; i < 4; i++) {
    const y = top + height * (0.12 + i * 0.24);
    ctx.fillRect(x - wb, y, wb * 2, height * 0.1);
  }
  ctx.restore();
  ctx.fillStyle = lit ? "#131f30" : "#0b1422";
  ctx.fillRect(x - wt * 1.45, top - 3, wt * 2.9, Math.max(2, height * 0.025));
  const lampW = wt * 1.1;
  ctx.fillStyle = lit ? "#1b2a3e" : "#0b1422";
  ctx.fillRect(x - lampW, top - 3 - lampH, lampW * 2, lampH);
  ctx.beginPath();
  ctx.moveTo(x - lampW * 1.18, top - 3 - lampH);
  ctx.lineTo(x, top - 3 - lampH * 1.75);
  ctx.lineTo(x + lampW * 1.18, top - 3 - lampH);
  ctx.closePath();
  ctx.fillStyle = lit ? "#131f30" : "#0b1422";
  ctx.fill();
  const lampY = top - 3 - lampH * 0.5;
  if (lit) {
    ctx.fillStyle = "rgba(255,236,190,0.92)";
    ctx.fillRect(x - wt * 0.75, lampY - lampH * 0.32, wt * 1.5, lampH * 0.64);
  }
  return { lampX: x, lampY };
}

/** A beam cone sweeping round a vertical axis, seen from the side. */
export function drawSweepingBeam(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  reach: number,
  spread: number,
  alpha: number,
  rgb = "255,214,140",
): void {
  const c = Math.cos(angle);
  const front = Math.sin(angle) > 0;
  const dir = c >= 0 ? 1 : -1;
  const len = reach * Math.abs(c) + 10;
  const a = front ? alpha : alpha * 0.4;
  const sp = spread * (0.5 + Math.abs(c) * 0.5);
  const grad = ctx.createLinearGradient(x, y, x + dir * len, y);
  grad.addColorStop(0, `rgba(${rgb},${Math.min(0.95, a).toFixed(3)})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y - 2);
  ctx.lineTo(x + dir * len, y - sp);
  ctx.lineTo(x + dir * len, y + sp * 0.7);
  ctx.lineTo(x, y + 2);
  ctx.closePath();
  ctx.fill();
}
