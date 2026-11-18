import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/game/state";
import { isUnlocked, unlockProgress, upgradeById } from "../src/game/upgrades";

// unlockProgress drives the bars on undiscovered lessons in the Upgrades view.

describe("unlockProgress", () => {
  it("measures each kind of unlock condition, 0–1, reaching 1 exactly when it unlocks", () => {
    const state = createInitialState();
    const crabLesson = upgradeById("candle-crab-u1"); // own 10 Candle Crabs
    expect(unlockProgress(state, crabLesson)).toBe(0);
    state.generators["candle-crab"] = 4;
    expect(unlockProgress(state, crabLesson)).toBeCloseTo(0.4, 9);
    state.generators["candle-crab"] = 25;
    expect(unlockProgress(state, crabLesson)).toBe(1);
    expect(isUnlocked(state, crabLesson)).toBe(true);

    const click1 = upgradeById("click-1"); // 500 lifetime Lumen this run
    state.lifetimeLumen = new Decimal(125);
    expect(unlockProgress(state, click1)).toBeCloseTo(0.25, 9);

    const focus = upgradeById("keepers-focus"); // 50 generators in total
    expect(unlockProgress(state, focus)).toBeCloseTo(25 / 50, 9);

    const wicks = upgradeById("longer-wicks"); // 2,000,000 all-time Lumen
    state.allTimeLumen = new Decimal(500_000);
    expect(unlockProgress(state, wicks)).toBeCloseTo(0.25, 9);

    const resonance = upgradeById("ember-resonance"); // hold 10 Embers
    state.embers = 3;
    expect(unlockProgress(state, resonance)).toBeCloseTo(0.3, 9);
    state.embers = 1_000;
    expect(unlockProgress(state, resonance)).toBe(1);
  });
});
