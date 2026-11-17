// ── Tidelight balance simulation (not run in CI) ─────────────────────────────
// A greedy bot plays the current build: every simulated second it buys
// whichever affordable action has the best payback (cost ÷ production
// gain) — a generator copy or an upgrade — and it clicks the beam once per
// 2 seconds for the first 10 minutes only, like an engaged player who then
// goes idle. Sprint 2 additions: once the supply chain is unlocked, the bot
// keeps it fed — whenever efficiency drops under 95% it buys the
// bottleneck node's next level on the First Light board before generator
// purchases that step — and it relights Gull Rock the moment it's eligible.
// It reports how long the bot takes to reach the recommended first Rekindle
// threshold: 40 Embers = 8,000,000 run-lifetime Lumen.
//
// Run with:  npm run sim
import Decimal from "break_infinity.js";
import { FIRST_LIGHT_ID, GENERATORS, PRESTIGE_RECOMMENDED_EMBERS } from "../src/game/config";
import { buyNodeUpgrade, chainStatus, relightGullRock } from "../src/game/chain";
import {
  buyGenerator,
  clickBeam,
  clickValue,
  costFor,
  productionPerSecond,
  tick,
} from "../src/game/engine";
import { embersForLifetime } from "../src/game/prestige";
import { createInitialState } from "../src/game/state";
import type { GameState } from "../src/game/types";
import { UPGRADES, buyUpgrade, isUnlocked, upgradeById } from "../src/game/upgrades";

const TARGET_LIFETIME = new Decimal(8_000_000); // 40 Embers
const CLICK_WINDOW_SECONDS = 600; // clicking stops after 10 minutes
const CLICK_RATE = 0.5; // one click per 2 seconds while clicking
const MAX_SECONDS = 6 * 3600;

function productionWithGenerator(state: GameState, id: string): Decimal {
  state.generators[id] = (state.generators[id] ?? 0) + 1;
  const p = productionPerSecond(state);
  state.generators[id] = (state.generators[id] ?? 0) - 1;
  return p;
}

function productionWithUpgrade(state: GameState, id: string): Decimal {
  state.upgrades.push(id);
  const p = productionPerSecond(state);
  state.upgrades.pop();
  return p;
}

function clickWithUpgrade(state: GameState, id: string): Decimal {
  state.upgrades.push(id);
  const v = clickValue(state);
  state.upgrades.pop();
  return v;
}

interface Action {
  payback: number;
  run: () => boolean;
  label: string;
}

function bestAction(state: GameState, t: number): Action | null {
  const production = productionPerSecond(state);
  const clickRate = t < CLICK_WINDOW_SECONDS ? CLICK_RATE : 0;
  let best: Action | null = null;
  const consider = (payback: number, run: () => boolean, label: string) => {
    if (Number.isFinite(payback) && payback >= 0 && (best === null || payback < best.payback)) {
      best = { payback, run, label };
    }
  };

  for (const def of GENERATORS) {
    const owned = state.generators[def.id] ?? 0;
    const cost = costFor(def, owned);
    if (state.lumen.lt(cost)) continue;
    const gain = productionWithGenerator(state, def.id).sub(production);
    if (gain.lte(0)) continue;
    consider(cost.div(gain).toNumber(), () => buyGenerator(state, def.id, 1), `buy ${def.name}`);
  }

  for (const def of UPGRADES) {
    if (state.upgrades.includes(def.id)) continue;
    if (!isUnlocked(state, def)) continue;
    const cost = new Decimal(def.cost);
    if (state.lumen.lt(cost)) continue;
    const prodGain = productionWithUpgrade(state, def.id).sub(production);
    const clickGain = clickWithUpgrade(state, def.id).sub(clickValue(state)).mul(clickRate);
    const gain = prodGain.add(clickGain);
    if (gain.lte(0)) continue; // e.g. Longer Wicks: no value to an always-online bot
    consider(cost.div(gain).toNumber(), () => buyUpgrade(state, def.id), `buy upgrade ${def.name}`);
  }

  return best;
}

function main(): void {
  const state = createInitialState(0);
  state.lastSeen = 0;
  let t = 0;
  const upgradeLog: string[] = [];
  let gullRockAt: number | null = null;
  let nextReport = 0;

  while (state.lifetimeLumen.lt(TARGET_LIFETIME) && t < MAX_SECONDS) {
    // Buy phase: keep buying best-payback actions until none are worth it.
    for (let guard = 0; guard < 10_000; guard++) {
      // Sprint 2: relight Gull Rock the moment it's eligible (+50% forever).
      if (gullRockAt === null && relightGullRock(state)) {
        gullRockAt = t;
        continue;
      }
      // Sprint 2: feed the chain first — if efficiency sags under 95%, buy
      // the bottleneck node's next level (First Light board) when affordable,
      // before any generator purchase this step.
      const status = chainStatus(state);
      if (status.unlocked && status.efficiency < 0.95 && status.bottleneck) {
        if (buyNodeUpgrade(state, FIRST_LIGHT_ID, status.bottleneck)) continue;
      }
      const action = bestAction(state, t);
      if (!action) break;
      const before = state.upgrades.length;
      if (!action.run()) break;
      if (state.upgrades.length > before) {
        const id = state.upgrades[state.upgrades.length - 1];
        upgradeLog.push(`${(t / 60).toFixed(1)}m: ${upgradeById(id).name}`);
      }
    }
    // Click phase: engaged for the first 10 minutes only.
    if (t < CLICK_WINDOW_SECONDS && t % 2 === 0) clickBeam(state);
    tick(state, 1);
    t++;

    if (t >= nextReport) {
      const st = chainStatus(state);
      console.log(
        `t=${(t / 60).toFixed(0).padStart(3)}m  lifetime=${state.lifetimeLumen.toNumber().toFixed(0).padStart(9)}  ` +
          `prod/s=${productionPerSecond(state).toNumber().toFixed(1).padStart(9)}  ` +
          `eff=${st.unlocked ? `${Math.round(st.efficiency * 100)}%`.padStart(4) : "  — "}  ` +
          `gens=${Object.values(state.generators).reduce((a, b) => a + b, 0)}  upgrades=${state.upgrades.length}`,
      );
      nextReport = t + 600;
    }
  }

  const minutes = t / 60;
  const embers = embersForLifetime(state.lifetimeLumen);
  const finalStatus = chainStatus(state);
  console.log("\n── Simulation result ──────────────────────────────");
  console.log(`Time to ${TARGET_LIFETIME.toNumber().toLocaleString()} lifetime Lumen: ${minutes.toFixed(1)} minutes`);
  console.log(`Embers at stop: ${embers} (target ${PRESTIGE_RECOMMENDED_EMBERS})`);
  console.log(`Final production: ${productionPerSecond(state).toNumber().toFixed(1)} Lumen/s`);
  console.log(
    `Chain at stop: efficiency ${Math.round(finalStatus.efficiency * 100)}%, ` +
      `First Light board ${JSON.stringify(state.chainBoards[FIRST_LIGHT_ID])}, ` +
      `Gull Rock ${gullRockAt === null ? "never lit" : `lit at ${(gullRockAt / 60).toFixed(1)}m`}`,
  );
  console.log(`Generators owned: ${JSON.stringify(state.generators)}`);
  console.log(`Upgrades bought (${upgradeLog.length}):`);
  for (const line of upgradeLog) console.log(`  ${line}`);
  if (state.lifetimeLumen.lt(TARGET_LIFETIME)) {
    console.log("WARNING: target not reached within the 6-hour sim cap.");
    process.exitCode = 1;
  }
}

main();
