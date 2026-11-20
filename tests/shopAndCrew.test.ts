import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { lampCrewIdleReason } from "../src/game/automation";
import { CORMORANT_ROOST_ID, GULL_ROCK_ID } from "../src/game/config";
import { EMBER_PERKS, KINDLE_ALL_SHARE, kindleAll, kindleAllPreview, shopOffers } from "../src/game/emberShop";
import { createInitialState, startBoard } from "../src/game/state";
import type { GameState } from "../src/game/types";

describe("Kindle everything under 1%", () => {
  it("buys every purchase costing ≤1% of the Embers held at that moment, cheapest first", () => {
    const state = createInitialState(0);
    state.embers = 10_000; // 1% = 100: the keeper perks (5–40) and nothing else
    const preview = kindleAllPreview(state);
    expect(state.embers).toBe(10_000); // the preview buys nothing
    const bought = kindleAll(state);
    expect(bought).toEqual(["Head Start", "Warm Lamp Oil", "Friend of Gulls", "Deep Wicks", "The Long Night", "Full Reservoir", "Ember Heart", "Second Wind"]);
    expect(preview).toEqual({ count: 8, cost: 150 });
    expect(state.embers).toBe(10_000 - 150);
    expect(state.log.filter((e) => e.message.startsWith("Kindled everything small"))).toHaveLength(1);
    // What's left all costs more than 1% of what's held now.
    for (const o of shopOffers(state)) expect(o.cost).toBeGreaterThan(state.embers * KINDLE_ALL_SHARE);
    expect(kindleAll(state)).toEqual([]);
  });

  it("re-reads the held Embers after each purchase, so it never spends past the small", () => {
    const state = createInitialState(0);
    state.embers = 1e12;
    kindleAll(state);
    expect(state.embers).toBeGreaterThan(1e12 * 0.9);
    for (const p of EMBER_PERKS) if (p.costEmbers <= 0.01 * 0.9e12) expect(state.emberPerks).toContain(p.id);
  });
});

function crewKeeper(): GameState {
  const state = createInitialState(0);
  for (const id of [GULL_ROCK_ID, CORMORANT_ROOST_ID]) {
    state.litLighthouses.push(id);
    state.chainBoards[id] = startBoard(id);
  }
  return state;
}

describe("the Lamp Crew says why it's idle", () => {
  it("working: nothing to say", () => {
    const state = crewKeeper();
    state.lumen = new Decimal(1_000);
    expect(lampCrewIdleReason(state)).toBeNull();
  });

  it("saving up: nothing costs a tenth of your Lumen yet", () => {
    const state = crewKeeper();
    state.lumen = new Decimal(100); // a tenth is 10; a Candle Crab costs 15
    expect(lampCrewIdleReason(state)).toBe("budget");
  });

  it("waiting on the chain: every hire would starve the beam", () => {
    const state = crewKeeper();
    state.generators["candle-crab"] = 400; // far past the starting chain
    state.lumen = new Decimal("1e12");
    expect(lampCrewIdleReason(state)).toBe("chain");
  });

  it("off, or not yet with you: nothing to say", () => {
    const off = crewKeeper();
    off.autoHire = false;
    off.lumen = new Decimal(100);
    expect(lampCrewIdleReason(off)).toBeNull();
    const early = createInitialState(0);
    early.lumen = new Decimal(100);
    expect(lampCrewIdleReason(early)).toBeNull();
  });
});
