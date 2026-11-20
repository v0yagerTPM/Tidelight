import { dutySlots } from "./almanac";
import { tideAt } from "./tides";
import type { GameState, Moth } from "./types";

// ── Moth traits and lighthouse posts ─────────────────────────────────────────
// A second axis to breed for, after glow and pattern. Each moth carries at
// most one trait: a wild moth has a 25% chance of one; a child inherits a
// parent's trait half the time and otherwise gains a new one 3% of the time
// (moths.ts rolls them). Every relit lighthouse also has one moth POST: a
// posted moth strengthens that lighthouse's board (glow × 0.2% support, ×2
// for a Chain-tender), and can't be on duty or breed while it is there.
//
// This module only reads state and depends on nothing but tides, so chain,
// engine, upgrades and expeditions can all use it without import cycles.

export type MothTraitId = "lamp-loyal" | "night-flier" | "chain-tender" | "seeker" | "fertile" | "tidewise";

export interface MothTraitDef {
  id: MothTraitId;
  name: string;
  /** One line for the moth card and the guide. */
  effect: string;
}

export const MOTH_TRAITS: readonly MothTraitDef[] = [
  { id: "lamp-loyal",   name: "Lamp-loyal",   effect: "On duty, its glow counts ×1.5." },
  { id: "night-flier",  name: "Night-flier",  effect: "On duty, offline earnings rate +5 points (still capped at 90%)." },
  { id: "chain-tender", name: "Chain-tender", effect: "At a lighthouse post, its support bonus is doubled." },
  { id: "seeker",       name: "Seeker",       effect: "On duty, bottles bring relics home 5 points more often." },
  { id: "fertile",      name: "Fertile",      effect: "Cocoons it spins take 25% less time." },
  { id: "tidewise",     name: "Tidewise",     effect: "On duty in High Tide or a Stormfront, its bonus lifts the beam a second time." },
];

export function traitById(id: string | null | undefined): MothTraitDef | null {
  return MOTH_TRAITS.find((t) => t.id === id) ?? null;
}

/** Duty slots without the Almanac's A Fourth Wing (dutySlots gives the live number). */
export const MAX_DUTY_MOTHS = 3;
/**
 * Each duty moth adds +(glow × this) to the thrown beam: glow 100 → +10%.
 * (Was 0.002 on the helpers' output, where the chain took most of it back;
 * on the beam after the chain, half the rate is worth about four times the
 * hours: engine.lampMultiplier.)
 */
export const DUTY_GLOW_BONUS = 0.001;
export const LAMP_LOYAL_GLOW_MULTIPLIER = 1.5;
export const NIGHT_FLIER_OFFLINE_BONUS = 0.05;
export const SEEKER_RELIC_BONUS = 0.05;
export const FERTILE_COCOON_MULTIPLIER = 0.75;
/** A posted moth adds glow × this to its lighthouse board's support. */
export const POST_GLOW_BONUS = 0.002;
export const CHAIN_TENDER_POST_MULTIPLIER = 2;

export function hasTrait(moth: Moth, id: MothTraitId): boolean {
  return moth.trait === id || moth.trait2 === id;
}

/** A moth's traits (none, one, or a Hollow moth's two). */
export function traitsOf(moth: Moth): MothTraitDef[] {
  return [traitById(moth.trait), traitById(moth.trait2)].filter((t): t is MothTraitDef => t !== null);
}

/** The moths actually on duty (ids sanitized against the collection, up to dutySlots). */
export function dutyMothsOf(state: GameState): Moth[] {
  const duty: Moth[] = [];
  const slots = dutySlots(state);
  for (const id of state.mothDuty) {
    const moth = state.moths.find((m) => m.id === id);
    if (moth && !duty.includes(moth)) duty.push(moth);
    if (duty.length >= slots) break;
  }
  return duty;
}

/** The glow a duty moth contributes: its glow, ×1.5 if Lamp-loyal. */
export function dutyGlowOf(moth: Moth): number {
  return moth.glow * (hasTrait(moth, "lamp-loyal") ? LAMP_LOYAL_GLOW_MULTIPLIER : 1);
}

/** The beam bonus one duty moth grants, as a fraction (0.1 = +10%). */
export function dutyBonusOf(moth: Moth): number {
  return dutyGlowOf(moth) * DUTY_GLOW_BONUS;
}

/** Beam multiplier from the duty roster: 1 + Σ duty glow × 0.001. */
export function dutyProductionMultiplier(state: GameState): number {
  return 1 + dutyMothsOf(state).reduce((sum, m) => sum + dutyBonusOf(m), 0);
}

/** How many moths with this trait are on duty. */
export function dutyTraitCount(state: GameState, id: MothTraitId): number {
  return dutyMothsOf(state).filter((m) => hasTrait(m, id)).length;
}

/** Night-fliers on duty: +5 offline-rate points each (the 90% cap still applies). */
export function mothOfflineRateBonus(state: GameState): number {
  return NIGHT_FLIER_OFFLINE_BONUS * dutyTraitCount(state, "night-flier");
}

/** Seekers on duty: +5 relic-chance points each. */
export function mothRelicChanceBonus(state: GameState): number {
  return SEEKER_RELIC_BONUS * dutyTraitCount(state, "seeker");
}

/**
 * Tidewise moths on duty during High Tide or a Stormfront lift the final
 * beam by their duty bonus again. Like the tide itself it acts on the
 * thrown beam only (never on chain demand), and is neutral without `now`.
 */
export function tidewiseMultiplier(state: GameState, now?: number): number {
  if (now === undefined) return 1;
  const tide = tideAt(now).def.id;
  if (tide !== "high" && tide !== "storm") return 1;
  return 1 + dutyMothsOf(state).filter((m) => hasTrait(m, "tidewise")).reduce((sum, m) => sum + dutyBonusOf(m), 0);
}

/**
 * Tidelit moths on duty follow the tide: in a Stormfront their duty bonus
 * counts double; in Glass Calm it counts half. Final rate only, never chain demand; neutral without `now`.
 */
export function tidelitMultiplier(state: GameState, now?: number): number {
  if (now === undefined) return 1;
  const tide = tideAt(now).def.id;
  if (tide !== "storm" && tide !== "calm") return 1;
  const tidelit = dutyMothsOf(state).filter((m) => m.pattern === "tidelit").reduce((sum, m) => sum + dutyBonusOf(m), 0);
  // The base rate already carries the whole duty multiplier (1 + all): swap
  // the Tidelit share for its tide-adjusted share at the very end.
  const all = dutyProductionMultiplier(state);
  return (all + (tide === "storm" ? tidelit : -tidelit / 2)) / all;
}

// ── Moths riding with bottles ────────────────────────────────────────────────

/** A riding moth adds glow × this to a bottle's relic chance (glow 100 → +10 points). */
export const RIDER_RELIC_PER_GLOW = 0.001;
/** A Seeker riding a bottle adds this on top. */
export const SEEKER_RIDER_RELIC_BONUS = 0.1;
/** On the Deep Glass Crossing, a rider without a trait comes home with one this often. */
export const CROSSING_TRAIT_CHANCE = 0.1;

/** The moth riding the bottle at sea, if any. */
export function riderOf(state: GameState): Moth | null {
  const id = state.expedition?.riderId;
  return id ? state.moths.find((m) => m.id === id) ?? null : null;
}

export function isAtSea(state: GameState, mothId: string): boolean {
  return state.expedition?.riderId === mothId;
}

/** The relic-chance bonus a moth gives riding a bottle. */
export function riderRelicBonus(moth: Moth | null): number {
  if (!moth) return 0;
  return moth.glow * RIDER_RELIC_PER_GLOW + (hasTrait(moth, "seeker") ? SEEKER_RIDER_RELIC_BONUS : 0);
}

// ── Lighthouse posts ─────────────────────────────────────────────────────────

/** The moth posted at a lighthouse, if any (and only while it burns). */
export function postedMoth(state: GameState, lighthouseId: string): Moth | null {
  if (!state.litLighthouses.includes(lighthouseId)) return null;
  const id = state.mothPosts[lighthouseId];
  return id ? state.moths.find((m) => m.id === id) ?? null : null;
}

/** The lighthouse a moth is posted at, or null. */
export function postOf(state: GameState, mothId: string): string | null {
  for (const [lighthouseId, id] of Object.entries(state.mothPosts)) if (id === mothId) return lighthouseId;
  return null;
}

/** The support bonus a moth gives at a post, as a fraction (0.2 = +20%). */
export function postBonusOf(moth: Moth): number {
  return moth.glow * POST_GLOW_BONUS * (hasTrait(moth, "chain-tender") ? CHAIN_TENDER_POST_MULTIPLIER : 1);
}

/** Support multiplier for one lighthouse board from its posted moth. */
export function postSupportMultiplier(state: GameState, lighthouseId: string): number {
  const moth = postedMoth(state, lighthouseId);
  return moth ? 1 + postBonusOf(moth) : 1;
}
