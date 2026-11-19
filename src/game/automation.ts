import { GENERATORS } from "./config";
import { canBuyGenerator } from "./challenges";
import { hasPerk } from "./emberShop";
import { buyGenerator, costFor, productionForOwned } from "./engine";
import { chainStatus, chainUnlocked, lighthouseMultiplier } from "./chain";
import { efficiencyAtDemand } from "./supply";
import { addLog } from "./state";
import type { GameState } from "./types";
import { UPGRADES, buyUpgrade, isUnlocked } from "./upgrades";

// ── Automation: the Quartermaster and the Lamp Crew (Ember perks) ────────────
// Both run in the live game loop (not while you're away), both can be
// switched off, and both spend only a slice of the Lumen in hand, so a
// keeper saving for a lighthouse is never emptied out:
//   Quartermaster — learns any unlocked upgrade that costs no more than a
//                   quarter of your Lumen, cheapest first.
//   Lamp Crew     — hires the best-value helper (lowest cost per Lumen/s
//                   gained) that costs no more than a tenth of your Lumen,
//                   and never one that would drop the beam below 90%
//                   efficiency (or below where it already is).

export const QUARTERMASTER_SHARE = 0.25;
export const LAMP_CREW_SHARE = 0.1;
export const LAMP_CREW_MIN_EFFICIENCY = 0.9;
/** Most helpers the Lamp Crew hires in one go (it runs again a second later). */
const LAMP_CREW_BATCH = 25;

export function quartermasterActive(state: GameState): boolean {
  return hasPerk(state, "quartermaster") && state.autoLearn;
}

export function lampCrewActive(state: GameState): boolean {
  return hasPerk(state, "lamp-crew") && state.autoHire;
}

/** The Quartermaster's round: the names of the upgrades it learned (one log line for all). */
export function autoLearn(state: GameState): string[] {
  if (!quartermasterActive(state)) return [];
  const ready = UPGRADES.filter((u) => !state.upgrades.includes(u.id) && isUnlocked(state, u)).sort((a, b) => a.cost - b.cost);
  const learned: string[] = [];
  for (const def of ready) {
    if (state.lumen.mul(QUARTERMASTER_SHARE).lt(def.cost)) break;
    if (buyUpgrade(state, def.id, false)) learned.push(def.name);
  }
  if (learned.length > 0) addLog(state, `Your Quartermaster learned ${learned.join(", ")}.`);
  return learned;
}

/** The Lamp Crew's round: how many helpers it hired. */
export function autoHire(state: GameState, now?: number): number {
  if (!lampCrewActive(state)) return 0;
  let hired = 0;
  for (let i = 0; i < LAMP_CREW_BATCH; i++) {
    const budget = state.lumen.mul(LAMP_CREW_SHARE);
    const chainOn = chainUnlocked(state);
    const floor = chainOn ? Math.min(LAMP_CREW_MIN_EFFICIENCY, chainStatus(state, now).efficiency) : 0;
    let best: { id: string; payback: number } | null = null;
    for (const def of GENERATORS) {
      if (!canBuyGenerator(state, def.id)) continue;
      const owned = state.generators[def.id] ?? 0;
      const cost = costFor(def, owned);
      if (budget.lt(cost)) continue;
      const gain = productionForOwned(state, def, owned + 1).sub(productionForOwned(state, def, owned));
      if (gain.lte(0)) continue;
      // Demand rises by the helper's output times the lighthouse bonuses (before the chain factor).
      if (chainOn && efficiencyAtDemand(state, gain.mul(lighthouseMultiplier(state)), now) < floor - 1e-9) continue;
      const payback = cost.div(gain).toNumber();
      if (best === null || payback < best.payback) best = { id: def.id, payback };
    }
    if (!best || !buyGenerator(state, best.id, 1)) break;
    hired++;
  }
  return hired;
}
