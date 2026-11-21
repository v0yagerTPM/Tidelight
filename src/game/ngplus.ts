import Decimal from "break_infinity.js";
import { FIRST_LIGHT_ID, HOLLOW_LIGHT_ID } from "./config";
import { headStartLumen } from "./emberShop";
import { vacateDarkPosts } from "./moths";
import { addLog, defaultChainBoards } from "./state";
import type { GameState } from "./types";
import { isPermanentUpgrade } from "./upgrades";

// ── New Game+: the Next Keeping (Sprint 5) ───────────────────────────────────
// Lighting The Hollow Light ends the story — and opens the endless mode.
// Beginning the Next Keeping is a deeper reset than Rekindle: the whole
// shore goes dark again and even the Ember ledger starts fresh. What a
// keeper IS cannot be unlearned, though:
//
//   KEPT (the keeper, not the keeping):
//     moths + duty roster, roost expansions, cocoon, expedition, relics,
//     story fragments, story beats seen, endingSeen, Ember perks,
//     completed challenges (and their banked rewards), permanent Lumen
//     upgrades (Longer Wicks, Ember Resonance), buy-amount + notation
//     settings, and the cumulative stats (all-time Lumen, clicks,
//     generators bought, Rekindles, play time).
//   RESET (the keeping itself):
//     Lumen (back to the Head Start purse), run lifetime, generators,
//     non-permanent Lumen upgrades, chain boards, lit lighthouses (First
//     Light only), any active challenge, and Embers — held AND total
//     earned both return to a fresh ledger.
//
// In exchange, each Keeping leaves a legacy: production ×(1 + 0.25 ×
// ngPlusCount) forever, applied in engine.productionForOwned alongside
// the other global multipliers, and a grant of +5 starting Embers per
// Keeping at NG+ start. DECISION (documented per spec): the granted
// Embers count toward the HELD balance only, never toward
// embersTotalEarned — they are an inheritance, not earnings, so lifetime
// records (and the "100 Embers earned" story beat) stay honest.

/** Production bonus per completed Keeping: +25%, additive in the count. */
export const LEGACY_BONUS_PER_KEEPING = 0.25;
/** Embers granted at NG+ start, per Keeping begun (held balance only). */
export const NGPLUS_STARTING_EMBERS_PER_KEEPING = 5;

/** The legacy production multiplier: ×1.25 after one Keeping, ×1.5 after two… */
export function legacyMultiplier(state: GameState): number {
  return 1 + LEGACY_BONUS_PER_KEEPING * state.ngPlusCount;
}

/** NG+ can begin whenever The Hollow Light currently burns. */
export function canStartNgPlus(state: GameState): boolean {
  return state.litLighthouses.includes(HOLLOW_LIGHT_ID);
}

/**
 * Begin the Next Keeping. See the module header for the exact kept/lost
 * contract. Returns false (no change) while The Hollow Light is dark.
 */
export function startNgPlus(state: GameState): boolean {
  if (!canStartNgPlus(state)) return false;

  state.ngPlusCount += 1;
  const grantedEmbers = NGPLUS_STARTING_EMBERS_PER_KEEPING * state.ngPlusCount;

  // The keeping resets…
  state.lumen = new Decimal(headStartLumen(state));
  state.lifetimeLumen = new Decimal(0);
  state.runSeconds = 0;
  state.runBestGrowth = 0;
  state.generators = {};
  state.upgrades = state.upgrades.filter((id) => isPermanentUpgrade(id));
  state.litLighthouses = [FIRST_LIGHT_ID];
  state.crossing = 0; // the waymarks go dark with the lighthouses
  state.deepGlassBottle = false; // and the Glass Stair's offering with them
  state.chainBoards = defaultChainBoards();
  vacateDarkPosts(state); // moths posted at the darkened lights come home
  state.activeChallenge = null;
  // …and the Ember ledger starts fresh, plus the inheritance (held only).
  state.embers = grantedEmbers;
  state.embersTotalEarned = 0;

  addLog(
    state,
    `The Next Keeping begins (Keeping № ${state.ngPlusCount + 1}). The shore is dark again, the lamp is cold — ` +
      `but the moths remember, the relics remember, and the keeper remembers. ` +
      `Legacy: production ×${legacyMultiplier(state).toFixed(2)}, and ${grantedEmbers} inherited Embers in hand.`,
  );
  return true;
}
