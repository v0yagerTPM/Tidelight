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
// past it. It is NOT cheap enough to run per frame — callers should
// compute it when the Rekindle view renders / its inputs change
// materially, and cache the result.

/** Hard cap on the recovery simulation, in minutes. */
export const RECOVERY_CAP_MINUTES = 600;
const STEP_SECONDS = 10;

export function estimateRecoveryMinutes(state: GameState): number | null {
  const target = productionPerSecond(state);
  if (target.lte(0)) return null;
  if (!canRekindle(state)) return null; // includes "in a challenge" and "< 1 Ember"

  const clone = deserializeState(serializeState(state));
  if (!clone) return null;
  if (rekindle(clone) < 1) return null;

  const capSeconds = RECOVERY_CAP_MINUTES * 60;
  let t = 0;
  while (t <= capSeconds) {
    botBuyPhase(clone, t);
    if (productionPerSecond(clone).gte(target)) return t / 60;
    // The bot clicks once per 2s for the first 10 minutes of the new run.
    if (t < BOT_CLICK_WINDOW_SECONDS) {
      const clicks = Math.round(STEP_SECONDS * BOT_CLICK_RATE);
      for (let i = 0; i < clicks; i++) clickBeam(clone);
    }
    tick(clone, STEP_SECONDS);
    t += STEP_SECONDS;
  }
  return null;
}
