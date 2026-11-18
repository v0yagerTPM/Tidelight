import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { bestBoardFor } from "../src/game/bot";
import { buyNodeUpgrade, chainStatus, nodeCost, totalSupport } from "../src/game/chain";
import { canBuyGenerator, generatorLockedBy } from "../src/game/challenges";
import { CHAIN_LIGHTHOUSES, FIRST_LIGHT_ID, GENERATORS, HOLLOW_LIGHT_ID, chainLighthouseById } from "../src/game/config";
import { baseProductionPerSecond, buyGenerator } from "../src/game/engine";
import { createInitialState, startBoard } from "../src/game/state";
import type { GameState } from "../src/game/types";

// The post-launch rebalance's guarantees (see config.ts and docs/SPRINTS.md).

describe("the upper generator tiers answer the relit lighthouses", () => {
  const unlocks: [string, string][] = [
    ["lens-polisher", "gull-rock"],
    ["storm-lantern", "cormorant-roost"],
    ["beacon-whale", "widows-walk"],
    ["seventh-light", "sirens-rest"],
  ];

  it("tiers 1–4 are always for hire; 5–8 each wait on their lighthouse", () => {
    const state = createInitialState();
    for (const def of GENERATORS.slice(0, 4)) expect(canBuyGenerator(state, def.id)).toBe(true);
    for (const [gen, lh] of unlocks) {
      expect(canBuyGenerator(state, gen)).toBe(false);
      expect(generatorLockedBy(state, gen)).toBe(lh);
    }
    state.lumen = new Decimal(1e12);
    expect(buyGenerator(state, "lens-polisher")).toBe(false);
    state.litLighthouses.push("gull-rock");
    expect(canBuyGenerator(state, "lens-polisher")).toBe(true);
    expect(generatorLockedBy(state, "lens-polisher")).toBeNull();
    expect(buyGenerator(state, "lens-polisher")).toBe(true);
    expect(canBuyGenerator(state, "storm-lantern")).toBe(false);
  });

  it("copies already owned keep producing while their tier is locked", () => {
    const state = createInitialState();
    state.generators["seventh-light"] = 3;
    expect(baseProductionPerSecond(state).toNumber()).toBeGreaterThan(0);
  });
});

/**
 * A keeper with about `demand` Lumen/s of base production, with every
 * lighthouse but the last lit (so their boards are available) or just
 * First Light, and every board at its starting levels.
 */
function keeperAt(demand: number, allLit: boolean): GameState {
  const state = createInitialState();
  state.generators["candle-crab"] = 10; // chain awake
  if (allLit) {
    for (const lh of CHAIN_LIGHTHOUSES.slice(1, -1)) {
      state.litLighthouses.push(lh.id);
      state.chainBoards[lh.id] = startBoard(lh.id);
    }
  }
  // Scale demand with held Embers (+2% each) — a pure multiplier on base.
  const base = baseProductionPerSecond(state).toNumber();
  state.embers = Math.max(0, Math.round((demand / base - 1) / 0.02));
  return state;
}

/** Spend `budget` feeding the bottleneck on the best-value board; return the efficiency reached. */
function feedWith(state: GameState, budget: Decimal): number {
  state.lumen = budget;
  for (let guard = 0; guard < 20_000; guard++) {
    const st = chainStatus(state);
    if (st.efficiency >= 1 || !st.bottleneck) break;
    const board = bestBoardFor(state, st.bottleneck);
    if (!board || !buyNodeUpgrade(state, board, st.bottleneck)) break;
  }
  return chainStatus(state).efficiency;
}

describe("growing never locks the ending", () => {
  it("an hour of production fed to the chain clears the 80% gate at any scale", () => {
    for (const demand of [1e3, 1e6, 1e9, 1e12, 1e15]) {
      for (const allLit of [false, true]) {
        const state = keeperAt(demand, allLit);
        const actual = baseProductionPerSecond(state);
        expect(actual.toNumber()).toBeGreaterThan(demand * 0.9);
        const efficiency = feedWith(state, actual.mul(3600));
        expect(efficiency, `demand ${demand}, all lit ${allLit}`).toBeGreaterThanOrEqual(chainLighthouseById(HOLLOW_LIGHT_ID).efficiencyRequirement);
      }
    }
  });

  it("support per Lumen spent stays within a narrow band as boards deepen", () => {
    // Raising Lens from level L to L+1 on First Light: Lumen per Lumen/s of support.
    const ratio = (level: number): number => {
      const state = createInitialState();
      state.chainBoards[FIRST_LIGHT_ID].lens = level;
      const before = totalSupport(state, "lens");
      state.chainBoards[FIRST_LIGHT_ID].lens = level + 1;
      return nodeCost(FIRST_LIGHT_ID, "lens", level).div(totalSupport(state, "lens").sub(before)).toNumber();
    };
    // Costs grow 1.12×, support 1.115× per level: ~0.45% dearer per level.
    expect(ratio(100) / ratio(1)).toBeLessThan(1.6);
    expect(ratio(300) / ratio(1)).toBeLessThan(5);
  });
});

describe("the early game is unchanged at the start", () => {
  it("a fresh board's first levels support exactly what they always did", () => {
    const state = createInitialState();
    expect(totalSupport(state, "wick").toNumber()).toBe(20);
    expect(totalSupport(state, "oil").toNumber()).toBe(15);
    expect(totalSupport(state, "lens").toNumber()).toBe(10);
  });
});

describe("a run starts warm, however many Embers you hold", () => {
  function tenCrabs(embers: number): GameState {
    const state = createInitialState();
    state.generators["candle-crab"] = 10; // the chain just woke
    state.embers = embers;
    return state;
  }

  it("1,000 held Embers start the chain as fed as a new keeper's", () => {
    // Demand: 10 crabs × 0.5 × 21 (Embers) = 105/s. The starting Lens alone
    // used to carry 10/s (9.5% efficiency); warmed ×21 it carries 210/s.
    expect(chainStatus(tenCrabs(0)).efficiency).toBe(1);
    expect(chainStatus(tenCrabs(1000)).efficiency).toBe(1);
    expect(totalSupport(tenCrabs(1000), "lens").toNumber()).toBeCloseTo(210, 9);
  });

  it("only the starting levels are warmed; bought levels add their usual support", () => {
    const state = tenCrabs(1000);
    const before = totalSupport(state, "lens").toNumber();
    state.chainBoards[FIRST_LIGHT_ID].lens = 2;
    expect(totalSupport(state, "lens").toNumber() - before).toBeCloseTo(10 * 1.115, 9);
  });

  it("a penalty such as Fogbound's ×0.5 never shrinks the starting chain", () => {
    const state = tenCrabs(0);
    state.activeChallenge = "fogbound";
    expect(totalSupport(state, "wick").toNumber()).toBe(20);
  });
});
