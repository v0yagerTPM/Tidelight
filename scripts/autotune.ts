// Relight-cost search (balance tooling, not part of the game or CI). For
// each lighthouse in order, binary-search its relight cost (on a log scale)
// so the sim's bot lights it at the target hour, holding the earlier ones
// fixed and the later ones out of reach. Prints the costs it settles on.
//   TARGETS='[3,6,11,18,30,50]' npx vite-node scripts/autotune.ts
import { CHAIN_LIGHTHOUSES } from "../src/game/config";
import { runSim } from "./simCore";

const targets: number[] = JSON.parse(process.env.TARGETS ?? "[3,6,11,18,30,50]");
const lights = CHAIN_LIGHTHOUSES.slice(1) as { id: string; relightCost: number | null }[];
for (const l of lights) l.relightCost = 1e60;

for (let i = 0; i < lights.length; i++) {
  let lo = 6; // log10 bounds
  let hi = 40;
  let best = 0;
  for (let step = 0; step < 14; step++) {
    const mid = (lo + hi) / 2;
    lights[i].relightCost = Number((10 ** mid).toPrecision(2));
    const r = runSim();
    const at = r.litAtHours[lights[i].id];
    if (at === undefined || at > targets[i]) hi = mid;
    else lo = mid;
    best = lo;
  }
  lights[i].relightCost = Number((10 ** best).toPrecision(2));
  const r = runSim();
  console.log(`${lights[i].id}: cost ${lights[i].relightCost.toExponential(1)} → lit at ${r.litAtHours[lights[i].id]?.toFixed(1)}h (target ${targets[i]}h)`);
}
const r = runSim();
console.log(`ending ${r.endingHours?.toFixed(1)}h · R1 ${r.firstRekindleMinutes?.toFixed(0)}m · tier≤${r.highestTierOwned} · eff ${(r.meanEfficiencyEndgame * 100).toFixed(0)}% · stalls ${r.stalls}`);
console.log(`relight: ${JSON.stringify(lights.map((l) => l.relightCost))}`);
