import { LAST_LANTERN_OFFERING_GLOW, SIRENS_REST_ID, WAYMARK_OFFERING_PRICE_SHARE, type WaymarkDef } from "./config";
import { dutyMothsOf } from "./mothTraits";
import type { GameState } from "./types";

// ── The Crossing's offerings ─────────────────────────────────────────────────
// Each waymark has an offering from the Shore (config.ts WAYMARKS): bring it
// and the waymark costs half. Live conditions are checked when the price is
// read; the Glass Stair's bottle is remembered (state.deepGlassBottle,
// set by expeditions.claimExpedition) because a bottle comes home once.
//   The Drowned Bell  a moth posted at Siren's Rest
//   The Glass Stair   a bottle home from the Deep Glass Crossing since Siren's Rest was lit
//   The Last Lantern  a moth on duty glowing 80 or brighter

/** Whether this keeper has brought a waymark's offering. */
export function offeringMet(state: GameState, waymarkId: string): boolean {
  switch (waymarkId) {
    case "drowned-bell": {
      const id = state.mothPosts[SIRENS_REST_ID];
      return id !== undefined && state.moths.some((m) => m.id === id);
    }
    case "glass-stair":
      return state.deepGlassBottle;
    case "last-lantern":
      return dutyMothsOf(state).some((m) => m.glow >= LAST_LANTERN_OFFERING_GLOW);
    default:
      return false;
  }
}

/** A waymark's Lumen price for this keeper: half with its offering. */
export function waymarkCost(state: GameState, waymark: WaymarkDef): number {
  return offeringMet(state, waymark.id) ? waymark.cost * WAYMARK_OFFERING_PRICE_SHARE : waymark.cost;
}
