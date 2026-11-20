import Decimal from "break_infinity.js";
import {
  CLICK_LUMEN,
  GENERATORS,
  GLASS_STAIR_BEAM_MULTIPLIER,
  MILESTONE_THRESHOLDS,
  effectiveEmbers,
  generatorById,
  milestoneMultiplier,
  type GeneratorDef,
} from "./config";
import { beamMultiplier, chainFactor, lighthouseMultiplier } from "./chain";
import {
  canBuyGenerator,
  challengeClickMultiplier,
  challengeProductionMultiplier,
  challengeTierMultiplier,
  checkChallengeCompletion,
} from "./challenges";
import { emberShopClickMultiplier, emberShopProductionMultiplier, offlineCapSeconds } from "./emberShop";
import { relicClickMultiplier, relicProductionMultiplier } from "./expeditions";
import { mothProductionMultiplier } from "./moths";
import { tidelitMultiplier, tidewiseMultiplier } from "./mothTraits";
import { legacyMultiplier } from "./ngplus";
import { addLog } from "./state";
import { tideClickMultiplier, tideProductionMultiplier } from "./tides";
import type { BuyAmount, GameState } from "./types";
import {
  clickMultiplier,
  emberBonusPerEmber,
  flashEchoShare,
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

/**
 * Global multiplier from held Embers: +2% each (+3% with Ember Resonance,
 * +1% more with Ember Heart), counted along EMBER_CURVE.
 */
export function emberMultiplier(state: GameState): Decimal {
  // Embers rest in the tin through a challenge run: it is a trial of the
  // keeper, not of the Embers (design review — with a million Embers held,
  // every challenge goal fell in its first second).
  if (state.activeChallenge !== null) return new Decimal(1);
  return new Decimal(1 + effectiveEmbers(state.embers) * emberBonusPerEmber(state));
}

/**
 * The production bonuses that outlast a run and weigh on the chain: held
 * Embers, Ember perks, the Next Keeping's legacy and lit lighthouses —
 * everything in base production except the generators themselves and
 * their per-run upgrades (the lamp's companions light the thrown beam and
 * never weigh on it: lampMultiplier). A Rekindle keeps all
 * of it, so it is exactly how much more a fresh run's first generators
 * demand of the chain than a new keeper's do. First Light's starting chain
 * is scaled by it (chain.ts, startingCushion).
 */
export function lastingProductionMultiplier(state: GameState): Decimal {
  return emberMultiplier(state).mul(lastingMultiplierBesideEmbers(state));
}

/**
 * The lasting bonuses other than held Embers: Ember perks, the Next
 * Keeping's legacy and lit lighthouses. What a challenge run keeps while
 * the Embers rest, and what its goal grows with (challenges.challengeGoal).
 */
export function lastingMultiplierBesideEmbers(state: GameState): Decimal {
  return new Decimal(emberShopProductionMultiplier(state))
    .mul(legacyMultiplier(state))
    .mul(lighthouseMultiplier(state));
}

/**
 * The lamp's companions: moths on duty, the Brass Compass relic, the
 * challenge lamps (Fog Lamps, Patient Keeper, and Fogbound's fog while it
 * lies) and the Glass Stair (the Crossing's second waymark). Like Beam levels and the tide they brighten the THROWN beam, after
 * the chain, so they never add to what the chain must carry.
 *
 * Why (design review): applied to the helpers' output, every one of them
 * raised the chain's demand as much as the production it gave, so the
 * chain took most of it back. In the sim, three glow-100 moths on duty from
 * the first minute (+60%) saved 2.5 of 47.5 hours and the Compass 0.2,
 * while the Tide Chart's +15% chain support saved 5.7.
 */
export function lampMultiplier(state: GameState): Decimal {
  return new Decimal(mothProductionMultiplier(state))
    .mul(relicProductionMultiplier(state))
    .mul(challengeProductionMultiplier(state))
    .mul(state.crossing >= 2 ? GLASS_STAIR_BEAM_MULTIPLIER : 1);
}

/**
 * Lumen/s a generator type would produce at a given ownership count.
 * Multiplier ordering (kept in one place — see also chain.ts):
 *   base × owned × milestones × its own upgrades × Humble Mastery (tiers 1–3)
 *   × Keeper's Focus × Ember bonus (held Embers) × Second Wind (Ember perk)
 *   × legacy bonus (Sprint 5: ×(1 + 0.25 × Keepings begun))
 * (Moths on duty, the Brass Compass and the challenge lamps light the
 * thrown beam instead: see lampMultiplier.)
 */
export function productionForOwned(state: GameState, def: GeneratorDef, owned: number): Decimal {
  if (owned === 0) return new Decimal(0);
  return new Decimal(def.baseProduction)
    .mul(owned)
    .mul(milestoneMultiplier(owned))
    .mul(generatorUpgradeMultiplier(state, def.id))
    .mul(challengeTierMultiplier(state, def.id))
    .mul(globalProductionMultiplier(state))
    .mul(emberMultiplier(state))
    .mul(emberShopProductionMultiplier(state))
    .mul(legacyMultiplier(state));
}

/** Lumen/s from one generator type at its current ownership. */
export function generatorProduction(state: GameState, def: GeneratorDef): Decimal {
  return productionForOwned(state, def, state.generators[def.id] ?? 0);
}

/**
 * Base production: the rate BEFORE the supply chain and beam bonus.
 * Ordering (documented here and in chain.ts):
 *   per-generator (see productionForOwned: milestones, upgrades, Humble
 *   Mastery, Keeper's Focus, Ember bonus, Second Wind, legacy bonus)
 *   × lighthouse production bonuses, multiplied together (Gull Rock ×1.5,
 *   Cormorant Roost ×1.75, The Hollow Light ×2.5 — ×6.5625 with all seven)
 * This base rate is the chain's "demand" — what wick/oil/lens must support.
 * The FULL final ordering is: base (above) × chain factor (0.25 + 0.75 ×
 * efficiency) × beam bonus (1 + 5% × Beam levels) × tide = final rate.
 */
export function baseProductionPerSecond(state: GameState): Decimal {
  let total = new Decimal(0);
  for (const def of GENERATORS) total = total.add(generatorProduction(state, def));
  return total.mul(lighthouseMultiplier(state));
}

/**
 * Final Lumen/s: base production × chain factor × beam bonus × the lamp's
 * companions (lampMultiplier: moths on duty, Brass Compass, challenge
 * lamps) × tide (× Tidewise moths on duty in High Tide or a Stormfront, × Tidelit moths
 * on duty in a Stormfront or Glass Calm).
 * The chain factor is 0.25 + 0.75 × efficiency once the chain is unlocked
 * (1 before that); the beam bonus is +5% per Beam level across all boards.
 * The tide multiplier (Sprint 4) applies only here, at the very end: the
 * tide acts on the thrown beam, never on what the keepers produce, so it
 * cannot inflate the chain's demand. `now` is optional — omit it (as the
 * sim, the recovery estimate and offline earnings do) and the tide is
 * neutral; the game loop passes Date.now().
 */
export function productionPerSecond(state: GameState, now?: number): Decimal {
  return baseProductionPerSecond(state)
    .mul(chainFactor(state, now))
    .mul(beamMultiplier(state))
    .mul(lampMultiplier(state))
    .mul(tideProductionMultiplier(state, now))
    .mul(tidewiseMultiplier(state, now))
    .mul(tidelitMultiplier(state, now));
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Credit earned Lumen: purse, run lifetime and all-time total all grow,
 * and a challenge completes the moment its lifetime goal is reached.
 * Exported so expeditions can pay their caches through the same path.
 */
export function creditLumen(state: GameState, amount: Decimal): void {
  state.lumen = state.lumen.add(amount);
  state.lifetimeLumen = state.lifetimeLumen.add(amount);
  state.allTimeLumen = state.allTimeLumen.add(amount);
  // A challenge completes the moment its lifetime goal is reached.
  if (amount.gt(0)) checkChallengeCompletion(state);
}

/**
 * Lumen gained per Flash the Beam click: click upgrades ×2 each,
 * Warm Lamp Oil (Ember perk) ×2, Salt Lens (relic) ×1.5, plus Flash Echo
 * (a share of a second's production); then Glass Calm tide ×2 (only when
 * `now` is passed) and Still Hands (challenge) ×0 apply to the whole flash.
 */
export function clickValue(state: GameState, now?: number): Decimal {
  let value = new Decimal(CLICK_LUMEN)
    .mul(clickMultiplier(state))
    .mul(emberShopClickMultiplier(state))
    .mul(relicClickMultiplier(state));
  const echo = flashEchoShare(state);
  if (echo > 0) value = value.add(productionPerSecond(state, now).mul(echo));
  return value.mul(challengeClickMultiplier(state)).mul(tideClickMultiplier(now));
}

/** Flash the Beam: +click value in Lumen. */
export function clickBeam(state: GameState, now?: number): void {
  creditLumen(state, clickValue(state, now));
  state.totalClicks++;
}

/** Buy `count` copies of a generator. Returns true if the purchase happened. */
export function buyGenerator(state: GameState, id: string, count = 1): boolean {
  const def = generatorById(id);
  // Challenge gating (First Light Only): tiers 4+ cannot be bought at all.
  if (!canBuyGenerator(state, id)) return false;
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

/**
 * Advance the game by dt seconds. Returns the Lumen gained.
 * `now` (ms) is optional: the game loop passes Date.now() so the live
 * tide applies; the sim and tests omit it and play tide-neutral.
 */
export function tick(state: GameState, dtSeconds: number, now?: number): Decimal {
  if (dtSeconds <= 0) return new Decimal(0);
  const gain = productionPerSecond(state, now).mul(dtSeconds);
  if (gain.gt(0)) creditLumen(state, gain);
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
 * The cap is 8h, or 12h with The Long Night (Ember perk), plus 4h more
 * with Siren's Rest lit (Sprint 5); the rate is 50%/75% (Longer Wicks)
 * + 10 points with Full Reservoir + 5 points with the Keeper's Coat relic
 * + 10 points with Siren's Rest lit, capped at 90%. The rate used is the
 * tide-NEUTRAL production: over hours away, tides average out (Sprint 4).
 */
export function offlineEarnings(state: GameState, now: number = Date.now()): OfflineResult {
  const awaySeconds = Math.max(0, (now - state.lastSeen) / 1000);
  const creditedSeconds = Math.min(awaySeconds, offlineCapSeconds(state));
  const gain = productionPerSecond(state).mul(creditedSeconds).mul(offlineRateFor(state));
  return { awaySeconds, creditedSeconds, gain };
}

/** Apply offline earnings (call once, right after loading a save). */
export function applyOfflineEarnings(state: GameState, now: number = Date.now()): OfflineResult {
  const result = offlineEarnings(state, now);
  if (result.gain.gt(0)) creditLumen(state, result.gain);
  state.lastSeen = now;
  return result;
}

// ── Real time while the page is open ────────────────────────────────────────

/**
 * Gaps longer than this between two live ticks are treated as time away.
 * Browsers throttle timers in background tabs (to once a second, and to
 * once a minute after ~5 minutes hidden), so a live tab can see gaps of
 * about a minute; those are still "online" and pay full rate. Anything
 * longer (a sleeping laptop, a long-suspended tab) pays exactly what a
 * closed tab would, through the offline rules.
 */
export const LIVE_GAP_LIMIT_SECONDS = 90;

export interface AdvanceResult {
  /** "live" — credited at full rate; "offline" — credited by the offline rules. */
  mode: "live" | "offline";
  gain: Decimal;
  /** Wall-clock seconds since the previous tick. */
  elapsedSeconds: number;
  /** Seconds the offline rules credited (offline mode only). */
  creditedSeconds: number;
}

/**
 * Advance a running game to wall-clock `now`, from `state.lastSeen` (which
 * this updates). Short gaps tick at full, tide-aware rate; long gaps go
 * through the offline-earnings path. The old loop clamped every tick to
 * one second, so a background tab throttled to one tick a minute earned
 * one second of production per minute — less than closing the tab.
 */
export function advanceToNow(state: GameState, now: number): AdvanceResult {
  const elapsedSeconds = Math.max(0, (now - state.lastSeen) / 1000);
  if (elapsedSeconds > LIVE_GAP_LIMIT_SECONDS) {
    const offline = applyOfflineEarnings(state, now);
    return { mode: "offline", gain: offline.gain, elapsedSeconds, creditedSeconds: offline.creditedSeconds };
  }
  const gain = tick(state, elapsedSeconds, now);
  state.lastSeen = now;
  return { mode: "live", gain, elapsedSeconds, creditedSeconds: 0 };
}
