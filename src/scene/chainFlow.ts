import { AnimatedCanvas, drawSweepingBeam, glow, seeded } from "./canvas";
import type { ChainFlowModel } from "./model";

// ── The chain, flowing (Lighthouses view) ────────────────────────────────────
// Wick → Oil → Lens → Beam drawn as stations joined by pipes. Each supply
// station shows a gauge of its own support against demand; what flows out of
// it is capped by the weakest station so far, so the pipe narrows and thins
// from the bottleneck on. The bottleneck itself glows coral and sputters. The
// Beam station throws a cone whose strength is the chain factor (25–100%).
//
// Visual scale is the square root of efficiency, so a 1% node is a thin
// trickle rather than invisible, while the shape stays honest.

const rand = seeded(733);
const PARTICLES = Array.from({ length: 90 }, () => ({ u: rand(), lane: rand() - 0.5, speed: 0.7 + rand() * 0.6 }));

const STATIONS = ["Wick", "Oil", "Lens", "Beam"] as const;

export class ChainFlowRenderer extends AnimatedCanvas {
  private model: ChainFlowModel | null = null;

  setModel(model: ChainFlowModel): void {
    this.model = model;
    this.redraw();
  }

  protected render(t: number): void {
    const m = this.model;
    if (!m) return;
    const ctx = this.ctx;
    const { w: W, h: H } = this;
    ctx.clearRect(0, 0, W, H);
    const midY = H * 0.5;
    const xs = STATIONS.map((_, i) => ((i + 0.5) / STATIONS.length) * W);
    const stationR = Math.min(26, H * 0.24, W * 0.05);
    const asleep = !m.unlocked;
    const vis = (e: number): number => Math.sqrt(Math.max(0, Math.min(1, e)));

    // Pipes and their flowing light, wick→oil, oil→lens, lens→beam.
    for (let i = 0; i < 3; i++) {
      const node = m.nodes[i];
      const flow = asleep ? 0.5 : vis(node.flow);
      const x0 = xs[i] + stationR;
      const x1 = xs[i + 1] - stationR;
      const thick = 3 + 9 * flow;
      ctx.fillStyle = "#0d1a2e";
      ctx.fillRect(x0, midY - 7, x1 - x0, 14);
      const grad = ctx.createLinearGradient(x0, 0, x1, 0);
      const rgb = !asleep && node.flow < 0.7 ? "255,160,110" : "255,206,120";
      grad.addColorStop(0, `rgba(${rgb},${(0.25 + 0.45 * flow).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${rgb},${(0.15 + 0.35 * flow).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x0, midY - thick / 2, x1 - x0, thick);
      // Particles: as many and as fast as the flow allows.
      const count = Math.round(PARTICLES.length / 3 * (asleep ? 0.2 : 0.1 + 0.9 * flow));
      for (let k = 0; k < count; k++) {
        const p = PARTICLES[i * 30 + (k % 30)];
        const u = (p.u + t * 0.25 * p.speed * (0.3 + flow)) % 1;
        const px = x0 + u * (x1 - x0);
        const py = midY + p.lane * thick * 0.7;
        ctx.fillStyle = `rgba(255,236,190,${(0.5 + 0.4 * flow).toFixed(3)})`;
        ctx.fillRect(px, py - 1, 2.5, 2);
      }
    }

    // Stations.
    STATIONS.forEach((name, i) => {
      const x = xs[i];
      const isBeam = i === 3;
      const node = isBeam ? null : m.nodes[i];
      const bottleneck = !asleep && node?.bottleneck;
      if (bottleneck) {
        const sputter = 0.6 + 0.4 * Math.sin(t * 9) * Math.sin(t * 4.3);
        glow(ctx, x, midY, stationR * 2.4, "255,127,99", 0.35 * sputter);
      } else if (!asleep) {
        glow(ctx, x, midY, stationR * 2, "255,196,99", isBeam ? 0.2 + 0.3 * m.chainFactor : 0.15);
      }
      ctx.fillStyle = "#11263a";
      ctx.strokeStyle = bottleneck ? "#ff7f63" : "#234560";
      ctx.lineWidth = bottleneck ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(x, midY, stationR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (node) {
        // Gauge: this node's own support against demand, filled from below.
        const level = asleep ? 1 : vis(node.efficiency);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, midY, stationR - 3, 0, Math.PI * 2);
        ctx.clip();
        const top = midY + (stationR - 3) - level * (stationR - 3) * 2;
        const wobble = asleep ? 0 : Math.sin(t * 2 + i) * 1.5;
        ctx.fillStyle = bottleneck ? "rgba(255,127,99,0.55)" : asleep ? "rgba(159,176,196,0.25)" : "rgba(255,196,99,0.55)";
        ctx.fillRect(x - stationR, top + wobble, stationR * 2, stationR * 2);
        ctx.restore();
      } else {
        // The lamp, and the beam it throws.
        const strength = asleep ? 1 : m.chainFactor;
        glow(ctx, x, midY, stationR * 1.2, "255,236,190", 0.5 + 0.5 * strength);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, 0, W - x, H);
        ctx.clip();
        const spread = H * (0.18 + Math.min(0.12, m.beamLevels * 0.004));
        // A steady beam out to the right, breathing a little.
        drawSweepingBeam(ctx, x, midY, 0.35 + Math.sin(t * 0.6) * 0.12, W - x, spread, 0.15 + 0.5 * strength);
        ctx.restore();
      }

      ctx.fillStyle = bottleneck ? "#ffc2b4" : asleep ? "#9fb0c4" : "#ffe2a6";
      ctx.font = '600 12px "Figtree", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(name.toUpperCase(), x, midY + stationR + 16);
    });
  }
}
