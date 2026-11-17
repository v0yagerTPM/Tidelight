import Decimal from "break_infinity.js";
import { FIRST_LIGHT_ID, GENERATORS } from "./config";
import { buyNodeUpgrade, chainStatus, relightGullRock } from "./chain";
import { buyGenerator, clickValue, costFor, productionPerSecond } from "./engine";
import type { GameState } from "./types";
import { UPGRADES, buyUpgrade, isUnlocked } from "./upgrades";

// ── The greedy balance bot ───────────────────────────────────────────────────
// One shared playing strategy, used by scripts/simulate.ts (balance
// reports) and estimate.ts (the Rekindle recovery preview), so both always
// agree on what "greedy play" means:
//   • every step, buy whichever affordable action has the best payback
//     (cost ÷ production gain) — a generator copy or an upgrade;
//   • once the supply chain is unlocked, keep it fed first: whenever
//     efficiency drops under 95%, buy the bottleneck node's next level
//     on the First Light board before generator purchases that step;
//   • relight Gull Rock the moment it is eligible;
//   • click the beam once per 2 seconds for the first 10 minutes of a
//     run, like an engaged player who then goes idle (the clicking itself
//     is applied by the caller — this module only values it).

/** Clicking stops after this many seconds of a run. */
export const BOT_CLICK_WINDOW_SECONDS = 600;
/** Clicks per second while the bot is still clicking. */
export const BOT_CLICK_RATE = 0.5;

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

export interface BotAction {
  payback: number;
  run: () => boolean;
  label: string;
}

/** The single best-payback purchase available right now, or null. */
export function bestBotAction(state: GameState, tSeconds: number): BotAction | null {
  const production = productionPerSecond(state);
  const clickRate = tSeconds < BOT_CLICK_WINDOW_SECONDS ? BOT_CLICK_RATE : 0;
  let best: BotAction | null = null;
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

export interface BotHooks {
  /** Called with the upgrade id whenever the bot buys an upgrade. */
  onUpgradeBought?: (id: string) => void;
  /** Called with the sim-time when the bot relights Gull Rock. */
  onGullRockLit?: (tSeconds: number) => void;
}

/**
 * One buy phase: Gull Rock first, then chain feeding, then best-payback
 * purchases until nothing affordable is worth buying.
 */
export function botBuyPhase(state: GameState, tSeconds: number, hooks: BotHooks = {}): void {
  for (let guard = 0; guard < 10_000; guard++) {
    if (!state.litLighthouses.includes("gull-rock") && relightGullRock(state)) {
      hooks.onGullRockLit?.(tSeconds);
      continue;
    }
    const status = chainStatus(state);
    if (status.unlocked && status.efficiency < 0.95 && status.bottleneck) {
      if (buyNodeUpgrade(state, FIRST_LIGHT_ID, status.bottleneck)) continue;
    }
    const action = bestBotAction(state, tSeconds);
    if (!action) break;
    const before = state.upgrades.length;
    if (!action.run()) break;
    if (state.upgrades.length > before) {
      hooks.onUpgradeBought?.(state.upgrades[state.upgrades.length - 1]);
    }
  }
}
