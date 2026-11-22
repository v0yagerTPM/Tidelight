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
  openPlaces,
  patternById,
  releaseMoth,
  scentedAttractMoth,
  spareMoths,
  setStormWait,
  stormHatchAt,
  tendCocoons,
  startBreeding,
  attractMoth,
} from "../src/game/moths";
import { CROSSING_TRAIT_CHANCE } from "../src/game/mothTraits";
import { mulberry32 } from "../src/game/rng";
import { createInitialState } from "../src/game/state";
import { TIDE_BUCKET_MS, tideAt } from "../src/game/tides";
import type { GameState, Moth } from "../src/game/types";
import Decimal from "break_infinity.js";
import { childOutcomes, expectedChildGlow } from "../src/game/breedingOdds";

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
  /** Release taps: a bulk release of the spares counts once a visit. */
  releaseActions: number;
  /** Moths let go on arrival (state.autoReleaseSpares): no tap at all. */
  autoReleases: number;
  bottles: number;
  /** Cocoons the keeper set to wait for a Stormfront. */
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
  // The brightest Prismatics of each family a missing Hollow page needs (none, or a trait).
  if (moth.pattern === "prismatic") {
    for (const fam of hollowFamilies(missing)) {
      if (!inFamily(moth, fam)) continue;
      const kin = state.moths.filter((m) => m.pattern === "prismatic" && inFamily(m, fam)).sort((a, b) => b.glow - a.glow);
      if (kin.indexOf(moth) < 2) v += 8;
    }
  }
  // A trait carrier for a pattern whose trait pages are missing is a parent to keep.
  if (moth.trait && ALMANAC_PATTERNS.some((p) => missing.has(`${p}:${moth.trait}`))) v += 3;
  return v;
}

/** Per visit: whether the keeper has pressed Release spares yet. */
const visit = { spareTapped: false };

/**
 * Room for a hatchling (`hatch`: a free roost place) or for a new moth or
 * cocoon (`new`: a place no spinning cocoon has kept, moths.openPlaces).
 * Releases the moth worth least, never one of `keep`.
 */
function makeRoom(state: GameState, missing: Set<string>, run: AlmanacRun, need: "hatch" | "new" = "new", keep: Moth[] = []): boolean {
  if (need === "hatch" ? state.moths.length < mothCapacity(state) : openPlaces(state) > 0) return true;
  // The keeper releases the moth worth least to the chase. Counting taps: a
  // spare (moths.spareMoths) goes with one Release spares tap a visit; any
  // other release is a tap of its own.
  const atSea = state.expedition?.riderId;
  const candidates = state.moths.filter((m) => !isCocoonParent(state, m.id) && m.id !== atSea && !keep.includes(m));
  if (candidates.length === 0) return false;
  candidates.sort((a, b) => keepValue(state, a, missing) - keepValue(state, b, missing));
  const spare = spareMoths(state).some((m) => m.id === candidates[0].id);
  if (releaseMoth(state, candidates[0].id, false) === null) return false;
  run.releases++;
  if (!spare) run.releaseActions++;
  else if (!visit.spareTapped) {
    visit.spareTapped = true;
    run.releaseActions++;
  }
  return true;
}

/**
 * The families a missing Hollow page needs a glow-100 Prismatic from:
 * "none" (Hollow with no trait needs two traitless parents) or a trait (a
 * parent carrying it).
 */
function hollowFamilies(missing: Set<string>): string[] {
  return [...missing].filter((k) => k.startsWith("hollow:")).map((k) => k.slice("hollow:".length));
}
function inFamily(m: Moth, fam: string): boolean {
  return fam === "none" ? !m.trait && !m.trait2 : m.trait === fam || m.trait2 === fam;
}

/** How much a pair is worth breeding now: the chance of a new page, plus the climb toward Hollow. */
function pairScore(state: GameState, a: Moth, b: Moth, missing: Set<string>, storm: boolean): number {
  let score = 0;
  for (const o of childOutcomes(a, b, { storm, endingSeen: state.endingSeen })) {
    if (o.keys.some((k) => missing.has(k))) score += o.p;
  }
  // Hollow needs two glow-100 Prismatics, of the right family for the page:
  // value raising the second-brightest of each family still short of a page.
  // (Breeding for the brightest Prismatic alone stalled on Hollow with no
  // trait, which needs two traitless ones.)
  if (state.endingSeen && a.pattern === "prismatic" && b.pattern === "prismatic") {
    const child = Math.min(100, expectedChildGlow(a, b));
    for (const fam of hollowFamilies(missing)) {
      // How likely the child joins the family: traitless parents stay traitless 97%;
      // a carrier passes its trait half the time, split between the parents' traits.
      const traits = [a.trait, b.trait].filter(Boolean);
      const pFam = fam === "none" ? (traits.length === 0 ? 0.97 : 0.485) : traits.includes(fam) ? 0.5 * (traits.filter((t) => t === fam).length / traits.length) : 0.005;
      if (pFam <= 0.01) continue;
      const kin = state.moths.filter((m) => m.pattern === "prismatic" && inFamily(m, fam)).map((m) => m.glow).sort((x, y) => y - x);
      const second = kin[1] ?? 0;
      score += 0.6 * pFam * 0.004 * Math.max(0, child - second); // 60% the child stays Prismatic
    }
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

/** Whether a pair's cocoon should wait for a Stormfront (a Tidelit page it could fill is missing). */
function worthAStorm(state: GameState, a: Moth, b: Moth, missing: Set<string>): boolean {
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
  // The keeper chooses its own releases (it turns its roost over by what each
  // moth is worth to the chase), so "Let spares go" stays off: on, it threw
  // away trait carriers the keeper would have bred from, and the chase slowed.
  state.autoReleaseSpares = false;

  const run: AlmanacRun = { daysToComplete: null, daysAtCount: [0], filledAt: {}, sourceOf: {}, lures: 0, scented: 0, hatches: 0, releases: 0, releaseActions: 0, autoReleases: 0, bottles: 0, stormHolds: 0 };
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
    visit.spareTapped = false;

    // 1. Cocoons set to wait for a Stormfront opened by themselves when one came
    //    (moths.tendCocoons, as the game does live and on return); then the
    //    keeper hatches the other ready ones.
    if (state.cocoons.some((_, i) => (stormHatchAt(state, i) ?? Infinity) <= now)) makeRoom(state, missing, run, "hatch");
    for (const child of tendCocoons(state, rng, now)) {
      run.hatches++;
      note(child.pattern === "hollow" ? "hollow" : child.pattern === "tidelit" ? "tidelit" : "bred", now);
      missing = missingSet();
    }
    for (let i = state.cocoons.length - 1; i >= 0; i--) {
      if (now < state.cocoons[i].readyAt || state.cocoons[i].stormWait) continue;
      if (!makeRoom(state, missing, run, "hatch")) break;
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
      const moth = attractMoth(state, rng, now);
      if (!moth) break;
      run.lures++;
      if (!state.moths.includes(moth)) run.autoReleases++;
      note("lure", now);
      missing = missingSet();
    }
    while (state.wingScales >= SCENTED_LURE_SCALES && makeRoom(state, missing, run)) {
      const moth = scentedAttractMoth(state, rng);
      if (!moth) break;
      run.scented++;
      if (!state.moths.includes(moth)) run.autoReleases++;
      note("scented", now);
      missing = missingSet();
    }
    // 4. Fill every free nest with the best pair for the pages still missing.
    while (nestFree(state)) {
      const pair = bestPair(state, missing, true);
      // A cocoon keeps a place for its hatchling: make one first.
      if (!pair || !makeRoom(state, missing, run, "new", pair) || !startBreeding(state, pair[0].id, pair[1].id, now)) break;
      // A pair that could hatch a missing Tidelit page waits for a Stormfront.
      if (worthAStorm(state, pair[0], pair[1], missing)) {
        setStormWait(state, state.cocoons.length - 1, true);
        run.stormHolds++;
      }
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
