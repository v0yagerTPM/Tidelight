// Relight-cost search (balance tooling, not part of the game or CI). For
// each lighthouse in order, binary-search its relight cost (on a log scale)
// so the sim's bot lights it at the target hour, holding the earlier ones
// fixed and the later ones out of reach. Each trial stops as soon as the
// lighthouse lights (or the target passes), and each settled cost is
// printed as soon as it's found.
//   TARGETS='[3,6,11,18,30,50]' npx vite-node scripts/autotune.ts
import { CHAIN_LIGHTHOUSES } from "../src/game/config";
import { runSim } from "./simCore";

const targets: number[] = JSON.parse(process.env.TARGETS ?? "[3,6,11,18,30,50]");
const lights = CHAIN_LIGHTHOUSES.slice(1) as { id: string; relightCost: number | null }[];
const start: number[] | null = process.env.START ? JSON.parse(process.env.START) : null;
for (const l of lights) l.relightCost = 1e60;
const from = start ? start.length : 0;
if (start) start.forEach((c, i) => (lights[i].relightCost = c));

for (let i = from; i < lights.length; i++) {
  const id = lights[i].id;
  let lo = Math.log10(i === 0 ? 1e5 : (lights[i - 1].relightCost as number));
  let hi = lo + 8;
  for (let step = 0; step < 11; step++) {
    const mid = (lo + hi) / 2;
    lights[i].relightCost = Number((10 ** mid).toPrecision(2));
    const r = runSim({ stopWhenLit: id, stopAfterHours: targets[i] + 0.01 });
    const at = r.litAtHours[id];
    if (at === undefined || at > targets[i]) hi = mid;
    else lo = mid;
  }
  lights[i].relightCost = Number((10 ** lo).toPrecision(2));
  const r = runSim({ stopWhenLit: id, stopAfterHours: targets[i] * 2 });
  console.log(`${id}: cost ${lights[i].relightCost.toExponential(1)} → lit at ${r.litAtHours[id]?.toFixed(1)}h (target ${targets[i]}h)`);
  console.log(`  so far: ${JSON.stringify(lights.slice(0, i + 1).map((l) => l.relightCost))}`);
}
