import type { GameState, Moth } from "./types";

// ── The Wing Almanac ─────────────────────────────────────────────────────────
// A collection book: one entry for every wing pattern and trait pairing
// (no trait counts as a column), Hollow moths included (56 pages; a Hollow
// moth's two traits fill two pages). An entry fills the first time the keeper
// HOLDS such a moth, whether attracted, bred or brought home; releasing it
// later never empties the page. Filled entries earn lasting rewards.
//
// This module depends only on the types, so moths.ts and mothTraits.ts can
// both read the rewards without import cycles. The pattern and trait lists
// are kept literal here; tests/almanac.test.ts checks they match moths.ts
// and mothTraits.ts.

export const ALMANAC_PATTERNS: readonly string[] = ["plain", "spotted", "striped", "crescent", "starlit", "prismatic", "tidelit", "hollow"];
/** "none" is the column for moths without a trait. */
export const ALMANAC_TRAITS: readonly string[] = ["none", "lamp-loyal", "night-flier", "chain-tender", "seeker", "fertile", "tidewise"];
export const ALMANAC_SIZE = ALMANAC_PATTERNS.length * ALMANAC_TRAITS.length;

export function almanacKey(pattern: string, trait?: string | null): string {
  return `${pattern}:${trait ?? "none"}`;
}

export function isAlmanacKey(key: string): boolean {
  const [pattern, trait] = key.split(":");
  return ALMANAC_PATTERNS.includes(pattern) && ALMANAC_TRAITS.includes(trait) && key.split(":").length === 2;
}

export function almanacHas(state: GameState, pattern: string, trait?: string | null): boolean {
  return state.almanac.includes(almanacKey(pattern, trait));
}

export function almanacCount(state: GameState): number {
  return state.almanac.length;
}

/** The pages a moth fills: one for its trait (or none), and a Hollow moth's second trait. */
export function almanacKeysOf(moth: Moth): string[] {
  const keys = [almanacKey(moth.pattern, moth.trait)];
  if (moth.trait2) keys.push(almanacKey(moth.pattern, moth.trait2));
  return keys.filter(isAlmanacKey);
}

/** Note a moth in the Almanac. Returns true when it fills a new entry. */
export function recordAlmanac(state: GameState, moth: Moth): boolean {
  let filled = false;
  for (const key of almanacKeysOf(moth)) {
    if (state.almanac.includes(key)) continue;
    state.almanac.push(key);
    filled = true;
  }
  return filled;
}

export type AlmanacRewardId = "deep-bank" | "fourth-duty" | "quick-cocoons" | "swift-lures" | "lamp-halo" | "hollow-pages";

export interface AlmanacReward {
  id: AlmanacRewardId;
  /** Entries needed to earn it. */
  entries: number;
  name: string;
  effect: string;
}

export const ALMANAC_REWARDS: readonly AlmanacReward[] = [
  { id: "deep-bank",     entries: 6,            name: "A Deeper Bank",  effect: "The lure bank holds 4." },
  { id: "fourth-duty",   entries: 12,           name: "A Fourth Wing",  effect: "A fourth moth can stand duty." },
  { id: "quick-cocoons", entries: 24,           name: "Warm Silk",      effect: "Cocoons take 15% less time." },
  { id: "swift-lures",   entries: 36,           name: "Sweet Oil",      effect: "A lure regrows every 15 minutes." },
  { id: "lamp-halo",     entries: 49,           name: "Every Living Wing", effect: "The lamp wears a halo the colour of your brightest moth." },
  { id: "hollow-pages",  entries: ALMANAC_SIZE, name: "The Hollow Pages",  effect: "A fifth moth can stand duty." },
];

export function hasAlmanacReward(state: GameState, id: AlmanacRewardId): boolean {
  const reward = ALMANAC_REWARDS.find((r) => r.id === id);
  return reward !== undefined && almanacCount(state) >= reward.entries;
}

/** Lures the bank can hold: 3, or 4 with A Deeper Bank. */
export function lureBankSize(state: GameState): number {
  // +1 with the Moth Lantern Ember perk (read directly: this module stays a leaf).
  return (hasAlmanacReward(state, "deep-bank") ? 4 : 3) + (state.emberPerks.includes("moth-lantern") ? 1 : 0);
}

/** How long a lure takes to regrow: 20 minutes, or 15 with Sweet Oil; Quick Lures take 5% off a level. */
/** Each level of the Shore Kindlings (Ember shop) takes 5% off a wait. */
export const SHORE_KINDLING_FACTOR = 0.95;

export function lureRegrowMs(state: GameState): number {
  // Quick Lures (Ember shop Kindling), read directly: this module stays a leaf.
  const quick = SHORE_KINDLING_FACTOR ** (state.kindlings?.["quick-lures"] ?? 0);
  return Math.round((hasAlmanacReward(state, "swift-lures") ? 15 : 20) * 60 * 1000 * quick);
}

/** Moths that can stand duty at once: 3, 4 with A Fourth Wing, 5 with The Hollow Pages. */
export function dutySlots(state: GameState): number {
  return 3 + (hasAlmanacReward(state, "fourth-duty") ? 1 : 0) + (hasAlmanacReward(state, "hollow-pages") ? 1 : 0);
}

/** Cocoon time multiplier from Warm Silk (×0.85). */
export function almanacCocoonMultiplier(state: GameState): number {
  return hasAlmanacReward(state, "quick-cocoons") ? 0.85 : 1;
}
