import Decimal from "break_infinity.js";
import { almanacCocoonMultiplier, dutySlots, lureBankSize, lureRegrowMs, recordAlmanac } from "./almanac";
import { CHAIN_LIGHTHOUSES } from "./config";
import { relicMothGlowBonus } from "./expeditions";
import { formatNumber } from "./format";
import {
  DUTY_GLOW_BONUS,
  FERTILE_COCOON_MULTIPLIER,
  MAX_DUTY_MOTHS,
  MOTH_TRAITS,
  dutyGlowOf,
  dutyMothsOf,
  dutyProductionMultiplier,
  hasTrait,
  isAtSea,
  postOf,
  traitById,
} from "./mothTraits";
import { tideAt } from "./tides";
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
  // Never wild and never bred true: a Starlit or Prismatic cocoon that opens in a Stormfront is Tidelit 5% of the time.
  { id: "tidelit",   name: "Tidelit",   tier: 5, weight: 0, glowCeiling: 100, emoji: "🌊", swatch: "repeating-linear-gradient(160deg, #2d6f86 0 5px, #8fd6c4 5px 8px, #1d3f5c 8px 13px)" },
];

const PATTERNS_BY_ID: ReadonlyMap<string, MothPatternDef> = new Map(MOTH_PATTERNS.map((p) => [p.id, p]));

export function patternById(id: string): MothPatternDef {
  return PATTERNS_BY_ID.get(id) ?? MOTH_PATTERNS[0];
}

/** The highest wing tier (Prismatic, and the Tidelit sidegrade). */
export const MAX_TIER = 5;

/** The bred pattern for a tier (Tidelit shares tier 5 but is never bred to by tier). */
export function patternByTier(tier: number): MothPatternDef {
  const clamped = Math.max(0, Math.min(MAX_TIER, Math.floor(tier)));
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
export { DUTY_GLOW_BONUS, MAX_DUTY_MOTHS };
/** A wild moth carries a trait this often (mothTraits.ts). */
export const WILD_TRAIT_CHANCE = 0.25;
/** A child takes one of its parents' traits this often, when they have any… */
export const TRAIT_INHERIT_CHANCE = 0.5;
/** …and otherwise gains a new trait this often. */
export const TRAIT_MUTATION_CHANCE = 0.03;
/** Lures held at most (4 with the Almanac's A Deeper Bank, see lureBankSize). */
export const LURE_BANK = 3;
/** One lure regrows this often, offline too (15 minutes with Sweet Oil, see lureRegrowMs). */
export const LURE_REGROW_MS = 20 * 60 * 1000;
export { lureBankSize, lureRegrowMs };
/** A scented lure costs this many Wing Scales and always brings a moth with a trait. */
export const SCENTED_LURE_SCALES = 8;
/** During a Stormfront, a Starlit or Prismatic hatchling is Tidelit this often. */
export const TIDELIT_CHANCE = 0.05;
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
  const bank = lureBankSize(state);
  const regrow = lureRegrowMs(state);
  const held = Math.max(0, Math.min(bank, Math.floor(state.mothLures)));
  if (held >= bank) return { held, nextInMs: null, rushes: 0 };
  const elapsed = Math.max(0, now - state.mothLureAnchor);
  const grown = Math.floor(elapsed / regrow);
  const nowHeld = Math.min(bank, held + grown);
  const rushes = Math.max(0, state.mothLureRushes - grown);
  if (nowHeld >= bank) return { held: nowHeld, nextInMs: null, rushes: 0 };
  return { held: nowHeld, nextInMs: regrow - (elapsed - grown * regrow), rushes };
}

/** Fold the lures grown since the anchor into the state (call before spending). */
function settleLures(state: GameState, now: number): void {
  const bank = lureBankSize(state);
  const before = Math.max(0, Math.min(bank, Math.floor(state.mothLures)));
  const st = lureStatus(state, now);
  if (st.held >= bank || state.mothLureAnchor > now) {
    state.mothLureAnchor = now;
  } else {
    state.mothLureAnchor += (st.held - before) * lureRegrowMs(state);
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
  return dutyMothsOf(state);
}

/** The duty roster's working glow: each moth's glow, ×1.5 for a Lamp-loyal one. */
export function dutyGlowTotal(state: GameState): number {
  return dutyMoths(state).reduce((sum, m) => sum + dutyGlowOf(m), 0);
}

/** Production multiplier from the duty roster: 1 + duty glow × 0.002. */
export function mothProductionMultiplier(state: GameState): number {
  return dutyProductionMultiplier(state);
}

/**
 * Toggle a moth on/off duty. Returns false when the moth doesn't exist, is
 * at a lighthouse post, or the roster is already full (3) and this moth
 * isn't on it.
 */
export function toggleDuty(state: GameState, mothId: string): boolean {
  if (!mothById(state, mothId)) return false;
  if (postOf(state, mothId) !== null || isAtSea(state, mothId)) return false;
  const idx = state.mothDuty.indexOf(mothId);
  if (idx >= 0) {
    state.mothDuty.splice(idx, 1);
    return true;
  }
  if (dutyMoths(state).length >= dutySlots(state)) return false;
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
  return patternByTier(MAX_TIER);
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

/**
 * Attract a wild moth with a scented lure: 8 Wing Scales, no lure needed,
 * and the moth always carries a trait.
 */
export function scentedAttractMoth(state: GameState, rng: () => number): Moth | null {
  if (!canAttract(state)) return null;
  if (state.wingScales < SCENTED_LURE_SCALES) return null;
  state.wingScales -= SCENTED_LURE_SCALES;
  return wildMoth(state, rng, true);
}

/** Wild moths: pattern by weight, glow 1 to 60% of that pattern's ceiling (+ the Cradle). */
function wildMoth(state: GameState, rng: () => number, scented = false): Moth {
  const pattern = rollPattern(rng);
  const glow = clampGlow(1 + Math.floor(rng() * WILD_GLOW_SHARE * pattern.glowCeiling) + wildGlowBonus(state), pattern.id);
  // rng order: pattern, glow, name prefix, name suffix, id, then the trait rolls.
  const name = generateName(rng);
  const moth: Moth = { id: generateId(state, rng), name, pattern: pattern.id, glow, generation: 1 };
  const trait = scented || rng() < WILD_TRAIT_CHANCE ? randomTrait(rng) : null;
  if (trait) moth.trait = trait;
  state.moths.push(moth);
  addLog(state, `A lantern moth settles by the lamp: ${moth.name}, ${pattern.name.toLowerCase()}-winged and glowing at ${glow}${traitPhrase(moth)}. It followed the light home. It stayed.`);
  noteInAlmanac(state, moth);
  return moth;
}

/** Fill the moth's Almanac entry, if new, and say so in the log. */
export function noteInAlmanac(state: GameState, moth: Moth): void {
  if (!recordAlmanac(state, moth)) return;
  const trait = traitById(moth.trait);
  addLog(state, `A new page in the Wing Almanac: ${patternById(moth.pattern).name} wings, ${trait ? trait.name.toLowerCase() : "no trait"} (${state.almanac.length} filled).`);
}

function randomTrait(rng: () => number): string {
  return MOTH_TRAITS[Math.min(MOTH_TRAITS.length - 1, Math.floor(rng() * MOTH_TRAITS.length))].id;
}

/**
 * A child's trait: one of its parents' traits half the time (when they have
 * any), otherwise a new trait 3% of the time. Rolls in order: inherit,
 * which parent's (only when inheriting), mutate, which trait (only when
 * mutating).
 */
function childTrait(rng: () => number, parentA: Moth, parentB: Moth): string | null {
  const inherited = [parentA.trait, parentB.trait].filter((t): t is string => traitById(t) !== null);
  if (rng() < TRAIT_INHERIT_CHANCE && inherited.length > 0) {
    return inherited[Math.min(inherited.length - 1, Math.floor(rng() * inherited.length))];
  }
  return rng() < TRAIT_MUTATION_CHANCE ? randomTrait(rng) : null;
}

function traitPhrase(moth: Moth): string {
  const trait = traitById(moth.trait);
  return trait ? `, and ${trait.name.toLowerCase()}` : "";
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
export function cocoonDurationMs(parentA: Moth, parentB: Moth, state?: GameState): number {
  const tier = Math.max(patternById(parentA.pattern).tier, patternById(parentB.pattern).tier);
  const fertile = hasTrait(parentA, "fertile") || hasTrait(parentB, "fertile") ? FERTILE_COCOON_MULTIPLIER : 1;
  const silk = state ? almanacCocoonMultiplier(state) : 1;
  return Math.round(COCOON_BASE_MS * (1 + COCOON_PER_TIER * tier) * fertile * silk);
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
  if (postOf(state, parentAId) !== null || postOf(state, parentBId) !== null) return false; // on watch
  if (isAtSea(state, parentAId) || isAtSea(state, parentBId)) return false; // riding a bottle
  const a = mothById(state, parentAId)!;
  const b = mothById(state, parentBId)!;
  const duration = cocoonDurationMs(a, b, state);
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
  const top = MAX_TIER;
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
  const trait = childTrait(rng, parentA, parentB);
  if (trait) child.trait = trait;
  // Last roll: a Starlit or Prismatic cocoon opening in a Stormfront may be Tidelit.
  const stormborn = pattern.tier >= MAX_TIER - 1 && tideAt(now).def.id === "storm" && rng() < TIDELIT_CHANCE;
  if (stormborn) child.pattern = "tidelit";
  state.cocoon = null;
  state.moths.push(child);
  addLog(state, `The cocoon opens: ${child.name}, ${patternById(child.pattern).name.toLowerCase()}-winged, generation ${child.generation}, glowing at ${glow}${traitPhrase(child)}. ${parentA.name} and ${parentB.name} look insufferably proud.`);
  if (stormborn) addLog(state, `${child.name} opened in the storm, and the storm stayed in its wings: a Tidelit moth, bright when the sea is rough and dim when it is still.`);
  noteInAlmanac(state, child);
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
/** Wing Scales a release leaves behind: 1 per tier + 1, and 1 more for a trait. */
export function releaseScales(moth: Moth): number {
  return patternById(moth.pattern).tier + 1 + (traitById(moth.trait) ? 1 : 0);
}

export function releaseMoth(state: GameState, mothId: string): Decimal | null {
  const moth = mothById(state, mothId);
  if (!moth) return null;
  if (isCocoonParent(state, mothId) || isAtSea(state, mothId)) return null;
  const value = releasePayout(state, moth);
  state.moths = state.moths.filter((m) => m.id !== mothId);
  state.mothDuty = state.mothDuty.filter((id) => id !== mothId);
  const post = postOf(state, mothId);
  if (post) delete state.mothPosts[post];
  state.lumen = state.lumen.add(value);
  const scales = releaseScales(moth);
  state.wingScales += scales;
  addLog(state, `${moth.name} drifts out over the glass sea, unhurried. The lamp is dimmer for it. (+${formatNumber(value, state.notation)} Lumen of stored lamplight, +${scales} Wing Scale${scales === 1 ? "" : "s"})`);
  return value;
}

// ── Lighthouse posts ─────────────────────────────────────────────────────────

/**
 * Post a moth at a lit lighthouse (see mothTraits.ts for the support it
 * gives). It stands down from duty; a moth in the cocoon can't go. A moth
 * already posted elsewhere moves; the lighthouse's previous moth returns to
 * the roost. Returns false when nothing changed.
 */
export function postMoth(state: GameState, mothId: string, lighthouseId: string): boolean {
  const moth = mothById(state, mothId);
  if (!moth || !state.litLighthouses.includes(lighthouseId)) return false;
  if (isCocoonParent(state, mothId) || isAtSea(state, mothId)) return false;
  if (state.mothPosts[lighthouseId] === mothId) return false;
  const previous = postOf(state, mothId);
  if (previous) delete state.mothPosts[previous];
  state.mothDuty = state.mothDuty.filter((id) => id !== mothId);
  state.mothPosts[lighthouseId] = mothId;
  addLog(state, `${moth.name} takes up a post at the lamp of ${lighthouseName(lighthouseId)}, wings folded, watching the glass.`);
  return true;
}

/** Bring a lighthouse's posted moth home to the roost. */
export function recallMoth(state: GameState, lighthouseId: string): boolean {
  const id = state.mothPosts[lighthouseId];
  if (!id) return false;
  delete state.mothPosts[lighthouseId];
  const moth = mothById(state, id);
  if (moth) addLog(state, `${moth.name} comes home from ${lighthouseName(lighthouseId)} and settles back into the roost.`);
  return true;
}

/** Posts at lighthouses that have gone dark (the Next Keeping) are vacated. */
export function vacateDarkPosts(state: GameState): void {
  for (const id of Object.keys(state.mothPosts)) {
    if (!state.litLighthouses.includes(id)) delete state.mothPosts[id];
  }
}

function lighthouseName(id: string): string {
  return CHAIN_LIGHTHOUSES.find((l) => l.id === id)?.name ?? "the lighthouse";
}
