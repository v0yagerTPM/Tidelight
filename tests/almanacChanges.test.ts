import { describe, expect, it } from "vitest";
import { ALMANAC_REWARDS, dutySlots } from "../src/game/almanac";
import {
  dutyUpgrade,
  hatchCocoon,
  keptPlaces,
  mothCapacity,
  openPlaces,
  scentedAttractMoth,
  setBrightestDuty,
  nestCount,
  nextStormAt,
  releaseSpares,
  setStormWait,
  spareMoths,
  startBreeding,
  stormHatchAt,
  tendCocoons,
} from "../src/game/moths";
import { pairForecast } from "../src/game/breedingOdds";
import { CROSSING_TRAIT_CHANCE } from "../src/game/mothTraits";
import { mulberry32 } from "../src/game/rng";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import { TIDE_BUCKET_MS, tideAt } from "../src/game/tides";
import type { GameState, Moth } from "../src/game/types";

// The changes the Wing Almanac analysis led to: cocoons that wait for a
// Stormfront, A Fifth Nest at 42 pages, releasing the spares at once, and a
// likelier trait on the Deep Glass Crossing.

const m = (id: string, pattern: string, glow: number, trait?: string): Moth => ({ id, name: id, pattern, glow, generation: 1, ...(trait ? { trait } : {}) });

function roost(moths: Moth[]): GameState {
  const state = createInitialState(0);
  state.generators["lantern-moth"] = 1;
  state.roostExpansions = 5;
  state.moths = moths;
  return state;
}

describe("cocoons that wait for a Stormfront", () => {
  it("finds the next storm", () => {
    let t = 0;
    while (tideAt(t).def.id === "storm") t += TIDE_BUCKET_MS;
    const at = nextStormAt(t);
    expect(at).toBeGreaterThan(t);
    expect(tideAt(at).def.id).toBe("storm");
    expect(tideAt(at - 1).def.id).not.toBe("storm");
    expect(nextStormAt(at + 1000)).toBe(at + 1000); // already in one
  });

  it("opens by itself in the first storm after it's ready, at the storm's time, even if that passed while away", () => {
    const state = roost([m("a", "starlit", 60), m("b", "prismatic", 60)]);
    let t = 0;
    while (tideAt(t).def.id === "storm") t += TIDE_BUCKET_MS;
    startBreeding(state, "a", "b", t - 10 * 3_600_000); // long since ready
    state.cocoons[0].readyAt = t;
    expect(tendCocoons(state, mulberry32(1), t + 50 * 3_600_000)).toHaveLength(0); // not waiting: stays
    setStormWait(state, 0, true);
    const storm = stormHatchAt(state, 0)!;
    expect(tideAt(storm).def.id).toBe("storm");
    expect(tendCocoons(state, mulberry32(1), storm - 1)).toHaveLength(0); // before the storm
    const hatched = tendCocoons(state, mulberry32(1), storm + 5 * 3_600_000);
    expect(hatched).toHaveLength(1);
    expect(state.cocoons).toHaveLength(0);
  });

  it("keeps waiting while the roost is full, and survives a save", () => {
    const state = roost([m("a", "starlit", 60), m("b", "prismatic", 60)]);
    startBreeding(state, "a", "b", 0);
    setStormWait(state, 0, true);
    while (state.moths.length < mothCapacity(state)) state.moths.push(m(`x${state.moths.length}`, "plain", 5));
    expect(tendCocoons(state, mulberry32(1), 100 * 3_600_000)).toHaveLength(0);
    const loaded = deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!;
    expect(loaded.cocoons[0].stormWait).toBe(true);
    // Hatch still opens it now.
    loaded.moths.pop();
    expect(hatchCocoon(loaded, mulberry32(1), 100 * 3_600_000, 0)).not.toBeNull();
  });
});

describe("A Fifth Nest", () => {
  it("comes at 42 pages and adds a nest past the roost's four", () => {
    const reward = ALMANAC_REWARDS.find((r) => r.id === "fifth-nest")!;
    expect(reward.entries).toBe(42);
    const state = roost([]);
    state.roostExpansions = 9;
    expect(nestCount(state)).toBe(4);
    state.almanac = Array.from({ length: 42 }, (_, i) => `k${i}`);
    expect(nestCount(state)).toBe(5);
  });
});

describe("releasing the spares", () => {
  it("keeps the two brightest of each pattern, the brightest of each page and every moth at work; the rest go at once", () => {
    const moths = [
      m("p1", "plain", 30), m("p2", "plain", 25), m("p3", "plain", 20), m("p4", "plain", 10),
      m("s1", "spotted", 40, "seeker"), m("s2", "spotted", 30, "seeker"), m("s3", "spotted", 20, "seeker"),
      m("d1", "plain", 5), // on duty
    ];
    const state = roost(moths);
    state.mothDuty = ["d1"];
    const spares = spareMoths(state).map((x) => x.id).sort();
    expect(spares).toEqual(["p3", "p4", "s3"]);
    const scales = state.wingScales;
    const result = releaseSpares(state);
    expect(result.count).toBe(3);
    expect(state.wingScales).toBe(scales + result.scales);
    expect(state.moths.map((x) => x.id).sort()).toEqual(["d1", "p1", "p2", "s1", "s2"]);
    expect(state.log.filter((e) => e.message.includes("drift out over the glass sea together"))).toHaveLength(1);
    expect(releaseSpares(state).count).toBe(0);
  });
});

describe("the Deep Glass Crossing", () => {
  it("brings a traitless rider home with a trait 2 times in 5", () => {
    expect(CROSSING_TRAIT_CHANCE).toBe(0.4);
  });
});

describe("letting spares go on arrival", () => {
  const bright = () => [m("b0", "plain", 40), m("b1", "spotted", 55), m("b2", "striped", 70), m("b3", "crescent", 80), m("b4", "starlit", 90), m("b5", "prismatic", 100)];
  const wildPages = ["plain", "spotted", "striped", "crescent", "starlit", "prismatic"].flatMap((p) => ["none", "lamp-loyal", "night-flier", "chain-tender", "seeker", "fertile", "tidewise"].map((t) => `${p}:${t}`));

  it("with every wild page filled and the brightest wings kept, each lured moth flies straight back out, leaving scales", async () => {
    const { attractMoth } = await import("../src/game/moths");
    const state = roost(bright());
    state.almanac = [...wildPages];
    state.autoReleaseSpares = true;
    for (let i = 0; i < 20; i++) {
      state.mothLures = 3;
      const scales = state.wingScales;
      const moth = attractMoth(state, mulberry32(50 + i), 1)!;
      expect(state.moths).not.toContain(moth);
      expect(state.wingScales).toBeGreaterThan(scales);
    }
    expect(state.moths).toHaveLength(6);
    expect(deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!.autoReleaseSpares).toBe(true);
  });

  it("a moth that fills a new page stays, and so does every moth while it is off", async () => {
    const { attractMoth } = await import("../src/game/moths");
    const fresh = roost(bright());
    fresh.autoReleaseSpares = true;
    fresh.mothLures = 3;
    const moth = attractMoth(fresh, mulberry32(9), 1)!;
    expect(fresh.moths).toContain(moth); // the Almanac was empty: a new page
    const off = roost(bright());
    off.almanac = [...wildPages];
    off.mothLures = 3;
    expect(off.moths).toContain(attractMoth(off, mulberry32(9), 1));
  });
});

describe("nests never fill the roost", () => {
  it("a 6-moth roost keeps two nests even with A Fifth Nest: each cocoon takes two parents and a place for its hatchling", () => {
    const state = roost(Array.from({ length: 4 }, (_, i) => m(`m${i}`, "plain", 10)));
    state.roostExpansions = 0;
    state.almanac = Array.from({ length: 42 }, (_, i) => `k${i}`);
    expect(nestCount(state)).toBe(2);
    expect(startBreeding(state, "m0", "m1", 0)).toBe(true);
    expect(startBreeding(state, "m2", "m3", 0)).toBe(true);
    expect(openPlaces(state)).toBe(0); // 4 moths and 2 kept places
    expect(keptPlaces(state)).toBe(2);
    state.roostExpansions = 1; // 8 moths: still two (three would need 9 places)
    expect(nestCount(state)).toBe(2);
    state.roostExpansions = 2; // 10: a third
    expect(nestCount(state)).toBe(3);
  });

  it("a cocoon waiting for a Stormfront always finds its place", () => {
    const state = roost(Array.from({ length: 4 }, (_, i) => m(`m${i}`, "starlit", 50)));
    state.roostExpansions = 0;
    expect(startBreeding(state, "m0", "m1", 0)).toBe(true);
    setStormWait(state, 0, true);
    // Fill every other place with lures: the hatchling's place stays kept.
    state.wingScales = 1000;
    while (scentedAttractMoth(state, mulberry32(state.moths.length))) { /* fill */ }
    expect(state.moths.length).toBe(mothCapacity(state) - 1);
    const storm = stormHatchAt(state, 0)!;
    expect(tendCocoons(state, mulberry32(9), storm)).toHaveLength(1);
  });
});

describe("brightest on duty", () => {
  it("names the best change, and puts the brightest on duty, cocoon parents included", () => {
    const state = roost([m("dim", "spotted", 43), m("mid", "crescent", 48), m("p1", "prismatic", 100), m("p2", "prismatic", 100), m("loyal", "starlit", 70, "lamp-loyal")]);
    state.mothDuty = ["dim", "mid"];
    expect(startBreeding(state, "p1", "p2", 0)).toBe(true);
    const slots = dutySlots(state);
    const up = dutyUpgrade(state);
    expect(up?.add.id).toBe("loyal"); // 70 × 1.5 = 105 working glow
    expect(setBrightestDuty(state)).toBe(true);
    expect(state.mothDuty.slice(0, 3)).toEqual(["loyal", "p1", "p2"]);
    expect(state.mothDuty).toHaveLength(Math.min(slots, 5));
    expect(setBrightestDuty(state)).toBe(false);
    expect(dutyUpgrade(state)).toBeNull();
  });

  it("leaves posted moths at their posts", () => {
    const state = roost([m("a", "plain", 10), m("star", "prismatic", 100)]);
    state.litLighthouses = ["first-light"];
    state.mothPosts = { "first-light": "star" };
    setBrightestDuty(state);
    expect(state.mothDuty).toEqual(["a"]);
  });
});

describe("what a pair can hatch (pairForecast)", () => {
  it("names Hollow for two perfect Prismatics after the ending, and the missing pages it could fill", () => {
    const state = roost([m("a", "prismatic", 100, "fertile"), m("b", "prismatic", 100, "fertile")]);
    state.endingSeen = true;
    state.almanac = ["prismatic:fertile"];
    const f = pairForecast(state, state.moths[0], state.moths[1], false);
    const wing = (p: string) => f.wings.find((w) => w.pattern === p)?.p ?? 0;
    expect(wing("hollow")).toBeCloseTo(0.02, 5);
    expect(wing("tidelit")).toBe(0); // not opening in a storm
    expect(f.wings.reduce((s, w) => s + w.p, 0)).toBeCloseTo(1, 9);
    expect(f.newPages.map((n) => n.key)).toContain("hollow:fertile");
    expect(f.newPages.map((n) => n.key)).not.toContain("prismatic:fertile"); // already filled
    expect(f.stormPages.map((n) => n.key)).toContain("tidelit:fertile");
    expect(f.tidelitInStorm).toBeGreaterThan(0);
    // Set to wait for a Stormfront: Tidelit is in the odds and its pages are plain new pages.
    const s = pairForecast(state, state.moths[0], state.moths[1], true);
    expect(s.wings.find((w) => w.pattern === "tidelit")?.p ?? 0).toBeCloseTo(f.tidelitInStorm, 9);
    expect(s.newPages.map((n) => n.key)).toContain("tidelit:fertile");
    expect(s.stormPages).toEqual([]);
  });

  it("a Plain pair can't be Tidelit or Hollow", () => {
    const state = roost([m("a", "plain", 30), m("b", "plain", 30)]);
    state.endingSeen = true;
    const f = pairForecast(state, state.moths[0], state.moths[1], true);
    expect(f.wings.map((w) => w.pattern)).not.toContain("hollow");
    expect(f.tidelitInStorm).toBe(0);
  });
});
