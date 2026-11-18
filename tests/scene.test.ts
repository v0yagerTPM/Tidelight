import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { CHAIN_LIGHTHOUSES, HOLLOW_LIGHT_ID } from "../src/game/config";
import { createInitialState, startBoard } from "../src/game/state";
import {
  MOTH_WING_COLORS,
  buildChainFlowModel,
  buildCoastModel,
  buildMeadowModel,
  buildSceneModel,
  reachFor,
  visibleCount,
} from "../src/scene/model";

// The scene model maps game state to what the Light-view scene draws. The
// renderer itself is canvas drawing; these tests pin the mapping.

const NOW = 1_700_000_000_000;

describe("scene model", () => {
  it("a fresh keeper: a dark coast, no helpers, glass sea", () => {
    const m = buildSceneModel(createInitialState(), NOW);
    expect(m.farLit).toEqual([false, false, false, false, false, false]);
    expect(m.seaIsWater).toBe(false);
    expect(m.crabs + m.motes + m.bells + m.cottageWindows + m.lensGlints + m.stormLanterns + m.whales).toBe(0);
    expect(m.seventh).toBe(0);
    expect(m.reach).toBe(0);
    expect(m.beamStrength).toBe(1); // the chain is asleep: full strength
    expect(m.starved).toBe(false);
  });

  it("each copy shows at first, then counts fill slowly toward their cap", () => {
    expect(visibleCount(0, 12)).toBe(0);
    expect(visibleCount(1, 12)).toBe(1);
    expect(visibleCount(3, 12)).toBe(3);
    expect(visibleCount(500, 12)).toBe(12);
    for (let n = 1; n < 200; n++) expect(visibleCount(n + 1, 12)).toBeGreaterThanOrEqual(visibleCount(n, 12));
  });

  it("lamplight reach grows with production and stays within 0–1", () => {
    expect(reachFor(0)).toBe(0);
    expect(reachFor(10)).toBeGreaterThan(reachFor(1));
    expect(reachFor(1e6)).toBeGreaterThan(reachFor(1e3));
    expect(reachFor(1e30)).toBe(1);
  });

  it("lit lighthouses light up on the horizon; The Hollow Light turns glass to water", () => {
    const state = createInitialState();
    for (const lh of CHAIN_LIGHTHOUSES.slice(1, 3)) {
      state.litLighthouses.push(lh.id);
      state.chainBoards[lh.id] = startBoard(lh.id);
    }
    expect(buildSceneModel(state, NOW).farLit).toEqual([true, true, false, false, false, false]);
    state.litLighthouses.push(HOLLOW_LIGHT_ID);
    expect(buildSceneModel(state, NOW).seaIsWater).toBe(true);
  });

  it("a starved chain weakens and flags the beam", () => {
    const state = createInitialState();
    state.generators["candle-crab"] = 10;
    state.generators["beacon-whale"] = 1; // far more demand than 1/1/1 can support
    const m = buildSceneModel(state, NOW);
    expect(m.starved).toBe(true);
    expect(m.beamStrength).toBeLessThan(0.5);
    expect(m.whales).toBe(1);
  });

  it("duty moths fly in their own wing colours", () => {
    const state = createInitialState();
    state.moths = [
      { id: "a", name: "Ash", pattern: "prismatic", glow: 80, generation: 1 },
      { id: "b", name: "Bee", pattern: "unknown-pattern", glow: 10, generation: 1 },
    ];
    state.mothDuty = ["a", "b"];
    const m = buildSceneModel(state, NOW);
    expect(m.duty).toHaveLength(2);
    expect(m.duty[0]).toEqual({ color: MOTH_WING_COLORS.prismatic, glow: 0.8, tier: 5 });
    expect(m.duty[1].color).toBe(MOTH_WING_COLORS.plain); // unknown patterns fall back to Plain
  });

  it("one Seventh Light already shows its halo", () => {
    const state = createInitialState();
    state.generators["seventh-light"] = 1;
    expect(buildSceneModel(state, NOW).seventh).toBeGreaterThanOrEqual(0.3);
  });
});

describe("coast model", () => {
  it("marks lit towers, and the next one with how close its gates are", () => {
    const state = createInitialState();
    let m = buildCoastModel(state, NOW);
    expect(m.towers).toHaveLength(7);
    expect(m.towers[0]).toMatchObject({ lit: true, isNext: false, readiness: 1 });
    expect(m.towers[1]).toMatchObject({ isNext: true, readiness: 0 }); // chain asleep
    expect(m.towers.slice(2).every((t) => !t.isNext && t.readiness === 0)).toBe(true);

    state.generators["candle-crab"] = 10; // chain awake, 5/s, fully supported
    state.lumen = new Decimal(1_000_000); // half of Gull Rock's 2,000,000
    m = buildCoastModel(state, NOW);
    expect(m.towers[1].readiness).toBeCloseTo(0.5, 6);
  });
});

describe("chain flow model", () => {
  it("what flows out of each node is capped by the weakest node so far", () => {
    const state = createInitialState();
    state.generators["candle-crab"] = 10;
    state.generators["tide-bell"] = 1; // 22/s: wick 20 (91%), oil 15 (68%), lens 10 (45%)
    const m = buildChainFlowModel(state, NOW);
    expect(m.unlocked).toBe(true);
    const [wick, oil, lens] = m.nodes;
    expect(wick.flow).toBeCloseTo(20 / 22, 6);
    expect(oil.flow).toBeCloseTo(15 / 22, 6);
    expect(lens.flow).toBeCloseTo(10 / 22, 6);
    expect(lens.bottleneck).toBe(true);
    expect(m.chainFactor).toBeCloseTo(0.25 + 0.75 * (10 / 22), 6);
  });
});

describe("meadow model", () => {
  it("places duty and cocoon moths, and tracks the cocoon and the bottle's voyage", () => {
    const state = createInitialState();
    state.generators["lantern-moth"] = 1;
    state.moths = [
      { id: "a", name: "Ash", pattern: "plain", glow: 50, generation: 1 },
      { id: "b", name: "Bee", pattern: "starlit", glow: 20, generation: 1 },
      { id: "c", name: "Cob", pattern: "spotted", glow: 30, generation: 1 },
    ];
    state.mothDuty = ["a"];
    state.cocoon = { parentIds: ["b", "c"], readyAt: NOW + 150_000 }; // halfway through 5 min
    state.expedition = { routeId: "crossing", startedAt: NOW - 1_000, returnsAt: NOW + 3_000 };
    const m = buildMeadowModel(state, NOW);
    expect(m.unlocked).toBe(true);
    expect(m.moths.map((x) => [x.id, x.duty, x.inCocoon])).toEqual([["a", true, false], ["b", false, true], ["c", false, true]]);
    expect(m.cocoon).toEqual({ progress: 0.5, ready: false });
    expect(m.bottle).toEqual({ progress: 0.25, reach: 1, ready: false });
    expect(buildMeadowModel(state, NOW + 5_000).bottle?.ready).toBe(true);
  });

  it("an empty roost before the first Lantern Moth is asleep", () => {
    const m = buildMeadowModel(createInitialState(), NOW);
    expect(m).toEqual({ unlocked: false, moths: [], cocoon: null, bottle: null });
  });
});
