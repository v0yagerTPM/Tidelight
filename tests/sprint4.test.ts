import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { chainStatus, nodeCost, totalSupport } from "../src/game/chain";
import { generatorById } from "../src/game/config";
import {
  clickValue,
  generatorProduction,
  productionPerSecond,
} from "../src/game/engine";
import {
  RELICS,
  STORY_FRAGMENTS,
  claimExpedition,
  expeditionCache,
  routeById,
  sendExpedition,
} from "../src/game/expeditions";
import {
  LURE_BANK,
  LURE_REGROW_MS,
  MOTH_PATTERNS,
  attractMoth,
  cocoonDurationMs,
  cocoonReady,
  glowCeiling,
  isOldLight,
  lureStatus,
  dutyGlowTotal,
  expandRoost,
  hatchCocoon,
  mothCapacity,
  mothProductionMultiplier,
  mothsUnlocked,
  patternById,
  releaseMoth,
  releasePayout,
  roostExpansionCost,
  rushAttractMoth,
  rushLureCost,
  startBreeding,
  toggleDuty,
} from "../src/game/moths";
import { rekindle, rekindleGain } from "../src/game/prestige";
import { mulberry32 } from "../src/game/rng";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import {
  TIDE_BUCKET_MS,
  tideAt,
  tideForecast,
  type TideId,
} from "../src/game/tides";
import type { GameState, Moth } from "../src/game/types";
import { buyUpgrade, offlineRateFor } from "../src/game/upgrades";

const crab = generatorById("candle-crab");
const mothGen = generatorById("lantern-moth");

/** An rng that plays back the given values, then keeps returning the last. */
function stubRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function moth(id: string, pattern: string, glow: number, generation = 1): Moth {
  return { id, name: `Moth-${id}`, pattern, glow, generation };
}

/** A state where the Moth Garden is open and the purse is deep. */
function gardenState(lumen = 1_000_000): GameState {
  const state = createInitialState();
  state.generators[mothGen.id] = 1;
  state.lumen = new Decimal(lumen);
  return state;
}

describe("seeded rng", () => {
  it("mulberry32 is deterministic and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(seqA[0]);
  });
});

describe("lantern moths — attracting with lures", () => {
  it("the garden is locked until a Lantern Moth generator is hired", () => {
    const state = createInitialState();
    expect(mothsUnlocked(state)).toBe(false);
    expect(attractMoth(state, mulberry32(1))).toBeNull();
    expect(state.mothLures).toBe(LURE_BANK); // nothing spent
    state.generators[mothGen.id] = 1;
    expect(mothsUnlocked(state)).toBe(true);
  });

  it("a seeded attract yields a generation-1 moth from the pattern table, deterministically", () => {
    const state = gardenState();
    const moth = attractMoth(state, mulberry32(42), 0);
    expect(moth).not.toBeNull();
    expect(MOTH_PATTERNS.map((p) => p.id)).toContain(moth!.pattern);
    expect(Number.isInteger(moth!.glow)).toBe(true);
    expect(moth!.glow).toBeGreaterThanOrEqual(1);
    expect(moth!.generation).toBe(1);
    expect(state.moths).toEqual([moth]);
    expect(state.lumen.toNumber()).toBe(1_000_000); // lures, not Lumen
    expect(attractMoth(gardenState(), mulberry32(42), 0)).toEqual(moth);
  });

  it("a keeper holds 3 lures; one regrows every 20 minutes, offline too, up to 3", () => {
    const state = gardenState();
    const t0 = 5_000_000;
    expect(lureStatus(state, t0)).toEqual({ held: 3, nextInMs: null, rushes: 0 });
    for (let i = 0; i < 3; i++) expect(attractMoth(state, mulberry32(i + 1), t0)).not.toBeNull();
    expect(attractMoth(state, mulberry32(9), t0)).toBeNull(); // the bank is empty
    // The clock started when the full bank was first spent.
    expect(lureStatus(state, t0)).toEqual({ held: 0, nextInMs: LURE_REGROW_MS, rushes: 0 });
    expect(lureStatus(state, t0 + 19 * 60_000).held).toBe(0);
    expect(attractMoth(state, mulberry32(9), t0 + 19 * 60_000)).toBeNull();
    expect(attractMoth(state, mulberry32(9), t0 + 20 * 60_000)).not.toBeNull();
    expect(lureStatus(state, t0 + 30 * 60_000)).toEqual({ held: 0, nextInMs: 10 * 60_000, rushes: 0 });
    // Hours away fill the bank, never past 3.
    expect(lureStatus(state, t0 + 10 * 3_600_000)).toEqual({ held: 3, nextInMs: null, rushes: 0 });
  });

  it("odds: a wild Prismatic is 1 in 200, and the six weights sum to 100", () => {
    expect(MOTH_PATTERNS.map((p) => p.weight)).toEqual([44, 26, 16, 9, 4.5, 0.5, 0, 0]); // Tidelit and Hollow are never wild
    expect(MOTH_PATTERNS.reduce((sum, p) => sum + p.weight, 0)).toBe(100);
    expect(attractMoth(gardenState(), stubRng([0.996, 0.5, 0, 0, 0.25]), 0)!.pattern).toBe("prismatic");
    expect(attractMoth(gardenState(), stubRng([0.994, 0.5, 0, 0, 0.25]), 0)!.pattern).toBe("starlit");
  });

  it("wild glow rolls 1 to 60% of the pattern's ceiling, so nothing arrives perfect", () => {
    expect(MOTH_PATTERNS.map((p) => p.glowCeiling)).toEqual([40, 55, 70, 80, 90, 100, 100, 120]);
    const rng = mulberry32(2026);
    for (let i = 0; i < 600; i++) {
      const state = gardenState();
      const m = attractMoth(state, rng, 0)!;
      expect(m.glow).toBeLessThanOrEqual(Math.ceil(0.6 * glowCeiling(m.pattern)));
    }
    // The top roll on a Prismatic: 1 + floor(0.999 × 60) = 60.
    expect(attractMoth(gardenState(), stubRng([0.999, 0.999, 0, 0, 0.25]), 0)!.glow).toBe(60);
  });

  it("a rush lure costs 0.5% of all-time Lumen (at least 500), only with an empty bank, tripling until a lure regrows", () => {
    const state = gardenState(20_000_000);
    state.allTimeLumen = new Decimal(1e9);
    const t0 = 0;
    expect(rushAttractMoth(state, mulberry32(1), t0)).toBeNull(); // spend the lures first
    for (let i = 0; i < 3; i++) attractMoth(state, mulberry32(i + 1), t0);
    expect(rushLureCost(state, t0).toNumber()).toBe(5_000_000);
    expect(rushAttractMoth(state, mulberry32(4), t0)).not.toBeNull();
    expect(state.lumen.toNumber()).toBe(15_000_000);
    expect(rushLureCost(state, t0).toNumber()).toBe(15_000_000);
    // One regrown lure forgives one rush.
    expect(rushLureCost(state, t0 + LURE_REGROW_MS).toNumber()).toBe(5_000_000);
    // A new keeper pays the 500 floor.
    expect(rushLureCost(gardenState(), 0).toNumber()).toBe(500);
  });

  it("the roost holds 6; expansions cost 10,000 × 6ⁿ or 3 minutes of production × 1.5ⁿ, whichever is more", () => {
    const state = gardenState();
    for (let i = 0; i < 6; i++) state.moths.push(moth(`m${i}`, "plain", 10));
    expect(mothCapacity(state)).toBe(6);
    expect(attractMoth(state, mulberry32(3), 0)).toBeNull();
    expect(roostExpansionCost(state).toNumber()).toBe(10_000);
    expect(expandRoost(state)).toBe(true);
    expect(mothCapacity(state)).toBe(8);
    expect(roostExpansionCost(state).toNumber()).toBe(60_000);
    expect(attractMoth(state, mulberry32(3), 0)).not.toBeNull();
    // All-time Lumen no longer matters (it once walled the roost at 10–12 moths).
    state.allTimeLumen = new Decimal(1e30);
    expect(roostExpansionCost(state).toNumber()).toBe(60_000);
    // Minutes of production: 1,000 crabs make 500 × 8 (milestones) = 4,000/s.
    state.generators[crab.id] = 1_000;
    const perSecond = productionPerSecond(state).toNumber();
    expect(roostExpansionCost(state).toNumber()).toBe(Math.ceil(perSecond * 3 * 1.5 * 60));
    // Every expansion stays within reach of a run: by mid-game production the
    // 11th costs under four hours of production (the 10,000 × 6ⁿ ladder only
    // matters while production is small).
    state.embers = 1e10;
    state.roostExpansions = 10;
    const midGame = productionPerSecond(state).toNumber();
    expect(roostExpansionCost(state).div(midGame).toNumber()).toBeLessThan(4 * 3600);
  });
});

describe("lantern moths — duty", () => {
  it("duty moths grant +(glow × 0.2)% production through the engine", () => {
    const state = createInitialState();
    state.moths = [moth("a", "plain", 50), moth("b", "spotted", 30), moth("c", "striped", 90)];
    state.generators[crab.id] = 5; // 2.5/s base, chain still locked
    expect(productionPerSecond(state).toNumber()).toBe(2.5);
    expect(toggleDuty(state, "a")).toBe(true);
    expect(toggleDuty(state, "b")).toBe(true);
    expect(dutyGlowTotal(state)).toBe(80);
    expect(mothProductionMultiplier(state)).toBeCloseTo(1.16, 9);
    // 2.5 × (1 + 80 × 0.002) = 2.9
    expect(generatorProduction(state, crab).toNumber()).toBeCloseTo(2.9, 9);
    expect(productionPerSecond(state).toNumber()).toBeCloseTo(2.9, 9);
    // Standing down removes the bonus:
    expect(toggleDuty(state, "a")).toBe(true);
    expect(mothProductionMultiplier(state)).toBeCloseTo(1.06, 9);
  });

  it("at most 3 moths on duty", () => {
    const state = createInitialState();
    state.moths = [moth("a", "plain", 10), moth("b", "plain", 10), moth("c", "plain", 10), moth("d", "plain", 10)];
    expect(toggleDuty(state, "a")).toBe(true);
    expect(toggleDuty(state, "b")).toBe(true);
    expect(toggleDuty(state, "c")).toBe(true);
    expect(toggleDuty(state, "d")).toBe(false); // roster full
    expect(toggleDuty(state, "ghost")).toBe(false); // no such moth
    expect(toggleDuty(state, "c")).toBe(true); // stand one down…
    expect(toggleDuty(state, "d")).toBe(true); // …and the slot frees up
  });
});

describe("lantern moths — breeding", () => {
  function parents(): GameState {
    const state = gardenState();
    state.moths = [
      moth("a", "striped", 40, 1), // tier 2
      moth("b", "crescent", 60, 2), // tier 3
    ];
    return state;
  }

  it("a cocoon takes 30 min × (1 + 0.3 × the higher tier): Plain 30, Crescent 57, Prismatic 75", () => {
    expect(cocoonDurationMs(moth("x", "plain", 1), moth("y", "plain", 1))).toBe(30 * 60_000);
    expect(cocoonDurationMs(moth("x", "plain", 1), moth("y", "crescent", 1))).toBe(57 * 60_000);
    expect(cocoonDurationMs(moth("x", "prismatic", 1), moth("y", "spotted", 1))).toBe(75 * 60_000);
  });

  it("not ready before its time, ready at it; parents kept; child at about the average glow", () => {
    const state = parents();
    const t0 = 1_000_000;
    const ready = t0 + 57 * 60_000;
    expect(startBreeding(state, "a", "b", t0)).toBe(true);
    expect(startBreeding(state, "a", "b", t0)).toBe(false); // one cocoon at a time
    expect(cocoonReady(state, ready - 1)).toBe(false);
    expect(hatchCocoon(state, mulberry32(1), ready - 1)).toBeNull();
    expect(cocoonReady(state, ready)).toBe(true);
    // rng: higher tier (0.5 < 0.65), no shift (0.5), no bright (0.5), drift round(10) − 10 − 1 = −1
    const child = hatchCocoon(state, stubRng([0.5, 0.5, 0.5, 0.5, 0, 0, 0.25]), ready);
    expect(child!.pattern).toBe("crescent");
    expect(child!.glow).toBe(49); // average 50, regression −1
    expect(child!.generation).toBe(3);
    expect(state.cocoon).toBeNull();
    expect(state.moths.map((m) => m.id)).toEqual(["a", "b", child!.id]);
  });

  it("tier shifts: 8% up, 12% down, clamped at Plain", () => {
    const up = parents();
    startBreeding(up, "a", "b", 0);
    const upChild = hatchCocoon(up, stubRng([0.9, 0.05, 0.5, 0.5, 0, 0, 0.3]), 1e9);
    expect(patternById(upChild!.pattern).tier).toBe(3); // the lower parent (2) + 1
    const none = parents();
    startBreeding(none, "a", "b", 0);
    expect(hatchCocoon(none, stubRng([0.9, 0.09, 0.5, 0.5, 0, 0, 0.3]), 1e9)!.pattern).toBe("spotted"); // 0.09 → down
    const down = gardenState();
    down.moths = [moth("a", "plain", 30), moth("b", "plain", 30)];
    startBreeding(down, "a", "b", 0);
    expect(hatchCocoon(down, stubRng([0.5, 0.15, 0.5, 0.5, 0, 0, 0.3]), 1e9)!.pattern).toBe("plain");
  });

  it("Prismatic is unstable: a Prismatic child stays Prismatic 60% of the time, otherwise Starlit", () => {
    const pair = () => {
      const state = gardenState();
      state.moths = [moth("a", "prismatic", 80), moth("b", "prismatic", 80)];
      startBreeding(state, "a", "b", 0);
      return state;
    };
    expect(hatchCocoon(pair(), stubRng([0.5, 0.59, 0.5, 0.5, 0, 0, 0.3]), 1e9)!.pattern).toBe("prismatic");
    expect(hatchCocoon(pair(), stubRng([0.5, 0.6, 0.5, 0.5, 0, 0, 0.3]), 1e9)!.pattern).toBe("starlit");
    let prismatic = 0;
    const rng = mulberry32(77);
    for (let i = 0; i < 4000; i++) if (hatchCocoon(pair(), rng, 1e9)!.pattern === "prismatic") prismatic++;
    expect(prismatic / 4000).toBeGreaterThan(0.57);
    expect(prismatic / 4000).toBeLessThan(0.63);
  });

  it("glow is held to the child's pattern ceiling", () => {
    const state = gardenState();
    state.moths = [moth("a", "prismatic", 100), moth("b", "prismatic", 100)];
    startBreeding(state, "a", "b", 0);
    // Falls to Starlit (0.7): average 100 − 1 = 99, held to Starlit's 90.
    expect(hatchCocoon(state, stubRng([0.5, 0.7, 0.5, 0.5, 0, 0, 0.3]), 1e9)!.glow).toBe(90);
  });

  it("a bright mutation (3%) adds +8..+15; above an average of 90 every gain is halved", () => {
    const state = parents(); // average 50
    startBreeding(state, "a", "b", 0);
    // mutation kind 0.02 < 0.03 → bright; amount 0.5 → 8 + 4 = +12
    expect(hatchCocoon(state, stubRng([0.5, 0.5, 0.02, 0.5, 0, 0, 0.3]), 1e9)!.glow).toBe(62);
    const high = gardenState();
    high.moths = [moth("a", "prismatic", 90), moth("b", "prismatic", 90)];
    startBreeding(high, "a", "b", 0);
    // drift round(18) − 11 = +7, halved → 93.5 → 94 (it would be 97 below 90)
    expect(hatchCocoon(high, stubRng([0.5, 0.5, 0.5, 0.9, 0, 0, 0.3]), 1e9)!.glow).toBe(94);
  });

  it("a seeded sweep stays within ±1 tier of a parent and within the child's ceiling", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const state = gardenState();
      const pa = MOTH_PATTERNS[seed % 6];
      const pb = MOTH_PATTERNS[(seed * 3) % 6];
      state.moths = [moth("a", pa.id, (seed * 37) % 100 + 1, 2), moth("b", pb.id, (seed * 53) % 100 + 1, 4)];
      expect(startBreeding(state, "a", "b", 0)).toBe(true);
      const child = hatchCocoon(state, mulberry32(seed), 1e9);
      const tier = patternById(child!.pattern).tier;
      expect(Math.abs(tier - pa.tier) <= 1 || Math.abs(tier - pb.tier) <= 1).toBe(true);
      expect(child!.glow).toBeGreaterThanOrEqual(1);
      expect(child!.glow).toBeLessThanOrEqual(glowCeiling(child!.pattern));
      expect(child!.generation).toBe(5);
    }
  });

  it("moths from before the rebalance keep their glow above the new ceilings (old light)", () => {
    const old = moth("o", "plain", 95);
    expect(isOldLight(old)).toBe(true);
    expect(isOldLight(moth("n", "plain", 40))).toBe(false);
    const restored = deserializeState(JSON.parse(JSON.stringify({ ...serializeState(gardenState()), moths: [old] })));
    expect(restored!.moths[0].glow).toBe(95);
  });

  it("hatching needs a free roost slot", () => {
    const state = parents();
    state.moths.push(moth("c", "plain", 10), moth("d", "plain", 10), moth("e", "plain", 10), moth("f", "plain", 10));
    expect(state.moths.length).toBe(6);
    startBreeding(state, "a", "b", 0);
    expect(hatchCocoon(state, mulberry32(5), 1e9)).toBeNull();
    expect(releaseMoth(state, "f")).not.toBeNull();
    expect(hatchCocoon(state, mulberry32(5), 1e9)).not.toBeNull();
  });

  it("breeding validates its parents", () => {
    const state = parents();
    expect(startBreeding(state, "a", "a", 0)).toBe(false);
    expect(startBreeding(state, "a", "ghost", 0)).toBe(false);
    expect(state.cocoon).toBeNull();
  });
});

describe("lantern moths — release", () => {
  it("release gives a small gift, 10 × glow × (tier + 1), to the purse only, and clears duty", () => {
    const state = gardenState(0);
    state.moths = [moth("a", "striped", 20), moth("b", "plain", 10)];
    toggleDuty(state, "a");
    expect(releasePayout(state, state.moths[0]).toNumber()).toBe(10 * 20 * 3);
    expect(releaseMoth(state, "a")!.toNumber()).toBe(600);
    expect(state.lumen.toNumber()).toBe(600);
    expect(state.lifetimeLumen.toNumber()).toBe(0);
    expect(state.moths.map((m) => m.id)).toEqual(["b"]);
    expect(state.mothDuty).toEqual([]);
    expect(releaseMoth(state, "a")).toBeNull();
  });

  it("a moth in the cocoon cannot be released", () => {
    const state = gardenState();
    state.moths = [moth("a", "plain", 30), moth("b", "plain", 30)];
    startBreeding(state, "a", "b", 0);
    expect(releaseMoth(state, "a")).toBeNull();
    expect(state.moths.length).toBe(2);
  });
});

describe("bottle expeditions", () => {
  it("sending costs Lumen, sets the return time, and only one bottle sails", () => {
    const state = createInitialState();
    state.lumen = new Decimal(10_000);
    const t0 = 5_000_000;
    expect(sendExpedition(state, "drift", t0)).toBe(true);
    expect(state.lumen.toNumber()).toBe(9_000);
    expect(state.expedition).toEqual({ routeId: "drift", startedAt: t0, returnsAt: t0 + 600_000 });
    expect(sendExpedition(state, "coastal", t0)).toBe(false); // one at a time
    const broke = createInitialState();
    expect(sendExpedition(broke, "drift", t0)).toBe(false); // can't afford
    expect(sendExpedition(broke, "nowhere", t0)).toBe(false); // unknown route
  });

  it("the cache is max(route minimum, production × duration × 0.5)", () => {
    const drift = routeById("drift")!;
    const empty = createInitialState();
    expect(expeditionCache(empty, drift).toNumber()).toBe(500); // the floor
    const state = createInitialState();
    state.generators[crab.id] = 10; // 5/s, fully chain-supported
    expect(productionPerSecond(state).toNumber()).toBe(5);
    expect(expeditionCache(state, drift).toNumber()).toBe(1_500); // 5 × 600 × 0.5
    expect(expeditionCache(state, routeById("coastal")!).toNumber()).toBe(9_000); // 5 × 3600 × 0.5
  });

  it("claiming before the bottle returns does nothing; claiming after pays the cache and a story fragment", () => {
    const state = createInitialState();
    state.generators[crab.id] = 10;
    state.lumen = new Decimal(10_000);
    const t0 = 5_000_000;
    sendExpedition(state, "drift", t0);
    expect(claimExpedition(state, stubRng([0.99]), t0 + 599_999)).toBeNull();
    expect(state.expedition).not.toBeNull();
    const before = state.lumen.toNumber();
    const claim = claimExpedition(state, stubRng([0.99]), t0 + 600_000); // 0.99 ≥ 10% → no relic
    expect(claim).not.toBeNull();
    expect(claim!.relic).toBeNull();
    expect(claim!.bonusLumen.toNumber()).toBe(0);
    expect(state.lumen.toNumber()).toBe(before + claim!.cache.toNumber());
    expect(claim!.fragment).toBe(STORY_FRAGMENTS[0]);
    expect(state.storyFragmentIndex).toBe(1);
    expect(state.expedition).toBeNull();
    // The log carries the fragment home:
    expect(state.log.some((e) => e.message.includes(STORY_FRAGMENTS[0]))).toBe(true);
  });

  it("a lucky roll grants a relic; relics are unique; with all 8 home the roll pays +50% bonus Lumen", () => {
    const state = createInitialState();
    state.generators[crab.id] = 10;
    const lucky = () => 0; // roll 0 always succeeds; pick 0 = first unclaimed
    const fragments: string[] = [];
    for (let i = 0; i < RELICS.length; i++) {
      state.expedition = { routeId: "crossing", startedAt: 0, returnsAt: 0 };
      const claim = claimExpedition(state, lucky, 0);
      expect(claim!.relic).not.toBeNull();
      fragments.push(claim!.fragment);
    }
    expect(new Set(state.relics).size).toBe(8); // all unique
    expect(state.relics).toEqual(RELICS.map((r) => r.id)); // pick-0 grants in table order
    expect(fragments).toEqual([...STORY_FRAGMENTS]); // fragments rotate without repeats

    // Ninth bottle: the relic roll still "succeeds", but there's nothing
    // left to give — it converts to +50% of the cache in bonus Lumen.
    state.expedition = { routeId: "crossing", startedAt: 0, returnsAt: 0 };
    const before = state.lumen.toNumber();
    const claim = claimExpedition(state, lucky, 0);
    expect(claim!.relic).toBeNull();
    expect(claim!.bonusLumen.toNumber()).toBeCloseTo(claim!.cache.toNumber() * 0.5, 6);
    expect(state.lumen.toNumber()).toBeCloseTo(before + claim!.cache.toNumber() * 1.5, 4);
    expect(claim!.fragment).toBe(STORY_FRAGMENTS[0]); // the rotation wraps
  });
});

describe("relic effects", () => {
  it("Brass Compass +10% production, Salt Lens click ×1.5, Tide Chart support +15%", () => {
    const state = createInitialState();
    state.generators[crab.id] = 5; // 2.5/s
    state.relics = ["brass-compass"];
    expect(generatorProduction(state, crab).toNumber()).toBeCloseTo(2.75, 9);
    state.relics = ["salt-lens"];
    expect(clickValue(state).toNumber()).toBe(1.5);
    state.generators[crab.id] = 10; // chain unlocked, First Light board 1/1/1
    state.relics = ["tide-chart"];
    expect(totalSupport(state, "wick").toNumber()).toBeCloseTo(23, 9); // 20 × 1.15
  });

  it("Gull Feather takes 20% off chain node costs", () => {
    const state = createInitialState();
    expect(nodeCost("first-light", "wick", 0, state).toNumber()).toBe(500);
    state.relics = ["gull-feather"];
    expect(nodeCost("first-light", "wick", 0, state).toNumber()).toBe(400);
    expect(nodeCost("first-light", "beam", 0, state).toNumber()).toBe(20_000);
  });

  it("Keeper's Coat adds +5 points to the offline rate, still hard-capped at 90%", () => {
    const state = createInitialState();
    expect(offlineRateFor(state)).toBe(0.5);
    state.relics = ["keepers-coat"];
    expect(offlineRateFor(state)).toBeCloseTo(0.55, 9);
    // Everything stacked: Longer Wicks 75% + Full Reservoir 10 + Coat 5 = 90, the cap.
    state.embers = 100;
    state.embersTotalEarned = 100;
    state.emberPerks = ["full-lamp"];
    state.allTimeLumen = new Decimal(2_000_000);
    state.lumen = new Decimal(300_000);
    expect(buyUpgrade(state, "longer-wicks")).toBe(true);
    expect(offlineRateFor(state)).toBeCloseTo(0.9, 9);
  });

  it("Amber Heart raises Rekindle gain by 10% (floored)", () => {
    const state = createInitialState();
    state.lifetimeLumen = new Decimal(8_000_000); // worth 40
    expect(rekindleGain(state)).toBe(40);
    state.relics = ["amber-heart"];
    expect(rekindleGain(state)).toBe(44);
    expect(rekindle(state)).toBe(44);
    expect(state.embers).toBe(44);
  });

  it("Driftwood Cradle: wild moths arrive with +5 glow (hatchlings get nothing extra)", () => {
    // rng: pattern plain (0), glow roll 0.5 → 1 + floor(0.5 × 24) = 13, then name/id rolls.
    const plain = attractMoth(gardenState(), stubRng([0, 0.5, 0, 0, 0.25]), 0);
    expect(plain!.glow).toBe(13);
    const state = gardenState();
    state.relics = ["driftwood-cradle"];
    const cradled = attractMoth(state, stubRng([0, 0.5, 0, 0, 0.25]), 0);
    expect(cradled!.glow).toBe(18);
    // Still held to the ceiling: Plain's top roll 24 + 5 = 29 ≤ 40.
    state.moths = [moth("a", "plain", 30), moth("b", "plain", 30)];
    startBreeding(state, "a", "b", 0);
    expect(hatchCocoon(state, stubRng([0.5, 0.5, 0.5, 0.55, 0, 0, 0.3]), 1e9)!.glow).toBe(30); // 30 + 11 − 11, no Cradle
  });
});

describe("tide & weather", () => {
  function findTideTime(id: TideId): number {
    let t = Math.floor(1_700_000_000_000 / TIDE_BUCKET_MS) * TIDE_BUCKET_MS;
    for (let i = 0; i < 500; i++) {
      if (tideAt(t).def.id === id) return t;
      t += TIDE_BUCKET_MS;
    }
    throw new Error(`no ${id} tide found in scan window`);
  }

  it("tideAt is deterministic: same bucket, same tide, exact 30-minute span", () => {
    const now = 1_700_000_123_456;
    const a = tideAt(now);
    const b = tideAt(now + 60_000); // a minute later, same bucket
    expect(b.def.id).toBe(a.def.id);
    expect(a.startsAt).toBeLessThanOrEqual(now);
    expect(a.endsAt).toBeGreaterThan(now);
    expect(a.endsAt - a.startsAt).toBe(TIDE_BUCKET_MS);
    expect(tideAt(now).def.id).toBe(a.def.id); // stable across calls
  });

  it("the forecast is [current, next, next+1] in order", () => {
    const now = 1_700_000_123_456;
    const forecast = tideForecast(now);
    expect(forecast.length).toBe(3);
    expect(forecast[0].def.id).toBe(tideAt(now).def.id);
    expect(forecast[1].startsAt).toBe(forecast[0].endsAt);
    expect(forecast[2].startsAt).toBe(forecast[1].endsAt);
    expect(forecast.map((f) => f.bucket)).toEqual([
      forecast[0].bucket,
      forecast[0].bucket + 1,
      forecast[0].bucket + 2,
    ]);
  });

  it("High Tide lifts final production ×1.15 — and never inflates chain demand", () => {
    const state = createInitialState();
    state.generators[crab.id] = 10; // 5/s base
    const t = findTideTime("high");
    expect(productionPerSecond(state).toNumber()).toBe(5);
    expect(productionPerSecond(state, t).toNumber()).toBeCloseTo(5.75, 9);
    // Demand is what the keepers produce; the tide acts on the thrown beam:
    expect(chainStatus(state, t).demand.toNumber()).toBe(chainStatus(state).demand.toNumber());
  });

  it("Stormfront: production ×1.30 (×1.45 with the Storm in a Bottle), support ×0.8", () => {
    const state = createInitialState();
    state.generators[crab.id] = 10;
    const t = findTideTime("storm");
    expect(productionPerSecond(state, t).toNumber()).toBeCloseTo(6.5, 9);
    expect(chainStatus(state, t).nodes.find((n) => n.nodeId === "wick")!.support.toNumber()).toBeCloseTo(16, 9);
    state.relics = ["storm-in-a-bottle"];
    expect(productionPerSecond(state, t).toNumber()).toBeCloseTo(7.25, 9);
  });

  it("Low Tide raises chain support ×1.2; Glass Calm doubles the click", () => {
    const state = createInitialState();
    state.generators[crab.id] = 10;
    const low = findTideTime("low");
    expect(chainStatus(state, low).nodes.find((n) => n.nodeId === "wick")!.support.toNumber()).toBeCloseTo(24, 9);
    expect(totalSupport(state, "lens", low).toNumber()).toBeCloseTo(12, 9);
    const calm = findTideTime("calm");
    expect(clickValue(state).toNumber()).toBe(1);
    expect(clickValue(state, calm).toNumber()).toBe(2);
  });

  it("with no time passed, every tide effect is neutral (the sim's sea is calm)", () => {
    const state = createInitialState();
    state.generators[crab.id] = 10;
    expect(productionPerSecond(state).toNumber()).toBe(5);
    expect(totalSupport(state, "wick").toNumber()).toBe(20);
    expect(clickValue(state).toNumber()).toBe(1);
  });
});

describe("permanence & save migration (v4 → v5)", () => {
  it("moths, duty, relics, roost and an expedition all survive Rekindle untouched", () => {
    const state = gardenState();
    attractMoth(state, mulberry32(11));
    attractMoth(state, mulberry32(12));
    toggleDuty(state, state.moths[0].id);
    state.relics = ["brass-compass"];
    state.roostExpansions = 1;
    state.expedition = { routeId: "drift", startedAt: 0, returnsAt: 123_456 };
    const mothsBefore = serializeState(state).moths;
    state.lifetimeLumen = new Decimal(8_000_000);
    expect(rekindle(state)).toBe(40);
    expect(state.moths).toEqual(mothsBefore);
    expect(state.mothDuty).toEqual([mothsBefore[0].id]);
    expect(state.relics).toEqual(["brass-compass"]);
    expect(state.roostExpansions).toBe(1);
    expect(state.expedition).toEqual({ routeId: "drift", startedAt: 0, returnsAt: 123_456 });
  });

  it("a Sprint 3-era (v4) save gains the Shore fields, empty", () => {
    const v4Save = {
      version: 4,
      lumen: "500",
      lifetimeLumen: "5000",
      allTimeLumen: "9000",
      embers: 12,
      embersTotalEarned: 20,
      emberPerks: ["head-start"],
      activeChallenge: null,
      completedChallenges: ["fogbound"],
      generators: { "candle-crab": 12 },
      upgrades: ["click-1"],
      buyAmount: 10,
      litLighthouses: ["first-light"],
      chainBoards: { "first-light": { wick: 2, oil: 1, lens: 1, beam: 0 } },
      totalClicks: 9,
      totalGeneratorsBought: 12,
      totalRekindles: 1,
      playTimeSeconds: 300,
      lastSeen: 1_700_000_000_000,
      log: [],
    };
    const restored = deserializeState(JSON.parse(JSON.stringify(v4Save)));
    expect(restored).not.toBeNull();
    expect(restored?.version).toBe(12);
    expect(restored?.moths).toEqual([]);
    expect(restored?.mothDuty).toEqual([]);
    expect(restored?.roostExpansions).toBe(0);
    expect(restored?.cocoon).toBeNull();
    expect(restored?.expedition).toBeNull();
    expect(restored?.relics).toEqual([]);
    expect(restored?.storyFragmentIndex).toBe(0);
    expect(restored?.embersTotalEarned).toBe(20); // v4 fields intact
    expect(restored?.chainBoards["first-light"].wick).toBe(2);
  });

  it("v5 round-trips the Shore fields and sanitizes duty/cocoon against the collection", () => {
    const state = gardenState();
    state.moths = [moth("m1", "crescent", 70, 2), moth("m2", "plain", 20, 1)];
    state.mothDuty = ["m1"];
    state.relics = ["tide-chart"];
    state.storyFragmentIndex = 3;
    state.expedition = { routeId: "coastal", startedAt: 100, returnsAt: 200 };
    state.cocoon = { parentIds: ["m1", "m2"], readyAt: 999 };
    const saved = serializeState(state);
    expect(saved.version).toBe(12);
    const restored = deserializeState(JSON.parse(JSON.stringify(saved)));
    expect(restored?.moths).toEqual(state.moths);
    expect(restored?.mothDuty).toEqual(["m1"]);
    expect(restored?.relics).toEqual(["tide-chart"]);
    expect(restored?.storyFragmentIndex).toBe(3);
    expect(restored?.expedition).toEqual({ routeId: "coastal", startedAt: 100, returnsAt: 200 });
    expect(restored?.cocoon).toEqual({ parentIds: ["m1", "m2"], readyAt: 999 });

    // Junk duty ids are dropped; a cocoon missing a parent is dropped:
    const junk = {
      ...saved,
      mothDuty: ["m1", "ghost", 7],
      cocoon: { parentIds: ["m1", "ghost"], readyAt: 999 },
    };
    const cleaned = deserializeState(junk);
    expect(cleaned?.mothDuty).toEqual(["m1"]);
    expect(cleaned?.cocoon).toBeNull();
  });
});
