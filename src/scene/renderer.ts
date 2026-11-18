import { AnimatedCanvas, drawMoth, glow, seeded, sparkle } from "./canvas";
import type { SceneModel } from "./model";

// ── The Light-view scene ─────────────────────────────────────────────────────
// Candlewick Point at night: a sky, the glass sea, the six far lighthouses on
// the horizon, the home lighthouse and its beam, and the keeper's helpers as
// living things. Pure Canvas 2D, procedural, no image assets.
//
// The renderer reads only a SceneModel (see model.ts) and owns nothing of the
// game. It runs on requestAnimationFrame while started; main.ts starts it when
// the Light view is shown and stops it otherwise, and the browser pauses rAF
// in hidden tabs. prefers-reduced-motion slows the beam to a crawl and holds
// every ambient animation still.

interface Floater { text: string; x: number; y: number; life: number }
interface Ring { r: number; life: number }

const rand = seeded(1871);
const STARS = Array.from({ length: 150 }, () => ({ x: rand(), y: rand() * 0.52, s: rand() * 1.3 + 0.35, p: rand() * 6.283 }));
const CRACKS = Array.from({ length: 13 }, () => {
  const pts: [number, number][] = [];
  let x = 0.3 + rand() * 0.7;
  let y = rand();
  for (let i = 0; i < 5; i++) {
    pts.push([x, y]);
    x += (rand() - 0.5) * 0.12;
    y += (rand() - 0.25) * 0.12;
  }
  return pts;
});
const CRAB_SLOTS = Array.from({ length: 12 }, (_, i) => ({ x: 0.03 + (i / 12) * 0.36 + rand() * 0.02, ph: rand() * 6.283, sp: 0.15 + rand() * 0.35 }));
const MOTE_SLOTS = Array.from({ length: 16 }, (_, i) => ({ a: rand() * 6.283, rx: 34 + rand() * 80, ry: 16 + rand() * 46, sp: (0.3 + rand() * 0.6) * (i % 2 ? 1 : -1) }));
const BELL_SLOTS = [[0.47, 0.32], [0.63, 0.22], [0.78, 0.4], [0.9, 0.18], [0.56, 0.6], [0.86, 0.66]].map(([x, d]) => ({ x, d, ph: rand() * 6.283 }));
const WHALE_SLOTS = [0.62, 0.8, 0.94].map((x) => ({ x, period: 14 + rand() * 10, off: rand() * 20 }));
const SHIP_SLOTS = [0.12, 0.3, 0.47].map((x) => ({ x, drift: 0.004 + rand() * 0.004, ph: rand() * 6.283, scale: 0.75 + rand() * 0.35 }));
const RAIN = Array.from({ length: 170 }, () => ({ x: rand() * 1.2, y: rand(), l: 8 + rand() * 14 }));
const FAR_X = [0.5, 0.58, 0.66, 0.74, 0.83, 0.93];

export class SceneRenderer extends AnimatedCanvas {
  private model: SceneModel | null = null;
  private flashLevel = 0;
  private lightning = 0;
  private readonly floaters: Floater[] = [];
  private readonly rings: Ring[] = [];

  setModel(model: SceneModel): void {
    this.model = model;
    this.redraw();
  }

  /** A Flash the Beam moment: the lamp blooms, a ring spreads, the gain floats up. */
  flash(text: string): void {
    this.flashLevel = 1;
    this.rings.push({ r: 18, life: 1 });
    const g = this.geometry();
    this.floaters.push({ text, x: g.lx + (Math.random() - 0.5) * 60, y: g.lampY - 26, life: 1 });
    if (this.floaters.length > 24) this.floaters.shift();
    this.redraw();
  }

  private geometry() {
    const { w: W, h: H } = this;
    const tide = this.model?.tide;
    const narrow = W < 600;
    const horizon = H * (0.55 + (tide === "high" ? -0.025 : tide === "low" ? 0.03 : 0));
    const lx = W * (narrow ? 0.28 : 0.22);
    const base = H * 0.86;
    const top = H * (narrow ? 0.4 : 0.3);
    const wb = Math.max(20, Math.min(46, W * 0.035));
    const wt = wb * 0.62;
    const lampH = H * 0.06;
    const lampY = top - 4 - lampH * 0.5;
    return { W, H, narrow, horizon, lx, base, top, wb, wt, lampH, lampY };
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  protected render(t: number, _tms: number, still: boolean): void {
    const m = this.model;
    const ctx = this.ctx;
    if (!m) return;
    const g = this.geometry();
    const { W, H, horizon, lx, lampY } = g;
    const storm = m.tide === "storm";
    const calm = m.tide === "calm";

    // Sky — stars fade as the lamplight grows.
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, storm ? "#04070e" : "#050b18");
    sky.addColorStop(1, storm ? "#151b27" : "#17324c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 1);
    if (!storm) {
      const starAlpha = 0.85 - m.reach * 0.45;
      for (const s of STARS) {
        const tw = 0.55 + 0.45 * Math.sin(t * 1.3 + s.p);
        ctx.fillStyle = `rgba(233,230,220,${(starAlpha * tw).toFixed(3)})`;
        ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
      }
      this.glow(W * 0.84, H * 0.15, 70, "255,240,210", 0.45);
      ctx.fillStyle = "#f4ead2";
      ctx.beginPath();
      ctx.arc(W * 0.84, H * 0.15, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // The sea: glass (cracked, faintly shimmering) or, after the ending, water.
    const sea = ctx.createLinearGradient(0, horizon, 0, H);
    if (m.seaIsWater) {
      sea.addColorStop(0, "#1d4a66");
      sea.addColorStop(1, "#08172a");
    } else {
      sea.addColorStop(0, calm ? "#1b3a55" : "#132b42");
      sea.addColorStop(1, "#070f1c");
    }
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, W, H - horizon);
    for (let i = 0; i < 24; i++) {
      const y = horizon + Math.pow(i / 24, 1.6) * (H - horizon);
      const swell = m.seaIsWater ? Math.sin(t * 1.4 + i) * 3 : 0;
      const a = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.7));
      ctx.strokeStyle = m.seaIsWater ? `rgba(160,220,240,${(a * 1.4).toFixed(3)})` : `rgba(143,214,196,${a.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + swell);
      ctx.lineTo(W, y - swell + (i % 3) - 1);
      ctx.stroke();
    }
    if (!m.seaIsWater) {
      // One pair of cracks per dark lighthouse (plus one that never heals
      // until the end): the glass mends as the coast relights.
      const dark = m.farLit.filter((lit) => !lit).length;
      ctx.strokeStyle = "rgba(205,232,242,0.13)";
      ctx.lineWidth = 1;
      for (const crack of CRACKS.slice(0, 1 + dark * 2)) {
        ctx.beginPath();
        crack.forEach(([x, y], i) => {
          const px = x * W;
          const py = horizon + 6 + y * (H - horizon) * 0.9;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    }
    if (m.tide === "low") {
      ctx.fillStyle = "#0c1727";
      for (const [x, w] of [[0.55, 60], [0.71, 38], [0.88, 70]] as const) {
        ctx.beginPath();
        ctx.ellipse(x * W, horizon + (H - horizon) * 0.36, w, 9, 0, Math.PI, 0);
        ctx.fill();
      }
    }

    // Foreground rocks.
    ctx.fillStyle = "#0a111e";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, g.base - H * 0.02);
    ctx.quadraticCurveTo(W * 0.12, g.base - H * 0.08, lx - 40, g.base - H * 0.02);
    ctx.quadraticCurveTo(lx + 70, g.base - H * 0.05, W * 0.5, H * 0.93);
    ctx.lineTo(W * 0.52, H);
    ctx.closePath();
    ctx.fill();

    // The dark: lamplight reach pushes it back as production grows.
    const reachR = Math.max(W, H) * (0.28 + 0.95 * m.reach);
    const dark = ctx.createRadialGradient(lx, lampY, reachR * 0.35, lx, lampY, reachR * 1.25);
    dark.addColorStop(0, "rgba(3,6,12,0)");
    dark.addColorStop(1, "rgba(3,6,12,0.72)");
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, W, H);

    // ── Lights and living things, drawn over the dark (they make their own light).
    this.drawFarLighthouses(m, t, horizon);
    this.drawBeam(m, t, g);

    // Lamplight on the sea, and the mirror in a Glass Calm.
    const reflect = ctx.createLinearGradient(0, horizon, 0, H);
    const ra = (calm ? 0.3 : 0.15) * (0.5 + m.beamStrength * 0.5) + this.flashLevel * 0.3;
    reflect.addColorStop(0, `rgba(255,200,110,${ra.toFixed(3)})`);
    reflect.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = reflect;
    ctx.fillRect(lx - 24, horizon, 48, H - horizon);
    if (calm) {
      ctx.save();
      ctx.translate(0, horizon * 2);
      ctx.scale(1, -1);
      ctx.globalAlpha = 0.16;
      this.drawTower(g);
      ctx.restore();
    }

    this.drawBells(m, t, g);
    this.drawShips(m, t, g);
    this.drawWhales(m, t, g);
    this.drawTower(g);
    this.drawCottage(m, t, g);
    this.drawJetty(m, t, g);
    this.drawLamp(m, t, g);
    this.drawCrabs(m, t, g);
    this.drawMoths(m, t, g);

    if (storm) this.drawStorm(t, still);
    this.drawFlashEffects(g);
    this.flashLevel = Math.max(0, this.flashLevel - 0.035);
  }

  private glow(x: number, y: number, r: number, rgb: string, alpha: number): void {
    glow(this.ctx, x, y, r, rgb, alpha);
  }

  private drawFarLighthouses(m: SceneModel, t: number, horizon: number): void {
    const ctx = this.ctx;
    const scale = this.h / 600;
    m.farLit.forEach((lit, i) => {
      const x = FAR_X[i] * this.w;
      const isHollow = i === m.farLit.length - 1;
      const h = (isHollow ? 40 : 30 - i * 2) * scale;
      const wHalf = (isHollow ? 4.5 : 3) * Math.max(0.8, scale);
      ctx.fillStyle = lit ? "#33465f" : "#0e1828";
      ctx.beginPath();
      ctx.moveTo(x - wHalf, horizon);
      ctx.lineTo(x - wHalf * 0.6, horizon - h);
      ctx.lineTo(x + wHalf * 0.6, horizon - h);
      ctx.lineTo(x + wHalf, horizon);
      ctx.fill();
      if (lit) {
        const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.5 + i * 1.3));
        this.glow(x, horizon - h, isHollow ? 34 : 22, "255,214,140", 0.85 * pulse);
        // A faint answering beam, sweeping on its own clock.
        const a = t * 0.4 + i;
        const len = 60 * scale * Math.abs(Math.cos(a));
        const beam = ctx.createLinearGradient(x, 0, x + Math.sign(Math.cos(a)) * len, 0);
        beam.addColorStop(0, "rgba(255,214,140,0.22)");
        beam.addColorStop(1, "rgba(255,214,140,0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(x, horizon - h - 1);
        ctx.lineTo(x + Math.sign(Math.cos(a)) * len, horizon - h - 6 * scale);
        ctx.lineTo(x + Math.sign(Math.cos(a)) * len, horizon - h + 4 * scale);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  /** The thrown beam: sweeps round the vertical axis; a starved chain makes it sputter. */
  private drawBeam(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    const ctx = this.ctx;
    const speed = this.reducedMotion.matches ? 0.12 : 0.25 + 0.45 * m.beamStrength;
    const angle = (this.reducedMotion.matches ? performance.now() / 1000 : t) * speed;
    const c = Math.cos(angle);
    const front = Math.sin(angle) > 0;
    const dir = c >= 0 ? 1 : -1;
    const beamBonus = Math.min(0.5, m.beamLevels * 0.02);
    const len = g.W * (1.05 + beamBonus) * Math.abs(c) + 40;
    let strength = 0.15 + 0.32 * m.beamStrength;
    if (m.starved) {
      const sputter = 0.5 + 0.5 * Math.sin(t * 13.1) * Math.sin(t * 7.7);
      strength *= 1 - (1 - m.beamStrength) * 0.55 * sputter;
    }
    const alpha = (front ? strength : strength * 0.4) + this.flashLevel * 0.45;
    const spread = g.H * (0.09 + beamBonus * 0.1) * (0.5 + Math.abs(c) * 0.5);
    const rgb = m.starved && m.beamStrength < 0.5 ? "255,190,120" : "255,214,140";
    const grad = ctx.createLinearGradient(g.lx, g.lampY, g.lx + dir * len, g.lampY);
    grad.addColorStop(0, `rgba(${rgb},${Math.min(0.95, alpha).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(g.lx, g.lampY - 4);
    ctx.lineTo(g.lx + dir * len, g.lampY - spread);
    ctx.lineTo(g.lx + dir * len, g.lampY + spread * 0.7);
    ctx.lineTo(g.lx, g.lampY + 4);
    ctx.closePath();
    ctx.fill();
  }

  private drawTower(g: ReturnType<SceneRenderer["geometry"]>): void {
    const ctx = this.ctx;
    const { lx, base, top, wb, wt, lampH } = g;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lx - wb, base);
    ctx.lineTo(lx - wt, top);
    ctx.lineTo(lx + wt, top);
    ctx.lineTo(lx + wb, base);
    ctx.closePath();
    const body = ctx.createLinearGradient(lx - wb, 0, lx + wb, 0);
    body.addColorStop(0, "#1f3149");
    body.addColorStop(0.55, "#e6dfcd");
    body.addColorStop(1, "#7f7d7a");
    ctx.fillStyle = body;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = "rgba(156,52,44,0.88)";
    for (let i = 0; i < 4; i++) {
      const y = top + (base - top) * (0.12 + i * 0.24);
      ctx.fillRect(lx - wb, y, wb * 2, (base - top) * 0.1);
    }
    ctx.restore();
    // Gallery, lamp room and cap.
    ctx.fillStyle = "#131f30";
    ctx.fillRect(lx - wt * 1.45, top - 4, wt * 2.9, 6);
    const lampW = wt * 1.1;
    ctx.fillStyle = "#1b2a3e";
    ctx.fillRect(lx - lampW, top - 4 - lampH, lampW * 2, lampH);
    ctx.beginPath();
    ctx.moveTo(lx - lampW * 1.18, top - 4 - lampH);
    ctx.lineTo(lx, top - 4 - lampH * 1.75);
    ctx.lineTo(lx + lampW * 1.18, top - 4 - lampH);
    ctx.closePath();
    ctx.fillStyle = "#131f30";
    ctx.fill();
  }

  private drawLamp(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    const ctx = this.ctx;
    const { lx, lampY, wt } = g;
    let flicker = 1;
    if (m.starved) flicker = 1 - (1 - m.beamStrength) * 0.35 * (0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 5.3));
    const r = (g.narrow ? 58 : 84) * (0.7 + 0.3 * m.beamStrength) * flicker * (1 + this.flashLevel * 0.8);
    this.glow(lx, lampY, r, "255,196,99", 0.75 * flicker + this.flashLevel * 0.2);
    // The flame behind the glass.
    ctx.fillStyle = `rgba(255,236,190,${(0.9 * flicker).toFixed(3)})`;
    ctx.fillRect(lx - wt * 0.75, lampY - g.lampH * 0.32, wt * 1.5, g.lampH * 0.64);

    // The Seventh Light: a halo you become.
    if (m.seventh > 0) {
      ctx.strokeStyle = `rgba(255,236,190,${(0.25 + 0.45 * m.seventh).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      const hr = 30 + 26 * m.seventh + Math.sin(t * 0.9) * 3;
      ctx.beginPath();
      ctx.ellipse(lx, lampY, hr, hr * 0.9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The Wing Almanac, complete: a halo in the brightest moth's colour.
    if (m.lampHalo) {
      const [r, gg, b] = [1, 3, 5].map((i) => parseInt(m.lampHalo!.slice(i, i + 2), 16));
      const hr = 46 + Math.sin(t * 0.6) * 4;
      ctx.strokeStyle = `rgba(${r},${gg},${b},0.55)`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(lx, lampY, hr, hr * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      this.glow(lx, lampY, hr * 1.25, `${r},${gg},${b}`, 0.18);
    }
    // Lens polishers: glints on the lamp-room glass.
    for (let i = 0; i < m.lensGlints; i++) {
      const phase = (t * 0.7 + i * 1.37) % 3;
      if (phase > 1) continue;
      const a = Math.sin(phase * Math.PI);
      const x = lx + (i - (m.lensGlints - 1) / 2) * wt * 0.45;
      const y = lampY + (i % 2 ? -1 : 1) * g.lampH * 0.18;
      this.sparkle(x, y, 5 * a + 2, a);
    }
  }

  private sparkle(x: number, y: number, r: number, alpha: number): void {
    sparkle(this.ctx, x, y, r, alpha);
  }

  /** Oil keepers: the cottage at the foot of the tower, a lit window each. */
  private drawCottage(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    if (m.cottageWindows === 0) return;
    const ctx = this.ctx;
    const cw = Math.max(44, g.W * 0.07);
    const ch = cw * 0.55;
    const x = g.lx + g.wb + 6;
    const y = g.base - g.H * 0.035 - ch;
    ctx.fillStyle = "#18263a";
    ctx.fillRect(x, y, cw, ch);
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + cw / 2, y - ch * 0.6);
    ctx.lineTo(x + cw + 5, y);
    ctx.closePath();
    ctx.fillStyle = "#101a29";
    ctx.fill();
    const ww = cw / 9;
    for (let i = 0; i < m.cottageWindows; i++) {
      const wx = x + ww * (1 + i * 2);
      const flick = 0.85 + 0.15 * Math.sin(t * 3 + i * 2);
      ctx.fillStyle = `rgba(255,205,120,${flick.toFixed(3)})`;
      ctx.fillRect(wx, y + ch * 0.35, ww, ch * 0.32);
      this.glow(wx + ww / 2, y + ch * 0.5, 14, "255,196,99", 0.35 * flick);
    }
  }

  /** Storm lanterns: hung on posts along a little jetty into the glass. */
  private drawJetty(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    if (m.stormLanterns === 0) return;
    const ctx = this.ctx;
    const x0 = g.W * 0.4;
    const x1 = g.W * 0.62;
    const y = g.H * 0.9;
    ctx.fillStyle = "#14202f";
    ctx.fillRect(x0, y, x1 - x0, 5);
    for (let i = 0; i < m.stormLanterns; i++) {
      const px = x0 + ((i + 0.5) / 6) * (x1 - x0);
      ctx.fillStyle = "#14202f";
      ctx.fillRect(px - 1.5, y - 24, 3, 28);
      const sway = Math.sin(t * 1.8 + i) * (this.model?.tide === "storm" ? 4 : 1.5);
      const ly = y - 22;
      ctx.strokeStyle = "#2a3a50";
      ctx.beginPath();
      ctx.moveTo(px, ly - 2);
      ctx.lineTo(px + sway, ly + 6);
      ctx.stroke();
      this.glow(px + sway, ly + 9, 16, "255,190,110", 0.7);
      ctx.fillStyle = "#ffd894";
      ctx.fillRect(px + sway - 2.5, ly + 6, 5, 6);
    }
  }

  /** Tide bells: buoys bobbing on the sea, ringing a glint now and then. */
  private drawBells(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    const ctx = this.ctx;
    for (let i = 0; i < m.bells; i++) {
      const slot = BELL_SLOTS[i];
      const x = slot.x * g.W;
      const y = g.horizon + slot.d * (g.H - g.horizon) + Math.sin(t * 1.2 + slot.ph) * 2.5;
      const s = 0.6 + slot.d * 0.8;
      ctx.fillStyle = "#2b2f3a";
      ctx.beginPath();
      ctx.ellipse(x, y, 7 * s, 2.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a6a3a";
      ctx.beginPath();
      ctx.moveTo(x - 4 * s, y);
      ctx.quadraticCurveTo(x - 4 * s, y - 10 * s, x, y - 11 * s);
      ctx.quadraticCurveTo(x + 4 * s, y - 10 * s, x + 4 * s, y);
      ctx.fill();
      const ring = Math.max(0, Math.sin(t * 0.9 + slot.ph * 3));
      if (ring > 0.92) this.glow(x, y - 6 * s, 14 * s, "255,226,166", (ring - 0.92) * 8);
    }
  }

  /** Memory ships: pale sails on the horizon, a lantern at each stern, rocking home. */
  private drawShips(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    const ctx = this.ctx;
    for (let i = 0; i < m.ships; i++) {
      const slot = SHIP_SLOTS[i];
      const x = (slot.x + Math.sin(t * slot.drift * 6 + slot.ph) * 0.012) * g.W;
      const y = g.horizon + 2;
      const s = slot.scale * (g.H / 600);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.8 + slot.ph) * 0.04);
      ctx.globalAlpha = 0.55; // mostly memory
      ctx.fillStyle = "#1b2d45";
      ctx.beginPath();
      ctx.moveTo(-16 * s, 0);
      ctx.lineTo(16 * s, 0);
      ctx.lineTo(11 * s, 5 * s);
      ctx.lineTo(-11 * s, 5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#cfd9ea";
      ctx.beginPath();
      ctx.moveTo(-1 * s, -2 * s);
      ctx.lineTo(-1 * s, -24 * s);
      ctx.lineTo(11 * s, -3 * s);
      ctx.closePath();
      ctx.moveTo(-3 * s, -4 * s);
      ctx.lineTo(-3 * s, -19 * s);
      ctx.lineTo(-12 * s, -4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      const flick = 0.75 + 0.25 * Math.sin(t * 5 + slot.ph);
      this.glow(x + 13 * s, y - 2 * s, 12 * s, "255,196,99", 0.55 * flick);
    }
  }

  /** Beacon whales: surfacing slowly, a glowing spout on each breath. */
  private drawWhales(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    const ctx = this.ctx;
    for (let i = 0; i < m.whales; i++) {
      const slot = WHALE_SLOTS[i];
      const phase = ((t + slot.off) % slot.period) / slot.period; // 0..1
      if (phase > 0.35) continue;
      const rise = Math.sin((phase / 0.35) * Math.PI); // 0 → 1 → 0
      const x = slot.x * g.W;
      const y = g.horizon + (g.H - g.horizon) * 0.5;
      const len = 46 * (g.H / 600);
      ctx.fillStyle = "#1a2c44";
      ctx.beginPath();
      ctx.ellipse(x, y, len, len * 0.22 * rise, 0, Math.PI, 0);
      ctx.fill();
      if (rise > 0.6) this.glow(x - len * 0.4, y - len * 0.35 * rise, 22, "160,230,215", (rise - 0.6) * 1.6);
    }
  }

  private drawCrabs(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    const ctx = this.ctx;
    for (let i = 0; i < m.crabs; i++) {
      const slot = CRAB_SLOTS[i];
      const x = (slot.x + Math.sin(t * slot.sp + slot.ph) * 0.01) * g.W;
      const y = g.base - g.H * 0.03 + Math.sin(slot.x * 23) * 5;
      ctx.fillStyle = "#7a2e22";
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e9dfc8";
      ctx.fillRect(x - 1, y - 9, 2, 6);
      const flick = 0.8 + 0.2 * Math.sin(t * 9 + slot.ph);
      this.glow(x, y - 10, 13 * flick, "255,220,150", 0.9);
    }
  }

  /** Lantern-moth generators as motes; collected duty moths larger, in their wings. */
  private drawMoths(m: SceneModel, t: number, g: ReturnType<SceneRenderer["geometry"]>): void {
    for (let i = 0; i < m.motes; i++) {
      const slot = MOTE_SLOTS[i];
      const a = slot.a + t * slot.sp;
      this.moth(g.lx + Math.cos(a) * slot.rx, g.lampY + Math.sin(a) * slot.ry, 2.4, "#ffe9b8", 0.3, t + i);
    }
    m.duty.forEach((d, i) => {
      const a = i * 2.09 + t * 0.45;
      const rx = 64 + i * 14;
      const x = g.lx + Math.cos(a) * rx;
      const y = g.lampY - 8 + Math.sin(a) * (30 + i * 6);
      this.moth(x, y, 3.6 + d.glow * 2, d.color, 0.35 + d.glow * 0.4, t * 1.1 + i);
      if (d.tier >= 4) this.sparkle(x, y - 8, 3, 0.4 + 0.4 * Math.sin(t * 4 + i));
    });
  }

  private moth(x: number, y: number, size: number, color: string, glowAlpha: number, phase: number): void {
    drawMoth(this.ctx, x, y, size, color, glowAlpha, phase, this.reducedMotion.matches);
  }

  private drawStorm(t: number, still: boolean): void {
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    ctx.fillStyle = "rgba(20,26,38,0.85)";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse((((i * 0.21 + t * 0.01) % 1.3) - 0.15) * W, H * (0.07 + (i % 3) * 0.05), W * 0.18, H * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(180,200,225,0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of RAIN) {
      const y = ((d.y + t * 0.9) % 1) * H;
      const x = d.x * W - y * 0.15;
      ctx.moveTo(x, y);
      ctx.lineTo(x - d.l * 0.3, y + d.l);
    }
    ctx.stroke();
    if (!still && Math.random() < 0.005) this.lightning = 1;
    if (this.lightning > 0) {
      ctx.fillStyle = `rgba(220,230,255,${(this.lightning * 0.3).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      this.lightning = Math.max(0, this.lightning - 0.08);
    }
  }

  private drawFlashEffects(g: ReturnType<SceneRenderer["geometry"]>): void {
    const ctx = this.ctx;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.r += 5;
      ring.life -= 0.025;
      if (ring.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(255,214,140,${(ring.life * 0.8).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(g.lx, g.lampY, ring.r, ring.r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = '500 15px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.y -= 0.8;
      f.life -= 0.016;
      if (f.life <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255,226,166,${f.life.toFixed(3)})`;
      ctx.fillText(f.text, f.x, f.y);
    }
  }
}
