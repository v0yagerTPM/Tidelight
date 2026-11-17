import Decimal from "break_infinity.js";
import { CHAIN_NODE_IDS, PRESTIGE_DIVISOR } from "./config";
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
  return rekindleGain(state) >= 1;
}

/**
 * Rekindle: bank this run's Embers and start the light over.
 * Resets Lumen, this run's lifetime, all generators, all upgrades
 * EXCEPT permanent ones (keeper knowledge: Longer Wicks, Ember Resonance),
 * and every chain board back to its starting levels. Keeps Embers, the
 * buy-amount setting, every lifetime stat, and every lit lighthouse
 * (lighthouses — and their production bonuses — are permanent).
 * Returns the Embers gained (0 = no-op).
 */
export function rekindle(state: GameState): number {
  const gain = rekindleGain(state);
  if (gain < 1) return 0;
  state.embers += gain;
  state.totalRekindles++;
  state.lumen = new Decimal(0);
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
  const kept = state.upgrades.filter((id) => isPermanentUpgrade(id));
  const lost = state.upgrades.length - kept.length;
  state.upgrades = kept;
  addLog(state, `The light gutters, and is lit again — stronger. +${gain} Embers (total ${state.embers}).`);
  if (kept.length > 0) {
    const names = kept.map((id) => upgradeById(id).name).join(", ");
    addLog(state, `Keeper knowledge survives the dark: ${names}.`);
  }
  if (lost > 0) {
    addLog(state, `${lost} upgrade${lost === 1 ? "" : "s"} forgotten in the guttering — they can be learned again.`);
  }
  return gain;
}
