import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { otherBuys } from "../src/game/bestBuy";
import { productionPerSecond } from "../src/game/engine";
import { createInitialState } from "../src/game/state";

// The Light view's best buy weighs feeds and lessons against the hires
// (design review 6): their gains are measured on the game's own production.

describe("the best buy that isn't a hire (otherBuys)", () => {
  it("measures an affordable production lesson, and leaves the state as it was", () => {
    const state = createInitialState(0);
    state.generators["candle-crab"] = 30;
    state.lumen = new Decimal(1_000);
    const before = productionPerSecond(state, 0);
    const list = otherBuys(state, 0);
    const wax = list.find((o) => o.kind === "lesson" && o.name === "Wax-Rich Diet");
    expect(wax).toBeDefined();
    expect(wax!.gain.toNumber()).toBeGreaterThan(0); // Candle Crab ×2
    expect(state.upgrades).toEqual([]);
    expect(productionPerSecond(state, 0).eq(before)).toBe(true);
  });

  it("gives what you can afford, or reach within a minute, and nothing further", () => {
    const state = createInitialState(0);
    state.generators["candle-crab"] = 30;
    state.lumen = new Decimal(10);
    const rate = productionPerSecond(state, 0).toNumber();
    const names = (within: number) => otherBuys(state, 0, undefined, within).map((o) => o.id);
    expect(names(0)).toEqual([]);
    // Wax-Rich Diet costs 600: in reach once 600 − 10 Lumen is that many seconds away.
    expect(names(Math.ceil(590 / rate))).toContain("candle-crab-u1");
    expect(names(Math.floor(590 / rate) - 1)).not.toContain("candle-crab-u1");
  });

  it("measures a feed on a starving chain, and puts the board back", () => {
    const state = createInitialState(0);
    state.generators["candle-crab"] = 200;
    state.generators["lantern-moth"] = 150;
    state.generators["tide-bell"] = 100;
    state.lumen = new Decimal(1e9);
    const board = JSON.stringify(state.chainBoards);
    const feeds = otherBuys(state, 0).filter((o) => o.kind === "feed");
    expect(feeds.map((f) => f.id)).toEqual(["wick", "oil", "lens", "beam"]);
    expect(feeds.find((f) => f.id === "lens")!.gain.gt(0)).toBe(true); // the short supply
    expect(JSON.stringify(state.chainBoards)).toBe(board);
  });
});
