import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { CHAIN_LIGHTHOUSES, HOLLOW_LIGHT_ID, priceCeiling } from "../src/game/config";
import { EMBER_PERKS, KINDLINGS } from "../src/game/emberShop";
import { roostExpansionCost, rushLureCost } from "../src/game/moths";
import { createInitialState } from "../src/game/state";
import { UPGRADES } from "../src/game/upgrades";

// A keeper who has lit The Hollow Light can afford anything: no single
// purchase costs more than its relight (8.20e30).
describe("the price ceiling", () => {
  const ceiling = priceCeiling();

  it("is The Hollow Light's relight cost", () => {
    expect(ceiling).toBe(CHAIN_LIGHTHOUSES.find((l) => l.id === HOLLOW_LIGHT_ID)!.relightCost);
    expect(ceiling).toBe(8.2e30);
  });

  it("caps every upgrade and every relight", () => {
    for (const u of UPGRADES) expect(u.cost, u.id).toBeLessThanOrEqual(ceiling);
    for (const l of CHAIN_LIGHTHOUSES) expect(l.relightCost ?? 0).toBeLessThanOrEqual(ceiling);
  });

  it("caps roost expansions and rush lures, however far past the ending you are", () => {
    const state = createInitialState(0);
    state.generators["seventh-light"] = 400;
    state.embers = 1e15;
    state.roostExpansions = 40;
    expect(roostExpansionCost(state).div(ceiling).toNumber()).toBeCloseTo(1, 12);
    state.allTimeLumen = new Decimal("1e40");
    state.mothLureRushes = 10;
    expect(rushLureCost(state, 0).div(ceiling).toNumber()).toBeCloseTo(1, 12);
  });

  it("keeps every Ember Shop item within reach of a keeper at the ending", () => {
    // The plain sim ends holding about 7.4e13 Embers; a keeper who shops holds less, but over a run earns far more.
    for (const p of EMBER_PERKS) expect(p.costEmbers).toBeLessThanOrEqual(1e13);
    for (const k of KINDLINGS) {
      const top = k.baseCost * k.growth ** ((k.maxLevel ?? 1) - 1);
      expect(top, k.id).toBeLessThanOrEqual(1e13);
    }
  });
});
