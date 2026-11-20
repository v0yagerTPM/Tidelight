import { AnimatedCanvas, drawSweepingBeam, drawTower, glow, seeded } from "./canvas";
import type { CoastModel } from "./model";

// ── The coast panorama (Lighthouses view) ────────────────────────────────────
// All seven lighthouses along the shore of the Hollow Sea, nearest (First
// Light) to farthest (The Hollow Light, on the horizon). Lit towers burn and
// sweep their beams; the next dark one waits behind a ring that fills as its
// gates come within reach; the rest are cold silhouettes. A path of light runs
// across the glass from each lit tower to the next, and the three waymarks
// of the Crossing stand on the last stretch of it.
//
// Positions are shared with main.ts, which lays clickable labels over the
// towers (so the panorama is keyboard- and screen-reader-usable).

export interface CoastSlot {
  /** Horizontal centre, 0–1 of width. */
  x: number;
  /** Foot of the tower, 0–1 of height. */
  base: number;
  /** Tower height, 0–1 of height. */
  height: number;
  /** Half-width at the foot, 0–1 of height. */
  halfWidth: number;
}

export const COAST_HORIZON = 0.52;

export const COAST_LAYOUT: readonly CoastSlot[] = [
  { x: 0.08, base: 0.9, height: 0.58, halfWidth: 0.045 }, // First Light, nearest
  { x: 0.22, base: 0.83, height: 0.42, halfWidth: 0.04 }, // Gull Rock: squat
  { x: 0.35, base: 0.77, height: 0.42, halfWidth: 0.024 }, // Cormorant Roost: tall, narrow
  { x: 0.48, base: 0.715, height: 0.26, halfWidth: 0.03 }, // Widow's Walk
  { x: 0.61, base: 0.665, height: 0.25, halfWidth: 0.024 }, // The Bellwether
  { x: 0.74, base: 0.615, height: 0.15, halfWidth: 0.024 }, // Siren's Rest: low
  { x: 0.89, base: 0.575, height: 0.26, halfWidth: 0.02 }, // The Hollow Light, on the horizon
];

const rand = seeded(4021);
const STARS = Array.from({ length: 90 }, () => ({ x: rand(), y: rand() * 0.48, s: rand() * 1.2 + 0.3, p: rand() * 6.283 }));

export class CoastRenderer extends AnimatedCanvas {
  private model: CoastModel | null = null;
  private selectedId = "";

  setModel(model: CoastModel, selectedId: string): void {
    this.model = model;
    this.selectedId = selectedId;
    this.redraw();
  }

  protected render(t: number): void {
    const m = this.model;
    if (!m) return;
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    const horizon = H * COAST_HORIZON;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#050b18");
    sky.addColorStop(1, "#17324c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 1);
    for (const s of STARS) {
      ctx.fillStyle = `rgba(233,230,220,${(0.6 * (0.55 + 0.45 * Math.sin(t * 1.2 + s.p))).toFixed(3)})`;
      ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
    }

    const sea = ctx.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, m.seaIsWater ? "#1d4a66" : "#132b42");
    sea.addColorStop(1, m.seaIsWater ? "#08172a" : "#070f1c");
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, W, H - horizon);
    for (let i = 0; i < 14; i++) {
      const y = horizon + Math.pow(i / 14, 1.5) * (H - horizon);
      ctx.strokeStyle = `rgba(143,214,196,${(0.05 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.9))).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // The path of light across the glass: lit → lit, and a dashed reach to the next.
    const points = COAST_LAYOUT.map((slot) => ({ x: slot.x * W, y: slot.base * H }));
    for (let i = 1; i < m.towers.length; i++) {
      const tower = m.towers[i];
      if (!tower.lit && !tower.isNext) break;
      const a = points[i - 1];
      const b = points[i];
      ctx.save();
      ctx.lineWidth = tower.lit ? 2 : 1.5;
      if (tower.lit) {
        ctx.strokeStyle = "rgba(255,206,120,0.45)";
      } else {
        ctx.strokeStyle = `rgba(255,206,120,${(0.15 + 0.3 * tower.readiness).toFixed(3)})`;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -t * 12;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, Math.max(a.y, b.y) + H * 0.04, b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    // The Crossing: three waymarks on the path from Siren's Rest out to The
    // Hollow Light. Lit ones burn; the next one pulses inside a ring that
    // fills as its gates come near; the rest are cold silhouettes.
    if (m.waymarks.length > 0 && points.length >= 2) {
      const a = points[points.length - 2];
      const b = points[points.length - 1];
      const cx = (a.x + b.x) / 2;
      const cy = Math.max(a.y, b.y) + H * 0.04;
      m.waymarks.forEach((wm, i) => {
        // Along the same curve the path of light follows, clear of the
        // Hollow Light's label at the far end.
        const u = 0.14 + (0.4 * i) / Math.max(1, m.waymarks.length - 1);
        const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * cx + u * u * b.x;
        const y = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * cy + u * u * b.y;
        const r = Math.max(2, H * 0.008);
        // A post on the glass, and its lantern.
        ctx.strokeStyle = wm.lit ? "rgba(255,206,120,0.6)" : "rgba(120,140,160,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - r * 3);
        ctx.stroke();
        const ly = y - r * 3.6;
        if (wm.lit) {
          glow(ctx, x, ly, r * 7, "255,196,99", 0.55 + 0.1 * Math.sin(t * 1.7 + i));
          ctx.fillStyle = "#ffe2a6";
        } else if (wm.isNext) {
          glow(ctx, x, ly, r * 6, "255,196,99", 0.08 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2)) * wm.readiness);
          ctx.fillStyle = "#3a4d63";
        } else {
          ctx.fillStyle = "#26364a";
        }
        ctx.beginPath();
        ctx.arc(x, ly, r, 0, Math.PI * 2);
        ctx.fill();
        if (wm.isNext) {
          const ringR = r * 3;
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(35,69,96,0.9)";
          ctx.beginPath();
          ctx.arc(x, ly, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,196,99,0.95)";
          ctx.beginPath();
          ctx.arc(x, ly, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * wm.readiness);
          ctx.stroke();
        }
      });
    }

    // Towers, farthest first so nearer ones overlap them.
    for (let i = m.towers.length - 1; i >= 0; i--) {
      const tower = m.towers[i];
      const slot = COAST_LAYOUT[i];
      const x = slot.x * W;
      const base = slot.base * H;
      const height = slot.height * H;
      const halfWidth = Math.max(4, slot.halfWidth * H);

      // The rock it stands on.
      ctx.fillStyle = "#0a111e";
      ctx.beginPath();
      ctx.ellipse(x, base + 2, halfWidth * 2.6, Math.max(4, halfWidth * 0.7), 0, Math.PI, 0);
      ctx.fill();

      if (tower.id === this.selectedId && tower.lit) {
        ctx.strokeStyle = "rgba(143,214,196,0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, base + 3, halfWidth * 2.9, Math.max(5, halfWidth * 0.85), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (tower.isNext) {
        // Waiting: a soft pulse and a ring that fills as the gates come near.
        const pulse = 0.5 + 0.5 * Math.sin(t * 2);
        glow(ctx, x, base - height * 0.6, height * 0.8, "255,196,99", 0.08 + 0.1 * pulse * tower.readiness);
      }
      const { lampX, lampY } = drawTower(ctx, { x, base, height, halfWidth, lit: tower.lit });
      if (tower.lit) {
        const r = height * 0.55;
        glow(ctx, lampX, lampY, r, "255,196,99", 0.7);
        drawSweepingBeam(ctx, lampX, lampY, t * 0.5 + i * 0.9, W * 0.18 * (1 - i * 0.07), height * 0.16, 0.38);
      }
      if (tower.isNext) {
        const ringR = Math.max(10, height * 0.18);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(35,69,96,0.9)";
        ctx.beginPath();
        ctx.arc(lampX, lampY, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,196,99,0.95)";
        ctx.beginPath();
        ctx.arc(lampX, lampY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * tower.readiness);
        ctx.stroke();
      }
    }
  }
}
