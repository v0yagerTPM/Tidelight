import { lighthouseStatus, nextLighthouseId } from "./chain";
import { PRESTIGE_RECOMMENDED_EMBERS, chainLighthouseById } from "./config";
import { productionPerSecond } from "./engine";
import { rekindleGain } from "./prestige";
import type { GameState } from "./types";

// ── The Rekindle moment ──────────────────────────────────────────────────────
// When to Rekindle is the biggest decision in the game: waiting for bigger
// jumps took the balance bot from 42 hours to 15 (design review, after a
// real playthrough whose keeper Rekindled 8 times where the bot did 64).
// The game and the bot share one rule, here, so what the hearth teaches is
// what the pacing is measured on.
//
// Held Embers multiply production, so a run is worth how far it grows them:
// ln(1 + gain ÷ held) per second of run, counting the run as
// REKINDLE_REBUILD_SECONDS longer than it is (what it costs to buy the
// helpers and the chain back). That rate climbs while the run builds and
// falls once the √ in the Ember formula takes over. Its best moment is just
// past the peak: the rate has fallen REKINDLE_PAST_PEAK below its best.
// Without the rebuild time the rate looks best in a run's first minute (the
// √ again), and a keeper following it would Rekindle for nothing.

export const REKINDLE_PAST_PEAK = 0.98;
export const REKINDLE_REBUILD_SECONDS = 900;
/**
 * A relight that costs no more than this much production is worth finishing
 * before a Rekindle (a Rekindle keeps the lighthouses, not the Lumen saved
 * for one). The balance bot saves for a light from the same point.
 */
export const RELIGHT_FIRST_SECONDS = 1800;

/** This run's Ember growth rate right now (0 before the run can bank the recommended 40). */
export function runGrowthRate(state: GameState): number {
  const gain = rekindleGain(state);
  if (gain < PRESTIGE_RECOMMENDED_EMBERS) return 0;
  return Math.log1p(gain / Math.max(1, state.embers)) / (Math.max(0, state.runSeconds) + REKINDLE_REBUILD_SECONDS);
}

/**
 * Note this moment's growth rate in the run's best. Call it as the run goes
 * (the game loop and the balance bot both do). A run from a save before
 * v15 has no length yet: it is estimated as the time this run's lifetime
 * would take at today's rate, so the first reading isn't a false peak.
 */
export function trackRekindleGrowth(state: GameState): number {
  if (state.runSeconds < 0) {
    const rate = productionPerSecond(state);
    const estimate = rate.gt(0) ? state.lifetimeLumen.div(rate).toNumber() : 0;
    state.runSeconds = Number.isFinite(estimate) ? Math.max(0, Math.min(state.playTimeSeconds, estimate)) : 0;
  }
  if (state.activeChallenge !== null) return 0;
  const growth = runGrowthRate(state);
  if (growth > state.runBestGrowth) state.runBestGrowth = growth;
  return growth;
}

export type RekindlePhase =
  /** Before the first recommended Rekindle (fewer than 40 Embers earned): bank 40. */
  | "first"
  /** The run is still growing the Embers faster. */
  | "building"
  /** Past its peak: the run has done its best work. */
  | "best"
  /** Past its peak, but the next lighthouse is close: relight it first. */
  | "relight-first"
  /** A challenge is under way: no Rekindle. */
  | "challenge";

export interface RekindleMoment {
  phase: RekindlePhase;
  /** What a Rekindle now would multiply the Embers held by (1 + gain ÷ held). */
  multiplier: number;
  /** "relight-first": the lighthouse within reach. */
  relightName?: string;
}

/** Where this run stands: what the hearth shows and the balance bot obeys. */
export function rekindleMoment(state: GameState): RekindleMoment {
  const gain = rekindleGain(state);
  const multiplier = 1 + gain / Math.max(1, state.embers);
  if (state.activeChallenge !== null) return { phase: "challenge", multiplier };
  // Until the keeper has earned the recommended first 40 (a keeper who
  // spends Embers in the shop can hold fewer and still be past it).
  if (state.embersTotalEarned < PRESTIGE_RECOMMENDED_EMBERS) return { phase: "first", multiplier };
  const growth = runGrowthRate(state);
  const past = growth > 0 && growth < state.runBestGrowth * REKINDLE_PAST_PEAK;
  if (!past) return { phase: "building", multiplier };
  const next = nextLighthouseId(state);
  if (next) {
    const status = lighthouseStatus(state, next);
    if (status.cost.lte(productionPerSecond(state).mul(RELIGHT_FIRST_SECONDS))) {
      return { phase: "relight-first", multiplier, relightName: status.waymark?.name ?? chainLighthouseById(next)?.name ?? "The next light" };
    }
  }
  return { phase: "best", multiplier };
}
