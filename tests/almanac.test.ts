import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import {
  ALMANAC_PATTERNS,
  ALMANAC_SIZE,
  ALMANAC_TRAITS,
  almanacKey,
  dutySlots,
  lureBankSize,
  lureRegrowMs,
} from "../src/game/almanac";
import { productionPerSecond } from "../src/game/engine";
import { claimExpedition, relicChanceFor, routeById, sendExpedition } from "../src/game/expeditions";
import { MOTH_TRAITS, tidelitMultiplier } from "../src/game/mothTraits";
import {
  MOTH_PATTERNS,
  attractMoth,
  cocoonDurationMs,
  hatchCocoon,
  lureStatus,
  postMoth,
  releaseMoth,
  releaseScales,
  scentedAttractMoth,
  startBreeding,
  toggleDuty,
} from "../src/game/moths";
import { mulberry32 } from "../src/game/rng";
import { lampHaloColor } from "../src/scene/model";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import { TIDE_BUCKET_MS, tideAt } from "../src/game/tides";
import type { GameState, Moth } from "../src/game/types";

function stubRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function moth(id: string, pattern: string, glow: number, trait?: string): Moth {
  return { id, name: `Moth-${id}`, pattern, glow, generation: 1, ...(trait ? { trait } : {}) };
}

function garden(): GameState {
  const state = createInitialState(0);
  state.generators["lantern-moth"] = 1;
  return state;
}

/** Fill the first `n` Almanac entries. */
function filled(state: GameState, n: number): GameState {
  const keys = ALMANAC_PATTERNS.flatMap((p) => ALMANAC_TRAITS.map((t) => almanacKey(p, t === "none" ? null : t)));
  state.almanac = keys.slice(0, n);
  return state;
}

/** A time with this tide, late enough for any cocoon started at 0 to be ready. */
function findTide(id: string): number {
  for (let t = 10 * TIDE_BUCKET_MS; ; t += TIDE_BUCKET_MS) if (tideAt(t).def.id === id) return t;
}

describe("the Wing Almanac", () => {
  it("has a page for every pattern × trait pairing, matching the game's own lists", () => {
    expect(ALMANAC_PATTERNS).toEqual(MOTH_PATTERNS.map((p) => p.id));
    expect(ALMANAC_TRAITS).toEqual(["none", ...MOTH_TRAITS.map((t) => t.id)]);
    expect(ALMANAC_SIZE).toBe(49);
  });

  it("a page fills the first time you hold such a moth, and stays filled", () => {
    const state = garden();
    const m = attractMoth(state, stubRng([0, 0.5, 0, 0, 0.3, 0.2, 0]), 0)!; // a Lamp-loyal Plain
    expect(state.almanac).toEqual(["plain:lamp-loyal"]);
    attractMoth(state, stubRng([0, 0.5, 0, 0, 0.6, 0.2, 0]), 0);
    expect(state.almanac).toEqual(["plain:lamp-loyal"]); // the same page
    releaseMoth(state, m.id);
    expect(state.almanac).toEqual(["plain:lamp-loyal"]);
    state.moths = [moth("a", "crescent", 30), moth("b", "crescent", 30)];
    startBreeding(state, "a", "b", 0);
    hatchCocoon(state, stubRng([0.5, 0.5, 0.5, 0.5, 0, 0, 0.3, 0.9, 0.9, 0.9]), findTide("calm"));
    expect(state.almanac).toEqual(["plain:lamp-loyal", "crescent:none"]);
  });

  it("rewards at 6, 12, 24, 36 and every page", () => {
    const state = garden();
    expect([lureBankSize(state), dutySlots(state), lureRegrowMs(state) / 60_000]).toEqual([3, 3, 20]);
    expect(lureBankSize(filled(state, 6))).toBe(4);
    expect(lureStatus(state, 0).held).toBe(3); // the bank grows; the extra lure regrows
    expect(lureStatus(state, 20 * 60_000).held).toBe(4);
    expect(dutySlots(filled(state, 12))).toBe(4);
    state.moths = ["a", "b", "c", "d", "e"].map((id) => moth(id, "plain", 10));
    for (const id of ["a", "b", "c", "d"]) expect(toggleDuty(state, id)).toBe(true);
    expect(toggleDuty(state, "e")).toBe(false);
    const pair = [moth("x", "plain", 1), moth("y", "plain", 1)] as const;
    expect(cocoonDurationMs(...pair, filled(state, 23))).toBe(30 * 60_000);
    expect(cocoonDurationMs(...pair, filled(state, 24))).toBe(25.5 * 60_000);
    expect(lureRegrowMs(filled(state, 36))).toBe(15 * 60_000);
    expect(lampHaloColor(filled(state, 48))).toBeNull();
    state.moths = [moth("a", "plain", 30), moth("b", "crescent", 70)];
    expect(lampHaloColor(filled(state, 49))).toBe("#c9b8ff"); // the brightest moth's wings
  });

  it("loading fills pages for every moth already held, and drops junk", () => {
    const raw = { ...serializeState(garden()), version: 8 } as Record<string, unknown>;
    delete raw.almanac;
    raw.moths = [moth("a", "starlit", 50, "seeker"), moth("b", "plain", 10)];
    expect(deserializeState(raw)!.almanac.sort()).toEqual(["plain:none", "starlit:seeker"]);
    raw.almanac = ["plain:none", "dragon:none", "plain:wizard", 7];
    expect(deserializeState(raw)!.almanac.sort()).toEqual(["plain:none", "starlit:seeker"]);
  });
});

describe("Wing Scales", () => {
  it("a release leaves tier + 1 scales, +1 for a trait", () => {
    expect(releaseScales(moth("a", "plain", 10))).toBe(1);
    expect(releaseScales(moth("a", "prismatic", 10, "fertile"))).toBe(7);
    const state = garden();
    state.moths = [moth("a", "crescent", 10, "seeker")];
    releaseMoth(state, "a");
    expect(state.wingScales).toBe(5);
  });

  it("a scented lure costs 8 scales, needs no lure, and always brings a trait", () => {
    const state = garden();
    state.wingScales = 7;
    expect(scentedAttractMoth(state, mulberry32(1))).toBeNull();
    state.wingScales = 17;
    state.mothLures = 0;
    const rng = mulberry32(5);
    for (let i = 0; i < 2; i++) expect(scentedAttractMoth(state, rng)!.trait).toBeTruthy();
    expect(state.wingScales).toBe(1);
  });
});

describe("Tidelit moths", () => {
  const prismaticPair = () => {
    const state = garden();
    state.moths = [moth("a", "prismatic", 80), moth("b", "prismatic", 80)];
    startBreeding(state, "a", "b", 0);
    return state;
  };
  // pick, shift (< 0.6 stays Prismatic), kind, amount, name ×2, id, inherit, mutate, Tidelit
  const rolls = (last: number) => stubRng([0.5, 0.3, 0.5, 0.5, 0, 0, 0.3, 0.9, 0.9, last]);

  it("a Starlit or Prismatic cocoon opening in a Stormfront is Tidelit 5% of the time; never otherwise", () => {
    const storm = findTide("storm");
    expect(hatchCocoon(prismaticPair(), rolls(0.04), storm)!.pattern).toBe("tidelit");
    expect(hatchCocoon(prismaticPair(), rolls(0.05), storm)!.pattern).toBe("prismatic");
    expect(hatchCocoon(prismaticPair(), rolls(0.01), findTide("calm"))!.pattern).toBe("prismatic");
    const plain = garden();
    plain.moths = [moth("a", "plain", 30), moth("b", "plain", 30)];
    startBreeding(plain, "a", "b", 0);
    expect(hatchCocoon(plain, rolls(0.01), storm)!.pattern).toBe("plain");
  });

  it("is never wild, and breeds as tier 5 (its children are Prismatic or Starlit)", () => {
    expect(MOTH_PATTERNS.find((p) => p.id === "tidelit")!.weight).toBe(0);
    const state = garden();
    state.moths = [moth("a", "tidelit", 80), moth("b", "tidelit", 80)];
    startBreeding(state, "a", "b", 0);
    expect(hatchCocoon(state, rolls(0.9), findTide("calm"))!.pattern).toBe("prismatic");
  });

  it("on duty its bonus counts double in a Stormfront and half in Glass Calm (final rate only)", () => {
    const at = (pattern: string, now?: number) => {
      const state = garden();
      state.generators["candle-crab"] = 5;
      state.moths = [moth("a", pattern, 50), moth("b", "plain", 25)];
      toggleDuty(state, "a");
      toggleDuty(state, "b");
      return { state, rate: productionPerSecond(state, now).toNumber() };
    };
    // duty: 1 + 0.1 (Tidelit) + 0.05 = 1.15
    const storm = findTide("storm");
    const calm = findTide("calm");
    expect(tidelitMultiplier(at("tidelit").state)).toBe(1);
    expect(tidelitMultiplier(at("tidelit").state, storm)).toBeCloseTo(1.25 / 1.15, 9);
    expect(tidelitMultiplier(at("tidelit").state, calm)).toBeCloseTo(1.1 / 1.15, 9);
    expect(tidelitMultiplier(at("tidelit").state, findTide("low"))).toBe(1);
    expect(at("tidelit", calm).rate / at("prismatic", calm).rate).toBeCloseTo(1.1 / 1.15, 9);
  });
});

describe("moths riding bottles", () => {
  function sea(): GameState {
    const state = garden();
    state.lumen = new Decimal(1e9);
    state.moths = [moth("a", "starlit", 90, "seeker"), moth("b", "plain", 30), moth("c", "plain", 30)];
    return state;
  }

  it("a rider adds glow ÷ 10 points of relic chance, +10 for a Seeker", () => {
    const state = sea();
    const drift = routeById("drift")!;
    expect(relicChanceFor(state, drift, state.moths[1])).toBeCloseTo(0.13, 9);
    expect(relicChanceFor(state, drift, state.moths[0])).toBeCloseTo(0.29, 9);
    expect(relicChanceFor(state, routeById("crossing")!, state.moths[0])).toBe(0.99);
  });

  it("a rider leaves duty and its post, and can't breed, post, stand duty or be released at sea", () => {
    const state = sea();
    toggleDuty(state, "b");
    postMoth(state, "a", "first-light");
    expect(sendExpedition(state, "drift", 0, "ghost")).toBe(false);
    expect(sendExpedition(state, "drift", 0, "a")).toBe(true);
    expect(state.expedition!.riderId).toBe("a");
    expect(state.mothPosts).toEqual({});
    expect(toggleDuty(state, "a")).toBe(false);
    expect(postMoth(state, "a", "first-light")).toBe(false);
    expect(startBreeding(state, "a", "b", 0)).toBe(false);
    expect(releaseMoth(state, "a")).toBeNull();
    expect(relicChanceFor(state, routeById("drift")!)).toBeCloseTo(0.29, 9); // the moth at sea
    const claim = claimExpedition(state, stubRng([0.99, 0.5]), 10 * 60_000)!;
    expect(claim.rider!.id).toBe("a");
    expect(state.expedition).toBeNull();
    expect(toggleDuty(state, "a")).toBe(true); // home again
  });

  it("a moth in the cocoon can't ride", () => {
    const state = sea();
    startBreeding(state, "b", "c", 0);
    expect(sendExpedition(state, "drift", 0, "b")).toBe(false);
  });

  it("on the Crossing, a traitless rider comes home with a trait 1 time in 10", () => {
    const trip = (riderId: string, rolls: number[]) => {
      const state = sea();
      sendExpedition(state, "crossing", 0, riderId);
      const claim = claimExpedition(state, stubRng(rolls), 360 * 60_000)!;
      return { state, claim };
    };
    // rolls: relic (0.999 = none), trait (0.05 < 0.1), which trait (0 → Lamp-loyal)
    const changed = trip("b", [0.999, 0.05, 0]);
    expect(changed.claim.riderTrait).toBe("lamp-loyal");
    expect(changed.state.moths[1].trait).toBe("lamp-loyal");
    expect(changed.state.almanac).toContain("plain:lamp-loyal");
    expect(trip("b", [0.999, 0.1, 0]).claim.riderTrait).toBeNull();
    expect(trip("a", [0.999, 0.01, 0]).state.moths[0].trait).toBe("seeker"); // already has one
  });

  it("saves keep the rider; an unknown rider is dropped", () => {
    const state = sea();
    sendExpedition(state, "coastal", 0, "a");
    const raw = JSON.parse(JSON.stringify(serializeState(state)));
    expect(deserializeState(raw)!.expedition!.riderId).toBe("a");
    raw.expedition.riderId = "ghost";
    expect(deserializeState(raw)!.expedition!.riderId).toBeUndefined();
  });
});
