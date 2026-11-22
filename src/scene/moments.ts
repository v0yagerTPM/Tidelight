import { AnimatedCanvas, drawSweepingBeam, drawTower, glow, seeded, sparkle } from "./canvas";

// ── Moments ──────────────────────────────────────────────────────────────────
// The set pieces that play over the whole screen when something big happens:
//   rekindle — the lamp gutters out, embers rise in the dark, and the flame
//              catches again, brighter (also used for the Next Keeping);
//   relight  — a light path runs across the glass to a dark tower, and it
//              catches and begins to sweep;
//   waymark  — the same path, to a lantern on a post out on the deep glass
//              (the Crossing): it catches, and a ring of light spreads;
//   ending   — the Hollow Light: the glass cracks, shatters into water, and
//              seven beams stand in a row across the sea.
// Timing is driven by the rAF timestamp from when the moment began; under
// prefers-reduced-motion each moment shows its final, still frame.

export type MomentKind = "rekindle" | "relight" | "waymark" | "ending" | "tidelit" | "hollow";

const rand = seeded(5309);
const STARS = Array.from({ length: 140 }, () => ({ x: rand(), y: rand() * 0.6, s: rand() * 1.3 + 0.3, p: rand() * 6.283 }));
const EMBERS = Array.from({ length: 70 }, (_, i) => ({ birth: 0.5 + (i / 70) * 2.2, speed: 0.6 + rand() * 0.8, sway: rand() * 6.283, drift: (rand() - 0.5) * 60 }));
const CRACKS = Array.from({ length: 16 }, () => ({ angle: rand() * Math.PI, length: 0.3 + rand() * 0.6, kink: (rand() - 0.5) * 0.6 }));

const easeOut = (x: number): number => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export class MomentRenderer extends AnimatedCanvas {
  private kind: MomentKind = "rekindle";
  private startedAt = 0;

  begin(kind: MomentKind): void {
    this.kind = kind;
    this.startedAt = performance.now();
    this.redraw();
  }

  protected render(t: number, tms: number, still: boolean): void {
    const e = still ? 99 : (tms - this.startedAt) / 1000;
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    const horizon = H * 0.62;
    const water = this.kind === "ending" && e > 3.4;

    // Night: sky, stars, and the sea (glass, or water once the ending breaks it).
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#03070f");
    sky.addColorStop(1, water ? "#1f4466" : "#122840");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 1);
    const starBoost = this.kind === "ending" ? clamp01((e - 3.4) / 2) * 0.4 : 0;
    for (const s of STARS) {
      ctx.fillStyle = `rgba(233,230,220,${((0.45 + starBoost) * (0.6 + 0.4 * Math.sin(t * 1.4 + s.p))).toFixed(3)})`;
      ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
    }
    const sea = ctx.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, water ? "#1d4a66" : "#10253a");
    sea.addColorStop(1, water ? "#08172a" : "#050c18");
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, W, H - horizon);
    for (let i = 0; i < 18; i++) {
      const y = horizon + Math.pow(i / 18, 1.5) * (H - horizon);
      const swell = water ? Math.sin(t * 1.5 + i) * 4 : 0;
      ctx.strokeStyle = water ? "rgba(160,220,240,0.14)" : "rgba(143,214,196,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + swell);
      ctx.lineTo(W, y - swell);
      ctx.stroke();
    }

    if (this.kind === "rekindle") this.rekindle(e, t, horizon);
    else if (this.kind === "relight") this.relight(e, t, horizon);
    else if (this.kind === "waymark") this.waymark(e, t, horizon);
    else if (this.kind === "tidelit" || this.kind === "hollow") this.hatch(e, t, horizon, this.kind);
    else this.ending(e, t, horizon);
  }

  private rekindle(e: number, t: number, horizon: number): void {
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    const x = W / 2;
    const y = horizon - H * 0.2;
    // The flame: guttering (0–1.2s), an ember in the dark (1.2–2s), catching (2s+).
    let f: number;
    if (e < 1.2) f = (1 - e / 1.2) * (0.75 + 0.25 * Math.sin(e * 30));
    else if (e < 2) f = 0.04;
    else f = 1.25 * easeOut((e - 2) / 1.1) + 0.05 * Math.sin(t * 3);
    glow(ctx, x, y, 40 + 260 * f, "255,196,99", 0.25 + 0.55 * clamp01(f));
    glow(ctx, x, y, 10 + 40 * f, "255,240,210", 0.9 * clamp01(f + 0.2));
    // A small lamp: glass, cap, and the flame inside.
    ctx.strokeStyle = "rgba(233,230,220,0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 16, y - 22, 32, 40);
    ctx.fillStyle = "#131f30";
    ctx.fillRect(x - 20, y + 18, 40, 6);
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 22);
    ctx.lineTo(x, y - 36);
    ctx.lineTo(x + 20, y - 22);
    ctx.fill();
    const flameH = 4 + 22 * clamp01(f);
    ctx.fillStyle = "rgba(255,226,166,0.95)";
    ctx.beginPath();
    ctx.moveTo(x, y + 8 - flameH);
    ctx.quadraticCurveTo(x + 7, y + 2, x, y + 10);
    ctx.quadraticCurveTo(x - 7, y + 2, x, y + 8 - flameH);
    ctx.fill();
    // Embers rising while the lamp is dark.
    for (const em of EMBERS) {
      const age = e - em.birth;
      if (age <= 0 || age > 2.6) continue;
      const ex = x + em.drift * age * 0.5 + Math.sin(age * 2.4 + em.sway) * 14 * age;
      const ey = y - age * 90 * em.speed;
      const a = 1 - age / 2.6;
      glow(ctx, ex, ey, 7, "255,150,70", 0.8 * a);
      ctx.fillStyle = `rgba(255,214,150,${a.toFixed(3)})`;
      ctx.fillRect(ex - 1, ey - 1, 2, 2);
    }
    // The ring as it catches.
    if (e > 2 && e < 3.4) {
      const k = (e - 2) / 1.4;
      ctx.strokeStyle = `rgba(255,214,140,${(0.8 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 30 + k * W * 0.4, (30 + k * W * 0.4) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private relight(e: number, t: number, horizon: number): void {
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    const x = W / 2;
    // The tower stands out on the horizon, clear of the words below it.
    const base = horizon - 2;
    const height = Math.min(H * 0.34, W * 0.55);
    // A path of light running across the glass to the tower (0–1s).
    const p = easeOut(e / 1);
    ctx.strokeStyle = "rgba(255,206,120,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.98);
    ctx.quadraticCurveTo(W * 0.25, base + H * 0.12, 0 + (x - 0) * p, H * 0.98 + (base - H * 0.98) * p);
    ctx.stroke();
    ctx.fillStyle = "#0a111e";
    ctx.beginPath();
    ctx.ellipse(x, base + 3, height * 0.22, height * 0.05, 0, Math.PI, 0);
    ctx.fill();
    const lit = e > 1;
    const { lampX, lampY } = drawTower(ctx, { x, base, height, halfWidth: height * 0.08, lit });
    if (lit) {
      const k = e - 1;
      glow(ctx, lampX, lampY, height * (0.5 + 0.6 * Math.max(0, 1 - k)), "255,196,99", 0.75);
      drawSweepingBeam(ctx, lampX, lampY, k * 0.9 + 0.3, W * 0.7, height * 0.12, 0.5);
      if (k < 1.4) {
        const r = 20 + k * W * 0.35;
        ctx.strokeStyle = `rgba(255,214,140,${(0.8 * (1 - k / 1.4)).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(lampX, lampY, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const a = Math.sin(t * 2 + i * 1.3);
        if (a > 0.6) sparkle(ctx, lampX + Math.cos(i * 1.05) * height * 0.22, lampY + Math.sin(i * 1.05) * height * 0.12, 4, (a - 0.6) * 2.5);
      }
    }
  }

  /**
   * A rare hatch: a cocoon hangs glowing under the lamp, splits, and the moth
   * climbs into the dark on beating wings. Tidelit hatches in a storm (sea
   * light, flickers of lightning); Hollow is pale, wings around a dark core.
   */
  private hatch(e: number, t: number, horizon: number, kind: "tidelit" | "hollow"): void {
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    const rgb = kind === "tidelit" ? "143,214,196" : "226,232,255";
    const x = W / 2;
    const cy = horizon - H * 0.22;
    const s = Math.min(W, H) * 0.06;
    // A storm for the Tidelit: the odd flash low on the sky.
    if (kind === "tidelit") {
      const flash = Math.max(0, Math.sin(t * 2.3) * Math.sin(t * 5.1) - 0.8) * 5;
      if (flash > 0) {
        ctx.fillStyle = `rgba(190,225,255,${(0.12 * flash).toFixed(3)})`;
        ctx.fillRect(0, 0, W, horizon);
      }
    }
    // The thread and the cocoon (0–1.1s), pulsing faster as it wakes.
    const open = clamp01((e - 1.1) / 0.5);
    if (open < 1) {
      ctx.strokeStyle = `rgba(233,230,220,${(0.35 * (1 - open)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cy - s * 1.4);
      ctx.stroke();
      const pulse = 0.5 + 0.5 * Math.sin(e * (4 + e * 6));
      glow(ctx, x, cy, s * (3 + 2 * pulse), rgb, 0.35 + 0.3 * pulse);
      for (const side of [-1, 1]) {
        ctx.fillStyle = `rgba(214,200,170,${(1 - open).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x + side * open * s * 1.6, cy + open * s * 1.2, s * 0.5, s * 1.3, side * open * 0.8, side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 ? Math.PI * 1.5 : Math.PI / 2);
        ctx.fill();
      }
    }
    // The moth, rising.
    if (e > 1.1) {
      const k = e - 1.1;
      const mx = x + Math.sin(k * 1.7) * s * 1.2;
      const my = cy - easeOut(k / 3) * H * 0.22;
      glow(ctx, mx, my, s * 6, rgb, 0.45);
      const beat = 0.25 + 0.75 * Math.abs(Math.sin(k * 9));
      for (const side of [-1, 1]) {
        for (const [dy, size] of [[-0.35, 1.25], [0.45, 0.85]] as const) {
          ctx.save();
          ctx.translate(mx + side * s * 0.15, my + dy * s);
          ctx.scale(side * beat, 1);
          ctx.fillStyle = kind === "tidelit" ? "rgba(143,214,196,0.92)" : "rgba(244,247,255,0.95)";
          ctx.beginPath();
          ctx.ellipse(s * size * 0.75, 0, s * size * 0.8, s * size * 0.55, dy < 0 ? -0.35 : 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = kind === "tidelit" ? "rgba(29,63,92,0.8)" : "rgba(11,18,32,0.9)";
          ctx.beginPath();
          ctx.ellipse(s * size * 0.75, 0, s * size * (kind === "hollow" ? 0.3 : 0.5), s * size * (kind === "hollow" ? 0.2 : 0.08), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = "#1b2433";
      ctx.fillRect(mx - s * 0.1, my - s * 0.6, s * 0.2, s * 1.3);
      // Dust from its wings.
      for (let i = 0; i < 10; i++) {
        const age = (k * 1.3 + i * 0.37) % 2;
        sparkle(ctx, mx + Math.sin(i * 7.1 + k) * s * 2, my + age * s * 3, 2 + i % 3, 0.8 * (1 - age / 2));
      }
    }
  }

  private waymark(e: number, t: number, horizon: number): void {
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    const x = W / 2;
    // A lantern on a post, standing in the glass just below the horizon.
    const base = horizon + H * 0.03;
    const post = Math.min(H * 0.16, W * 0.3);
    const p = easeOut(e / 1);
    ctx.strokeStyle = "rgba(255,206,120,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.98);
    ctx.quadraticCurveTo(W * 0.25, base + H * 0.12, x * p, H * 0.98 + (base - H * 0.98) * p);
    ctx.stroke();
    // Its reflection-shadow on the glass, then the post.
    ctx.fillStyle = "#0a111e";
    ctx.beginPath();
    ctx.ellipse(x, base + 2, post * 0.22, post * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a4d63";
    ctx.lineWidth = Math.max(2, post * 0.035);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - post);
    ctx.stroke();
    // The lantern: a small glass box with a cap.
    const lw = post * 0.14;
    const lh = post * 0.2;
    const ly = base - post - lh;
    const lit = e > 1;
    ctx.fillStyle = lit ? "#ffe2a6" : "#26364a";
    ctx.fillRect(x - lw / 2, ly, lw, lh);
    ctx.fillStyle = "#3a4d63";
    ctx.beginPath();
    ctx.moveTo(x - lw * 0.7, ly);
    ctx.lineTo(x, ly - lh * 0.45);
    ctx.lineTo(x + lw * 0.7, ly);
    ctx.closePath();
    ctx.fill();
    if (lit) {
      const k = e - 1;
      const cy = ly + lh / 2;
      glow(ctx, x, cy, post * (0.7 + 0.8 * Math.max(0, 1 - k)), "255,196,99", 0.75);
      // A ring of light spreading across the glass, then a second.
      for (const delay of [0, 0.7]) {
        const kk = k - delay;
        if (kk < 0 || kk > 1.8) continue;
        const r = 12 + kk * W * 0.3;
        ctx.strokeStyle = `rgba(255,214,140,${(0.7 * (1 - kk / 1.8)).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, base, r, r * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const a = Math.sin(t * 2 + i * 1.4);
        if (a > 0.6) sparkle(ctx, x + Math.cos(i * 1.25) * post * 0.3, cy + Math.sin(i * 1.25) * post * 0.2, 4, (a - 0.6) * 2.5);
      }
    }
  }

  private ending(e: number, t: number, horizon: number): void {
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    const cx = W / 2;
    const cy = horizon + (H - horizon) * 0.45;
    // Cracks spread through the glass (0–2.6s), then it breaks — a white flash (2.6–3.4s).
    if (e < 3.4) {
      const grow = easeOut(e / 2.6);
      ctx.strokeStyle = "rgba(220,240,250,0.55)";
      ctx.lineWidth = 1.2;
      for (const c of CRACKS) {
        const len = c.length * grow * W * 0.6;
        const mx = cx + Math.cos(c.angle) * len * 0.5;
        const my = cy + Math.sin(c.angle + c.kink) * len * 0.12;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(mx, my);
        ctx.lineTo(cx + Math.cos(c.angle + c.kink) * len, cy + Math.sin(c.angle) * len * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - (mx - cx), my);
        ctx.stroke();
      }
    }
    if (e > 2.6 && e < 4.2) {
      const k = e < 3.4 ? (e - 2.6) / 0.8 : 1 - (e - 3.4) / 0.8;
      ctx.fillStyle = `rgba(240,248,255,${(0.85 * clamp01(k)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Seven lights in a row across the sea, catching one by one.
    if (e > 3.4) {
      for (let i = 0; i < 7; i++) {
        const k = clamp01((e - 3.6 - i * 0.35) / 0.6);
        if (k <= 0) continue;
        const x = W * (0.1 + i * 0.133);
        const height = H * (0.16 - i * 0.012);
        const base = horizon + H * (0.05 - i * 0.006);
        const { lampX, lampY } = drawTower(ctx, { x, base, height, halfWidth: height * 0.09, lit: true });
        glow(ctx, lampX, lampY, height * 0.9 * k, "255,196,99", 0.7 * k);
        drawSweepingBeam(ctx, lampX, lampY, t * 0.5 + i * 0.8, W * 0.16, height * 0.15, 0.4 * k);
        // Its light on the water, fading toward the shore.
        const reflect = ctx.createLinearGradient(0, base, 0, base + (H - horizon) * 0.7);
        reflect.addColorStop(0, `rgba(255,200,110,${(0.22 * k).toFixed(3)})`);
        reflect.addColorStop(1, "rgba(255,200,110,0)");
        ctx.fillStyle = reflect;
        ctx.fillRect(lampX - 5, base, 10, (H - horizon) * 0.7);
      }
    }
  }
}
