import Decimal from "break_infinity.js";
import { relicMothGlowBonus } from "./expeditions";
import { formatNumber } from "./format";
import { addLog } from "./state";
import type { GameState, Moth } from "./types";

// ── Lantern moths (Sprint 4) ─────────────────────────────────────────────────
// A cozy collection system living on the Shore. Moths are PERMANENT: the
// collection, duty roster, roost expansions and any cocoon are untouched
// by Rekindle and challenge resets — the moths simply roost through the
// dark. Up to 3 moths can be "on duty" by the lamp; each grants
// +(glow × 0.2)% production, flowing through engine.productionForOwned as
// the moth multiplier (1 + totalDutyGlow × 0.002).
//
// The moth rebalance: wild moths come on LURES (a bank of 3, one regrowing
// every 20 minutes, offline too) instead of Lumen, each pattern has a glow
// CEILING, hatch glow climbs slowly, Prismatic breeds true only 60% of the
// time, and a cocoon takes 30–75 minutes. A keeper who breeds well reaches
// a first Prismatic after ~12 hours of cocoons and three at glow 100 after
// ~95 (see docs/SPRINTS.md). Moths from before the rebalance keep their
// glow even above the new ceilings ("old light").
//
// All randomness takes an `rng: () => number` (see rng.ts): game code
// passes Math.random, tests pass seeded functions. The rng is consumed in
// a fixed, documented order per action so seeded runs are reproducible:
//   attract: pattern, glow, name prefix, name suffix, id
//   hatch:   parent pick, tier shift, mutation kind, mutation amount,
//            name prefix, name suffix, id

export interface MothPatternDef {
  id: string;
  name: string;
  /** Rarity tier 0 (common) – 5 (mythic). Breeding inheritance works in tiers. */
  tier: number;
  /** Relative weight when attracting a wild moth (sums to 100). */
  weight: number;
  /** The highest glow this pattern can reach by attracting or breeding. */
  glowCeiling: number;
  /** Emoji shown on the collection card. */
  emoji: string;
  /** CSS gradient for the wing swatch on the collection card. */
  swatch: string;
}

export const MOTH_PATTERNS: readonly MothPatternDef[] = [
  { id: "plain",     name: "Plain",     tier: 0, weight: 44, glowCeiling: 40, emoji: "🤍", swatch: "linear-gradient(135deg, #e8e0cf, #cfc4ab)" },
  { id: "spotted",   name: "Spotted",   tier: 1, weight: 26, glowCeiling: 55, emoji: "💛", swatch: "radial-gradient(circle at 30% 35%, #8a6d3b 18%, transparent 19%), radial-gradient(circle at 68% 62%, #8a6d3b 14%, transparent 15%), linear-gradient(135deg, #f2d492, #dfba6a)" },
  { id: "striped",   name: "Striped",   tier: 2, weight: 16, glowCeiling: 70, emoji: "🧡", swatch: "repeating-linear-gradient(45deg, #e8975a 0 6px, #f7cf9f 6px 12px)" },
  { id: "crescent",  name: "Crescent",  tier: 3, weight: 9, glowCeiling: 80, emoji: "🌙", swatch: "radial-gradient(circle at 68% 32%, transparent 26%, #7d84b8 27%), linear-gradient(135deg, #4b5480, #7983b5)" },
  { id: "starlit",   name: "Starlit",   tier: 4, weight: 4.5, glowCeiling: 90,  emoji: "⭐", swatch: "radial-gradient(circle at 25% 30%, #fff6c9 8%, transparent 9%), radial-gradient(circle at 70% 55%, #ffe9a8 6%, transparent 7%), radial-gradient(circle at 45% 78%, #fff6c9 5%, transparent 6%), linear-gradient(135deg, #232a52, #3d4a8a)" },
  { id: "prismatic", name: "Prismatic", tier: 5, weight: 0.5, glowCeiling: 100,  emoji: "🌈", swatch: "linear-gradient(135deg, #f28ba8, #f7d774, #8fd18b, #7fb5d9, #b48fd9)" },
];

export function patternById(id: string): MothPatternDef {
  return MOTH_PATTERNS.find((p) => p.id === id) ?? MOTH_PATTERNS[0];
}

export function patternByTier(tier: number): MothPatternDef {
  const clamped = Math.max(0, Math.min(MOTH_PATTERNS.length - 1, Math.floor(tier)));
  return MOTH_PATTERNS.find((p) => p.tier === clamped) ?? MOTH_PATTERNS[0];
}

// ── Names: cozy prefix + suffix compounds ("Brindlewing", "Vesperdust") ─────
const NAME_PREFIXES: readonly string[] = [
  "Brindle", "Saffron", "Pell", "Umbra", "Luma", "Vesper", "Cinder", "Mallow",
  "Sorrel", "Thistle", "Wren", "Alder", "Fennel", "Marigold", "Plum", "Tansy",
  "Hazel", "Rowan", "Ember", "Quill",
];
const NAME_SUFFIXES: readonly string[] = [
  "wing", "dust", "flutter", "shade", "glow", "petal", "fuzz", "drift", "light", "moth",
];

function generateName(rng: () => number): string {
  const prefix = NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)];
  const suffix = NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)];
  return `${prefix}${suffix}`;
}

function generateId(state: GameState, rng: () => number): string {
  let id = "";
  do {
    id = `moth-${(Math.floor(rng() * 0xffffffff) >>> 0).toString(16)}`;
  } while (state.moths.some((m) => m.id === id));
  return id;
}

/** Driftwood Cradle (relic): wild moths arrive brighter — +5 glow. */
function wildGlowBonus(state: GameState): number {
  return relicMothGlowBonus(state);
}

/** A pattern's glow ceiling (see MOTH_PATTERNS). */
export function glowCeiling(patternId: string): number {
  return patternById(patternId).glowCeiling;
}

/**
 * "Old light": a moth from before the rebalance whose glow is above its
 * pattern's ceiling. It keeps that glow; its children are held to theirs.
 */
export function isOldLight(moth: Moth): boolean {
  return moth.glow > glowCeiling(moth.pattern);
}

function clampGlow(value: number, patternId: string): number {
  return Math.max(1, Math.min(glowCeiling(patternId), Math.round(value)));
}

// ── Unlock, capacity, costs ──────────────────────────────────────────────────

export const MOTH_GENERATOR_ID = "lantern-moth";
export const BASE_MOTH_CAPACITY = 6;
export const ROOST_CAPACITY_PER_EXPANSION = 2;
export const MAX_DUTY_MOTHS = 3;
/** Each duty moth grants +(glow × this)% production — glow 50 → +10%. */
export const DUTY_GLOW_BONUS = 0.002;
/** Lures held at most; one regrows every LURE_REGROW_MS, offline too. */
export const LURE_BANK = 3;
export const LURE_REGROW_MS = 20 * 60 * 1000;
/** A rush lure costs this share of all-time Lumen (at least RUSH_LURE_MIN_COST)… */
export const RUSH_LURE_SHARE = 0.005;
export const RUSH_LURE_MIN_COST = 500;
/** …tripled for each rush since the last lure regrew (each regrowth forgives one). */
export const RUSH_LURE_GROWTH = 3;
/** Roost expansions cost the larger of a fixed ladder and a share of all-time Lumen. */
export const ROOST_BASE_COST = 10_000;
export const ROOST_COST_GROWTH = 6;
export const ROOST_ALL_TIME_SHARE = 0.03;
export const ROOST_ALL_TIME_GROWTH = 3;
/** A wild moth's glow rolls 1 to this share of its pattern's ceiling. */
export const WILD_GLOW_SHARE = 0.6;
/** A cocoon takes COCOON_BASE_MS × (1 + COCOON_PER_TIER × the higher parent's tier). */
export const COCOON_BASE_MS = 30 * 60 * 1000;
export const COCOON_PER_TIER = 0.3;
/** Chance a child that would be Prismatic stays Prismatic (otherwise Starlit). */
export const PRISMATIC_TRUE_CHANCE = 0.6;
export const TIER_UP_CHANCE = 0.08;
export const TIER_DOWN_CHANCE = 0.12;
/** Hatch glow: parents' average − 1, ±10; 3% chance of a bright +8..+15 instead. */
export const HATCH_GLOW_DRIFT = 10;
export const HATCH_GLOW_REGRESSION = 1;
export const BRIGHT_MUTATION_CHANCE = 0.03;
/** Above this average glow, gains are halved: the last points are earned. */
export const HARD_GLOW = 90;

/**
 * The Moth Garden opens once the keeper hires a Lantern Moth generator —
 * and stays open for anyone who already keeps moths (the collection is
 * permanent, so a Rekindle can never lock a keeper out of their own roost).
 */
export function mothsUnlocked(state: GameState): boolean {
  return (state.generators[MOTH_GENERATOR_ID] ?? 0) >= 1 || state.moths.length > 0;
}

export function mothCapacity(state: GameState): number {
  return BASE_MOTH_CAPACITY + ROOST_CAPACITY_PER_EXPANSION * state.roostExpansions;
}

/**
 * Cost of the next roost expansion (+2 capacity): the larger of
 * 10,000 × 6^expansions and 3% of all-time Lumen × 3^expansions. Pricing
 * on ALL-TIME Lumen (which only grows) keeps the roost a real choice late
 * in the game without making it cheap right after a Rekindle.
 */
export function roostExpansionCost(state: GameState): Decimal {
  const ladder = new Decimal(ROOST_BASE_COST).mul(new Decimal(ROOST_COST_GROWTH).pow(state.roostExpansions));
  const share = state.allTimeLumen.mul(ROOST_ALL_TIME_SHARE).mul(new Decimal(ROOST_ALL_TIME_GROWTH).pow(state.roostExpansions));
  return Decimal.max(ladder, share).ceil();
}

// ── Lures ────────────────────────────────────────────────────────────────────

export interface LureStatus {
  /** Lures ready to spend, 0–LURE_BANK. */
  held: number;
  /** Milliseconds until the next lure grows, or null with a full bank. */
  nextInMs: number | null;
  /** Rushes not yet forgiven by a regrowth (prices the next rush lure). */
  rushes: number;
}

/** The lure bank as of `now`, without changing the state. */
export function lureStatus(state: GameState, now: number = Date.now()): LureStatus {
  const held = Math.max(0, Math.min(LURE_BANK, Math.floor(state.mothLures)));
  if (held >= LURE_BANK) return { held, nextInMs: null, rushes: 0 };
  const elapsed = Math.max(0, now - state.mothLureAnchor);
  const grown = Math.floor(elapsed / LURE_REGROW_MS);
  const nowHeld = Math.min(LURE_BANK, held + grown);
  const rushes = Math.max(0, state.mothLureRushes - grown);
  if (nowHeld >= LURE_BANK) return { held: nowHeld, nextInMs: null, rushes: 0 };
  return { held: nowHeld, nextInMs: LURE_REGROW_MS - (elapsed - grown * LURE_REGROW_MS), rushes };
}

/** Fold the lures grown since the anchor into the state (call before spending). */
function settleLures(state: GameState, now: number): void {
  const before = Math.max(0, Math.min(LURE_BANK, Math.floor(state.mothLures)));
  const st = lureStatus(state, now);
  if (st.held >= LURE_BANK || state.mothLureAnchor > now) {
    state.mothLureAnchor = now;
  } else {
    state.mothLureAnchor += (st.held - before) * LURE_REGROW_MS;
  }
  state.mothLures = st.held;
  state.mothLureRushes = st.rushes;
}

/**
 * A rush lure, for a keeper who can't wait: 0.5% of all-time Lumen (at
 * least 500), tripled for each rush since the bank last regrew a lure.
 */
export function rushLureCost(state: GameState, now: number = Date.now()): Decimal {
  const base = Decimal.max(RUSH_LURE_MIN_COST, state.allTimeLumen.mul(RUSH_LURE_SHARE));
  return base.mul(new Decimal(RUSH_LURE_GROWTH).pow(lureStatus(state, now).rushes)).ceil();
}

export function mothById(state: GameState, id: string): Moth | undefined {
  return state.moths.find((m) => m.id === id);
}

// ── Duty ─────────────────────────────────────────────────────────────────────

/** The moths actually on duty (ids sanitized against the collection, max 3). */
export function dutyMoths(state: GameState): Moth[] {
  const duty: Moth[] = [];
  for (const id of state.mothDuty) {
    const moth = mothById(state, id);
    if (moth && !duty.includes(moth)) duty.push(moth);
    if (duty.length >= MAX_DUTY_MOTHS) break;
  }
  return duty;
}

export function dutyGlowTotal(state: GameState): number {
  return dutyMoths(state).reduce((sum, m) => sum + m.glow, 0);
}

/** Production multiplier from the duty roster: 1 + total duty glow × 0.002. */
export function mothProductionMultiplier(state: GameState): number {
  return 1 + dutyGlowTotal(state) * DUTY_GLOW_BONUS;
}

/**
 * Toggle a moth on/off duty. Returns false when the moth doesn't exist or
 * the roster is already full (3) and this moth isn't on it.
 */
export function toggleDuty(state: GameState, mothId: string): boolean {
  if (!mothById(state, mothId)) return false;
  const idx = state.mothDuty.indexOf(mothId);
  if (idx >= 0) {
    state.mothDuty.splice(idx, 1);
    return true;
  }
  if (dutyMoths(state).length >= MAX_DUTY_MOTHS) return false;
  state.mothDuty.push(mothId);
  return true;
}

// ── Attracting & the roost ───────────────────────────────────────────────────

function rollPattern(rng: () => number): MothPatternDef {
  const total = MOTH_PATTERNS.reduce((sum, p) => sum + p.weight, 0);
  let roll = rng() * total;
  for (const def of MOTH_PATTERNS) {
    roll -= def.weight;
    if (roll < 0) return def;
  }
  return MOTH_PATTERNS[MOTH_PATTERNS.length - 1];
}

function canAttract(state: GameState): boolean {
  return mothsUnlocked(state) && state.moths.length < mothCapacity(state);
}

/**
 * Attract a wild lantern moth with a lure. Fails (null, nothing spent)
 * while the garden is locked, the roost is full, or no lure is ready.
 * New moths are generation 1.
 */
export function attractMoth(state: GameState, rng: () => number, now: number = Date.now()): Moth | null {
  if (!canAttract(state)) return null;
  settleLures(state, now); // with a full bank this also starts the regrow clock now
  if (state.mothLures < 1) return null;
  state.mothLures -= 1;
  return wildMoth(state, rng);
}

/**
 * Attract a wild moth with a rush lure, paid in Lumen (see rushLureCost).
 * Only when the bank is empty — a ready lure is always spent first.
 */
export function rushAttractMoth(state: GameState, rng: () => number, now: number = Date.now()): Moth | null {
  if (!canAttract(state)) return null;
  if (lureStatus(state, now).held > 0) return null;
  const cost = rushLureCost(state, now);
  if (state.lumen.lt(cost)) return null;
  settleLures(state, now);
  state.lumen = state.lumen.sub(cost);
  state.mothLureRushes += 1;
  return wildMoth(state, rng);
}

/** Wild moths: pattern by weight, glow 1 to 60% of that pattern's ceiling (+ the Cradle). */
function wildMoth(state: GameState, rng: () => number): Moth {
  const pattern = rollPattern(rng);
  const glow = clampGlow(1 + Math.floor(rng() * WILD_GLOW_SHARE * pattern.glowCeiling) + wildGlowBonus(state), pattern.id);
  const name = generateName(rng);
  const moth: Moth = { id: generateId(state, rng), name, pattern: pattern.id, glow, generation: 1 };
  state.moths.push(moth);
  addLog(state, `A lantern moth settles by the lamp: ${moth.name}, ${pattern.name.toLowerCase()}-winged and glowing at ${glow}. It followed the light home. It stayed.`);
  return moth;
}

/** Expand the roost: +2 collection capacity, at roostExpansionCost(). */
export function expandRoost(state: GameState): boolean {
  if (!mothsUnlocked(state)) return false;
  const cost = roostExpansionCost(state);
  if (state.lumen.lt(cost)) return false;
  state.lumen = state.lumen.sub(cost);
  state.roostExpansions++;
  addLog(state, `The roost is rebuilt with room to spare — the moths can now gather ${mothCapacity(state)} strong.`);
  return true;
}

// ── Breeding ─────────────────────────────────────────────────────────────────

export function isCocoonParent(state: GameState, mothId: string): boolean {
  return state.cocoon !== null && state.cocoon.parentIds.includes(mothId);
}

/**
 * How long a cocoon from these parents takes: 30 minutes × (1 + 0.3 × the
 * higher parent's tier) — Plain 30 minutes, Prismatic 75.
 */
export function cocoonDurationMs(parentA: Moth, parentB: Moth): number {
  const tier = Math.max(patternById(parentA.pattern).tier, patternById(parentB.pattern).tier);
  return Math.round(COCOON_BASE_MS * (1 + COCOON_PER_TIER * tier));
}

/**
 * Start a cocoon from two distinct moths. Only one cocoon at a time; it
 * takes cocoonDurationMs() of real time (timestamp-based, so it progresses
 * while away). Parents are NOT consumed. Hatching — not starting — needs a
 * free slot.
 */
export function startBreeding(state: GameState, parentAId: string, parentBId: string, now: number = Date.now()): boolean {
  if (state.cocoon !== null) return false;
  if (parentAId === parentBId) return false;
  if (!mothById(state, parentAId) || !mothById(state, parentBId)) return false;
  const a = mothById(state, parentAId)!;
  const b = mothById(state, parentBId)!;
  const duration = cocoonDurationMs(a, b);
  state.cocoon = { parentIds: [parentAId, parentBId], readyAt: now + duration };
  addLog(state, `${a.name} and ${b.name} spin a cocoon together in the warm dark under the lamp. ${Math.round(duration / 60_000)} minutes, give or take a dream.`);
  return true;
}

export function cocoonReady(state: GameState, now: number = Date.now()): boolean {
  return state.cocoon !== null && now >= state.cocoon.readyAt;
}

/**
 * Hatch the cocoon into a child moth. Fails (null) when there is no
 * cocoon, it isn't ready, a parent has vanished, or the roost is full.
 * Inheritance: the child's pattern starts from a parent's tier — weighted
 * toward the higher-tier parent (65%). A Prismatic start stays Prismatic
 * 60% of the time and otherwise falls to Starlit; any other tier shifts up
 * 8% / down 12% (clamped). Glow is the parents' average − 1 ± 10, or a
 * bright +8..+15 3% of the time; above an average of 90 gains are halved;
 * the result is held to the child's pattern ceiling. Generation is
 * max(parents) + 1. Parents are kept.
 */
export function hatchCocoon(state: GameState, rng: () => number, now: number = Date.now()): Moth | null {
  const cocoon = state.cocoon;
  if (!cocoon || now < cocoon.readyAt) return null;
  if (state.moths.length >= mothCapacity(state)) return null;
  const parentA = mothById(state, cocoon.parentIds[0]);
  const parentB = mothById(state, cocoon.parentIds[1]);
  if (!parentA || !parentB) return null;

  const tierA = patternById(parentA.pattern).tier;
  const tierB = patternById(parentB.pattern).tier;
  // 1. parent pick — weighted toward the higher tier
  const baseTier = rng() < 0.65 ? Math.max(tierA, tierB) : Math.min(tierA, tierB);
  // 2. tier shift — Prismatic is unstable; everything else drifts ±1
  const shiftRoll = rng();
  const top = MOTH_PATTERNS.length - 1;
  let tier = baseTier;
  if (baseTier >= top) {
    if (shiftRoll >= PRISMATIC_TRUE_CHANCE) tier = top - 1;
  } else if (shiftRoll < TIER_UP_CHANCE) tier += 1;
  else if (shiftRoll < TIER_UP_CHANCE + TIER_DOWN_CHANCE) tier -= 1;
  const pattern = patternByTier(tier);
  // 3–4. glow mutation — 3% bright (+8..+15), else average − 1 ± 10
  const avgGlow = (parentA.glow + parentB.glow) / 2;
  let delta: number;
  if (rng() < BRIGHT_MUTATION_CHANCE) {
    delta = 8 + Math.floor(rng() * 8);
  } else {
    delta = Math.round(rng() * 2 * HATCH_GLOW_DRIFT) - HATCH_GLOW_DRIFT - HATCH_GLOW_REGRESSION;
  }
  if (avgGlow >= HARD_GLOW && delta > 0) delta /= 2;
  const glow = clampGlow(avgGlow + delta, pattern.id);
  const name = generateName(rng);
  const child: Moth = {
    id: generateId(state, rng),
    name,
    pattern: pattern.id,
    glow,
    generation: Math.max(parentA.generation, parentB.generation) + 1,
  };
  state.cocoon = null;
  state.moths.push(child);
  addLog(state, `The cocoon opens: ${child.name}, ${pattern.name.toLowerCase()}-winged, generation ${child.generation}, glowing at ${glow}. ${parentA.name} and ${parentB.name} look insufferably proud.`);
  return child;
}

// ── Release ──────────────────────────────────────────────────────────────────

/**
 * What releasing a moth pays: a small gift of stored lamplight, 10 × glow
 * × (pattern tier + 1). Wild moths cost lures, not Lumen, so there is no
 * attract-and-release loop to guard against; the gift stays small so a
 * release is about making room, not profit.
 */
export function releasePayout(_state: GameState, moth: Moth): Decimal {
  return new Decimal(10 * moth.glow * (patternById(moth.pattern).tier + 1));
}

/**
 * Release a moth back to the glass sea. The Lumen is a trade-in, credited
 * to the purse only (it doesn't count as earned lifetime). A moth sitting
 * in the cocoon can't be released. Returns the Lumen gained, or null.
 */
export function releaseMoth(state: GameState, mothId: string): Decimal | null {
  const moth = mothById(state, mothId);
  if (!moth) return null;
  if (isCocoonParent(state, mothId)) return null;
  const value = releasePayout(state, moth);
  state.moths = state.moths.filter((m) => m.id !== mothId);
  state.mothDuty = state.mothDuty.filter((id) => id !== mothId);
  state.lumen = state.lumen.add(value);
  addLog(state, `${moth.name} drifts out over the glass sea, unhurried. The lamp is dimmer for it. (+${formatNumber(value, state.notation)} Lumen of stored lamplight)`);
  return value;
}
