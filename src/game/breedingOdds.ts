// ── Breeding odds, exactly ───────────────────────────────────────────────────
// The odds of a cocoon's child, worked out from the rules in moths.ts
// hatchCocoon rather than sampled: which wing pattern, which trait, the
// Tidelit and Hollow chances. The Moth Garden shows them for a pair
// (pairForecast); scripts/almanacSim.ts uses them to choose breeding pairs;
// tests/breedingOdds.test.ts checks them against the game's own hatchCocoon,
// so the two can't drift apart unnoticed.

import {
  HOLLOW_CHANCE,
  MAX_TIER,
  PRISMATIC_TRUE_CHANCE,
  TIDELIT_CHANCE,
  TIER_DOWN_CHANCE,
  TIER_UP_CHANCE,
  TRAIT_INHERIT_CHANCE as INHERIT,
  TRAIT_MUTATION_CHANCE as MUTATE,
  patternById,
  patternByTier,
} from "./moths";
import { MOTH_TRAITS, traitById } from "./mothTraits";
import type { GameState, Moth } from "./types";

/** The higher-tier parent's pattern is the starting point this often (moths.ts: hatchCocoon step 1). */
export const HIGHER_PARENT_CHANCE = 0.65;

/** Wing pattern of the child, before the storm and the ending have their say: tier → probability. */
export function childTierOdds(a: Moth, b: Moth): Map<number, number> {
  const tA = patternById(a.pattern).tier;
  const tB = patternById(b.pattern).tier;
  const out = new Map<number, number>();
  const add = (tier: number, p: number) => out.set(tier, (out.get(tier) ?? 0) + p);
  const bases: [number, number][] = tA === tB ? [[tA, 1]] : [[Math.max(tA, tB), HIGHER_PARENT_CHANCE], [Math.min(tA, tB), 1 - HIGHER_PARENT_CHANCE]];
  for (const [base, pb] of bases) {
    if (base >= MAX_TIER) {
      // Prismatic (and above) is unstable: true 60%, else Starlit.
      add(patternByTier(base).tier, pb * PRISMATIC_TRUE_CHANCE);
      add(MAX_TIER - 1, pb * (1 - PRISMATIC_TRUE_CHANCE));
    } else {
      add(patternByTier(base + 1).tier, pb * TIER_UP_CHANCE);
      add(patternByTier(base - 1).tier, pb * TIER_DOWN_CHANCE);
      add(base, pb * (1 - TIER_UP_CHANCE - TIER_DOWN_CHANCE));
    }
  }
  return out;
}

/** The child's trait (null = none): trait → probability. */
export function childTraitOdds(a: Moth, b: Moth): Map<string | null, number> {
  const inherited = [a.trait, b.trait].filter((t): t is string => traitById(t) !== null);
  const out = new Map<string | null, number>();
  const add = (t: string | null, p: number) => out.set(t, (out.get(t) ?? 0) + p);
  const pInherit = inherited.length > 0 ? INHERIT : 0;
  for (const t of inherited) add(t, pInherit / inherited.length);
  const rest = 1 - pInherit;
  for (const t of MOTH_TRAITS) add(t.id, (rest * MUTATE) / MOTH_TRAITS.length);
  add(null, rest * (1 - MUTATE));
  return out;
}

export interface ChildOutcome {
  pattern: string;
  /** The Almanac pages the child fills (a Hollow child can fill two). */
  keys: string[];
  p: number;
}

const key = (pattern: string, trait: string | null | undefined) => `${pattern}:${trait ?? "none"}`;

/**
 * Every outcome of a cocoon from `a` and `b`, with its probability: pattern
 * and trait, then a Starlit or Prismatic child opening in a Stormfront is
 * Tidelit 5% of the time (`storm`), and after the ending two glow-100
 * Prismatics have a 2% Hollow child carrying up to two of the family's traits.
 */
export function childOutcomes(a: Moth, b: Moth, opts: { storm: boolean; endingSeen: boolean }): ChildOutcome[] {
  const tiers = childTierOdds(a, b);
  const traits = childTraitOdds(a, b);
  const perfect = (m: Moth) => m.pattern === "prismatic" && m.glow >= 100;
  const hollowP = opts.endingSeen && perfect(a) && perfect(b) ? HOLLOW_CHANCE : 0;
  const out: ChildOutcome[] = [];
  for (const [tier, pt] of tiers) {
    const pattern = patternByTier(tier).id;
    for (const [trait, pr] of traits) {
      const p = pt * pr;
      if (p <= 0) continue;
      const tideP = opts.storm && tier >= MAX_TIER - 1 ? TIDELIT_CHANCE : 0;
      // Hollow overrides everything else; Tidelit overrides the bred pattern.
      if (hollowP > 0) {
        const family = [...new Set([a.trait, b.trait, a.trait2, b.trait2, trait])].filter((t): t is string => traitById(t) !== null);
        const keys = family.length === 0 ? [key("hollow", null)] : family.slice(0, 2).map((t) => key("hollow", t));
        out.push({ pattern: "hollow", keys, p: p * hollowP });
      }
      const rest = p * (1 - hollowP);
      if (tideP > 0) out.push({ pattern: "tidelit", keys: [key("tidelit", trait)], p: rest * tideP });
      out.push({ pattern, keys: [key(pattern, trait)], p: rest * (1 - tideP) });
    }
  }
  return out;
}

/** Expected glow of the child (before the ceiling): the parents' average − 1, or a bright jump 3% of the time. */
export function expectedChildGlow(a: Moth, b: Moth): number {
  const avg = (a.glow + b.glow) / 2;
  const bright = 0.03 * (avg + 11.5 * (avg >= 90 ? 0.5 : 1));
  const normal = 0.97 * (avg - 1);
  return bright + normal;
}

/** What a pair's cocoon may bring, for the Moth Garden: wing odds and missing Almanac pages. */
export interface PairForecast {
  /** Wing pattern → chance, most likely first (Tidelit only when `storm`). */
  wings: { pattern: string; p: number }[];
  /** Almanac pages the child could fill that the keeper is missing, likeliest first. */
  newPages: { key: string; p: number }[];
  /** The Tidelit chance if this cocoon opens in a Stormfront (0 when it can't be Tidelit). */
  tidelitInStorm: number;
  /** Without `storm`: the missing Tidelit pages it could fill if it opened in a Stormfront. */
  stormPages: { key: string; p: number }[];
}

/**
 * The forecast for a cocoon from `a` and `b`. `storm`: the cocoon will open
 * in a Stormfront (it is set to wait for one), so Tidelit is in the odds.
 */
export function pairForecast(state: GameState, a: Moth, b: Moth, storm: boolean): PairForecast {
  const outcomes = childOutcomes(a, b, { storm, endingSeen: state.endingSeen });
  const wings = new Map<string, number>();
  const pages = new Map<string, number>();
  const have = new Set(state.almanac);
  for (const o of outcomes) {
    wings.set(o.pattern, (wings.get(o.pattern) ?? 0) + o.p);
    for (const k of o.keys) if (!have.has(k)) pages.set(k, (pages.get(k) ?? 0) + o.p);
  }
  const stormed = childOutcomes(a, b, { storm: true, endingSeen: state.endingSeen }).filter((o) => o.pattern === "tidelit");
  const tidelitInStorm = stormed.reduce((s, o) => s + o.p, 0);
  const stormPages = new Map<string, number>();
  if (!storm) for (const o of stormed) for (const k of o.keys) if (!have.has(k)) stormPages.set(k, (stormPages.get(k) ?? 0) + o.p);
  const byP = <T extends { p: number }>(x: T, y: T) => y.p - x.p;
  return {
    wings: [...wings].map(([pattern, p]) => ({ pattern, p })).sort(byP),
    newPages: [...pages].map(([key, p]) => ({ key, p })).sort(byP),
    tidelitInStorm,
    stormPages: [...stormPages].map(([key, p]) => ({ key, p })).sort(byP),
  };
}

/** A suggested pair for the next cocoon (suggestPair). */
export interface PairSuggestion {
  a: Moth;
  b: Moth;
  /** The chance its hatchling fills a page you're missing (opening in a Stormfront when that helps). */
  newPage: number;
  /** It does better opening in a Stormfront (it could hatch a missing Tidelit page). */
  storm: boolean;
}

/** The chance a cocoon from `a` and `b` fills any Almanac page not yet filled. */
export function newPageChance(state: GameState, a: Moth, b: Moth, storm: boolean): number {
  const have = new Set(state.almanac);
  return childOutcomes(a, b, { storm, endingSeen: state.endingSeen })
    .filter((o) => o.keys.some((k) => !have.has(k)))
    .reduce((s, o) => s + o.p, 0);
}

/**
 * The pair, among `moths`, likeliest to fill a page you're missing; when
 * none can, or to break ties, the pair whose hatchling has the rarest wings
 * and the brightest glow, toward the glow-100 Prismatics the Hollow pages
 * ask for. The Moth Garden pre-selects it in an empty nest (a player asked).
 */
export function suggestPair(state: GameState, moths: Moth[]): PairSuggestion | null {
  let best: PairSuggestion | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < moths.length; i++) {
    for (let j = i + 1; j < moths.length; j++) {
      const a = moths[i];
      const b = moths[j];
      const calm = newPageChance(state, a, b, false);
      const canStorm = Math.max(patternById(a.pattern).tier, patternById(b.pattern).tier) >= MAX_TIER - 1;
      const stormy = canStorm ? newPageChance(state, a, b, true) : calm;
      const storm = stormy > calm + 1e-12;
      const newPage = Math.max(calm, stormy);
      let tier = 0;
      for (const [t, p] of childTierOdds(a, b)) tier += t * p;
      const score = newPage * 1e6 + tier * 100 + expectedChildGlow(a, b);
      if (score > bestScore) {
        bestScore = score;
        best = { a, b, newPage, storm };
      }
    }
  }
  return best;
}
