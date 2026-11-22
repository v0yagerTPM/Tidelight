import { AnimatedCanvas, drawMoth, glow, seeded, sparkle } from "./canvas";
import type { MeadowModel } from "./model";

// ── The Shore meadow ─────────────────────────────────────────────────────────
// The moth garden at night: a meadow running down to the glass sea, a lantern
// on a post where the duty moths circle, an old tree whose branch holds the
// cocoon, the rest of the collection wandering the grass in their own wing
// colours — and out on the glass, the bottle, drifting out along its route
// and home again, sparkling on the shingle once it has washed back.

const rand = seeded(9157);
const STARS = Array.from({ length: 80 }, () => ({ x: rand(), y: rand() * 0.42, s: rand() * 1.2 + 0.3, p: rand() * 6.283 }));
const GRASS = Array.from({ length: 90 }, () => ({ x: rand() * 0.62, h: 6 + rand() * 14, p: rand() * 6.283 }));
/** Each wandering moth gets a stable home spot and its own Lissajous path. */
function wanderSlot(id: string): { x: number; y: number; ax: number; ay: number; fx: number; fy: number; p: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const r = seeded(h >>> 0);
  return { x: 0.08 + r() * 0.45, y: 0.5 + r() * 0.28, ax: 0.03 + r() * 0.05, ay: 0.03 + r() * 0.06, fx: 0.15 + r() * 0.25, fy: 0.2 + r() * 0.3, p: r() * 6.283 };
}

export class MeadowRenderer extends AnimatedCanvas {
  private model: MeadowModel | null = null;

  setModel(model: MeadowModel): void {
    this.model = model;
    this.redraw();
  }

  protected render(t: number, _tms: number, still: boolean): void {
    const m = this.model;
    if (!m) return;
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    const horizon = H * 0.44;
    const shoreX = W * 0.6;

    // Sky and the glass sea beyond the meadow.
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#050b18");
    sky.addColorStop(1, "#17324c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 1);
    for (const s of STARS) {
      ctx.fillStyle = `rgba(233,230,220,${(0.65 * (0.55 + 0.45 * Math.sin(t * 1.3 + s.p))).toFixed(3)})`;
      ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
    }
    const sea = ctx.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, "#132b42");
    sea.addColorStop(1, "#08121f");
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, W, H - horizon);
    for (let i = 0; i < 12; i++) {
      const y = horizon + Math.pow(i / 12, 1.5) * (H - horizon);
      ctx.strokeStyle = `rgba(143,214,196,${(0.05 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.6))).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(shoreX - 40, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    this.drawBottle(m, t, horizon, shoreX);

    // The meadow: a rise of land from the left, its edge curving down to the shingle.
    ctx.fillStyle = "#0b1a1f";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.5);
    ctx.quadraticCurveTo(W * 0.3, H * 0.42, shoreX, H * 0.72);
    ctx.quadraticCurveTo(shoreX + W * 0.05, H * 0.86, shoreX + W * 0.02, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#16303a";
    ctx.lineWidth = 1.2;
    for (const g of GRASS) {
      const x = g.x * W;
      const groundY = this.groundY(x, H, shoreX);
      const sway = still ? 0 : Math.sin(t * 1.2 + g.p) * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, groundY + 2);
      ctx.quadraticCurveTo(x + sway * 0.5, groundY - g.h * 0.5, x + sway, groundY - g.h);
      ctx.stroke();
    }

    // The old tree, and the cocoon on its branch.
    const treeX = W * 0.1;
    const treeBase = this.groundY(treeX, H, shoreX);
    ctx.strokeStyle = "#0f2128";
    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(treeX, treeBase);
    ctx.quadraticCurveTo(treeX - 6, treeBase - H * 0.25, treeX + 4, H * 0.12);
    ctx.stroke();
    ctx.lineWidth = 3;
    const branchEnd = { x: treeX + W * 0.11, y: H * 0.2 };
    ctx.beginPath();
    ctx.moveTo(treeX + 1, H * 0.24);
    ctx.quadraticCurveTo(treeX + W * 0.06, H * 0.15, branchEnd.x, branchEnd.y);
    ctx.stroke();
    ctx.lineCap = "butt";
    // One cocoon per nest in use, hung along the branch from its tip inward.
    const branchAt = (u: number) => ({
      x: (1 - u) * (1 - u) * (treeX + 1) + 2 * (1 - u) * u * (treeX + W * 0.06) + u * u * branchEnd.x,
      y: (1 - u) * (1 - u) * (H * 0.24) + 2 * (1 - u) * u * (H * 0.15) + u * u * branchEnd.y,
    });
    m.cocoons.forEach((c, i) => {
      const p = branchAt(0.82 - i * 0.2);
      this.drawCocoon(c, t + i * 1.7, p.x, p.y - 2);
    });

    // The lantern post where duty moths keep watch.
    const lanternX = W * 0.36;
    const lanternGround = this.groundY(lanternX, H, shoreX);
    const lanternY = lanternGround - H * 0.3;
    ctx.fillStyle = "#0f2128";
    ctx.fillRect(lanternX - 2, lanternY, 4, lanternGround - lanternY);
    ctx.fillRect(lanternX - 2, lanternY, 14, 3);
    const lampX = lanternX + 12;
    const lampY = lanternY + 12;
    const anyDuty = m.moths.some((mo) => mo.duty);
    glow(ctx, lampX, lampY, anyDuty ? 70 : 34, "255,196,99", m.unlocked ? (anyDuty ? 0.6 : 0.35) : 0.1);
    ctx.fillStyle = m.unlocked ? "#ffd894" : "#3a3f48";
    ctx.fillRect(lampX - 4, lampY - 5, 8, 10);

    // The collection: duty moths circle the lantern, the rest wander the grass.
    let dutyIndex = 0;
    for (const moth of m.moths) {
      if (moth.inCocoon) continue; // both parents keep watch over the cocoon
      let x: number;
      let y: number;
      if (moth.duty) {
        const a = dutyIndex * 2.09 + t * 0.6;
        x = lampX + Math.cos(a) * (26 + dutyIndex * 8);
        y = lampY + Math.sin(a) * (14 + dutyIndex * 4);
        dutyIndex++;
      } else {
        const slot = wanderSlot(moth.id);
        x = (slot.x + Math.sin(t * slot.fx + slot.p) * slot.ax) * W;
        y = (slot.y + Math.sin(t * slot.fy + slot.p * 1.7) * slot.ay) * H;
      }
      drawMoth(ctx, x, y, 3 + moth.glow * 2.2, moth.color, 0.2 + moth.glow * 0.45, t * 1.1 + x, still);
      if (moth.tier >= 4) sparkle(ctx, x, y - 9, 3, 0.4 + 0.4 * Math.sin(t * 4 + y));
    }
    // Cocoon parents hover near the branch.
    m.moths
      .filter((mo) => mo.inCocoon)
      .forEach((moth, i) => {
        const a = i * Math.PI + t * 0.8;
        const x = branchEnd.x - W * 0.025 + Math.cos(a) * 22;
        const y = branchEnd.y + 22 + Math.sin(a) * 9;
        drawMoth(ctx, x, y, 3 + moth.glow * 2, moth.color, 0.25 + moth.glow * 0.4, t + i, still);
      });

    if (!m.unlocked) {
      ctx.fillStyle = "rgba(5,11,22,0.45)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** The meadow's surface height at x (matches the land's curve closely enough for grass). */
  private groundY(x: number, H: number, shoreX: number): number {
    const u = Math.min(1, x / shoreX);
    // Quadratic Bézier from (0, 0.5H) via (0.3W, 0.42H) to (shoreX, 0.72H), sampled by u.
    const y0 = H * 0.5;
    const y1 = H * 0.42;
    const y2 = H * 0.72;
    return (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * y1 + u * u * y2;
  }

  private drawCocoon(c: MeadowModel["cocoons"][number], t: number, x: number, y: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(233,230,220,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    const shake = c.ready ? Math.sin(t * 18) * 0.12 : Math.sin(t * 0.8) * 0.05;
    const pulse = 0.5 + 0.5 * Math.sin(t * (c.ready ? 4 : 1.5));
    glow(ctx, x, y + 20, 26, "255,214,160", 0.15 + 0.35 * c.progress * (0.6 + 0.4 * pulse));
    ctx.save();
    ctx.translate(x, y + 10);
    ctx.rotate(shake);
    ctx.fillStyle = "#e9dcc0";
    ctx.beginPath();
    ctx.ellipse(0, 11, 6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(160,140,110,0.6)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-6, 4 + i * 4.5);
      ctx.quadraticCurveTo(0, 6 + i * 4.5, 6, 3 + i * 4.5);
      ctx.stroke();
    }
    ctx.restore();
    if (c.ready) sparkle(ctx, x + 10, y + 8, 4, 0.5 + 0.5 * pulse);
  }

  private drawBottle(m: MeadowModel, t: number, horizon: number, shoreX: number): void {
    const b = m.bottle;
    if (!b) return;
    const { w: W, h: H } = this;
    const shore = { x: shoreX + W * 0.06, y: H * 0.86 };
    // Out along a bearing toward the horizon, as far as the route reaches, then home.
    const far = { x: W * (0.78 + 0.16 * b.reach), y: horizon + (H - horizon) * (0.32 - 0.26 * b.reach) };
    const leg = b.ready ? 0 : b.progress < 0.5 ? b.progress * 2 : (1 - b.progress) * 2;
    const x = shore.x + (far.x - shore.x) * leg;
    const y = shore.y + (far.y - shore.y) * leg + Math.sin(t * 1.6) * 1.5;
    const scale = 1 - 0.6 * leg;
    const ctx = this.ctx;
    // A faint wake behind it.
    ctx.strokeStyle = "rgba(143,214,196,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shore.x, shore.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    glow(ctx, x, y, 18 * scale, "160,230,215", b.ready ? 0.6 : 0.35);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5 + Math.sin(t * 1.2) * 0.12);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(143,214,196,0.75)";
    ctx.fillRect(-7, -3, 12, 6);
    ctx.fillRect(5, -1.5, 4, 3);
    ctx.fillStyle = "#c79a5a";
    ctx.fillRect(9, -1.5, 2, 3);
    ctx.fillStyle = "rgba(255,236,190,0.9)";
    ctx.fillRect(-5, -1.5, 7, 3);
    ctx.restore();
    if (b.ready) {
      sparkle(ctx, x - 8, y - 10, 4, 0.5 + 0.5 * Math.sin(t * 3));
      sparkle(ctx, x + 10, y - 6, 3, 0.5 + 0.5 * Math.sin(t * 3 + 2));
    }
  }
}
