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

export const MAX_DUTY_MOTHS = 3;
/** Each duty moth grants +(glow × this)% production — glow 50 → +10%. */
export const DUTY_GLOW_BONUS = 0.002;
export const LAMP_LOYAL_GLOW_MULTIPLIER = 1.5;
export const NIGHT_FLIER_OFFLINE_BONUS = 0.05;
export const SEEKER_RELIC_BONUS = 0.05;
export const FERTILE_COCOON_MULTIPLIER = 0.75;
/** A posted moth adds glow × this to its lighthouse board's support. */
export const POST_GLOW_BONUS = 0.002;
export const CHAIN_TENDER_POST_MULTIPLIER = 2;

export function hasTrait(moth: Moth, id: MothTraitId): boolean {
  return moth.trait === id;
}

/** The moths actually on duty (ids sanitized against the collection, max 3). */
export function dutyMothsOf(state: GameState): Moth[] {
  const duty: Moth[] = [];
  for (const id of state.mothDuty) {
    const moth = state.moths.find((m) => m.id === id);
    if (moth && !duty.includes(moth)) duty.push(moth);
    if (duty.length >= MAX_DUTY_MOTHS) break;
  }
  return duty;
}

/** The glow a duty moth contributes: its glow, ×1.5 if Lamp-loyal. */
export function dutyGlowOf(moth: Moth): number {
  return moth.glow * (hasTrait(moth, "lamp-loyal") ? LAMP_LOYAL_GLOW_MULTIPLIER : 1);
}

/** The production bonus one duty moth grants, as a fraction (0.2 = +20%). */
export function dutyBonusOf(moth: Moth): number {
  return dutyGlowOf(moth) * DUTY_GLOW_BONUS;
}

/** Production multiplier from the duty roster: 1 + Σ duty glow × 0.002. */
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
