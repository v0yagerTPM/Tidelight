import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { totalSupport } from "../src/game/chain";
import { FIRST_LIGHT_ID } from "../src/game/config";
import { productionPerSecond } from "../src/game/engine";
import { relicChanceFor, routeById } from "../src/game/expeditions";
import { MOTH_TRAITS, postSupportMultiplier, traitById, tidewiseMultiplier } from "../src/game/mothTraits";
import {
  attractMoth,
  cocoonDurationMs,
  hatchCocoon,
  mothProductionMultiplier,
  postMoth,
  recallMoth,
  releaseMoth,
  startBreeding,
  toggleDuty,
  vacateDarkPosts,
} from "../src/game/moths";
import { mulberry32 } from "../src/game/rng";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import { TIDE_BUCKET_MS, tideAt } from "../src/game/tides";
import type { GameState, Moth } from "../src/game/types";
import { offlineRateFor } from "../src/game/upgrades";

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

/** The first tide bucket at or after `from` with one of these tides. */
function findTide(ids: string[], from = 0): number {
  for (let t = from; ; t += TIDE_BUCKET_MS) if (ids.includes(tideAt(t).def.id)) return t;
}

describe("moth traits — where they come from", () => {
  it("six traits, each with a name and an effect", () => {
    expect(MOTH_TRAITS.map((t) => t.id)).toEqual(["lamp-loyal", "night-flier", "chain-tender", "seeker", "fertile", "tidewise"]);
    for (const t of MOTH_TRAITS) expect(t.effect.length).toBeGreaterThan(10);
    expect(traitById("nonsense")).toBeNull();
  });

  it("a wild moth carries a trait 25% of the time (rolled after its id)", () => {
    // rng: pattern, glow, name prefix, name suffix, id, trait roll, which trait
    expect(attractMoth(garden(), stubRng([0, 0.5, 0, 0, 0.3, 0.2, 0]), 0)!.trait).toBe("lamp-loyal");
    expect(attractMoth(garden(), stubRng([0, 0.5, 0, 0, 0.3, 0.2, 0.99]), 0)!.trait).toBe("tidewise");
    expect(attractMoth(garden(), stubRng([0, 0.5, 0, 0, 0.3, 0.25]), 0)!.trait).toBeUndefined();
    let traited = 0;
    const rng = mulberry32(31);
    for (let i = 0; i < 4000; i++) if (attractMoth(garden(), rng, 0)!.trait) traited++;
    expect(traited / 4000).toBeGreaterThan(0.23);
    expect(traited / 4000).toBeLessThan(0.27);
  });

  it("a child inherits a parent's trait half the time, or gains a new one 3% of the time", () => {
    const hatch = (traitA: string | undefined, traitB: string | undefined, tail: number[]) => {
      const state = garden();
      state.moths = [moth("a", "plain", 30, traitA), moth("b", "plain", 30, traitB)];
      startBreeding(state, "a", "b", 0);
      // rng: parent pick, tier shift, mutation kind, amount, name ×2, id, then the trait rolls
      return hatchCocoon(state, stubRng([0.5, 0.5, 0.5, 0.5, 0, 0, 0.3, ...tail]), 1e9)!;
    };
    expect(hatch("seeker", undefined, [0.4, 0.9]).trait).toBe("seeker"); // inherit, the only trait
    expect(hatch("seeker", "fertile", [0.4, 0.9]).trait).toBe("fertile"); // inherit, second parent's
    expect(hatch("seeker", "fertile", [0.6, 0.5]).trait).toBeUndefined(); // no inherit, no mutation
    expect(hatch(undefined, undefined, [0.1, 0.02, 0]).trait).toBe("lamp-loyal"); // a new trait
    expect(hatch(undefined, undefined, [0.1, 0.03]).trait).toBeUndefined();
  });
});

describe("moth traits — what they do", () => {
  it("Lamp-loyal: its duty glow counts ×1.5", () => {
    const state = garden();
    state.moths = [moth("a", "crescent", 50, "lamp-loyal"), moth("b", "crescent", 50)];
    toggleDuty(state, "a");
    expect(mothProductionMultiplier(state)).toBeCloseTo(1.15, 9); // 75 × 0.2%
    toggleDuty(state, "b");
    expect(mothProductionMultiplier(state)).toBeCloseTo(1.25, 9);
  });

  it("Night-flier: +5 offline points each on duty, under the 90% cap", () => {
    const state = garden();
    const base = offlineRateFor(state);
    state.moths = [moth("a", "plain", 10, "night-flier"), moth("b", "plain", 10, "night-flier")];
    expect(offlineRateFor(state)).toBe(base); // only on duty
    toggleDuty(state, "a");
    toggleDuty(state, "b");
    expect(offlineRateFor(state)).toBeCloseTo(base + 0.1, 9);
  });

  it("Seeker: +5 relic-chance points each on duty", () => {
    const state = garden();
    const drift = routeById("drift")!;
    expect(relicChanceFor(state, drift)).toBeCloseTo(0.1, 9);
    state.moths = [moth("a", "plain", 10, "seeker")];
    toggleDuty(state, "a");
    expect(relicChanceFor(state, drift)).toBeCloseTo(0.15, 9);
    expect(relicChanceFor(state, routeById("crossing")!)).toBeCloseTo(0.85, 9);
  });

  it("Fertile: a cocoon with a Fertile parent takes 25% less time", () => {
    expect(cocoonDurationMs(moth("a", "plain", 1), moth("b", "plain", 1))).toBe(30 * 60_000);
    expect(cocoonDurationMs(moth("a", "plain", 1, "fertile"), moth("b", "plain", 1))).toBe(22.5 * 60_000);
    expect(cocoonDurationMs(moth("a", "prismatic", 1, "fertile"), moth("b", "plain", 1, "fertile"))).toBe(56.25 * 60_000);
  });

  it("Tidewise: in High Tide or a Stormfront its duty bonus lifts the final beam again; neutral otherwise", () => {
    const state = garden();
    state.generators["candle-crab"] = 5;
    state.moths = [moth("a", "starlit", 50, "tidewise")];
    toggleDuty(state, "a");
    const rough = findTide(["high", "storm"]);
    const quiet = findTide(["low", "calm"]);
    expect(tidewiseMultiplier(state)).toBe(1); // no time → neutral, like the tide
    expect(tidewiseMultiplier(state, quiet)).toBe(1);
    expect(tidewiseMultiplier(state, rough)).toBeCloseTo(1.1, 9);
    const plain = garden();
    plain.generators["candle-crab"] = 5;
    plain.moths = [moth("a", "starlit", 50)];
    toggleDuty(plain, "a");
    const ratio = productionPerSecond(state, rough).div(productionPerSecond(plain, rough)).toNumber();
    expect(ratio).toBeCloseTo(1.1, 9);
  });
});

describe("lighthouse posts", () => {
  it("a posted moth adds glow × 0.2% support to its lighthouse's board; a Chain-tender doubles it", () => {
    const state = garden();
    state.moths = [moth("a", "crescent", 50), moth("b", "crescent", 50, "chain-tender")];
    expect(totalSupport(state, "wick").toNumber()).toBe(20);
    expect(postMoth(state, "a", FIRST_LIGHT_ID)).toBe(true);
    expect(postSupportMultiplier(state, FIRST_LIGHT_ID)).toBeCloseTo(1.1, 9);
    expect(totalSupport(state, "wick").toNumber()).toBeCloseTo(22, 9);
    expect(postMoth(state, "b", FIRST_LIGHT_ID)).toBe(true); // swap: a comes home
    expect(state.mothPosts).toEqual({ [FIRST_LIGHT_ID]: "b" });
    expect(totalSupport(state, "wick").toNumber()).toBeCloseTo(24, 9);
  });

  it("only at lit lighthouses; one post per moth; a posted moth leaves duty and can't breed", () => {
    const state = garden();
    state.moths = [moth("a", "plain", 30), moth("b", "plain", 30), moth("c", "plain", 30)];
    expect(postMoth(state, "a", "gull-rock")).toBe(false); // still dark
    state.litLighthouses.push("gull-rock");
    toggleDuty(state, "a");
    expect(postMoth(state, "a", "gull-rock")).toBe(true);
    expect(state.mothDuty).toEqual([]); // stood down
    expect(toggleDuty(state, "a")).toBe(false); // not while posted
    expect(startBreeding(state, "a", "b", 0)).toBe(false);
    expect(postMoth(state, "a", FIRST_LIGHT_ID)).toBe(true); // moves
    expect(state.mothPosts).toEqual({ [FIRST_LIGHT_ID]: "a" });
    expect(recallMoth(state, FIRST_LIGHT_ID)).toBe(true);
    expect(state.mothPosts).toEqual({});
    expect(recallMoth(state, FIRST_LIGHT_ID)).toBe(false);
    expect(startBreeding(state, "a", "b", 0)).toBe(true);
    expect(postMoth(state, "a", FIRST_LIGHT_ID)).toBe(false); // in the cocoon
  });

  it("releasing a posted moth clears its post; the Next Keeping vacates darkened posts", () => {
    const state = garden();
    state.moths = [moth("a", "plain", 30), moth("b", "plain", 30)];
    state.litLighthouses.push("gull-rock");
    postMoth(state, "a", FIRST_LIGHT_ID);
    postMoth(state, "b", "gull-rock");
    releaseMoth(state, "a");
    expect(state.mothPosts).toEqual({ "gull-rock": "b" });
    state.litLighthouses = [FIRST_LIGHT_ID];
    vacateDarkPosts(state);
    expect(state.mothPosts).toEqual({});
  });

  it("saves round-trip traits and posts; loading drops what can't stand", () => {
    const state = garden();
    state.lumen = new Decimal(5);
    state.litLighthouses.push("gull-rock");
    state.moths = [moth("a", "plain", 30, "seeker"), moth("b", "plain", 30)];
    postMoth(state, "a", "gull-rock");
    toggleDuty(state, "b");
    const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!;
    expect(restored.moths).toEqual(state.moths);
    expect(restored.mothPosts).toEqual({ "gull-rock": "a" });
    expect(restored.mothDuty).toEqual(["b"]);

    const raw = serializeState(state) as unknown as Record<string, unknown>;
    raw.moths = [{ ...moth("a", "plain", 30), trait: "wizard" }, moth("b", "plain", 30), moth("c", "plain", 30)];
    raw.mothPosts = { "gull-rock": "a", "first-light": "a", "hollow-light": "b", "cormorant-roost": "ghost" };
    raw.mothDuty = ["a", "b", "c"];
    const cleaned = deserializeState(JSON.parse(JSON.stringify(raw)))!;
    expect(cleaned.moths[0].trait).toBeUndefined(); // unknown trait dropped
    expect(cleaned.mothPosts).toEqual({ "gull-rock": "a" }); // one post per moth, lit only, real moths only
    expect(cleaned.mothDuty).toEqual(["b", "c"]); // a posted moth is never on duty

    const v7 = { ...serializeState(garden()), version: 7 } as Record<string, unknown>;
    delete v7.mothPosts;
    expect(deserializeState(v7)!.mothPosts).toEqual({});
  });
});
