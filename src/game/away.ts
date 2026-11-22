import Decimal from "break_infinity.js";
import { lureBankSize } from "./almanac";
import { offlineCapSeconds } from "./emberShop";
import { productionPerSecond, type OfflineResult } from "./engine";
import { expeditionReady } from "./expeditions";
import { cocoonReady, lureStatus, mothsUnlocked } from "./moths";
import { TIDE_BUCKET_MS } from "./tides";
import type { GameState } from "./types";
import { offlineRateFor } from "./upgrades";

// ── Welcome back: what time away brought ─────────────────────────────────────
// When a keeper comes back (a new visit, or a laptop waking after a long
// sleep), the game opens a card: how long you were gone, what your keepers
// earned and why it was that much (the offline rate and the cap), and what
// kept happening on the Shore and in the supply line. This module gathers
// the numbers; src/main.ts draws the card.

/** Shorter absences don't get a card (the log still notes them). */
export const AWAY_CARD_MIN_SECONDS = 5 * 60;

/** What the Shore looked like when the keeper left. Take it before offline earnings are applied. */
export interface AwaySnapshot {
  /** Lures held when you left (null before the Moth Garden opens). */
  lures: number | null;
  cocoonReady: boolean;
  bottleReady: boolean;
}

export function snapshotAway(state: GameState): AwaySnapshot {
  const left = state.lastSeen;
  return {
    lures: mothsUnlocked(state) ? lureStatus(state, left).held : null,
    cocoonReady: cocoonReady(state, left),
    bottleReady: state.expedition !== null && expeditionReady(state, left),
  };
}

export interface AwayReport {
  awaySeconds: number;
  /** Seconds the offline rules paid for (the away time, up to the cap). */
  creditedSeconds: number;
  capSeconds: number;
  /** Away longer than the cap: some of the time went unpaid. */
  capped: boolean;
  /** The share of production your keepers earn while you're gone (0–1). */
  offlineRate: number;
  /** What they earned per second: tide-neutral production × the offline rate. */
  perSecond: Decimal;
  gain: Decimal;
  lumenNow: Decimal;
  /** How many times the tide turned while you were gone. */
  tidesTurned: number;
  /** Lures that regrew (null before the Moth Garden opens). */
  luresGained: number | null;
  luresHeld: number;
  lureBank: number;
  /** Ready now; `…New` when it became ready while you were gone. */
  cocoonReady: boolean;
  cocoonNew: boolean;
  bottleReady: boolean;
  bottleNew: boolean;
  /** Chain levels the Chain Steward bought with its share of the time away. */
  stewardLevels: number;
  /** Story beats the time away earned. */
  storyTitles: string[];
}

export interface AwayExtras {
  stewardLevels?: number;
  storyTitles?: string[];
}

/** Build the report after offline earnings were applied at `now` (state.lastSeen is now `now`). */
export function awayReport(
  state: GameState,
  offline: OfflineResult,
  before: AwaySnapshot,
  now: number,
  extras: AwayExtras = {},
): AwayReport {
  const offlineRate = offlineRateFor(state);
  const capSeconds = offlineCapSeconds(state);
  const leftAt = now - offline.awaySeconds * 1000;
  const unlocked = mothsUnlocked(state);
  const luresHeld = unlocked ? lureStatus(state, now).held : 0;
  const cocoon = cocoonReady(state, now);
  const bottle = state.expedition !== null && expeditionReady(state, now);
  return {
    awaySeconds: offline.awaySeconds,
    creditedSeconds: offline.creditedSeconds,
    capSeconds,
    capped: offline.awaySeconds > capSeconds + 1,
    offlineRate,
    perSecond: productionPerSecond(state).mul(offlineRate),
    gain: offline.gain,
    lumenNow: state.lumen,
    tidesTurned: Math.max(0, Math.floor(now / TIDE_BUCKET_MS) - Math.floor(leftAt / TIDE_BUCKET_MS)),
    luresGained: before.lures === null || !unlocked ? null : Math.max(0, luresHeld - before.lures),
    luresHeld,
    lureBank: lureBankSize(state),
    cocoonReady: cocoon,
    cocoonNew: cocoon && !before.cocoonReady,
    bottleReady: bottle,
    bottleNew: bottle && !before.bottleReady,
    stewardLevels: extras.stewardLevels ?? 0,
    storyTitles: extras.storyTitles ?? [],
  };
}

/** Worth a card: away long enough, and something to show for it. */
export function shouldShowAway(r: AwayReport): boolean {
  if (r.awaySeconds < AWAY_CARD_MIN_SECONDS) return false;
  return (
    r.gain.gt(0) ||
    r.cocoonNew ||
    r.bottleNew ||
    (r.luresGained ?? 0) > 0 ||
    r.stewardLevels > 0 ||
    r.storyTitles.length > 0
  );
}
