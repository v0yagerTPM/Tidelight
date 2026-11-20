import { describe, expect, it } from "vitest";
import { chainStatus, startingWarmth, totalSupport } from "../src/game/chain";
import { CHAIN_UNLOCK_GENERATORS, FIRST_LIGHT_WARMTH } from "../src/game/config";
import { lastingProductionMultiplier } from "../src/game/engine";
import { createInitialState } from "../src/game/state";
import { STORY_BEATS } from "../src/game/story";

// The opening chain (playtest review): at ×1 the chain woke at ten helpers
// already short, and a new keeper spent the first twenty minutes at 6–25%
// efficiency. First Light's starting levels are warmed ×FIRST_LIGHT_WARMTH.

describe("First Light's warm start", () => {
  it("starting levels support FIRST_LIGHT_WARMTH × their usual 20 / 15 / 10 Lumen/s", () => {
    const state = createInitialState(0);
    const f = FIRST_LIGHT_WARMTH.factor;
    expect(f).toBeGreaterThan(1);
    expect(totalSupport(state, "wick").toNumber()).toBeCloseTo(20 * f, 9);
    expect(totalSupport(state, "oil").toNumber()).toBeCloseTo(15 * f, 9);
    expect(totalSupport(state, "lens").toNumber()).toBeCloseTo(10 * f, 9);
  });

  it("is added to the lasting bonuses, so it fades as they grow", () => {
    const state = createInitialState(0);
    state.embers = 50; // ×2
    const grace = FIRST_LIGHT_WARMTH.factor - 1;
    expect(startingWarmth(state).toNumber()).toBeCloseTo(lastingProductionMultiplier(state).toNumber() + grace, 9);
    expect(totalSupport(state, "lens").toNumber()).toBeCloseTo(10 * (2 + grace), 9);
    state.embers = 50_000; // ×1,001: the grace is half a percent of the warm start
    expect(startingWarmth(state).div(lastingProductionMultiplier(state)).toNumber()).toBeLessThan(1.01);
  });

  it("the chain wakes fed: the first mixed crew it wakes for runs at full efficiency", () => {
    const state = createInitialState(0);
    state.generators["candle-crab"] = 6;
    state.generators["lantern-moth"] = 3;
    state.generators["tide-bell"] = 1; // ten helpers, 29 Lumen/s
    expect(CHAIN_UNLOCK_GENERATORS).toBe(10);
    expect(chainStatus(state).unlocked).toBe(true);
    expect(chainStatus(state).efficiency).toBe(1);
  });
});

describe("the story keeps the coast's order", () => {
  it("hiring The Seventh Light (which Siren's Rest brings) comes after Siren's Rest", () => {
    const ids = STORY_BEATS.map((b) => b.id);
    expect(ids.indexOf("seventh-helper")).toBeGreaterThan(ids.indexOf("sirens-rest"));
    expect(ids.indexOf("sirens-rest")).toBeGreaterThan(ids.indexOf("bellwether"));
  });
});
