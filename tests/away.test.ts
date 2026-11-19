import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { AWAY_CARD_MIN_SECONDS, awayReport, shouldShowAway, snapshotAway } from "../src/game/away";
import { offlineCapSeconds } from "../src/game/emberShop";
import { applyOfflineEarnings } from "../src/game/engine";
import { LURE_REGROW_MS } from "../src/game/moths";
import { createInitialState } from "../src/game/state";
import { TIDE_BUCKET_MS } from "../src/game/tides";
import type { GameState } from "../src/game/types";

const LEFT = 10 * TIDE_BUCKET_MS; // on a tide boundary, so turns are easy to count

function keeper(): GameState {
  const state = createInitialState(LEFT);
  state.lastSeen = LEFT;
  state.generators["candle-crab"] = 10;
  return state;
}

/** Leave at LEFT, come back `seconds` later; returns the report. */
function returnAfter(state: GameState, seconds: number) {
  const before = snapshotAway(state);
  const now = LEFT + seconds * 1000;
  const offline = applyOfflineEarnings(state, now);
  return awayReport(state, offline, before, now);
}

describe("welcome-back report", () => {
  it("reports what the time away paid, and at what rate", () => {
    const state = keeper();
    const r = returnAfter(state, 3600);
    expect(r.awaySeconds).toBe(3600);
    expect(r.creditedSeconds).toBe(3600);
    expect(r.capped).toBe(false);
    expect(r.gain.gt(0)).toBe(true);
    expect(r.gain.toNumber()).toBeCloseTo(r.perSecond.toNumber() * 3600, 3);
    expect(r.offlineRate).toBeGreaterThan(0);
    expect(r.lumenNow.eq(state.lumen)).toBe(true);
    expect(r.tidesTurned).toBe(2);
    expect(shouldShowAway(r)).toBe(true);
  });

  it("says when the cap cut the time short", () => {
    const state = keeper();
    const cap = offlineCapSeconds(state);
    const r = returnAfter(state, cap + 7200);
    expect(r.capped).toBe(true);
    expect(r.creditedSeconds).toBe(cap);
    expect(r.capSeconds).toBe(cap);
  });

  it("skips the card for a short absence", () => {
    const r = returnAfter(keeper(), AWAY_CARD_MIN_SECONDS - 1);
    expect(shouldShowAway(r)).toBe(false);
  });

  it("skips the card when nothing happened", () => {
    const state = createInitialState(LEFT); // no helpers: nothing earned
    state.lastSeen = LEFT;
    expect(shouldShowAway(returnAfter(state, 3600))).toBe(false);
  });

  it("notes lures that regrew and a cocoon that finished", () => {
    const state = keeper();
    state.generators["lantern-moth"] = 1;
    state.mothLures = 0;
    state.mothLureAnchor = LEFT;
    state.cocoon = { parentIds: ["a", "b"], readyAt: LEFT + 60_000 };
    const r = returnAfter(state, (2 * LURE_REGROW_MS) / 1000 + 5);
    expect(r.luresGained).toBe(2);
    expect(r.luresHeld).toBe(2);
    expect(r.cocoonReady).toBe(true);
    expect(r.cocoonNew).toBe(true);
  });

  it("doesn't call a cocoon new if it was ready before you left", () => {
    const state = keeper();
    state.cocoon = { parentIds: ["a", "b"], readyAt: LEFT - 1 };
    const r = returnAfter(state, 3600);
    expect(r.cocoonReady).toBe(true);
    expect(r.cocoonNew).toBe(false);
  });

  it("has no lure line before the Moth Garden opens", () => {
    expect(returnAfter(keeper(), 3600).luresGained).toBeNull();
  });

  it("carries the Steward's levels and story titles", () => {
    const state = createInitialState(LEFT);
    state.lastSeen = LEFT;
    const before = snapshotAway(state);
    const offline = { awaySeconds: 600, creditedSeconds: 600, gain: new Decimal(0) };
    const r = awayReport(state, offline, before, LEFT + 600_000, { stewardLevels: 3, storyTitles: ["A page"] });
    expect(r.stewardLevels).toBe(3);
    expect(r.storyTitles).toEqual(["A page"]);
    expect(shouldShowAway(r)).toBe(true);
  });
});
