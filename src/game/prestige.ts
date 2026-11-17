import Decimal from "break_infinity.js";
import { PRESTIGE_DIVISOR } from "./config";
import { addLog } from "./state";
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
 * Resets Lumen, this run's lifetime, all generators, and all upgrades
 * EXCEPT permanent ones (keeper knowledge: Longer Wicks, Ember Resonance).
 * Keeps Embers, the buy-amount setting, and every lifetime stat.
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
