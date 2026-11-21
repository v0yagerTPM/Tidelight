import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { relightCost } from "../src/game/chain";
import { CORMORANT_ROOST_ID, GULL_ROCK_ID, PRESTIGE_RECOMMENDED_EMBERS } from "../src/game/config";
import { applyOfflineEarnings, productionPerSecond, tick } from "../src/game/engine";
import { rekindle, rekindleGain } from "../src/game/prestige";
import { RELIGHT_FIRST_SECONDS, rekindleMoment, runGrowthRate, trackRekindleGrowth } from "../src/game/rekindleMoment";
import { createInitialState, deserializeState, serializeState, startBoard } from "../src/game/state";
import type { GameState } from "../src/game/types";

// The Rekindle moment (game/rekindleMoment.ts): the rule the hearth teaches
// and the balance bot plays by.

/** A keeper past the first Rekindle, at the start of a run, with a fed crew and Gull Rock lit. */
function keeper(): GameState {
  const state = createInitialState(0);
  state.embers = 1_000;
  state.embersTotalEarned = 1_000;
  state.totalRekindles = 3;
  state.litLighthouses.push(GULL_ROCK_ID);
  state.chainBoards[GULL_ROCK_ID] = startBoard(GULL_ROCK_ID);
  state.generators["candle-crab"] = 10;
  return state;
}

/** Play `seconds` in one-minute steps, tracking the growth rate; returns the phase seen at each step. */
function play(state: GameState, seconds: number): string[] {
  const phases: string[] = [];
  for (let t = 0; t < seconds; t += 60) {
    tick(state, 60);
    trackRekindleGrowth(state);
    phases.push(rekindleMoment(state).phase);
  }
  return phases;
}

describe("the Rekindle moment", () => {
  it("teaches the recommended first 40 until the keeper has earned them", () => {
    const state = createInitialState(0);
    expect(rekindleMoment(state).phase).toBe("first");
    state.embersTotalEarned = PRESTIGE_RECOMMENDED_EMBERS;
    state.embers = 5; // spent in the shop: still past the first Rekindle
    expect(rekindleMoment(state).phase).not.toBe("first");
  });

  it("builds while the run's Ember growth climbs, then is at its best once the rate falls past its peak", () => {
    const state = keeper();
    // A big lifetime makes the gain worth banking: production is steady, so √ soon slows the rate.
    state.lifetimeLumen = new Decimal(5_000 * 4_000 ** 2);
    const phases = play(state, 6 * 3600);
    const firstBest = phases.indexOf("best");
    expect(phases[0]).toBe("building");
    expect(firstBest).toBeGreaterThan(0);
    expect(phases.slice(firstBest).every((p) => p === "best")).toBe(true);
    expect(state.runBestGrowth).toBeGreaterThan(runGrowthRate(state));
    expect(rekindleMoment(state).multiplier).toBeCloseTo(1 + rekindleGain(state) / state.embers, 9);
  });

  it("says relight first when the next lighthouse costs no more than half an hour of production", () => {
    const state = keeper();
    state.lifetimeLumen = new Decimal(5_000 * 4_000 ** 2);
    play(state, 6 * 3600);
    expect(rekindleMoment(state).phase).toBe("best");
    // Cormorant Roost is next: hire until it costs no more than half an hour of production.
    const cost = relightCost(state, CORMORANT_ROOST_ID);
    let n = 1;
    while (productionPerSecond(state).mul(RELIGHT_FIRST_SECONDS).lt(cost)) state.generators["seventh-light"] = n *= 2;
    const moment = rekindleMoment(state);
    expect(moment.phase).toBe("relight-first");
    expect(moment.relightName).toBe("Cormorant Roost");
    // Lit, it no longer holds the Rekindle back.
    state.litLighthouses.push(CORMORANT_ROOST_ID);
    state.chainBoards[CORMORANT_ROOST_ID] = startBoard(CORMORANT_ROOST_ID);
    expect(rekindleMoment(state).phase).not.toBe("relight-first"); // Widow's Walk is far off
  });

  it("waits out a challenge", () => {
    const state = keeper();
    state.activeChallenge = "fogbound";
    expect(rekindleMoment(state).phase).toBe("challenge");
    expect(trackRekindleGrowth(state)).toBe(0);
  });

  it("a Rekindle starts the run's clock and its best rate over", () => {
    const state = keeper();
    state.lifetimeLumen = new Decimal(5_000 * 4_000 ** 2);
    play(state, 3600);
    expect(state.runSeconds).toBe(3600);
    expect(state.runBestGrowth).toBeGreaterThan(0);
    rekindle(state);
    expect(state.runSeconds).toBe(0);
    expect(state.runBestGrowth).toBe(0);
  });

  it("time away counts toward the run, as far as it is credited", () => {
    const state = keeper();
    state.lastSeen = 0;
    const result = applyOfflineEarnings(state, 2 * 3600 * 1000);
    expect(state.runSeconds).toBe(result.creditedSeconds);
  });

  it("a v14 save has an unknown run length, estimated from its lifetime on first use", () => {
    const state = keeper();
    state.playTimeSeconds = 10_000;
    const v14 = serializeState(state) as unknown as Record<string, unknown>;
    v14.version = 14;
    delete v14.runSeconds;
    delete v14.runBestGrowth;
    delete v14.deepGlassBottle;
    const loaded = deserializeState(v14)!;
    expect(loaded.runSeconds).toBe(-1);
    expect(loaded.runBestGrowth).toBe(0);
    expect(loaded.deepGlassBottle).toBe(false);
    loaded.lifetimeLumen = productionPerSecond(loaded).mul(1_234);
    trackRekindleGrowth(loaded);
    expect(loaded.runSeconds).toBeCloseTo(1_234, 6);
    // Never longer than the keeper has played.
    const short = deserializeState(v14)!;
    short.lifetimeLumen = productionPerSecond(short).mul(1e9);
    trackRekindleGrowth(short);
    expect(short.runSeconds).toBe(10_000);
  });

  it("v15 round-trips the run's clock and best rate", () => {
    const state = keeper();
    state.runSeconds = 777;
    state.runBestGrowth = 0.0123;
    state.deepGlassBottle = true;
    const loaded = deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!;
    expect(loaded.runSeconds).toBe(777);
    expect(loaded.runBestGrowth).toBe(0.0123);
    expect(loaded.deepGlassBottle).toBe(true);
  });
});
