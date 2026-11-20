import { CHAIN_LIGHTHOUSES, GULL_ROCK_ID } from "./config";
import { chainUnlocked } from "./chain";
import { mothsUnlocked } from "./moths";
import { rekindleGain } from "./prestige";
import type { GameState } from "./types";
import { UPGRADES, isUnlocked } from "./upgrades";

// ── The guide, a page at a time (design review) ──────────────────────────────
// "How to keep the light" is eight pages (ui/tutorial.ts). A new keeper used
// to read all eight before the first click: the supply chain, Embers, moths
// and tides explained to someone who hadn't hired a crab yet. Now a new
// keeper reads the first two, and each of the others opens by itself the
// first time its part of the game matters. The ? button and the Keeper's
// Desk still open the whole guide. Seen pages are saved (state.guideSeen).

/** The guide's pages, in its order (ui/tutorial.ts builds them in the same order). */
export const GUIDE_PAGE_IDS = ["welcome", "light", "upgrades", "chain", "lighthouses", "rekindle", "shore", "tides"] as const;
export type GuidePageId = (typeof GUIDE_PAGE_IDS)[number];

/** What a new keeper reads before the first click. */
export const GUIDE_OPENING: readonly GuidePageId[] = ["welcome", "light"];

/** The Rekindle page opens once a Rekindle would bank this many Embers (a fair first look at the hearth). */
export const GUIDE_REKINDLE_EMBERS = 10;
/** The lighthouses page opens once the keeper holds this share of Gull Rock's price (or has lit it). */
export const GUIDE_LIGHTHOUSE_SHARE = 0.1;
/** The tides page opens after this much play: the tide will have turned at least once. */
export const GUIDE_TIDES_SECONDS = 30 * 60;

const gullRockCost = CHAIN_LIGHTHOUSES.find((l) => l.id === GULL_ROCK_ID)?.relightCost ?? 0;

/** When each page after the opening becomes worth reading. */
const DUE: Record<GuidePageId, (state: GameState) => boolean> = {
  welcome: () => true,
  light: () => true,
  upgrades: (s) => UPGRADES.some((u) => !s.upgrades.includes(u.id) && isUnlocked(s, u)),
  chain: (s) => chainUnlocked(s),
  lighthouses: (s) => s.litLighthouses.length > 1 || s.lumen.gte(gullRockCost * GUIDE_LIGHTHOUSE_SHARE),
  rekindle: (s) => s.totalRekindles > 0 || rekindleGain(s) >= GUIDE_REKINDLE_EMBERS,
  shore: (s) => mothsUnlocked(s),
  tides: (s) => s.playTimeSeconds >= GUIDE_TIDES_SECONDS,
};

/** The first unread page whose moment has come, in the guide's order, or null. */
export function dueGuidePage(state: GameState): GuidePageId | null {
  for (const id of GUIDE_PAGE_IDS) {
    if (!state.guideSeen.includes(id) && DUE[id](state)) return id;
  }
  return null;
}

/** Note pages as read (idempotent). */
export function markGuideSeen(state: GameState, ids: readonly GuidePageId[]): void {
  for (const id of ids) if (!state.guideSeen.includes(id)) state.guideSeen.push(id);
}
