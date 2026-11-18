import { BOT_CLICK_RATE, BOT_CLICK_WINDOW_SECONDS, botBuyPhase } from "./bot";
import { clickBeam, productionPerSecond, tick } from "./engine";
import { canRekindle, rekindle } from "./prestige";
import { deserializeState, serializeState } from "./state";
import type { GameState } from "./types";

// ── Rekindle recovery preview (Sprint 3) ─────────────────────────────────────
// "If I Rekindle now, how long until I'm back at this production rate?"
// Clone the state (through the save serializer, so the clone is a real,
// independent GameState), apply the Rekindle with the currently available
// Ember gain, then let the shared greedy bot (bot.ts — the same strategy
// scripts/simulate.ts reports on) play the new run in coarse 10-second
// steps until its production/sec meets or beats the player's current one.
//
// Deterministic and bounded: the sim caps at 600 minutes and returns null
// past it. It is NOT cheap enough to run per frame (≈350 ms at 3B Lumen/s):
// the UI runs it a few milliseconds per frame through
// createRecoveryEstimator, only while the Rekindle view is open, and only
// when the Ember gain has moved materially.

/** Hard cap on the recovery simulation, in minutes. */
export const RECOVERY_CAP_MINUTES = 600;
const STEP_SECONDS = 10;

/**
 * A recovery estimate that runs a slice at a time, so the UI can spread
 * the simulation over many frames instead of blocking one (late in the
 * game a full run takes hundreds of milliseconds). `step(budgetMs)`
 * advances it for about that long and returns true once `result` holds
 * the answer (minutes, or null past the cap / when no Rekindle is possible).
 */
export interface RecoveryEstimator {
  step(budgetMs: number): boolean;
  readonly done: boolean;
  readonly result: number | null;
}

export function createRecoveryEstimator(state: GameState, clock: () => number = () => performance.now()): RecoveryEstimator {
  let done = false;
  let result: number | null = null;
  const finish = (value: number | null): boolean => {
    done = true;
    result = value;
    return true;
  };

  const target = productionPerSecond(state);
  let clone: GameState | null = null;
  if (target.gt(0) && canRekindle(state)) {
    // includes "in a challenge" and "< 1 Ember"
    clone = deserializeState(serializeState(state));
    if (clone && rekindle(clone) < 1) clone = null;
  }
  if (!clone) finish(null);

  const capSeconds = RECOVERY_CAP_MINUTES * 60;
  let t = 0;
  return {
    get done() {
      return done;
    },
    get result() {
      return result;
    },
    step(budgetMs: number): boolean {
      if (done || !clone) return true;
      const until = clock() + budgetMs;
      do {
        if (t > capSeconds) return finish(null);
        botBuyPhase(clone, t);
        if (productionPerSecond(clone).gte(target)) return finish(t / 60);
        // The bot clicks once per 2s for the first 10 minutes of the new run.
        if (t < BOT_CLICK_WINDOW_SECONDS) {
          const clicks = Math.round(STEP_SECONDS * BOT_CLICK_RATE);
          for (let i = 0; i < clicks; i++) clickBeam(clone);
        }
        tick(clone, STEP_SECONDS);
        t += STEP_SECONDS;
      } while (clock() < until);
      return false;
    },
  };
}

/** The whole estimate in one go (tests and tools; the UI uses the stepped estimator). */
export function estimateRecoveryMinutes(state: GameState): number | null {
  const estimator = createRecoveryEstimator(state);
  estimator.step(Infinity);
  return estimator.result;
}
