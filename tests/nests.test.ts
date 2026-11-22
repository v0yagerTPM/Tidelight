import { describe, expect, it } from "vitest";
import {
  BASE_NESTS,
  EXPANSIONS_PER_NEST,
  MAX_NESTS,
  cocoonReady,
  expansionsToNextNest,
  hatchCocoon,
  isCocoonParent,
  nestCount,
  readyCocoonCount,
  startBreeding,
} from "../src/game/moths";
import { mulberry32 } from "../src/game/rng";
import { buildMeadowModel } from "../src/scene/model";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import type { GameState, Moth } from "../src/game/types";

// Nests (game/moths.ts): several cocoons spin at once, two to start and
// more with a bigger roost.

const moth = (id: string): Moth => ({ id, name: id.toUpperCase(), pattern: "plain", glow: 20, generation: 1 });

function roost(n: number): GameState {
  const state = createInitialState(0);
  state.generators["lantern-moth"] = 1;
  state.roostExpansions = 3; // room for 12
  state.moths = Array.from({ length: n }, (_, i) => moth(`m${i}`));
  return state;
}

describe("nests", () => {
  it("two to start, one more every three roost expansions, four at most", () => {
    const state = createInitialState(0);
    expect(BASE_NESTS).toBe(2);
    expect(nestCount(state)).toBe(2);
    expect(expansionsToNextNest(state)).toBe(EXPANSIONS_PER_NEST);
    state.roostExpansions = 2;
    expect(nestCount(state)).toBe(2);
    expect(expansionsToNextNest(state)).toBe(1);
    state.roostExpansions = 3;
    expect(nestCount(state)).toBe(3);
    state.roostExpansions = 6;
    expect(nestCount(state)).toBe(MAX_NESTS);
    expect(expansionsToNextNest(state)).toBeNull();
    state.roostExpansions = 30;
    expect(nestCount(state)).toBe(MAX_NESTS);
  });

  it("spins a cocoon in each free nest, each from its own pair", () => {
    const state = roost(8);
    expect(startBreeding(state, "m0", "m1", 0)).toBe(true);
    expect(startBreeding(state, "m1", "m2", 0)).toBe(false); // m1 is already spinning
    expect(startBreeding(state, "m2", "m3", 0)).toBe(true);
    expect(startBreeding(state, "m4", "m5", 0)).toBe(true); // three nests at 3 expansions
    expect(startBreeding(state, "m6", "m7", 0)).toBe(false); // every nest is spinning
    expect(state.cocoons).toHaveLength(3);
    expect(isCocoonParent(state, "m5")).toBe(true);
    expect(isCocoonParent(state, "m6")).toBe(false);
  });

  it("hatches the ready ones, any order, and frees their nests", () => {
    const state = roost(6);
    startBreeding(state, "m0", "m1", 0);
    startBreeding(state, "m2", "m3", 1_000_000_000);
    const later = 1e8; // the first is ready, the second is not
    expect(cocoonReady(state, later)).toBe(true);
    expect(readyCocoonCount(state, later)).toBe(1);
    expect(hatchCocoon(state, mulberry32(1), later, 1)).toBeNull(); // not ready yet
    const child = hatchCocoon(state, mulberry32(1), later);
    expect(child).not.toBeNull();
    expect(state.cocoons.map((c) => c.parentIds)).toEqual([["m2", "m3"]]);
    expect(startBreeding(state, "m0", "m4", later)).toBe(true); // the nest is free again
    expect(readyCocoonCount(state, 2e9)).toBe(2);
  });

  it("a v16 save's single cocoon becomes the first nest's; v17 keeps them all", () => {
    const state = roost(6);
    startBreeding(state, "m0", "m1", 0);
    startBreeding(state, "m2", "m3", 0);
    const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!;
    expect(restored.cocoons.map((c) => c.parentIds)).toEqual([["m0", "m1"], ["m2", "m3"]]);
    const v16 = serializeState(roost(6)) as unknown as Record<string, unknown>;
    v16.version = 16;
    delete v16.cocoons;
    v16.cocoon = { parentIds: ["m0", "m1"], readyAt: 999 };
    expect(deserializeState(v16)!.cocoons).toEqual([{ parentIds: ["m0", "m1"], readyAt: 999 }]);
    // A moth can't sit in two cocoons, even in a hand-edited save.
    const junk = serializeState(roost(6)) as unknown as Record<string, unknown>;
    junk.cocoons = [{ parentIds: ["m0", "m1"], readyAt: 1 }, { parentIds: ["m1", "m2"], readyAt: 2 }];
    expect(deserializeState(junk)!.cocoons).toHaveLength(1);
  });

  it("the meadow hangs a cocoon for each nest in use", () => {
    const state = roost(6);
    startBreeding(state, "m0", "m1", 0);
    startBreeding(state, "m2", "m3", 0);
    const m = buildMeadowModel(state, 1);
    expect(m.cocoons).toHaveLength(2);
    expect(m.moths.filter((x) => x.inCocoon).map((x) => x.id)).toEqual(["m0", "m1", "m2", "m3"]);
  });
});
