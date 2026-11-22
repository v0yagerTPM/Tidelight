// ── The Almanac simulation (balance tooling, not part of the game) ───────────
// What it takes to fill the Wing Almanac: a keeper bot plays the Shore with
// the game's own functions (lures, scented lures, cocoons in every nest,
// releases for Wing Scales, a moth riding the Deep Glass Crossing for a
// trait, holding Starlit and Prismatic cocoons for a Stormfront) and goes
// after whichever pages are still missing. scripts/almanac.ts runs it many
// times per scenario and writes the numbers the report draws.
//
// The keeper looks in at check-ins (every few minutes for a devoted one,
// a few times a day for a casual one); lures regrow and cocoons spin in
// between, as they do in the game. Lumen is never the limit here (roost
// expansions are a scenario setting; bottles are paid for).

import { ALMANAC_PATTERNS, ALMANAC_SIZE, ALMANAC_TRAITS } from "../src/game/almanac";
import { claimExpedition, expeditionReady, sendExpedition } from "../src/game/expeditions";
import {
  SCENTED_LURE_SCALES,
  cocoonDurationMs,
  hatchCocoon,
  isCocoonParent,
  lureStatus,
  mothCapacity,
  nestFree,
  patternById,
  releaseMoth,
  scentedAttractMoth,
  startBreeding,
  attractMoth,
} from "../src/game/moths";
import { CROSSING_TRAIT_CHANCE } from "../src/game/mothTraits";
import { mulberry32 } from "../src/game/rng";
import { createInitialState } from "../src/game/state";
import { TIDE_BUCKET_MS, tideAt } from "../src/game/tides";
import type { GameState, Moth } from "../src/game/types";
import Decimal from "break_infinity.js";
import { childOutcomes, expectedChildGlow } from "./breedingOdds";

export type Source = "lure" | "scented" | "bred" | "tidelit" | "hollow" | "rider";

export interface AlmanacScenario {
  id: string;
  name: string;
  /** Minutes between check-ins while the keeper is about. */
  checkMinutes: number;
  /** Hours a day the keeper looks in (from 08:00); 24 = always. */
  wakingHours: number;
  roostExpansions: number;
  /** Ember shop: Moth Lantern, and Quick Lures / Spinning Silk levels. */
  mothLantern: boolean;
  quickLures: number;
  spinningSilk: number;
  /** Whether the ending has been seen (Hollow moths are only possible after it). */
  endingSeen: boolean;
  /** Give up after this many days. */
  maxDays: number;
}

export interface AlmanacRun {
  /** Days to fill every page, or null if not within maxDays. */
  daysToComplete: number | null;
  /** Days at which the almanac reached each count (index = pages filled). */
  daysAtCount: number[];
  /** Days each page was filled, by key. */
  filledAt: Record<string, number>;
  /** How each page was filled. */
  sourceOf: Record<string, Source>;
  lures: number;
  scented: number;
  hatches: number;
  releases: number;
  bottles: number;
  stormHolds: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ALL_KEYS = ALMANAC_PATTERNS.flatMap((p) => ALMANAC_TRAITS.map((t) => `${p}:${t}`));

/** How much a moth is worth keeping (the lowest goes first when the roost needs room). */
function keepValue(state: GameState, moth: Moth, missing: Set<string>): number {
  const tier = patternById(moth.pattern).tier;
  let v = tier * 3 + moth.glow / 25 + (moth.trait ? 4 : 0) + (moth.trait2 ? 4 : 0);
  // The brightest two of each pattern breed the glow up.
  const same = state.moths.filter((m) => m.pattern === moth.pattern).sort((a, b) => b.glow - a.glow);
  if (same.indexOf(moth) < 2) v += 5;
  if (moth.pattern === "prismatic" && moth.glow >= 95) v += 12;
  // A trait carrier for a pattern whose trait pages are missing is a parent to keep.
  if (moth.trait && ALMANAC_PATTERNS.some((p) => missing.has(`${p}:${moth.trait}`))) v += 3;
  return v;
}

function makeRoom(state: GameState, missing: Set<string>, run: AlmanacRun): boolean {
  if (state.moths.length < mothCapacity(state)) return true;
  const atSea = state.expedition?.riderId;
  const candidates = state.moths.filter((m) => !isCocoonParent(state, m.id) && m.id !== atSea);
  if (candidates.length === 0) return false;
  candidates.sort((a, b) => keepValue(state, a, missing) - keepValue(state, b, missing));
  if (releaseMoth(state, candidates[0].id) === null) return false;
  run.releases++;
  return true;
}

/** How much a pair is worth breeding now: the chance of a new page, plus the climb toward Hollow. */
function pairScore(state: GameState, a: Moth, b: Moth, missing: Set<string>, storm: boolean): number {
  let score = 0;
  for (const o of childOutcomes(a, b, { storm, endingSeen: state.endingSeen })) {
    if (o.keys.some((k) => missing.has(k))) score += o.p;
  }
  // Hollow needs two glow-100 Prismatics: value raising the second-best one.
  const hollowMissing = [...missing].some((k) => k.startsWith("hollow:"));
  if (state.endingSeen && hollowMissing && a.pattern === "prismatic" && b.pattern === "prismatic") {
    const prisms = state.moths.filter((m) => m.pattern === "prismatic").map((m) => m.glow).sort((x, y) => y - x);
    const second = prisms[1] ?? 0;
    const gain = Math.max(0, Math.min(100, expectedChildGlow(a, b)) - second);
    score += 0.6 * 0.004 * gain; // 60% the child stays Prismatic
  }
  // A small pull toward higher tiers, so the roost climbs when nothing is close.
  score += 0.0004 * (patternById(a.pattern).tier + patternById(b.pattern).tier);
  return score;
}

function bestPair(state: GameState, missing: Set<string>, storm: boolean): [Moth, Moth] | null {
  const atSea = state.expedition?.riderId;
  const free = state.moths.filter((m) => !isCocoonParent(state, m.id) && m.id !== atSea);
  let best: [Moth, Moth] | null = null;
  let bestScore = 0;
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const s = pairScore(state, free[i], free[j], missing, storm);
      if (s > bestScore) {
        bestScore = s;
        best = [free[i], free[j]];
      }
    }
  }
  return best;
}

/** Whether a ready cocoon is worth holding for a Stormfront (a Tidelit page it could fill is missing). */
function holdForStorm(state: GameState, index: number, missing: Set<string>, now: number): boolean {
  if (tideAt(now).def.id === "storm") return false;
  const c = state.cocoons[index];
  const [a, b] = c.parentIds.map((id) => state.moths.find((m) => m.id === id));
  if (!a || !b) return false;
  if (now - c.readyAt > 10 * HOUR) return false; // a cycle (10 h) always holds a storm; don't wait forever
  return childOutcomes(a, b, { storm: true, endingSeen: state.endingSeen }).some((o) => o.pattern === "tidelit" && o.keys.some((k) => missing.has(k)));
}

/** Simulate one keeper filling the Almanac. Deterministic for a seed. */
export function simulateAlmanac(sc: AlmanacScenario, seed: number): AlmanacRun {
  const rng = mulberry32(seed);
  // Start at a random moment of the tide cycle, at 08:00 of a day.
  const start = Math.floor(rng() * 1000) * DAY + 8 * HOUR;
  const state = createInitialState(start);
  state.lumen = new Decimal("1e300");
  state.generators["lantern-moth"] = 1;
  state.endingSeen = sc.endingSeen;
  state.roostExpansions = sc.roostExpansions;
  if (sc.mothLantern) state.emberPerks.push("moth-lantern");
  state.kindlings = { "quick-lures": sc.quickLures, "spinning-silk": sc.spinningSilk };
  state.mothLureAnchor = start;

  const run: AlmanacRun = { daysToComplete: null, daysAtCount: [0], filledAt: {}, sourceOf: {}, lures: 0, scented: 0, hatches: 0, releases: 0, bottles: 0, stormHolds: 0 };
  const note = (source: Source, now: number) => {
    for (const k of state.almanac) {
      if (run.filledAt[k] !== undefined) continue;
      run.filledAt[k] = (now - start) / DAY;
      run.sourceOf[k] = source;
    }
    while (run.daysAtCount.length <= state.almanac.length) run.daysAtCount.push((now - start) / DAY);
  };
  const missingSet = () => new Set(ALL_KEYS.filter((k) => !state.almanac.includes(k)));

  const step = sc.checkMinutes * 60_000;
  for (let now = start; now < start + sc.maxDays * DAY; now += step) {
    const hourOfDay = ((now - start) / HOUR + 8) % 24;
    if (sc.wakingHours < 24 && (hourOfDay < 8 || hourOfDay >= 8 + sc.wakingHours)) continue;
    let missing = missingSet();
    const storm = tideAt(now).def.id === "storm";

    // 1. Ready cocoons: hatch, unless a Stormfront could make one Tidelit.
    for (let i = state.cocoons.length - 1; i >= 0; i--) {
      if (now < state.cocoons[i].readyAt) continue;
      if (holdForStorm(state, i, missing, now)) {
        run.stormHolds++;
        continue;
      }
      if (!makeRoom(state, missing, run)) break;
      const child = hatchCocoon(state, rng, now, i);
      if (child) {
        run.hatches++;
        note(child.pattern === "hollow" ? "hollow" : child.pattern === "tidelit" ? "tidelit" : "bred", now);
        missing = missingSet();
      }
    }
    // 2. The bottle: bring it home, and send a traitless moth to the deep glass for a trait.
    if (state.expedition && expeditionReady(state, now)) {
      claimExpedition(state, rng, now);
      note("rider", now);
      missing = missingSet();
    }
    if (!state.expedition) {
      const riders = state.moths
        .filter((m) => !m.trait && !isCocoonParent(state, m.id))
        .map((m) => ({ m, gain: ALMANAC_TRAITS.slice(1).filter((t) => missing.has(`${m.pattern}:${t}`)).length * patternById(m.pattern).tier }))
        .filter((x) => x.gain > 0)
        .sort((x, y) => y.gain - x.gain);
      if (riders[0] && CROSSING_TRAIT_CHANCE > 0 && sendExpedition(state, "crossing", now, riders[0].m.id, false)) run.bottles++;
    }
    // 3. Lures, then scented lures, making room as needed.
    while (lureStatus(state, now).held > 0 && makeRoom(state, missing, run)) {
      if (!attractMoth(state, rng, now)) break;
      run.lures++;
      note("lure", now);
      missing = missingSet();
    }
    while (state.wingScales >= SCENTED_LURE_SCALES && makeRoom(state, missing, run)) {
      if (!scentedAttractMoth(state, rng)) break;
      run.scented++;
      note("scented", now);
      missing = missingSet();
    }
    // 4. Fill every free nest with the best pair for the pages still missing.
    while (nestFree(state)) {
      const pair = bestPair(state, missing, storm);
      if (!pair || !startBreeding(state, pair[0].id, pair[1].id, now)) break;
    }
    if (state.almanac.length >= ALMANAC_SIZE) {
      run.daysToComplete = (now - start) / DAY;
      break;
    }
  }
  return run;
}

/** Hatch length for two moths at this keeper's bonuses (for the report's odds table). */
export function cocoonMinutes(state: GameState, a: Moth, b: Moth): number {
  return cocoonDurationMs(a, b, state) / 60_000;
}

export const ALMANAC_KEYS = ALL_KEYS;
export { TIDE_BUCKET_MS };
