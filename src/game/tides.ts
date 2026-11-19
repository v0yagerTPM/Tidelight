import { hashSeed, mulberry32 } from "./rng";
import type { GameState } from "./types";

// ── Tide & weather (Sprint 4) ────────────────────────────────────────────────
// The Hollow Sea still breathes on a schedule. Time is divided into
// 30-minute buckets; the tide for a bucket is derived deterministically
// from the bucket index (a seeded hash), so every keeper sees the same
// sea at the same time, the forecast is exact, and tests can pin a time
// and know the tide. Four states cycle by weight:
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
  /** Relative weight in the per-bucket draw (sums to 100). */
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

/** The tide in force at `now` — deterministic in the bucket index. */
export function tideAt(now: number): TideState {
  const bucket = Math.floor(now / TIDE_BUCKET_MS);
  const rng = mulberry32(hashSeed(bucket));
  const total = TIDES.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng() * total;
  let def = TIDES[TIDES.length - 1];
  for (const t of TIDES) {
    roll -= t.weight;
    if (roll < 0) {
      def = t;
      break;
    }
  }
  return { def, bucket, startsAt: bucket * TIDE_BUCKET_MS, endsAt: (bucket + 1) * TIDE_BUCKET_MS };
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
