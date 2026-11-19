// Balance tuning harness (not part of the game or CI). Applies the
// overrides in TUNE (JSON from the environment) to the config tables,
// runs the sim, and prints a one-line summary.
//   TUNE='{"s":[1.085,1.095,1.105],"gates":[0.5,0.6,0.6,0.7,0.75,0.8]}' npx vite-node scripts/tune.ts
import { CHAIN_LIGHTHOUSES, CHAIN_NODES } from "../src/game/config";
import { UPGRADES } from "../src/game/upgrades";
import { runSim } from "./simCore";

interface Tune {
  s?: [number, number, number];
  gates?: number[];
  base?: [number, number, number];
  /** Node base costs for wick, oil, lens. */
  cost?: [number, number, number];
  /** Relight costs for lighthouses 2–7. */
  relight?: number[];
  rk?: number;
}
const tune: Tune = JSON.parse(process.env.TUNE ?? "{}");
const nodes = [CHAIN_NODES.wick, CHAIN_NODES.oil, CHAIN_NODES.lens];
if (tune.s) nodes.forEach((n, i) => ((n as { supportGrowth: number }).supportGrowth = tune.s![i]));
if (tune.base) nodes.forEach((n, i) => ((n as { supportPerLevel: number }).supportPerLevel = tune.base![i]));
if (tune.cost) nodes.forEach((n, i) => ((n as { baseCost: number }).baseCost = tune.cost![i]));
if (tune.relight) {
  CHAIN_LIGHTHOUSES.slice(1).forEach((l, i) => {
    // Lighthouse lessons are priced off their lighthouse's relight cost: keep them in step.
    const ratio = tune.relight![i] / (l.relightCost ?? tune.relight![i]);
    for (const u of UPGRADES) {
      if (u.unlock.kind === "lighthouse-lit" && u.unlock.lighthouseId === l.id) (u as { cost: number }).cost *= ratio;
    }
    (l as { relightCost: number | null }).relightCost = tune.relight![i];
  });
}
if (tune.gates) {
  CHAIN_LIGHTHOUSES.slice(1).forEach((l, i) => ((l as { efficiencyRequirement: number }).efficiencyRequirement = tune.gates![i]));
}

const r = runSim({ verbose: process.env.VERBOSE === "1", rekindleGrowth: tune.rk });
const lit = CHAIN_LIGHTHOUSES.slice(1)
  .map((l) => (r.litAtHours[l.id] !== undefined ? r.litAtHours[l.id].toFixed(1) : "—"))
  .join("/");
console.log(
  `${JSON.stringify(tune)} → R1 ${r.firstRekindleMinutes?.toFixed(0)}m  R2 +${
    r.secondRekindleMinutes && r.firstRekindleMinutes ? (r.secondRekindleMinutes - r.firstRekindleMinutes).toFixed(0) : "—"
  }m  lit(h) ${lit}  END ${r.endingHours?.toFixed(1) ?? "—"}h  tier≤${r.highestTierOwned}  ` +
    `eff ${(r.meanEfficiencyEndgame * 100).toFixed(0)}%  starved ${(r.starvedShareEndgame * 100).toFixed(0)}%  stalls ${r.stalls}  rekindles ${r.rekindles}`,
);
if (process.env.CURVE === "1") {
  console.log("  log10 P by hour: " + Object.entries(r.curve).map(([h, v]) => `${h}h:${v.toFixed(1)}`).join(" "));
}
