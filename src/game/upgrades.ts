import Decimal from "break_infinity.js";
import { EMBER_PRODUCTION_BONUS, GENERATORS, OFFLINE_RATE, litOfflineRateBonus } from "./config";
import { OFFLINE_RATE_HARD_CAP, emberHeartBonus, offlineRateBonus } from "./emberShop";
import { relicOfflineRateBonus } from "./expeditions";
import { formatNumber } from "./format";
import { addLog } from "./state";
import type { GameState } from "./types";

// ── Upgrades ─────────────────────────────────────────────────────────────────
// One-time purchases, defined as data. Three families:
//   generator — ×2 to one generator's production (two per generator)
//   click     — ×2 to the Flash the Beam click value (three tiers)
//   global    — keeper-wide effects (production, offline rate, Ember bonus)
// Most upgrades are lost on Rekindle; the two marked `permanent` are keeper
// knowledge and survive it.

export type UpgradeKind = "generator" | "click" | "global";

export type UnlockCondition =
  | { kind: "generator-owned"; generatorId: string; count: number }
  | { kind: "run-lifetime"; amount: number }
  | { kind: "total-generators"; count: number }
  | { kind: "all-time-lumen"; amount: number }
  | { kind: "embers"; count: number };

export interface UpgradeDef {
  id: string;
  name: string;
  kind: UpgradeKind;
  /** Plain-words effect, shown in the UI. */
  effect: string;
  /** Cost in Lumen. */
  cost: number;
  unlock: UnlockCondition;
  /** Permanent upgrades are keeper knowledge: they survive Rekindle. */
  permanent: boolean;
  /** Set for kind === "generator". */
  generatorId?: string;
}

// ── Effect constants ─────────────────────────────────────────────────────────
/** Keeper's Focus: all production ×1.25. */
export const KEEPERS_FOCUS_MULTIPLIER = 1.25;
/** Ember Resonance: each held Ember gives +3% instead of +2%. */
export const EMBER_RESONANCE_BONUS = 0.03;
/** Longer Wicks: offline earnings rate (up from OFFLINE_RATE = 50%). */
export const LONGER_WICKS_OFFLINE_RATE = 0.75;

// ── Per-generator upgrades: ×2 at 10 owned, ×2 again at 30 owned ────────────
// Cost is 40× the generator's base cost for the first, 240× for the second.
// (Tuned up from 25×/150× in the Sprint 1 balance pass: the greedy-bot sim
// reached the first Rekindle in 36.8 min, just under the 40-min floor —
// see docs/SPRINTS.md.)
const GENERATOR_UPGRADE_UNLOCKS = [10, 30] as const;
const GENERATOR_UPGRADE_COST_MULTIPLIERS = [40, 240] as const;

const GENERATOR_UPGRADE_NAMES: Record<string, readonly [string, string]> = {
  "candle-crab": ["Wax-Rich Diet", "Second Claw Lamp"],
  "lantern-moth": ["Powdered Moonlight", "Twin-Wing Glide"],
  "tide-bell": ["Salt-Cured Clapper", "Harbour Resonance"],
  "oil-keeper": ["Steady Hands", "The Long Trim"],
  "lens-polisher": ["Silk Sleeves", "Flawless Finish"],
  "storm-lantern": ["Gale-Proof Wick", "Lightning Crown"],
  "beacon-whale": ["Luminous Plankton", "Song of Deep Light"],
  "seventh-light": ["Become the Wick", "The Final Brightening"],
};

const GENERATOR_UPGRADES: readonly UpgradeDef[] = GENERATORS.flatMap((gen) =>
  ([0, 1] as const).map((tier) => ({
    id: `${gen.id}-u${tier + 1}`,
    name: GENERATOR_UPGRADE_NAMES[gen.id]?.[tier] ?? `${gen.name} Mastery ${tier + 1}`,
    kind: "generator" as const,
    effect: `${gen.name} production ×2`,
    cost: gen.baseCost * GENERATOR_UPGRADE_COST_MULTIPLIERS[tier],
    unlock: {
      kind: "generator-owned" as const,
      generatorId: gen.id,
      count: GENERATOR_UPGRADE_UNLOCKS[tier],
    },
    permanent: false,
    generatorId: gen.id,
  })),
);

// ── Click upgrades: each doubles the beam's click value (1 → 2 → 4 → 8) ───
const CLICK_UPGRADES: readonly UpgradeDef[] = [
  {
    id: "click-1",
    name: "Polished Hand-Lens",
    kind: "click",
    effect: "Flash the Beam click value ×2",
    cost: 400,
    unlock: { kind: "run-lifetime", amount: 500 },
    permanent: false,
  },
  {
    id: "click-2",
    name: "Keeper's Rhythm",
    kind: "click",
    effect: "Flash the Beam click value ×2",
    cost: 20_000,
    unlock: { kind: "run-lifetime", amount: 25_000 },
    permanent: false,
  },
  {
    id: "click-3",
    name: "Storm-Focusing Grip",
    kind: "click",
    effect: "Flash the Beam click value ×2",
    cost: 800_000,
    unlock: { kind: "run-lifetime", amount: 1_000_000 },
    permanent: false,
  },
];

// ── Global upgrades ──────────────────────────────────────────────────────────
const GLOBAL_UPGRADES: readonly UpgradeDef[] = [
  {
    id: "keepers-focus",
    name: "Keeper's Focus",
    kind: "global",
    effect: "All production +25%",
    cost: 100_000, // tuned up from 50,000 in the Sprint 1 balance pass
    unlock: { kind: "total-generators", count: 50 },
    permanent: false,
  },
  {
    id: "longer-wicks",
    name: "Longer Wicks",
    kind: "global",
    effect: "Offline earnings rise from 50% to 75% of your production rate",
    cost: 250_000,
    unlock: { kind: "all-time-lumen", amount: 2_000_000 },
    permanent: true,
  },
  {
    id: "ember-resonance",
    name: "Ember Resonance",
    kind: "global",
    effect: "Each Ember held gives +3% production instead of +2%",
    cost: 5_000_000,
    unlock: { kind: "embers", count: 10 },
    permanent: true,
  },
];

export const UPGRADES: readonly UpgradeDef[] = [
  ...GENERATOR_UPGRADES,
  ...CLICK_UPGRADES,
  ...GLOBAL_UPGRADES,
];

export function upgradeById(id: string): UpgradeDef {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) throw new Error(`Unknown upgrade id: ${id}`);
  return def;
}

// ── Unlocks ──────────────────────────────────────────────────────────────────

export function totalGeneratorsOwned(state: GameState): number {
  let total = 0;
  for (const id of Object.keys(state.generators)) total += state.generators[id] ?? 0;
  return total;
}

export function isUnlocked(state: GameState, def: UpgradeDef): boolean {
  const u = def.unlock;
  switch (u.kind) {
    case "generator-owned":
      return (state.generators[u.generatorId] ?? 0) >= u.count;
    case "run-lifetime":
      return state.lifetimeLumen.gte(u.amount);
    case "total-generators":
      return totalGeneratorsOwned(state) >= u.count;
    case "all-time-lumen":
      return state.allTimeLumen.gte(u.amount);
    case "embers":
      return state.embers >= u.count;
  }
}

/** Human-readable unlock condition, shown on silhouetted (locked) upgrades. */
export function unlockText(def: UpgradeDef): string {
  const u = def.unlock;
  switch (u.kind) {
    case "generator-owned": {
      const gen = GENERATORS.find((g) => g.id === u.generatorId);
      return `Own ${u.count} × ${gen?.name ?? u.generatorId}`;
    }
    case "run-lifetime":
      return `Earn ${formatNumber(u.amount)} lifetime Lumen in one run`;
    case "total-generators":
      return `Own ${u.count} generators in total`;
    case "all-time-lumen":
      return `Earn ${formatNumber(u.amount)} all-time Lumen`;
    case "embers":
      return `Hold ${u.count} Embers`;
  }
}

// ── Ownership & effects ──────────────────────────────────────────────────────

export function hasUpgrade(state: GameState, id: string): boolean {
  return state.upgrades.includes(id);
}

export function isPermanentUpgrade(id: string): boolean {
  const def = UPGRADES.find((u) => u.id === id);
  return def?.permanent ?? false;
}

/** Production multiplier one generator gets from its own upgrades (×2 each). */
export function generatorUpgradeMultiplier(state: GameState, generatorId: string): number {
  let mult = 1;
  for (const def of UPGRADES) {
    if (def.kind === "generator" && def.generatorId === generatorId && hasUpgrade(state, def.id)) {
      mult *= 2;
    }
  }
  return mult;
}

/** Click value multiplier from click upgrades (×2 each: 1 → 2 → 4 → 8). */
export function clickMultiplier(state: GameState): number {
  let mult = 1;
  for (const def of UPGRADES) {
    if (def.kind === "click" && hasUpgrade(state, def.id)) mult *= 2;
  }
  return mult;
}

/** Keeper's Focus: ×1.25 to everything, or ×1 without it. */
export function globalProductionMultiplier(state: GameState): number {
  return hasUpgrade(state, "keepers-focus") ? KEEPERS_FOCUS_MULTIPLIER : 1;
}

/**
 * Production bonus per Ember held: +2% base, +3% with Ember Resonance,
 * and the Ember Heart perk (Sprint 3) adds a further +1% either way
 * (so 3% base, 4% with Resonance).
 */
export function emberBonusPerEmber(state: GameState): number {
  const base = hasUpgrade(state, "ember-resonance") ? EMBER_RESONANCE_BONUS : EMBER_PRODUCTION_BONUS;
  return base + emberHeartBonus(state);
}

/**
 * Offline earnings rate: 75% with Longer Wicks, else the base 50%; the
 * Full Reservoir perk (Sprint 3) adds +10 percentage points, the Keeper's
 * Coat relic (Sprint 4) +5 more, and Siren's Rest lit (Sprint 5) +10
 * more — all hard-capped at 90%.
 */
export function offlineRateFor(state: GameState): number {
  const base = hasUpgrade(state, "longer-wicks") ? LONGER_WICKS_OFFLINE_RATE : OFFLINE_RATE;
  return Math.min(
    OFFLINE_RATE_HARD_CAP,
    base + offlineRateBonus(state) + relicOfflineRateBonus(state) + litOfflineRateBonus(state.litLighthouses),
  );
}

// ── Buying ───────────────────────────────────────────────────────────────────

/**
 * Buy an upgrade. Returns true if the purchase happened.
 * Fails (false, no state change) when already owned, still locked, or
 * the player can't afford it.
 */
export function buyUpgrade(state: GameState, id: string): boolean {
  const def = upgradeById(id);
  if (hasUpgrade(state, id)) return false;
  if (!isUnlocked(state, def)) return false;
  const cost = new Decimal(def.cost);
  if (state.lumen.lt(cost)) return false;
  state.lumen = state.lumen.sub(cost);
  state.upgrades.push(id);
  addLog(state, `Upgrade learned: ${def.name} — ${def.effect}.`);
  return true;
}
