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
  /** Emoji shown on the collection card. */
  emoji: string;
  /** CSS gradient for the wing swatch on the collection card. */
  swatch: string;
}

export const MOTH_PATTERNS: readonly MothPatternDef[] = [
  { id: "plain",     name: "Plain",     tier: 0, weight: 40, emoji: "🤍", swatch: "linear-gradient(135deg, #e8e0cf, #cfc4ab)" },
  { id: "spotted",   name: "Spotted",   tier: 1, weight: 25, emoji: "💛", swatch: "radial-gradient(circle at 30% 35%, #8a6d3b 18%, transparent 19%), radial-gradient(circle at 68% 62%, #8a6d3b 14%, transparent 15%), linear-gradient(135deg, #f2d492, #dfba6a)" },
  { id: "striped",   name: "Striped",   tier: 2, weight: 16, emoji: "🧡", swatch: "repeating-linear-gradient(45deg, #e8975a 0 6px, #f7cf9f 6px 12px)" },
  { id: "crescent",  name: "Crescent",  tier: 3, weight: 10, emoji: "🌙", swatch: "radial-gradient(circle at 68% 32%, transparent 26%, #7d84b8 27%), linear-gradient(135deg, #4b5480, #7983b5)" },
  { id: "starlit",   name: "Starlit",   tier: 4, weight: 6,  emoji: "⭐", swatch: "radial-gradient(circle at 25% 30%, #fff6c9 8%, transparent 9%), radial-gradient(circle at 70% 55%, #ffe9a8 6%, transparent 7%), radial-gradient(circle at 45% 78%, #fff6c9 5%, transparent 6%), linear-gradient(135deg, #232a52, #3d4a8a)" },
  { id: "prismatic", name: "Prismatic", tier: 5, weight: 3,  emoji: "🌈", swatch: "linear-gradient(135deg, #f28ba8, #f7d774, #8fd18b, #7fb5d9, #b48fd9)" },
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

/** Driftwood Cradle (relic): moths arrive brighter — +10 glow at creation. */
function creationGlowBonus(state: GameState): number {
  return relicMothGlowBonus(state);
}

function clampGlow(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

// ── Unlock, capacity, costs ──────────────────────────────────────────────────

export const MOTH_GENERATOR_ID = "lantern-moth";
export const BASE_MOTH_CAPACITY = 6;
export const ROOST_CAPACITY_PER_EXPANSION = 2;
export const MAX_DUTY_MOTHS = 3;
/** Each duty moth grants +(glow × this)% production — glow 50 → +10%. */
export const DUTY_GLOW_BONUS = 0.002;
export const ATTRACT_BASE_COST = 500;
export const ATTRACT_COST_GROWTH = 2.2;
export const ROOST_BASE_COST = 10_000;
export const ROOST_COST_GROWTH = 6;
export const COCOON_DURATION_MS = 5 * 60 * 1000;

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
 * Cost to attract the next wild moth: ceil(500 × 2.2^owned). The price
 * scales with how many moths you CURRENTLY keep — releasing moths makes
 * attracting cheaper again.
 */
export function attractCost(state: GameState): Decimal {
  return new Decimal(ATTRACT_BASE_COST).mul(new Decimal(ATTRACT_COST_GROWTH).pow(state.moths.length)).ceil();
}

/** Cost of the next roost expansion (+2 capacity): ceil(10,000 × 6^expansions). */
export function roostExpansionCost(state: GameState): Decimal {
  return new Decimal(ROOST_BASE_COST).mul(new Decimal(ROOST_COST_GROWTH).pow(state.roostExpansions)).ceil();
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

/**
 * Attract a wild lantern moth with lamplight and patience. Costs
 * attractCost(); fails (null, no charge) while the garden is locked, the
 * roost is full, or the keeper can't pay. New moths are generation 1.
 */
export function attractMoth(state: GameState, rng: () => number): Moth | null {
  if (!mothsUnlocked(state)) return null;
  if (state.moths.length >= mothCapacity(state)) return null;
  const cost = attractCost(state);
  if (state.lumen.lt(cost)) return null;
  state.lumen = state.lumen.sub(cost);
  const pattern = rollPattern(rng);
  const glow = clampGlow(1 + Math.floor(rng() * 100) + creationGlowBonus(state));
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
 * Start a cocoon from two distinct moths. Only one cocoon at a time; it
 * takes 5 real minutes (timestamp-based, so it progresses while away).
 * Parents are NOT consumed. Hatching — not starting — needs a free slot.
 */
export function startBreeding(state: GameState, parentAId: string, parentBId: string, now: number = Date.now()): boolean {
  if (state.cocoon !== null) return false;
  if (parentAId === parentBId) return false;
  if (!mothById(state, parentAId) || !mothById(state, parentBId)) return false;
  state.cocoon = { parentIds: [parentAId, parentBId], readyAt: now + COCOON_DURATION_MS };
  const a = mothById(state, parentAId)!;
  const b = mothById(state, parentBId)!;
  addLog(state, `${a.name} and ${b.name} spin a cocoon together in the warm dark under the lamp. Five minutes, give or take a dream.`);
  return true;
}

export function cocoonReady(state: GameState, now: number = Date.now()): boolean {
  return state.cocoon !== null && now >= state.cocoon.readyAt;
}

/**
 * Hatch the cocoon into a child moth. Fails (null) when there is no
 * cocoon, it isn't ready, a parent has vanished, or the roost is full.
 * Inheritance: the child's pattern starts from a parent's tier — weighted
 * toward the higher-tier parent (65%) — then shifts ±1 tier with 10%
 * chance each way (clamped 0–5). Glow averages the parents', mutates by
 * −15..+15, with a 5% chance of a bright mutation (+20..+35) instead.
 * Generation is max(parents) + 1. Parents are kept.
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
  // 2. tier shift — 10% up, 10% down
  const shiftRoll = rng();
  let tier = baseTier;
  if (shiftRoll < 0.1) tier += 1;
  else if (shiftRoll < 0.2) tier -= 1;
  const pattern = patternByTier(tier);
  // 3–4. glow mutation — 5% bright (+20..+35), else a −15..+15 drift
  const avgGlow = (parentA.glow + parentB.glow) / 2;
  let delta: number;
  if (rng() < 0.05) {
    delta = 20 + Math.floor(rng() * 16);
  } else {
    delta = Math.round(rng() * 30) - 15;
  }
  const glow = clampGlow(avgGlow + delta + creationGlowBonus(state));
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

/** A moth's base trade-in value: 100 × glow × (pattern tier + 1). */
export function releaseValue(moth: Moth): Decimal {
  return new Decimal(100 * moth.glow * (patternById(moth.pattern).tier + 1));
}

/**
 * Share of the re-attract price a release can pay at most. Attracting is
 * priced on moths currently held, so without this cap an empty roost made
 * attract-then-release a Lumen printer (attract 500, release ~11,000).
 */
export const RELEASE_PAYOUT_CAP = 0.4;

/**
 * What releasing this moth actually pays: its base value, capped at 40% of
 * what attracting a moth will cost once it has gone. The loop always loses.
 */
export function releasePayout(state: GameState, moth: Moth): Decimal {
  const heldAfter = Math.max(0, state.moths.length - 1);
  const reattract = new Decimal(ATTRACT_BASE_COST).mul(new Decimal(ATTRACT_COST_GROWTH).pow(heldAfter)).ceil();
  return Decimal.min(releaseValue(moth), reattract.mul(RELEASE_PAYOUT_CAP).floor());
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
