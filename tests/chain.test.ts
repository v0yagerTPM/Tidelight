import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { FIRST_LIGHT_ID, GULL_ROCK_ID, generatorById } from "../src/game/config";
import {
  beamMultiplier,
  buyNodeUpgrade,
  chainFactor,
  chainStatus,
  gullRockStatus,
  lighthouseMultiplier,
  nodeCost,
  relightGullRock,
  totalNodeLevels,
  totalSupport,
} from "../src/game/chain";
import { productionPerSecond } from "../src/game/engine";
import { rekindle } from "../src/game/prestige";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import type { GameState } from "../src/game/types";
import { atBaseWarmth } from "./baseWarmth";

// Chain math here is checked at First Light's plain starting support.
atBaseWarmth();

const crab = generatorById("candle-crab");
const seventh = generatorById("seventh-light");

/** A state with `count` Candle Crabs and the given Lumen purse. */
function crabState(count: number, lumen = 0): GameState {
  const state = createInitialState();
  state.generators[crab.id] = count;
  state.lumen = new Decimal(lumen);
  return state;
}

describe("support & efficiency math", () => {
  it("starting boards support 20/15/10 Lumen/s (levels 1/1/1)", () => {
    const state = createInitialState();
    expect(totalNodeLevels(state, "wick")).toBe(1);
    expect(totalSupport(state, "wick").toNumber()).toBe(20);
    expect(totalSupport(state, "oil").toNumber()).toBe(15);
    expect(totalSupport(state, "lens").toNumber()).toBe(10);
  });

  it("efficiency caps at 1 when support covers demand", () => {
    const state = crabState(10); // demand 5/s, supports 20/15/10
    const status = chainStatus(state);
    expect(status.unlocked).toBe(true);
    expect(status.demand.toNumber()).toBe(5);
    expect(status.efficiency).toBe(1);
    expect(status.bottleneck).toBeNull();
    expect(status.shortfall.toNumber()).toBe(0);
    expect(status.chainFactor).toBe(1);
    expect(productionPerSecond(state).toNumber()).toBe(5);
  });

  it("identifies the bottleneck and its shortfall", () => {
    const state = crabState(25); // demand 25/s (milestone ×2)
    const status = chainStatus(state);
    expect(status.demand.toNumber()).toBe(25);
    const byNode = Object.fromEntries(status.nodes.map((n) => [n.nodeId, n.efficiency]));
    expect(byNode.wick).toBeCloseTo(0.8, 9);
    expect(byNode.oil).toBeCloseTo(0.6, 9);
    expect(byNode.lens).toBeCloseTo(0.4, 9);
    expect(status.efficiency).toBeCloseTo(0.4, 9);
    expect(status.bottleneck).toBe("lens");
    expect(status.shortfall.toNumber()).toBe(15); // 25 − 10 supported
    expect(status.chainFactor).toBeCloseTo(0.55, 9); // 0.25 + 0.75 × 0.4
    expect(productionPerSecond(state).toNumber()).toBeCloseTo(13.75, 9);
  });

  it("the bottleneck is whichever supply node is weakest, not always the lens", () => {
    const state = crabState(30); // demand 30/s
    state.chainBoards[FIRST_LIGHT_ID].oil = 10; // supports 150/s
    state.chainBoards[FIRST_LIGHT_ID].lens = 10; // supports 100/s
    const status = chainStatus(state);
    expect(status.bottleneck).toBe("wick"); // 20/30 ≈ 0.67 is the lowest
    expect(status.shortfall.toNumber()).toBe(10);
  });

  it("the chain factor never drops below the 25% floor", () => {
    const state = createInitialState();
    state.generators[seventh.id] = 10; // demand 1,150,000/s vs 10/s of lens
    const factor = chainFactor(state);
    expect(factor).toBeGreaterThanOrEqual(0.25);
    expect(factor).toBeLessThan(0.251);
  });
});

describe("chain lock", () => {
  it("before 10 total generators the chain is locked and the factor is 1", () => {
    const state = crabState(9, 1_000_000);
    const status = chainStatus(state);
    expect(status.unlocked).toBe(false);
    expect(status.chainFactor).toBe(1);
    expect(chainFactor(state)).toBe(1);
    expect(productionPerSecond(state).toNumber()).toBe(4.5);
    // And node upgrades can't be bought yet:
    expect(buyNodeUpgrade(state, FIRST_LIGHT_ID, "wick")).toBe(false);
    expect(state.chainBoards[FIRST_LIGHT_ID].wick).toBe(1);
  });
});

describe("node costs", () => {
  it("grow as ceil(base × growth^level)", () => {
    // (Prices after the post-launch rebalance — see config.ts / SPRINTS.md.)
    expect(nodeCost(FIRST_LIGHT_ID, "wick", 0).toNumber()).toBe(500);
    expect(nodeCost(FIRST_LIGHT_ID, "wick", 1).toNumber()).toBe(550); // 500 × 1.10
    expect(nodeCost(FIRST_LIGHT_ID, "oil", 2).toNumber()).toBe(1_233); // ceil(1000 × 1.11²)
    expect(nodeCost(FIRST_LIGHT_ID, "lens", 2).toNumber()).toBe(2_509); // ceil(2000 × 1.12²)
    expect(nodeCost(FIRST_LIGHT_ID, "beam", 0).toNumber()).toBe(25_000);
    expect(nodeCost(FIRST_LIGHT_ID, "beam", 1).toNumber()).toBe(30_500); // × 1.22
  });

  it("cost ×8 on the second lighthouse's board", () => {
    expect(nodeCost(GULL_ROCK_ID, "wick", 1).toNumber()).toBe(4_400); // 550 × 8
    expect(nodeCost(GULL_ROCK_ID, "lens", 0).toNumber()).toBe(16_000); // 2000 × 8
    expect(nodeCost(GULL_ROCK_ID, "beam", 0).toNumber()).toBe(200_000); // 25000 × 8
  });

  it("buying a node level deducts the cost and raises support", () => {
    const state = crabState(10, 100_000);
    expect(buyNodeUpgrade(state, FIRST_LIGHT_ID, "wick")).toBe(true);
    expect(state.lumen.toNumber()).toBe(100_000 - 550);
    expect(state.chainBoards[FIRST_LIGHT_ID].wick).toBe(2);
    // Geometric support: level 2 adds 20 × 1.095 on top of level 1's 20.
    expect(totalSupport(state, "wick").toNumber()).toBeCloseTo(20 + 20 * 1.095, 9);
    // Too poor for the lens (2,240 at level 1):
    const poor = crabState(10, 1_000);
    expect(buyNodeUpgrade(poor, FIRST_LIGHT_ID, "lens")).toBe(false);
    // A dark lighthouse's board can't be upgraded:
    expect(buyNodeUpgrade(state, GULL_ROCK_ID, "wick")).toBe(false);
  });
});

describe("beam bonus", () => {
  it("stacks additively at +5% per level across all lit boards", () => {
    const state = crabState(10); // demand 5/s, efficiency 1
    state.chainBoards[FIRST_LIGHT_ID].beam = 3;
    expect(beamMultiplier(state).toNumber()).toBeCloseTo(1.15, 9);
    expect(productionPerSecond(state).toNumber()).toBeCloseTo(5.75, 9);
    // Light Gull Rock by hand and add 2 beam levels there: 5 total.
    state.litLighthouses.push(GULL_ROCK_ID);
    state.chainBoards[GULL_ROCK_ID] = { wick: 0, oil: 0, lens: 0, beam: 2 };
    expect(totalNodeLevels(state, "beam")).toBe(5);
    expect(beamMultiplier(state).toNumber()).toBeCloseTo(1.25, 9);
    // Base is now 5 × 1.5 (Gull Rock bonus) = 7.5, still fully supported:
    expect(productionPerSecond(state).toNumber()).toBeCloseTo(7.5 * 1.25, 9);
  });
});

describe("Gull Rock Light", () => {
  it("gates on chain unlock, 50% efficiency, and the 5,000,000 cost", () => {
    // Chain locked (9 generators):
    expect(gullRockStatus(crabState(9, 5_000_000)).canRelight).toBe(false);
    // Efficiency too low (25 crabs → lens bottleneck at 40%):
    const strained = crabState(25, 5_000_000);
    expect(gullRockStatus(strained).efficiencyOk).toBe(false);
    expect(relightGullRock(strained)).toBe(false);
    // Can't afford it:
    const poor = crabState(10, 4_999_999);
    expect(gullRockStatus(poor).affordable).toBe(false);
    expect(relightGullRock(poor)).toBe(false);
    expect(poor.litLighthouses).toEqual([FIRST_LIGHT_ID]);
  });

  it("relighting costs 5M, grants +50% production, and starts an empty board", () => {
    const state = crabState(10, 5_000_000); // 5/s at full efficiency
    expect(productionPerSecond(state).toNumber()).toBe(5);
    expect(relightGullRock(state)).toBe(true);
    expect(state.lumen.toNumber()).toBe(0);
    expect(state.litLighthouses).toContain(GULL_ROCK_ID);
    expect(state.chainBoards[GULL_ROCK_ID]).toEqual({ wick: 0, oil: 0, lens: 0, beam: 0 });
    expect(lighthouseMultiplier(state).toNumber()).toBe(1.5);
    // Base 7.5/s is still under the 10/s lens support, so no efficiency loss:
    expect(productionPerSecond(state).toNumber()).toBeCloseTo(7.5, 9);
    // One-time purchase:
    state.lumen = new Decimal(5_000_000);
    expect(relightGullRock(state)).toBe(false);
  });

  it("an empty second board adds no support — and support sums across boards once upgraded", () => {
    const state = crabState(25, 5_000_000); // demand 25/s
    state.litLighthouses.push(GULL_ROCK_ID);
    state.chainBoards[GULL_ROCK_ID] = { wick: 0, oil: 0, lens: 0, beam: 0 };
    // (Lit by hand here because this state's efficiency is under the
    // relight gate; the gate itself is covered above.)
    // First Light's starting Wick is warmed by Gull Rock's lasting +50%
    // (startingCushion): 20 × 1.5. The empty Gull Rock board adds nothing.
    expect(totalSupport(state, "wick").toNumber()).toBeCloseTo(30, 9);
    expect(buyNodeUpgrade(state, GULL_ROCK_ID, "wick")).toBe(true); // 4,000 at level 0 (×8 board)
    expect(buyNodeUpgrade(state, GULL_ROCK_ID, "wick")).toBe(true); // 4,400 at level 1
    expect(totalNodeLevels(state, "wick")).toBe(3); // 1 + 2
    // That 30, plus Gull Rock's two levels at ×8 scale: 8 × (20 + 20 × 1.095).
    expect(totalSupport(state, "wick").toNumber()).toBeCloseTo(30 + 8 * (20 + 20 * 1.095), 9);
  });
});

describe("rekindle and the chain", () => {
  it("keeps lit lighthouses and their bonus, resets every board to its start", () => {
    const state = crabState(10, 6_000_000);
    expect(relightGullRock(state)).toBe(true);
    state.chainBoards[FIRST_LIGHT_ID].wick = 5;
    state.chainBoards[FIRST_LIGHT_ID].beam = 2;
    state.chainBoards[GULL_ROCK_ID].lens = 3;
    state.lifetimeLumen = new Decimal(8_000_000); // worth 40 Embers

    expect(rekindle(state)).toBe(40);
    expect(state.litLighthouses).toEqual([FIRST_LIGHT_ID, GULL_ROCK_ID]);
    expect(lighthouseMultiplier(state).toNumber()).toBe(1.5); // bonus kept
    expect(state.chainBoards[FIRST_LIGHT_ID]).toEqual({ wick: 1, oil: 1, lens: 1, beam: 0 });
    expect(state.chainBoards[GULL_ROCK_ID]).toEqual({ wick: 0, oil: 0, lens: 0, beam: 0 });
  });
});

describe("save migration (v2 → v4)", () => {
  it("a Sprint 1 (v2) save gains First Light lit and its starting board", () => {
    const v2Save = {
      version: 2,
      lumen: "500",
      lifetimeLumen: "5000",
      allTimeLumen: "9000",
      embers: 3,
      generators: { "candle-crab": 12 },
      upgrades: ["click-1"],
      buyAmount: 10,
      totalClicks: 9,
      totalGeneratorsBought: 12,
      totalRekindles: 0,
      playTimeSeconds: 300,
      lastSeen: 1_700_000_000_000,
      log: [],
    };
    const restored = deserializeState(JSON.parse(JSON.stringify(v2Save)));
    expect(restored).not.toBeNull();
    expect(restored?.version).toBe(12); // migrated forward (v6 in Sprint 5)
    expect(restored?.litLighthouses).toEqual([FIRST_LIGHT_ID]);
    expect(restored?.chainBoards[FIRST_LIGHT_ID]).toEqual({ wick: 1, oil: 1, lens: 1, beam: 0 });
    expect(restored?.upgrades).toEqual(["click-1"]);
    expect(restored?.buyAmount).toBe(10);
  });

  it("round-trips lit lighthouses and boards at version 6", () => {
    const state = crabState(10, 5_000_000);
    expect(relightGullRock(state)).toBe(true);
    state.chainBoards[GULL_ROCK_ID].wick = 4;
    const saved = serializeState(state);
    expect(saved.version).toBe(12);
    const restored = deserializeState(JSON.parse(JSON.stringify(saved)));
    expect(restored?.litLighthouses).toEqual([FIRST_LIGHT_ID, GULL_ROCK_ID]);
    expect(restored?.chainBoards[GULL_ROCK_ID].wick).toBe(4);
    expect(restored?.chainBoards[FIRST_LIGHT_ID]).toEqual({ wick: 1, oil: 1, lens: 1, beam: 0 });
  });
});
