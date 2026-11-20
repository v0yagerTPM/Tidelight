import { hashSeed, mulberry32 } from "./rng";
import type { GameState } from "./types";

// ── Tide & weather (Sprint 4) ────────────────────────────────────────────────
// The Hollow Sea still breathes on a schedule. Time is divided into
// 30-minute buckets; the tide for a bucket is derived deterministically
// from the bucket index (a shuffled, seeded cycle: see below), so every
// keeper sees the same sea at the same time, the forecast is exact, and
// tests can pin a time and know the tide. Four states, dealt by weight:
//
//   low    "Low Tide"    chain support ×1.2 — the glass is walkable, supplies flow
//   high   "High Tide"   production ×1.15 — the sea lifts every flame
//   calm   "Glass Calm"  click ×2 — a still sea doubles a steady hand
//   storm  "Stormfront"  production ×1.30 (×1.45 with the Storm in a Bottle
//                        relic) but chain support ×0.8 — glorious, and hungry
//
// Effects flow into engine production (final rate only — tides act on the
// thrown beam, not on what the keepers produce, so chain DEMAND is never
// tide-inflated), engine click value, and chain support. Offline gains are
// NOT tide-affected: over hours away, the tides average out.
//
// Engine/chain functions take an optional `now`; when it is omitted the
// tide is NEUTRAL (all multipliers 1). The game loop in main.ts passes
// Date.now(); the balance sim and the recovery estimate never do, so
// their numbers stay tide-free and comparable.

export type TideId = "low" | "high" | "calm" | "storm";

export interface TideDef {
  id: TideId;
  name: string;
  icon: string;
  /** Plain-words effect, shown in the tide strip and forecast. */
  effectText: string;
  /** Relative weight: its share of every shuffled cycle (sums to 100; see tideCycleCounts). */
  weight: number;
}

export const TIDE_BUCKET_MS = 30 * 60 * 1000;

export const HIGH_TIDE_PRODUCTION_MULTIPLIER = 1.15;
export const CALM_CLICK_MULTIPLIER = 2;
export const LOW_TIDE_SUPPORT_MULTIPLIER = 1.2;
export const STORM_PRODUCTION_MULTIPLIER = 1.3;
/** Storm production multiplier for keepers who own the Storm in a Bottle. */
export const STORM_RELIG_PRODUCTION_MULTIPLIER = 1.45;
export const STORM_SUPPORT_MULTIPLIER = 0.8;
/** A Stormfront's support with the Storm Charts perk (emberShop.ts). */
export const STORM_CHARTS_SUPPORT_MULTIPLIER = 0.9;

export const TIDES: readonly TideDef[] = [
  { id: "low",   name: "Low Tide",   icon: "🌊", effectText: "Chain support ×1.2 — supplies flow easily over the exposed glass.", weight: 30 },
  { id: "high",  name: "High Tide",  icon: "🌕", effectText: "Production ×1.15 — the risen sea lifts every flame.",              weight: 30 },
  { id: "calm",  name: "Glass Calm", icon: "🪞", effectText: "Click ×2 — a still sea doubles a steady hand.",                    weight: 25 },
  { id: "storm", name: "Stormfront", icon: "⛈️", effectText: "Production ×1.30, but chain support ×0.8 — glorious, and hungry.", weight: 15 },
];

export function tideDefById(id: TideId): TideDef {
  return TIDES.find((t) => t.id === id) ?? TIDES[0];
}

export interface TideState {
  def: TideDef;
  /** The 30-minute bucket index this tide belongs to. */
  bucket: number;
  /** Unix timestamp (ms) the tide began. */
  startsAt: number;
  /** Unix timestamp (ms) the tide turns. */
  endsAt: number;
}

// ── The tide sequence: a shuffled bag (design review) ───────────────────────
// Each bucket used to be an independent weighted draw, so 26% of turns
// repeated the tide before them and the strip could read "Glass Calm ·
// next: Glass Calm" for hours. Now the sea deals its tides like weather:
// every TIDE_CYCLE_LENGTH buckets (10 hours) hold exactly the weighted
// share of each tide (6 Low, 6 High, 5 Glass Calm, 3 Stormfront), shuffled
// by a seed from the cycle index, so it is still the same sea for every
// keeper and the forecast is still exact. No tide ever follows itself: a
// cycle never repeats inside, and every cycle opens on Low or High Tide and
// closes on Glass Calm or a Stormfront, so the seam between two cycles can't
// repeat either (and no cycle has to look at the one before it).

/** Buckets in one shuffled cycle of tides: 20 × 30 minutes = 10 hours. */
export const TIDE_CYCLE_LENGTH = 20;
/** Tides a cycle may open with, and close with (disjoint, so seams never repeat). */
const CYCLE_OPENERS: readonly TideId[] = ["low", "high"];
const CYCLE_CLOSERS: readonly TideId[] = ["calm", "storm"];

/** How many of each tide one cycle holds: its weight's share of the cycle. */
export function tideCycleCounts(): Record<TideId, number> {
  const total = TIDES.reduce((sum, t) => sum + t.weight, 0);
  const counts = {} as Record<TideId, number>;
  for (const t of TIDES) counts[t.id] = Math.round((t.weight / total) * TIDE_CYCLE_LENGTH);
  return counts;
}

/** Pick an id from `ids` with probability ∝ its remaining count. */
function pickWeighted(ids: TideId[], counts: Record<TideId, number>, rng: () => number): TideId {
  const total = ids.reduce((sum, id) => sum + counts[id], 0);
  let roll = rng() * total;
  for (const id of ids) {
    roll -= counts[id];
    if (roll < 0) return id;
  }
  return ids[ids.length - 1];
}

/**
 * Lay out one cycle: the closer is drawn first, then the rest are placed
 * front to back, each drawn by remaining count among the tides allowed
 * there (not the one before it; an opener first; not the closer last),
 * backing up if a choice leaves the rest impossible. Deterministic in rng.
 */
function layCycle(cycle: number): TideId[] {
  const rng = mulberry32(hashSeed(cycle * 2 + 1)); // odd seeds: apart from any other use of hashSeed
  const counts = tideCycleCounts();
  const closer = pickWeighted([...CYCLE_CLOSERS], counts, rng);
  counts[closer]--;
  const n = TIDE_CYCLE_LENGTH - 1;
  const out: TideId[] = [];
  const place = (pos: number): boolean => {
    if (pos === n) return true;
    let options = TIDES.map((t) => t.id).filter((id) => counts[id] > 0 && id !== out[pos - 1]);
    if (pos === 0) options = options.filter((id) => CYCLE_OPENERS.includes(id));
    if (pos === n - 1) options = options.filter((id) => id !== closer);
    while (options.length > 0) {
      const id = pickWeighted(options, counts, rng);
      options = options.filter((o) => o !== id);
      out.push(id);
      counts[id]--;
      if (place(pos + 1)) return true;
      counts[id]++;
      out.pop();
    }
    return false;
  };
  if (!place(0)) throw new Error(`tide cycle ${cycle} could not be laid out`);
  out.push(closer);
  return out;
}

// tideAt runs many times a second; a cycle covers 10 hours, so a handful
// of cached cycles serve the strip, the forecast and any time-away report.
const cycleCache = new Map<number, TideId[]>();
const CYCLE_CACHE_SIZE = 8;

/** The tides of one cycle, in order (TIDE_CYCLE_LENGTH of them). */
export function tideCycle(cycle: number): TideId[] {
  let ids = cycleCache.get(cycle);
  if (!ids) {
    ids = layCycle(cycle);
    if (cycleCache.size >= CYCLE_CACHE_SIZE) cycleCache.delete(cycleCache.keys().next().value as number);
    cycleCache.set(cycle, ids);
  }
  return ids;
}

/** The tide in force at `now`: deterministic in the bucket index (its cycle, and its place in it). */
export function tideAt(now: number): TideState {
  const bucket = Math.floor(now / TIDE_BUCKET_MS);
  const cycle = Math.floor(bucket / TIDE_CYCLE_LENGTH);
  const id = tideCycle(cycle)[bucket - cycle * TIDE_CYCLE_LENGTH];
  return { def: tideDefById(id), bucket, startsAt: bucket * TIDE_BUCKET_MS, endsAt: (bucket + 1) * TIDE_BUCKET_MS };
}

/** [current, next, next+1] tides with their start/end times. */
export function tideForecast(now: number): TideState[] {
  return [tideAt(now), tideAt(now + TIDE_BUCKET_MS), tideAt(now + 2 * TIDE_BUCKET_MS)];
}

// ── Effect multipliers (neutral when `now` is omitted) ──────────────────────

/** Final-production multiplier from the tide at `now`. */
export function tideProductionMultiplier(state: GameState, now?: number): number {
  if (now === undefined) return 1;
  const id = tideAt(now).def.id;
  if (id === "high") return HIGH_TIDE_PRODUCTION_MULTIPLIER;
  if (id === "storm") {
    return state.relics.includes("storm-in-a-bottle")
      ? STORM_RELIG_PRODUCTION_MULTIPLIER
      : STORM_PRODUCTION_MULTIPLIER;
  }
  return 1;
}

/** Chain-support multiplier from the tide at `now`. */
export function tideSupportMultiplier(now?: number, state?: GameState): number {
  if (now === undefined) return 1;
  const id = tideAt(now).def.id;
  if (id === "low") return LOW_TIDE_SUPPORT_MULTIPLIER;
  // Storm Charts (Ember perk) halve a Stormfront's drain: ×0.8 → ×0.9.
  // (The perk id is read directly: this module stays a leaf.)
  if (id === "storm") return state?.emberPerks.includes("storm-charts") ? STORM_CHARTS_SUPPORT_MULTIPLIER : STORM_SUPPORT_MULTIPLIER;
  return 1;
}

/** Click-value multiplier from the tide at `now`. */
export function tideClickMultiplier(now?: number): number {
  if (now === undefined) return 1;
  return tideAt(now).def.id === "calm" ? CALM_CLICK_MULTIPLIER : 1;
}
