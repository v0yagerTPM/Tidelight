import Decimal from "break_infinity.js";
import { GULL_ROCK_ID, OFFLINE_CAP_SECONDS, chainLighthouseById, litOfflineCapBonusSeconds } from "./config";
import { SHORE_KINDLING_FACTOR } from "./almanac";
import { addLog } from "./state";
import type { GameState } from "./types";

// ── The Ember shop (Sprint 3) ────────────────────────────────────────────────
// Embers are spendable. Every perk here is a one-time purchase, paid for in
// HELD Embers — and held Embers are what grant the per-Ember production
// bonus, so every purchase trades an ongoing bonus for a permanent perk.
// That tension is the point. Perks are PERMANENT: they survive Rekindle
// and challenge resets, and are never lost.
//
// Effect wiring (each helper is called from the system it modifies):
//   head-start    → prestige.resetRun grants a starting purse of Lumen
//   warm-lamp     → engine.clickValue ×2
//   gull-friend   → chain.gullRockStatus relight cost halved
//   deep-wicks    → chain.totalSupport ×1.25 (both boards)
//   long-night    → engine offline cap 8h → 12h
//   full-lamp     → upgrades.offlineRateFor +10 points (hard cap 90%)
//   ember-heart   → upgrades.emberBonusPerEmber +1%/Ember
//   second-wind   → engine production ×1.5
// Late perks (post-launch, priced ×10 apart to meet Embers as they grow;
// the Quartermaster and Lamp Crew that once opened this shelf now come
// with Gull Rock and Cormorant Roost, automation.ts):
//   warm-hearth   → prestige.resetRun starts runs with 10 of the first three helpers
//   steward-ledger → supply.tendChain: the Steward's purse holds 30 min, not 10
//   storm-charts  → tides: a Stormfront's support ×0.8 becomes ×0.9
//   moth-lantern  → almanac.lureBankSize +1, moths.cocoonDurationMs ×0.75
//   ember-memory  → prestige.resetRun keeps every helper's first upgrade
//   glass-charts  → expeditions.voyageMs ×0.75 (bottles home sooner)
// Kindlings (repeatable; each level costs more than the last):
//   ember-glow    → engine production ×1.05 per level (10 levels)
//   long-watch    → offline cap +1 hour per level (8 levels)
//   quick-lures   → almanac.lureRegrowMs ×0.95 per level (20 levels)
//   spinning-silk → moths.cocoonDurationMs ×0.95 per level (20 levels)
//   tailwind      → expeditions.voyageMs ×0.95 per level (20 levels)
//
// A comfort shop, on purpose: every production boost here compounds (more
// production, bigger Rekindles, more Embers, more production), and the sim
// showed a shop of strong boosts cutting the game from 62 to 16–23 hours.
// Even keeping a tenth of the chain's levels through a Rekindle cut it by 13.
// So the Embers buy automation, time away and a faster Shore, and the only
// production Kindling is small and capped (see docs/SPRINTS.md).

export interface EmberPerkDef {
  id: string;
  name: string;
  /** Plain-words effect, shown in the UI. */
  effect: string;
  /** Cost in held Embers. */
  costEmbers: number;
  /** Which shelf of the shop it sits on. */
  shelf: "keeper" | "late";
}

export const HEAD_START_LUMEN = 1_000;
export const WARM_LAMP_CLICK_MULTIPLIER = 2;
export const GULL_FRIEND_COST_MULTIPLIER = 0.5;
export const DEEP_WICKS_SUPPORT_MULTIPLIER = 1.25;
export const LONG_NIGHT_CAP_SECONDS = 12 * 60 * 60;
export const FULL_LAMP_RATE_BONUS = 0.1;
/** Offline earnings rate can never exceed this, however bonuses stack. */
export const OFFLINE_RATE_HARD_CAP = 0.9;
export const EMBER_HEART_BONUS = 0.01;
export const SECOND_WIND_MULTIPLIER = 1.5;

const KEEPER_PERKS: readonly Omit<EmberPerkDef, "shelf">[] = [
  { id: "head-start",   name: "Head Start",      effect: "Every new run starts with 1,000 Lumen in hand.",                          costEmbers: 5 },
  { id: "warm-lamp",    name: "Warm Lamp Oil",   effect: "Flash the Beam click power ×2.",                                          costEmbers: 8 },
  { id: "gull-friend",  name: "Friend of Gulls", effect: "Relighting Gull Rock Light costs half as much Lumen.",                    costEmbers: 10 },
  { id: "deep-wicks",   name: "Deep Wicks",      effect: "Every supply-chain node supports +25% more production (both boards).",    costEmbers: 12 },
  { id: "long-night",   name: "The Long Night",  effect: "Offline earnings cap rises from 8 hours to 12 hours.",                    costEmbers: 20 },
  { id: "full-lamp",    name: "Full Reservoir",  effect: "Offline earnings rate +10 percentage points (hard cap 90%).",             costEmbers: 25 },
  { id: "ember-heart",  name: "Ember Heart",     effect: "Each Ember held gives +1% more production (+2% → +3%, or +3% → +4% with Ember Resonance).", costEmbers: 30 },
  { id: "second-wind",  name: "Second Wind",     effect: "All production +50%.",                                                    costEmbers: 40 },
];

export const WARM_HEARTH_HELPERS = 10;
/** Warm Hearth's crew: the first three helpers (Candle Crab, Lantern Moth, Tide Bell). */
export const WARM_HEARTH_TIERS = 3;
/** The Chain Steward's purse cap with the Steward's Ledger: ×3 (10 → 30 minutes). */
export const STEWARD_LEDGER_PURSE_MULTIPLIER = 3;
export const MOTH_LANTERN_COCOON_MULTIPLIER = 0.75;
export const GLASS_CHARTS_VOYAGE_MULTIPLIER = 0.75;

const LATE_PERKS: readonly Omit<EmberPerkDef, "shelf">[] = [
  { id: "warm-hearth",   name: "Warm Hearth",         effect: "Every new run starts with 10 Candle Crabs, 10 Lantern Moths and 10 Tide Bells.",           costEmbers: 50_000 },
  { id: "steward-ledger", name: "The Steward's Ledger", effect: "Your Chain Steward's purse holds 30 minutes of production instead of 10.", costEmbers: 500_000 },
  { id: "storm-charts",  name: "Storm Charts",        effect: "A Stormfront drains the chain half as hard (support ×0.9, not ×0.8).",    costEmbers: 5_000_000 },
  { id: "moth-lantern",  name: "Moth Lantern",        effect: "One more lure in the bank, and cocoons spin 25% faster.",                 costEmbers: 50_000_000 },
  { id: "ember-memory",  name: "Ember Memory",        effect: "Every helper's first upgrade is kept through a Rekindle.",                costEmbers: 500_000_000 },
  { id: "glass-charts",  name: "Glass Charts",        effect: "Bottles come home 25% sooner on every route.",                            costEmbers: 5_000_000_000 },
];

/**
 * Perks no longer sold, with what they cost: a save that owns one gets the
 * Embers back when it loads (state.ts), and keeps the effect wherever it
 * now comes from (the Quartermaster with Gull Rock, the Lamp Crew with
 * Cormorant Roost: automation.ts).
 */
export const RETIRED_PERKS: readonly { id: string; name: string; costEmbers: number }[] = [
  { id: "quartermaster", name: "Quartermaster", costEmbers: 500 },
  { id: "lamp-crew", name: "Lamp Crew", costEmbers: 5_000 },
];

export const EMBER_PERKS: readonly EmberPerkDef[] = [
  ...KEEPER_PERKS.map((p) => ({ ...p, shelf: "keeper" as const })),
  ...LATE_PERKS.map((p) => ({ ...p, shelf: "late" as const })),
];

// ── Kindlings: repeatable perks ──────────────────────────────────────────────
// Each level costs `growth` times the last, so there is always one just out
// of reach, and buying one is always a trade against the held-Ember bonus.

export interface KindlingDef {
  id: string;
  name: string;
  /** What one level does, in plain words. */
  perLevel: string;
  /** What each level multiplies (production, Ember gain, support); 0 for Long Watch. */
  factor: number;
  baseCost: number;
  growth: number;
  /** Levels it stops at (undefined = no limit). */
  maxLevel?: number;
}

export const LONG_WATCH_SECONDS = 3600;

export const KINDLINGS: readonly KindlingDef[] = [
  { id: "ember-glow",    name: "Ember Glow",    perLevel: "All production +5%",       factor: 1.05, baseCost: 1_000, growth: 10, maxLevel: 10 },
  { id: "long-watch",    name: "Long Watch",    perLevel: "Offline cap +1 hour",      factor: 0, baseCost: 1_000, growth: 4, maxLevel: 8 },
  // ×3 a level, so the 20th (2.3 trillion Embers) is within reach by the ending.
  { id: "quick-lures",   name: "Quick Lures",   perLevel: "Lures regrow 5% sooner",   factor: SHORE_KINDLING_FACTOR, baseCost: 2_000, growth: 3, maxLevel: 20 },
  { id: "spinning-silk", name: "Spinning Silk", perLevel: "Cocoons spin 5% faster",   factor: SHORE_KINDLING_FACTOR, baseCost: 2_000, growth: 3, maxLevel: 20 },
  { id: "tailwind",      name: "Tailwind",      perLevel: "Bottles come home 5% sooner", factor: SHORE_KINDLING_FACTOR, baseCost: 2_000, growth: 3, maxLevel: 20 },
];

const KINDLINGS_BY_ID: ReadonlyMap<string, KindlingDef> = new Map(KINDLINGS.map((k) => [k.id, k]));

export function kindlingById(id: string): KindlingDef {
  const def = KINDLINGS_BY_ID.get(id);
  if (!def) throw new Error(`Unknown Kindling id: ${id}`);
  return def;
}

export function kindlingLevel(state: GameState, id: string): number {
  return state.kindlings[id] ?? 0;
}

/** A Kindling's multiplier at its current level: factor ^ level. */
export function kindlingMultiplier(state: GameState, id: string): number {
  const level = kindlingLevel(state, id);
  return level > 0 ? kindlingById(id).factor ** level : 1;
}

/** Embers the next level costs: ceil(base × growth ^ level); Infinity once maxed. */
export function kindlingCost(state: GameState, id: string): number {
  const def = kindlingById(id);
  const level = kindlingLevel(state, id);
  if (def.maxLevel !== undefined && level >= def.maxLevel) return Infinity;
  return Math.ceil(def.baseCost * def.growth ** level);
}

/** Buy the next level of a Kindling with held Embers. Returns true if it happened. */
export function buyKindling(state: GameState, id: string): boolean {
  const def = kindlingById(id);
  const cost = kindlingCost(state, id);
  if (!Number.isFinite(cost) || state.embers < cost) return false;
  state.embers -= cost;
  state.kindlings[id] = kindlingLevel(state, id) + 1;
  addLog(state, `Kindled: ${def.name}, level ${state.kindlings[id]} — ${def.perLevel} (−${cost.toLocaleString("en-US")} Embers held)`);
  return true;
}

export function perkById(id: string): EmberPerkDef {
  const def = EMBER_PERKS.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown Ember perk id: ${id}`);
  return def;
}

export function hasPerk(state: GameState, id: string): boolean {
  return state.emberPerks.includes(id);
}

/**
 * Buy a perk with held Embers. Returns true if the purchase happened.
 * Fails (false, no state change) when already owned or unaffordable.
 * Spending lowers the held-Ember production bonus — intended.
 */
export function buyPerk(state: GameState, id: string): boolean {
  const def = perkById(id);
  if (hasPerk(state, id)) return false;
  if (state.embers < def.costEmbers) return false;
  state.embers -= def.costEmbers;
  state.emberPerks.push(id);
  addLog(state, `Ember perk kindled: ${def.name} — ${def.effect} (−${def.costEmbers} Embers held)`);
  return true;
}

// ── Effect helpers ───────────────────────────────────────────────────────────

/** Lumen a fresh run starts with (Head Start perk), granted by run resets. */
export function headStartLumen(state: GameState): number {
  return hasPerk(state, "head-start") ? HEAD_START_LUMEN : 0;
}

/** Click-value multiplier from Warm Lamp Oil (×2), else 1. */
export function emberShopClickMultiplier(state: GameState): number {
  return hasPerk(state, "warm-lamp") ? WARM_LAMP_CLICK_MULTIPLIER : 1;
}

/** Production multiplier from Second Wind (×1.5) and Ember Glow (×1.05 a level). */
export function emberShopProductionMultiplier(state: GameState): number {
  return (hasPerk(state, "second-wind") ? SECOND_WIND_MULTIPLIER : 1) * kindlingMultiplier(state, "ember-glow");
}

/** Chain support multiplier from Deep Wicks (×1.25), else 1. */
export function chainSupportMultiplier(state: GameState): number {
  return hasPerk(state, "deep-wicks") ? DEEP_WICKS_SUPPORT_MULTIPLIER : 1;
}

/** How long a bottle's voyage takes, as a share of the route's time: Glass Charts ×0.75, Tailwind ×0.95 a level. */
export function voyageMultiplier(state: GameState): number {
  return (hasPerk(state, "glass-charts") ? GLASS_CHARTS_VOYAGE_MULTIPLIER : 1) * kindlingMultiplier(state, "tailwind");
}

/**
 * Offline earnings cap in seconds: 12h with The Long Night, else 8h —
 * plus Siren's Rest lit (Sprint 5) adds a further 4 hours either way.
 */
export function offlineCapSeconds(state: GameState): number {
  const base = hasPerk(state, "long-night") ? LONG_NIGHT_CAP_SECONDS : OFFLINE_CAP_SECONDS;
  return base + litOfflineCapBonusSeconds(state.litLighthouses) + LONG_WATCH_SECONDS * kindlingLevel(state, "long-watch");
}

/** Offline rate bonus from Full Reservoir (+0.10), else 0. */
export function offlineRateBonus(state: GameState): number {
  return hasPerk(state, "full-lamp") ? FULL_LAMP_RATE_BONUS : 0;
}

/** Extra production bonus per held Ember from Ember Heart (+0.01), else 0. */
export function emberHeartBonus(state: GameState): number {
  return hasPerk(state, "ember-heart") ? EMBER_HEART_BONUS : 0;
}

/** Gull Rock's relight cost for this keeper — halved for a Friend of Gulls. */
export function gullRockRelightCost(state: GameState): Decimal {
  const base = chainLighthouseById(GULL_ROCK_ID).relightCost ?? 0;
  const mult = hasPerk(state, "gull-friend") ? GULL_FRIEND_COST_MULTIPLIER : 1;
  return new Decimal(base).mul(mult).ceil();
}
