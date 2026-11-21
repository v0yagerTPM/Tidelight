import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { dutySlots } from "../src/game/almanac";
import { lighthouseStatus, nextLighthouseId, relightLighthouse, totalSupport } from "../src/game/chain";
import {
  BELLWETHER_ID,
  CHAIN_LIGHTHOUSES,
  CORMORANT_ROOST_ID,
  FIRST_LIGHT_ID,
  GULL_ROCK_ID,
  HOLLOW_LIGHT_ID,
  SIRENS_REST_ID,
  WAYMARKS,
  WIDOWS_WALK_ID,
} from "../src/game/config";
import { lampMultiplier } from "../src/game/engine";
import { startNgPlus } from "../src/game/ngplus";
import { createInitialState, deserializeState, serializeState, startBoard } from "../src/game/state";
import { checkStory } from "../src/game/story";
import type { GameState } from "../src/game/types";

// The Crossing: three waymarks on the deep glass between Siren's Rest and
// The Hollow Light (config.ts WAYMARKS), lit in order through The Hollow
// Light's own relight, each with its own reward and story beat.

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

describe("the Crossing", () => {
  it("has three waymarks, each dearer than the last and cheaper than The Hollow Light", () => {
    expect(WAYMARKS.map((w) => w.id)).toEqual(["drowned-bell", "glass-stair", "last-lantern"]);
    const sirens = CHAIN_LIGHTHOUSES.find((l) => l.id === SIRENS_REST_ID)!.relightCost!;
    const hollow = CHAIN_LIGHTHOUSES.find((l) => l.id === HOLLOW_LIGHT_ID)!.relightCost!;
    let last = sirens;
    for (const w of WAYMARKS) {
      expect(w.cost).toBeGreaterThan(last);
      last = w.cost;
    }
    expect(hollow).toBeGreaterThan(last);
  });

  it("The Hollow Light's relight lights the waymarks in order, then the tower", () => {
    const state = atSirensRest();
    expect(nextLighthouseId(state)).toBe(HOLLOW_LIGHT_ID);
    WAYMARKS.forEach((w, i) => {
      const status = lighthouseStatus(state, HOLLOW_LIGHT_ID);
      expect(status.waymark?.id).toBe(w.id);
      expect(status.cost.eq(new Decimal(w.cost))).toBe(true);
      state.lumen = new Decimal(w.cost); // exactly the price of this step
      expect(relightLighthouse(state, HOLLOW_LIGHT_ID)).toBe(true);
      expect(state.crossing).toBe(i + 1);
      expect(state.lumen.toNumber()).toBe(0);
      expect(state.litLighthouses).not.toContain(HOLLOW_LIGHT_ID);
      expect(state.chainBoards[HOLLOW_LIGHT_ID]).toBeUndefined(); // waymarks carry no board
    });
    const last = lighthouseStatus(state, HOLLOW_LIGHT_ID);
    expect(last.waymark).toBeNull();
    expect(last.cost.div(CHAIN_LIGHTHOUSES.find((l) => l.id === HOLLOW_LIGHT_ID)!.relightCost!).toNumber()).toBeCloseTo(1, 12);
    state.lumen = new Decimal("1e60");
    expect(relightLighthouse(state, HOLLOW_LIGHT_ID)).toBe(true);
    expect(state.litLighthouses).toContain(HOLLOW_LIGHT_ID);
    expect(state.endingSeen).toBe(true);
  });

  it("each waymark keeps The Hollow Light's gates: Siren's Rest lit, the beam fed, the Lumen", () => {
    const early = createInitialState(0);
    early.generators["candle-crab"] = 10;
    early.lumen = new Decimal("1e60");
    expect(relightLighthouse(early, HOLLOW_LIGHT_ID)).toBe(false); // the coast before it is dark
    expect(early.crossing).toBe(0);
    const starved = atSirensRest();
    starved.generators["candle-crab"] = 5000; // far past the chain
    expect(lighthouseStatus(starved, HOLLOW_LIGHT_ID).efficiencyOk).toBe(false);
    expect(relightLighthouse(starved, HOLLOW_LIGHT_ID)).toBe(false);
    const poor = atSirensRest();
    poor.lumen = new Decimal(WAYMARKS[0].cost / 2);
    expect(relightLighthouse(poor, HOLLOW_LIGHT_ID)).toBe(false);
  });

  it("the Drowned Bell lifts chain support, the Glass Stair the thrown beam, the Last Lantern a duty slot", () => {
    const state = atSirensRest();
    const support = totalSupport(state, "wick").toNumber();
    const lamp = lampMultiplier(state).toNumber();
    const slots = dutySlots(state);
    relightLighthouse(state, HOLLOW_LIGHT_ID);
    expect(totalSupport(state, "wick").toNumber()).toBeCloseTo(support * 1.25, 6);
    expect(lampMultiplier(state).toNumber()).toBe(lamp);
    relightLighthouse(state, HOLLOW_LIGHT_ID);
    expect(lampMultiplier(state).toNumber()).toBeCloseTo(lamp * 1.25, 9);
    expect(dutySlots(state)).toBe(slots);
    relightLighthouse(state, HOLLOW_LIGHT_ID);
    expect(dutySlots(state)).toBe(slots + 1);
  });

  it("each waymark has a story beat", () => {
    const state = atSirensRest();
    for (const id of ["drowned-bell", "glass-stair", "last-lantern"]) {
      relightLighthouse(state, HOLLOW_LIGHT_ID);
      checkStory(state);
      expect(state.storySeen).toContain(id);
    }
  });

  it("survives a save; a save that already lit The Hollow Light has crossed; junk is clamped", () => {
    const state = atSirensRest();
    relightLighthouse(state, HOLLOW_LIGHT_ID);
    relightLighthouse(state, HOLLOW_LIGHT_ID);
    expect(deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!.crossing).toBe(2);
    const v12 = serializeState(atSirensRest()) as unknown as Record<string, unknown>;
    v12.version = 12;
    delete v12.crossing;
    expect(deserializeState(v12)!.crossing).toBe(0);
    (v12.litLighthouses as string[]).push(HOLLOW_LIGHT_ID);
    expect(deserializeState(v12)!.crossing).toBe(WAYMARKS.length);
    const junk = serializeState(atSirensRest()) as unknown as Record<string, unknown>;
    junk.crossing = 99;
    expect(deserializeState(junk)!.crossing).toBe(WAYMARKS.length);
  });

  it("a Next Keeping darkens the waymarks with the lighthouses", () => {
    const state = atSirensRest();
    for (let i = 0; i <= WAYMARKS.length; i++) relightLighthouse(state, HOLLOW_LIGHT_ID);
    expect(state.litLighthouses).toContain(HOLLOW_LIGHT_ID);
    expect(startNgPlus(state)).toBe(true);
    expect(state.crossing).toBe(0);
  });
});
