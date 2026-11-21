import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { lighthouseStatus, relightLighthouse } from "../src/game/chain";
import {
  BELLWETHER_ID,
  CHAIN_LIGHTHOUSES,
  CORMORANT_ROOST_ID,
  FIRST_LIGHT_ID,
  GENERATORS,
  GULL_ROCK_ID,
  HOLLOW_LIGHT_ID,
  SIRENS_REST_ID,
  WAYMARKS,
  WAYMARK_OFFERING_PRICE_SHARE,
  WIDOWS_WALK_ID,
} from "../src/game/config";
import { generatorProduction, productionPerSecond, thrownFactor, thrownGain, thrownProduction } from "../src/game/engine";
import { claimExpedition, sendExpedition } from "../src/game/expeditions";
import { startNgPlus } from "../src/game/ngplus";
import { offeringMet } from "../src/game/offerings";
import { createInitialState, startBoard } from "../src/game/state";
import type { GameState, Moth } from "../src/game/types";

/** A keeper at Siren's Rest: every light but the last lit, the chain fed, a bottomless purse. */
function atSirensRest(): GameState {
  const state = createInitialState(0);
  state.generators["candle-crab"] = 10;
  state.lumen = new Decimal("1e60");
  for (const id of [GULL_ROCK_ID, CORMORANT_ROOST_ID, WIDOWS_WALK_ID, BELLWETHER_ID, SIRENS_REST_ID]) {
    state.litLighthouses.push(id);
    state.chainBoards[id] = startBoard(id);
  }
  const board = state.chainBoards[FIRST_LIGHT_ID];
  for (const node of ["wick", "oil", "lens"] as const) board[node] = 40;
  return state;
}

/** Prices as Decimals: equal to within float rounding. */
const expectPrice = (cost: Decimal, expected: number) => expect(cost.div(expected).toNumber()).toBeCloseTo(1, 9);

const moth = (id: string, glow: number): Moth => ({ id, name: id, pattern: "prismatic", glow, generation: 1 });

describe("the Crossing's offerings", () => {
  it("each waymark names an offering, and bringing it halves the price", () => {
    expect(WAYMARK_OFFERING_PRICE_SHARE).toBe(0.5);
    for (const w of WAYMARKS) expect(w.offering.length).toBeGreaterThan(0);
  });

  it("the Drowned Bell: a moth posted at Siren's Rest", () => {
    const state = atSirensRest();
    const full = WAYMARKS[0].cost;
    expectPrice(lighthouseStatus(state, HOLLOW_LIGHT_ID).cost, full);
    state.moths = [moth("a", 40)];
    state.mothPosts[SIRENS_REST_ID] = "a";
    expect(offeringMet(state, "drowned-bell")).toBe(true);
    expectPrice(lighthouseStatus(state, HOLLOW_LIGHT_ID).cost, full * 0.5);
    // A post that points at a moth no longer in the roost brings nothing.
    state.moths = [];
    expect(offeringMet(state, "drowned-bell")).toBe(false);
  });

  it("the Glass Stair: a bottle home from the Deep Glass Crossing once Siren's Rest burns", () => {
    const early = createInitialState(0);
    early.lumen = new Decimal("1e9");
    expect(sendExpedition(early, "crossing", 0)).toBe(true);
    claimExpedition(early, () => 0.99, 1e12);
    expect(early.deepGlassBottle).toBe(false); // before Siren's Rest, the stair isn't there to chart

    const state = atSirensRest();
    expect(sendExpedition(state, "drift", 0)).toBe(true);
    claimExpedition(state, () => 0.99, 1e12);
    expect(state.deepGlassBottle).toBe(false); // the short routes don't reach it
    expect(sendExpedition(state, "crossing", 0)).toBe(true);
    claimExpedition(state, () => 0.99, 1e12);
    expect(state.deepGlassBottle).toBe(true);
    expect(state.log.some((e) => e.message.includes("a chart of the Glass Stair"))).toBe(true);

    state.crossing = 1; // the Drowned Bell lit: the stair is next
    expectPrice(lighthouseStatus(state, HOLLOW_LIGHT_ID).cost, WAYMARKS[1].cost * 0.5);
  });

  it("the Last Lantern: a moth glowing 80 or brighter on duty", () => {
    const state = atSirensRest();
    state.crossing = 2;
    state.moths = [moth("dim", 79), moth("bright", 80)];
    state.mothDuty = ["dim"];
    expect(offeringMet(state, "last-lantern")).toBe(false);
    state.mothDuty = ["dim", "bright"];
    expect(offeringMet(state, "last-lantern")).toBe(true);
    expectPrice(lighthouseStatus(state, HOLLOW_LIGHT_ID).cost, WAYMARKS[2].cost * 0.5);
  });

  it("the relight charges the halved price; The Hollow Light itself has no offering", () => {
    const state = atSirensRest();
    state.moths = [moth("a", 90)];
    state.mothPosts[SIRENS_REST_ID] = "a";
    state.lumen = new Decimal(WAYMARKS[0].cost * 0.5);
    expect(relightLighthouse(state, HOLLOW_LIGHT_ID)).toBe(true);
    expect(state.crossing).toBe(1);
    expect(state.lumen.toNumber()).toBeLessThan(WAYMARKS[0].cost * 1e-9);
    state.crossing = WAYMARKS.length;
    state.deepGlassBottle = true;
    state.mothDuty = ["a"];
    const tower = lighthouseStatus(state, HOLLOW_LIGHT_ID);
    expect(tower.waymark).toBeNull();
    expectPrice(tower.cost, CHAIN_LIGHTHOUSES.find((l) => l.id === HOLLOW_LIGHT_ID)!.relightCost!);
  });

  it("a Next Keeping darkens the Glass Stair's chart with the waymarks", () => {
    const state = atSirensRest();
    state.litLighthouses.push(HOLLOW_LIGHT_ID);
    state.deepGlassBottle = true;
    expect(startNgPlus(state)).toBe(true);
    expect(state.deepGlassBottle).toBe(false);
  });
});

describe("helper rows show what reaches the thrown beam", () => {
  /** A late keeper: every helper, lots of Beam, a starved chain on one board. */
  function late(): GameState {
    const state = atSirensRest();
    for (const [i, def] of GENERATORS.entries()) state.generators[def.id] = 50 + i;
    for (const id of state.litLighthouses) state.chainBoards[id].beam = 30;
    return state;
  }

  it("the rows add up to the header's Lumen/s", () => {
    const state = late();
    let sum = new Decimal(0);
    for (const def of GENERATORS) sum = sum.add(thrownProduction(state, def));
    expect(sum.div(productionPerSecond(state)).toNumber()).toBeCloseTo(1, 9);
    // Far more than the helpers' own output: the Beam and the lighthouses multiply it.
    expect(thrownFactor(state).toNumber()).toBeGreaterThan(5);
    expect(thrownProduction(state, GENERATORS[0]).gt(generatorProduction(state, GENERATORS[0]))).toBe(true);
  });

  it("the next hire's gain is the real change in Lumen/s, and the keeper's crew is left as it was", () => {
    const state = late();
    const def = GENERATORS[3];
    const before = productionPerSecond(state);
    const gain = thrownGain(state, def, 10);
    expect(state.generators[def.id]).toBe(53);
    state.generators[def.id] = 63;
    expect(gain.div(productionPerSecond(state).sub(before)).toNumber()).toBeCloseTo(1, 9);
    // A helper not yet hired is removed again, not left at 0.
    const fresh = atSirensRest();
    delete fresh.generators["seventh-light"];
    expect(thrownGain(fresh, GENERATORS[8], 1).gt(0)).toBe(true);
    expect("seventh-light" in fresh.generators).toBe(false);
  });
});
