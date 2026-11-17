import Decimal from "break_infinity.js";
import {
  CLICK_LUMEN,
  GENERATORS,
  MILESTONE_THRESHOLDS,
  OFFLINE_CAP_SECONDS,
  generatorById,
  milestoneMultiplier,
  type GeneratorDef,
} from "./config";
import { addLog } from "./state";
import type { BuyAmount, GameState } from "./types";
import {
  clickMultiplier,
  emberBonusPerEmber,
  generatorUpgradeMultiplier,
  globalProductionMultiplier,
  offlineRateFor,
} from "./upgrades";

// ── Costs ────────────────────────────────────────────────────────────────────

/** Cost of the next copy: ceil(baseCost × growth ^ owned). */
export function costFor(def: GeneratorDef, owned: number): Decimal {
  return new Decimal(def.baseCost).mul(new Decimal(def.growth).pow(owned)).ceil();
}

/**
 * Total cost of buying `count` copies starting from `owned`:
 * geometric series  b·r^k · (r^n − 1) / (r − 1),  rounded up.
 */
export function bulkCost(def: GeneratorDef, owned: number, count: number): Decimal {
  if (count <= 0) return new Decimal(0);
  const r = new Decimal(def.growth);
  const firstTerm = new Decimal(def.baseCost).mul(r.pow(owned));
  const series = r.pow(count).sub(1).div(r.sub(1));
  return firstTerm.mul(series).ceil();
}

/** How many copies `budget` can buy starting from `owned` (0 if none). */
export function maxAffordable(def: GeneratorDef, owned: number, budget: Decimal): number {
  if (budget.lt(costFor(def, owned))) return 0;
  // Invert the bulk formula: n = floor( log_r( budget·(r−1) / (b·r^k) + 1 ) )
  const r = def.growth;
  const inside = budget
    .mul(r - 1)
    .div(new Decimal(def.baseCost).mul(new Decimal(r).pow(owned)))
    .add(1);
  const n = Math.floor(inside.log10() / Math.log10(r));
  // Correct any floating-point wobble at the boundary.
  let count = Math.max(0, n);
  while (count > 0 && bulkCost(def, owned, count).gt(budget)) count--;
  while (bulkCost(def, owned, count + 1).lte(budget)) count++;
  return count;
}

// ── Production ───────────────────────────────────────────────────────────────

/** Global multiplier from held Embers: +2% each (+3% with Ember Resonance). */
export function emberMultiplier(state: GameState): Decimal {
  return new Decimal(1 + state.embers * emberBonusPerEmber(state));
}

/**
 * Lumen/s a generator type would produce at a given ownership count,
 * including milestones, its own upgrades, Keeper's Focus, and Ember bonus.
 */
export function productionForOwned(state: GameState, def: GeneratorDef, owned: number): Decimal {
  if (owned === 0) return new Decimal(0);
  return new Decimal(def.baseProduction)
    .mul(owned)
    .mul(milestoneMultiplier(owned))
    .mul(generatorUpgradeMultiplier(state, def.id))
    .mul(globalProductionMultiplier(state))
    .mul(emberMultiplier(state));
}

/** Lumen/s from one generator type at its current ownership. */
export function generatorProduction(state: GameState, def: GeneratorDef): Decimal {
  return productionForOwned(state, def, state.generators[def.id] ?? 0);
}

/** Total Lumen/s across all generators. */
export function productionPerSecond(state: GameState): Decimal {
  let total = new Decimal(0);
  for (const def of GENERATORS) total = total.add(generatorProduction(state, def));
  return total;
}

// ── Actions ──────────────────────────────────────────────────────────────────

function credit(state: GameState, amount: Decimal): void {
  state.lumen = state.lumen.add(amount);
  state.lifetimeLumen = state.lifetimeLumen.add(amount);
  state.allTimeLumen = state.allTimeLumen.add(amount);
}

/** Lumen gained per Flash the Beam click, including click upgrades. */
export function clickValue(state: GameState): Decimal {
  return new Decimal(CLICK_LUMEN).mul(clickMultiplier(state));
}

/** Flash the Beam: +click value in Lumen. */
export function clickBeam(state: GameState): void {
  credit(state, clickValue(state));
  state.totalClicks++;
}

/** Buy `count` copies of a generator. Returns true if the purchase happened. */
export function buyGenerator(state: GameState, id: string, count = 1): boolean {
  const def = generatorById(id);
  const owned = state.generators[id] ?? 0;
  const cost = bulkCost(def, owned, count);
  if (state.lumen.lt(cost)) return false;
  state.lumen = state.lumen.sub(cost);
  state.generators[id] = owned + count;
  state.totalGeneratorsBought += count;
  if (count === 1 && (owned + 1 === 1 || (owned + 1) % 25 === 0)) {
    addLog(state, `${def.name} joins the light. (${owned + 1} owned)`);
  }
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (owned < threshold && owned + count >= threshold) {
      addLog(state, `Milestone: ${threshold} × ${def.name} — its production doubles.`);
    }
  }
  return true;
}

// ── Buy amounts (×1 / ×10 / ×100 / Max) ─────────────────────────────────────

export interface BuyQuote {
  /** Copies this purchase would buy (for Max: how many are affordable). */
  count: number;
  /** Total Lumen cost of those copies. */
  cost: Decimal;
  /** True when the player can pay `cost` right now. */
  affordable: boolean;
  /** Extra Lumen/s the purchase would add. */
  productionGain: Decimal;
}

/**
 * What a buy at the given amount setting would do right now.
 * Fixed amounts quote the full amount (cost of all ×10/×100, affordable only
 * when the whole batch is payable). Max quotes maxAffordable copies — or,
 * when even one copy is out of reach, the next single copy as the target.
 */
export function buyQuote(state: GameState, def: GeneratorDef, amount: BuyAmount): BuyQuote {
  const owned = state.generators[def.id] ?? 0;
  const current = productionForOwned(state, def, owned);
  if (amount === "max") {
    const count = maxAffordable(def, owned, state.lumen);
    if (count === 0) {
      return {
        count: 0,
        cost: costFor(def, owned),
        affordable: false,
        productionGain: productionForOwned(state, def, owned + 1).sub(current),
      };
    }
    return {
      count,
      cost: bulkCost(def, owned, count),
      affordable: true,
      productionGain: productionForOwned(state, def, owned + count).sub(current),
    };
  }
  const cost = bulkCost(def, owned, amount);
  return {
    count: amount,
    cost,
    affordable: state.lumen.gte(cost),
    productionGain: productionForOwned(state, def, owned + amount).sub(current),
  };
}

/**
 * Buy using a buy-amount setting. Fixed amounts buy exactly that many and
 * fail cleanly when the full batch is unaffordable; Max buys maxAffordable.
 */
export function buyWithAmount(state: GameState, id: string, amount: BuyAmount): boolean {
  const def = generatorById(id);
  const owned = state.generators[id] ?? 0;
  const count = amount === "max" ? maxAffordable(def, owned, state.lumen) : amount;
  if (count <= 0) return false;
  return buyGenerator(state, id, count);
}

/** Seconds until an arbitrary cost is affordable at current production. */
export function timeToAffordCost(state: GameState, cost: Decimal): number {
  const missing = cost.sub(state.lumen);
  if (missing.lte(0)) return 0;
  const rate = productionPerSecond(state);
  if (rate.lte(0)) return Infinity;
  return missing.div(rate).toNumber();
}

/** Seconds until a generator's next copy is affordable at current production. */
export function timeToAfford(state: GameState, def: GeneratorDef): number {
  const owned = state.generators[def.id] ?? 0;
  return timeToAffordCost(state, costFor(def, owned));
}

// ── Ticking & offline ────────────────────────────────────────────────────────

/** Advance the game by dt seconds. Returns the Lumen gained. */
export function tick(state: GameState, dtSeconds: number): Decimal {
  if (dtSeconds <= 0) return new Decimal(0);
  const gain = productionPerSecond(state).mul(dtSeconds);
  if (gain.gt(0)) credit(state, gain);
  state.playTimeSeconds += dtSeconds;
  return gain;
}

export interface OfflineResult {
  awaySeconds: number;
  creditedSeconds: number;
  gain: Decimal;
}

/**
 * What the player earned while away: rate × min(away, cap) × offline rate.
 * The offline rate is 50%, or 75% with the Longer Wicks upgrade.
 */
export function offlineEarnings(state: GameState, now: number = Date.now()): OfflineResult {
  const awaySeconds = Math.max(0, (now - state.lastSeen) / 1000);
  const creditedSeconds = Math.min(awaySeconds, OFFLINE_CAP_SECONDS);
  const gain = productionPerSecond(state).mul(creditedSeconds).mul(offlineRateFor(state));
  return { awaySeconds, creditedSeconds, gain };
}

/** Apply offline earnings (call once, right after loading a save). */
export function applyOfflineEarnings(state: GameState, now: number = Date.now()): OfflineResult {
  const result = offlineEarnings(state, now);
  if (result.gain.gt(0)) credit(state, result.gain);
  state.lastSeen = now;
  return result;
}
