import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { generatorById, milestoneMultiplier } from "../src/game/config";
import {
  applyOfflineEarnings,
  bulkCost,
  buyGenerator,
  costFor,
  generatorProduction,
  maxAffordable,
  offlineEarnings,
  productionPerSecond,
  tick,
} from "../src/game/engine";
import { createInitialState } from "../src/game/state";

const crab = generatorById("candle-crab");

describe("cost growth", () => {
  it("first Candle Crab costs 15, the next costs 18 (ceil of 15 × 1.15)", () => {
    expect(costFor(crab, 0).toNumber()).toBe(15);
    expect(costFor(crab, 1).toNumber()).toBe(18);
    expect(costFor(crab, 2).toNumber()).toBe(20); // ceil(15 × 1.15²) = ceil(19.8375)
  });

  it("bulk cost equals the sum of individual costs", () => {
    const sum = [0, 1, 2].reduce((acc, owned) => acc + costFor(crab, owned).toNumber(), 0);
    // Bulk formula rounds once at the end, so it can differ by a hair from
    // the sum of individually-rounded costs — but never by more than count.
    const bulk = bulkCost(crab, 0, 3).toNumber();
    expect(bulk).toBeGreaterThan(0);
    expect(Math.abs(bulk - sum)).toBeLessThanOrEqual(3);
    expect(bulkCost(crab, 0, 1).toNumber()).toBe(15);
    expect(bulkCost(crab, 0, 0).toNumber()).toBe(0);
  });

  it("maxAffordable inverts the bulk formula", () => {
    expect(maxAffordable(crab, 0, new Decimal(14))).toBe(0);
    expect(maxAffordable(crab, 0, new Decimal(15))).toBe(1);
    const budget = bulkCost(crab, 0, 10);
    expect(maxAffordable(crab, 0, budget)).toBe(10);
  });
});

describe("production", () => {
  it("is zero with no generators", () => {
    expect(productionPerSecond(createInitialState()).toNumber()).toBe(0);
  });

  it("milestone at 25 owned doubles production (×2), 50 doubles again", () => {
    expect(milestoneMultiplier(24)).toBe(1);
    expect(milestoneMultiplier(25)).toBe(2);
    expect(milestoneMultiplier(50)).toBe(4);
    expect(milestoneMultiplier(100)).toBe(8);

    const state = createInitialState();
    state.generators[crab.id] = 25;
    // 25 crabs × 0.5/s × milestone ×2 = 25/s per generator. (25 generators
    // also wake the supply chain, which taxes the TOTAL — so the milestone is
    // asserted on the generator's own rate, as the Sprint 2 notes describe.)
    expect(generatorProduction(state, crab).toNumber()).toBe(25);
  });

  it("held Embers add +2% production each", () => {
    const state = createInitialState();
    state.generators[crab.id] = 10; // 10 × 0.5 = 5/s base
    state.embers = 50; // +100%
    expect(productionPerSecond(state).toNumber()).toBe(10);
  });

  it("tick credits production over time", () => {
    const state = createInitialState();
    state.generators[crab.id] = 10; // 5/s
    const gain = tick(state, 10);
    expect(gain.toNumber()).toBe(50);
    expect(state.lumen.toNumber()).toBe(50);
    expect(state.lifetimeLumen.toNumber()).toBe(50);
  });

  it("buying deducts the cost and increments ownership", () => {
    const state = createInitialState();
    state.lumen = new Decimal(15);
    expect(buyGenerator(state, crab.id)).toBe(true);
    expect(state.lumen.toNumber()).toBe(0);
    expect(state.generators[crab.id]).toBe(1);
    // Can't afford the second one (18) with nothing left.
    expect(buyGenerator(state, crab.id)).toBe(false);
  });
});

describe("offline earnings", () => {
  it("pays rate × away × 50% under the cap", () => {
    const state = createInitialState(0);
    state.generators[crab.id] = 10; // 5/s
    state.lastSeen = 0;
    const oneHour = 3600 * 1000;
    const result = offlineEarnings(state, oneHour);
    expect(result.creditedSeconds).toBe(3600);
    expect(result.gain.toNumber()).toBe(5 * 3600 * 0.5);
  });

  it("caps at 8 hours: 24h away pays only 8h × 50%", () => {
    const state = createInitialState(0);
    state.generators[crab.id] = 10; // 5/s
    state.lastSeen = 0;
    const day = 24 * 3600 * 1000;
    const result = offlineEarnings(state, day);
    expect(result.awaySeconds).toBe(24 * 3600);
    expect(result.creditedSeconds).toBe(8 * 3600);
    expect(result.gain.toNumber()).toBe(5 * 8 * 3600 * 0.5);
  });

  it("applyOfflineEarnings credits the gain once", () => {
    const state = createInitialState(0);
    state.generators[crab.id] = 10;
    state.lastSeen = 0;
    const result = applyOfflineEarnings(state, 3600 * 1000);
    expect(result.gain.toNumber()).toBe(9000);
    expect(state.lumen.toNumber()).toBe(9000);
    expect(state.lastSeen).toBe(3600 * 1000);
  });
});
