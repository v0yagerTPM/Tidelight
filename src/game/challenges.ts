import Decimal from "break_infinity.js";
import { GENERATORS } from "./config";
import { resetRun } from "./prestige";
import { addLog } from "./state";
import type { GameState } from "./types";

// ── Challenges (Sprint 3) ────────────────────────────────────────────────────
// Opt-in, rule-changing runs. Starting one performs the same run reset as
// Rekindle (prestige.resetRun) but grants NO Embers. While a challenge is
// active, normal Rekindle is disabled (see prestige.canRekindle). The goal
// is tracked against the run's lifetime Lumen; the moment it is reached
// (checked on every credit, in engine.ts) the challenge completes: the
// reward becomes permanent, the challenge ends, and the run CONTINUES —
// no reset. Abandoning resets the run with no Embers and no reward.
// A completed challenge can never be run again for a second reward.
//
// Rules and rewards flow through the engine via the modifier helpers here:
//   fogbound        rule ×0.5 all production      → reward "Fog Lamps": ×1.25 all production
//   still-hands     rule clicking yields 0        → reward "Patient Keeper": ×1.2 all production
//   first-light-only rule only generator tiers 1–3 → reward "Humble Mastery": tiers 1–3 ×2

export interface ChallengeDef {
  id: string;
  name: string;
  /** Plain-words rule, shown in the UI. */
  ruleText: string;
  /** Plain-words reward, shown in the UI. */
  rewardName: string;
  rewardText: string;
  /** Run lifetime Lumen that completes the challenge. */
  goalLifetime: number;
}

export const FOGBOUND_PRODUCTION_MULTIPLIER = 0.5;
export const FOG_LAMPS_MULTIPLIER = 1.25;
export const PATIENT_KEEPER_MULTIPLIER = 1.2;
export const HUMBLE_MASTERY_MULTIPLIER = 2;
/** Generators with a tier index below this are "the first three tiers". */
export const EARLY_TIER_COUNT = 3;

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: "fogbound",
    name: "Fogbound",
    ruleText: "A sea-fog swallows half of everything: all production ×0.5 for the whole run.",
    rewardName: "Fog Lamps",
    rewardText: "All production +25%, permanently.",
    goalLifetime: 1_000_000,
  },
  {
    id: "still-hands",
    name: "Still Hands",
    ruleText: "The keeper's hands must rest: Flash the Beam yields 0 Lumen for the whole run.",
    rewardName: "Patient Keeper",
    rewardText: "All production +20%, permanently.",
    goalLifetime: 250_000,
  },
  {
    id: "first-light-only",
    name: "First Light Only",
    ruleText: "Only the first three helpers may be hired — Candle Crab, Lantern Moth and Tide Bell. Nothing bigger.",
    rewardName: "Humble Mastery",
    rewardText: "Candle Crab, Lantern Moth and Tide Bell production ×2, permanently.",
    goalLifetime: 100_000,
  },
];

export function challengeById(id: string): ChallengeDef {
  const def = CHALLENGES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown challenge id: ${id}`);
  return def;
}

export function activeChallenge(state: GameState): ChallengeDef | null {
  return state.activeChallenge === null ? null : challengeById(state.activeChallenge);
}

export function isChallengeCompleted(state: GameState, id: string): boolean {
  return state.completedChallenges.includes(id);
}

// ── Modifiers (read by the engine on every calculation) ─────────────────────

/**
 * Global production multiplier from challenges: the active rule (Fogbound
 * ×0.5) times every banked reward (Fog Lamps ×1.25, Patient Keeper ×1.2).
 */
export function challengeProductionMultiplier(state: GameState): number {
  let mult = 1;
  if (state.activeChallenge === "fogbound") mult *= FOGBOUND_PRODUCTION_MULTIPLIER;
  if (isChallengeCompleted(state, "fogbound")) mult *= FOG_LAMPS_MULTIPLIER;
  if (isChallengeCompleted(state, "still-hands")) mult *= PATIENT_KEEPER_MULTIPLIER;
  return mult;
}

/** Per-generator multiplier: Humble Mastery doubles tiers 1–3 once earned. */
export function challengeTierMultiplier(state: GameState, generatorId: string): number {
  if (!isChallengeCompleted(state, "first-light-only")) return 1;
  const tier = GENERATORS.findIndex((g) => g.id === generatorId);
  return tier >= 0 && tier < EARLY_TIER_COUNT ? HUMBLE_MASTERY_MULTIPLIER : 1;
}

/** Click multiplier: Still Hands reduces the beam to nothing while active. */
export function challengeClickMultiplier(state: GameState): number {
  return state.activeChallenge === "still-hands" ? 0 : 1;
}

/** Buy gating: First Light Only blocks every generator past tier 3. */
export function canBuyGenerator(state: GameState, generatorId: string): boolean {
  if (state.activeChallenge !== "first-light-only") return true;
  const tier = GENERATORS.findIndex((g) => g.id === generatorId);
  return tier >= 0 && tier < EARLY_TIER_COUNT;
}

// ── Progress & lifecycle ─────────────────────────────────────────────────────

export interface ChallengeProgress {
  def: ChallengeDef;
  /** This run's lifetime Lumen so far. */
  current: Decimal;
  goal: number;
  /** 0–1, for the progress bar. */
  fraction: number;
}

export function challengeProgress(state: GameState): ChallengeProgress | null {
  const def = activeChallenge(state);
  if (!def) return null;
  return {
    def,
    current: state.lifetimeLumen,
    goal: def.goalLifetime,
    fraction: Math.min(1, state.lifetimeLumen.div(def.goalLifetime).toNumber()),
  };
}

/**
 * Start a challenge: the run resets exactly as a Rekindle would, but no
 * Embers are granted. Only when no challenge is active and this one has
 * not already been completed. Returns true on success.
 */
export function startChallenge(state: GameState, id: string): boolean {
  const def = challengeById(id);
  if (state.activeChallenge !== null) return false;
  if (isChallengeCompleted(state, id)) return false;
  resetRun(state);
  state.activeChallenge = id;
  addLog(
    state,
    `Challenge begun — ${def.name}: ${def.ruleText} Reach ${def.goalLifetime.toLocaleString("en-US")} lifetime Lumen to earn ${def.rewardName}.`,
  );
  return true;
}

/**
 * Abandon the active challenge: the run resets (no Embers, no reward) and
 * the challenge ends. Returns true if a challenge was active.
 */
export function abandonChallenge(state: GameState): boolean {
  const def = activeChallenge(state);
  if (!def) return false;
  state.activeChallenge = null;
  resetRun(state);
  addLog(state, `Challenge abandoned — ${def.name}. The light starts over, and the fog keeps its secrets.`);
  return true;
}

/**
 * Completion check, called by engine.credit after every Lumen credit:
 * the moment the run's lifetime reaches the goal, the reward is banked,
 * the challenge ends, and the run continues untouched. Returns true if
 * this credit completed the challenge.
 */
export function checkChallengeCompletion(state: GameState): boolean {
  const def = activeChallenge(state);
  if (!def) return false;
  if (state.lifetimeLumen.lt(def.goalLifetime)) return false;
  state.activeChallenge = null;
  state.completedChallenges.push(def.id);
  addLog(
    state,
    `Challenge complete — ${def.name}! ${def.rewardName} is yours: ${def.rewardText} The run continues.`,
  );
  return true;
}
