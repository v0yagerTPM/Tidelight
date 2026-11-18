import Decimal from "break_infinity.js";
import { GULL_ROCK_ID, OFFLINE_CAP_SECONDS, chainLighthouseById, litOfflineCapBonusSeconds } from "./config";
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

export interface EmberPerkDef {
  id: string;
  name: string;
  /** Plain-words effect, shown in the UI. */
  effect: string;
  /** Cost in held Embers. */
  costEmbers: number;
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

export const EMBER_PERKS: readonly EmberPerkDef[] = [
  { id: "head-start",   name: "Head Start",      effect: "Every new run starts with 1,000 Lumen in hand.",                          costEmbers: 5 },
  { id: "warm-lamp",    name: "Warm Lamp Oil",   effect: "Flash the Beam click power ×2.",                                          costEmbers: 8 },
  { id: "gull-friend",  name: "Friend of Gulls", effect: "Relighting Gull Rock Light costs half as much Lumen.",                    costEmbers: 10 },
  { id: "deep-wicks",   name: "Deep Wicks",      effect: "Every supply-chain node supports +25% more production (both boards).",    costEmbers: 12 },
  { id: "long-night",   name: "The Long Night",  effect: "Offline earnings cap rises from 8 hours to 12 hours.",                    costEmbers: 20 },
  { id: "full-lamp",    name: "Full Reservoir",  effect: "Offline earnings rate +10 percentage points (hard cap 90%).",             costEmbers: 25 },
  { id: "ember-heart",  name: "Ember Heart",     effect: "Each Ember held gives +1% more production (+2% → +3%, or +3% → +4% with Ember Resonance).", costEmbers: 30 },
  { id: "second-wind",  name: "Second Wind",     effect: "All production +50%.",                                                    costEmbers: 40 },
];

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

/** Production multiplier from Second Wind (×1.5), else 1. */
export function emberShopProductionMultiplier(state: GameState): number {
  return hasPerk(state, "second-wind") ? SECOND_WIND_MULTIPLIER : 1;
}

/** Chain support multiplier from Deep Wicks (×1.25), else 1. */
export function chainSupportMultiplier(state: GameState): number {
  return hasPerk(state, "deep-wicks") ? DEEP_WICKS_SUPPORT_MULTIPLIER : 1;
}

/**
 * Offline earnings cap in seconds: 12h with The Long Night, else 8h —
 * plus Siren's Rest lit (Sprint 5) adds a further 4 hours either way.
 */
export function offlineCapSeconds(state: GameState): number {
  const base = hasPerk(state, "long-night") ? LONG_NIGHT_CAP_SECONDS : OFFLINE_CAP_SECONDS;
  return base + litOfflineCapBonusSeconds(state.litLighthouses);
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
