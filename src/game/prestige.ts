import Decimal from "break_infinity.js";
import { CHAIN_NODE_IDS, PRESTIGE_DIVISOR } from "./config";
import { headStartLumen, perkById } from "./emberShop";
import { addLog, startBoard } from "./state";
import type { GameState } from "./types";
import { isPermanentUpgrade, upgradeById } from "./upgrades";

/**
 * Embers a run is worth: floor(sqrt(lifetimeLumen / 5000)).
 * The square root is the genre-standard brake: doubling your Embers
 * always takes 4× the lifetime earnings of the run before.
 */
export function embersForLifetime(lifetime: Decimal | number | string): number {
  const d = lifetime instanceof Decimal ? lifetime : new Decimal(lifetime);
  if (d.lte(0)) return 0;
  return d.div(PRESTIGE_DIVISOR).sqrt().floor().toNumber();
}

/** Embers a Rekindle right now would grant, based on this run's lifetime. */
export function rekindleGain(state: GameState): number {
  return embersForLifetime(state.lifetimeLumen);
}

export function canRekindle(state: GameState): boolean {
  // Normal Rekindle is disabled while a challenge run is active (Sprint 3).
  return state.activeChallenge === null && rekindleGain(state) >= 1;
}

/**
 * The run reset shared by Rekindle and challenge start/abandon (Sprint 3):
 * Lumen back to the Head Start purse (1,000 with the perk, else 0), this
 * run's lifetime zeroed, all generators gone, all upgrades forgotten
 * EXCEPT permanent ones (keeper knowledge: Longer Wicks, Ember Resonance),
 * and every chain board back to its starting levels. Lit lighthouses,
 * Embers, Ember perks, challenge records, and every lifetime stat are
 * kept — this function never touches them.
 */
export function resetRun(state: GameState): void {
  const purse = headStartLumen(state);
  state.lumen = new Decimal(purse);
  state.lifetimeLumen = new Decimal(0);
  state.generators = {};
  // Chain boards reset to their starting levels; lit lighthouses stay lit.
  let boardsHadProgress = false;
  for (const id of state.litLighthouses) {
    const start = startBoard(id);
    const board = state.chainBoards[id];
    if (board && CHAIN_NODE_IDS.some((nodeId) => board[nodeId] !== start[nodeId])) {
      boardsHadProgress = true;
    }
    state.chainBoards[id] = start;
  }
  if (boardsHadProgress) {
    addLog(state, "The supply chains gutter with the flame — every board is stripped back to its starting levels, though every lit lighthouse stays lit.");
  }
  state.upgrades = state.upgrades.filter((id) => isPermanentUpgrade(id));
  if (purse > 0) {
    addLog(state, `A keeper's purse of ${purse} Lumen waits by the lamp (Head Start).`);
  }
}

/**
 * Rekindle: bank this run's Embers and start the light over (see resetRun
 * for what resets and what is kept). Gained Embers are added to both the
 * held balance and the lifetime total earned. Disabled while a challenge
 * is active. Returns the Embers gained (0 = no-op).
 */
export function rekindle(state: GameState): number {
  if (state.activeChallenge !== null) return 0;
  const gain = rekindleGain(state);
  if (gain < 1) return 0;
  const kept = state.upgrades.filter((id) => isPermanentUpgrade(id));
  const lost = state.upgrades.length - kept.length;
  state.embers += gain;
  state.embersTotalEarned += gain;
  state.totalRekindles++;
  resetRun(state);
  addLog(state, `The light gutters, and is lit again — stronger. +${gain} Embers (${state.embers} held, ${state.embersTotalEarned} earned all-time).`);
  if (kept.length > 0) {
    const names = kept.map((id) => upgradeById(id).name).join(", ");
    addLog(state, `Keeper knowledge survives the dark: ${names}.`);
  }
  if (state.emberPerks.length > 0) {
    const names = state.emberPerks.map((id) => perkById(id).name).join(", ");
    addLog(state, `Ember perks endure: ${names}.`);
  }
  if (lost > 0) {
    addLog(state, `${lost} upgrade${lost === 1 ? "" : "s"} forgotten in the guttering — they can be learned again.`);
  }
  return gain;
}
