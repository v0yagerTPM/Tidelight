import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import {
  BELLWETHER_ID,
  CORMORANT_ROOST_ID,
  FIRST_LIGHT_ID,
  GULL_ROCK_ID,
  HOLLOW_LIGHT_ID,
  SIRENS_REST_ID,
  WAYMARKS,
  WIDOWS_WALK_ID,
  generatorById,
} from "../src/game/config";
import {
  lighthouseMultiplier,
  lighthouseStatus,
  nodeCost,
  relightCost,
  relightLighthouse,
  totalSupport,
} from "../src/game/chain";
import { offlineCapSeconds } from "../src/game/emberShop";
import { productionPerSecond } from "../src/game/engine";
import { formatNumber } from "../src/game/format";
import { canStartNgPlus, legacyMultiplier, startNgPlus } from "../src/game/ngplus";
import { rekindleGain } from "../src/game/prestige";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import { STORY_BEATS, checkStory } from "../src/game/story";
import type { GameState } from "../src/game/types";
import { offlineRateFor } from "../src/game/upgrades";
import { atBaseWarmth } from "./baseWarmth";

// Chain math here is checked at First Light's plain starting support.
atBaseWarmth();

const crab = generatorById("candle-crab");
const ALL_RELIGHTABLE = [
  GULL_ROCK_ID,
  CORMORANT_ROOST_ID,
  WIDOWS_WALK_ID,
  BELLWETHER_ID,
  SIRENS_REST_ID,
  HOLLOW_LIGHT_ID,
];

/**
 * A keeper who can afford anything: 10 Candle Crabs (chain awake, demand
 * 5/s — fully supported by the starting board's 20/15/10) and a bottomless
 * purse. Each lighthouse lit raises demand, so lightAll() feeds the chain
 * before every relight to clear the 50–80% gates.
 */
function richState(lumen: number | string = "1e60"): GameState {
  const state = createInitialState();
  state.generators[crab.id] = 10;
  state.totalGeneratorsBought = 10;
  state.lumen = new Decimal(lumen);
  return state;
}

/**
 * Feed First Light's board well past any gate a ten-crab keeper meets. The
 * gates sit at 50–80% since the post-launch rebalance, and each lit
 * lighthouse raises demand, so the shore is relit the way a keeper would:
 * chain fed first.
 */
function feedChain(state: GameState): void {
  const board = state.chainBoards[FIRST_LIGHT_ID];
  for (const node of ["wick", "oil", "lens"] as const) board[node] = Math.max(board[node], 20);
}

function lightAll(state: GameState): void {
  for (const id of ALL_RELIGHTABLE) {
    // The Hollow Light's relight lights the Crossing's three waymarks first.
    const steps = id === HOLLOW_LIGHT_ID ? 1 + WAYMARKS.length - state.crossing : 1;
    for (let i = 0; i < steps; i++) {
      feedChain(state);
      expect(relightLighthouse(state, id)).toBe(true);
    }
  }
}

describe("lighthouse order gating", () => {
  it("LH(n) cannot be relit before LH(n−1)", () => {
    const state = richState();
    const status = lighthouseStatus(state, CORMORANT_ROOST_ID);
    expect(status.previousLit).toBe(false);
    expect(status.previousId).toBe(GULL_ROCK_ID);
    expect(status.canRelight).toBe(false);
    expect(relightLighthouse(state, CORMORANT_ROOST_ID)).toBe(false);
    expect(state.litLighthouses).toEqual([FIRST_LIGHT_ID]);
    // In order works, one by one:
    expect(relightLighthouse(state, GULL_ROCK_ID)).toBe(true);
    expect(relightLighthouse(state, CORMORANT_ROOST_ID)).toBe(true);
    // And skipping Widow's Walk to the Bellwether fails:
    expect(relightLighthouse(state, BELLWETHER_ID)).toBe(false);
  });

  it("the efficiency gate is enforced per lighthouse", () => {
    const state = richState();
    expect(relightLighthouse(state, GULL_ROCK_ID)).toBe(true);
    expect(relightLighthouse(state, CORMORANT_ROOST_ID)).toBe(true);
    // Flood demand: 10 Seventh Lights → efficiency collapses to ~0.1%.
    state.generators[generatorById("seventh-light").id] = 10;
    const status = lighthouseStatus(state, WIDOWS_WALK_ID);
    expect(status.efficiencyOk).toBe(false);
    expect(status.canRelight).toBe(false);
    expect(relightLighthouse(state, WIDOWS_WALK_ID)).toBe(false);
  });

  it("board scales: ×20 Cormorant, ×50 Widow's, ×750 Hollow", () => {
    expect(nodeCost(CORMORANT_ROOST_ID, "wick", 0).toNumber()).toBe(10_000); // 500 × 20
    expect(nodeCost(WIDOWS_WALK_ID, "beam", 0).toNumber()).toBe(1_250_000); // 25,000 × 50
    expect(nodeCost(HOLLOW_LIGHT_ID, "lens", 0).toNumber()).toBe(1_500_000); // 2,000 × 750
    expect(nodeCost(BELLWETHER_ID, "oil", 0).toNumber()).toBe(120_000); // 1,000 × 120
    expect(nodeCost(SIRENS_REST_ID, "wick", 0).toNumber()).toBe(150_000); // 500 × 300
  });

  it("Friend of Gulls halves Gull Rock only — never the later lights", () => {
    const state = richState();
    state.emberPerks.push("gull-friend");
    expect(relightCost(state, GULL_ROCK_ID).toNumber()).toBe(2_500_000);
    expect(relightCost(state, CORMORANT_ROOST_ID).toNumber()).toBe(1.2e11);
  });
});

describe("lighthouse bonuses", () => {
  it("production bonuses multiply together: all seven lit = ×6.5625", () => {
    const state = richState();
    lightAll(state);
    // 1.5 (Gull) × 1.75 (Cormorant) × 2.5 (Hollow); the rest grant none.
    expect(lighthouseMultiplier(state).toNumber()).toBeCloseTo(6.5625, 9);
  });

  it("Widow's Walk: chain support +50% on every supply node", () => {
    const before = richState();
    const wickBefore = totalSupport(before, "wick").toNumber();
    expect(relightLighthouse(before, GULL_ROCK_ID)).toBe(true);
    expect(relightLighthouse(before, CORMORANT_ROOST_ID)).toBe(true);
    expect(relightLighthouse(before, WIDOWS_WALK_ID)).toBe(true);
    // Same boards as a fresh state (all starting levels). First Light's
    // start is warmed by the lit lights' lasting production bonus (Gull Rock
    // ×1.5 × Cormorant Roost ×1.75), and Widow's Walk adds ×1.5 to support:
    expect(totalSupport(before, "wick").toNumber()).toBeCloseTo(wickBefore * 1.5 * 1.75 * 1.5, 9);
    expect(totalSupport(before, "lens").toNumber()).toBeCloseTo(10 * 1.5 * 1.75 * 1.5, 9);
  });

  it("The Bellwether: Rekindle Ember gain +25%", () => {
    const state = richState();
    state.lifetimeLumen = new Decimal(8_000_000); // base gain 40
    expect(rekindleGain(state)).toBe(40);
    expect(relightLighthouse(state, GULL_ROCK_ID)).toBe(true);
    expect(relightLighthouse(state, CORMORANT_ROOST_ID)).toBe(true);
    expect(relightLighthouse(state, WIDOWS_WALK_ID)).toBe(true);
    expect(relightLighthouse(state, BELLWETHER_ID)).toBe(true);
    expect(rekindleGain(state)).toBe(50); // floor(40 × 1.25)
  });

  it("Siren's Rest: offline rate +10 points and offline cap +4h", () => {
    const state = richState();
    expect(offlineRateFor(state)).toBeCloseTo(0.5, 9);
    expect(offlineCapSeconds(state)).toBe(8 * 3600);
    lightAll(state);
    expect(offlineRateFor(state)).toBeCloseTo(0.6, 9);
    expect(offlineCapSeconds(state)).toBe(12 * 3600);
    // Stacking still respects the 90% hard cap, and caps add:
    state.upgrades.push("longer-wicks"); // 75%
    state.emberPerks.push("full-lamp", "long-night"); // +10 pts, cap 12h
    expect(offlineRateFor(state)).toBeCloseTo(0.9, 9); // 75+10+10 = 95 → capped
    expect(offlineCapSeconds(state)).toBe(16 * 3600); // 12h + 4h
  });
});

describe("story beats", () => {
  it("has 27 beats across three acts (6 / 10 / 11)", () => {
    expect(STORY_BEATS).toHaveLength(27);
    expect(STORY_BEATS.filter((b) => b.act === 1)).toHaveLength(6);
    expect(STORY_BEATS.filter((b) => b.act === 2)).toHaveLength(10);
    expect(STORY_BEATS.filter((b) => b.act === 3)).toHaveLength(11);
  });

  it("the moth beats: a first trait, a first post, a first Hollow moth", () => {
    const state = createInitialState();
    checkStory(state);
    state.moths.push({ id: "m1", name: "Testwing", pattern: "plain", glow: 20, generation: 1 });
    expect(checkStory(state).map((b) => b.id)).toEqual(["first-moth"]);
    state.moths[0].trait = "seeker";
    expect(checkStory(state).map((b) => b.id)).toEqual(["first-trait"]);
    state.mothPosts["first-light"] = "m1";
    expect(checkStory(state).map((b) => b.id)).toEqual(["first-post"]);
    state.moths.push({ id: "m2", name: "Hollowwing", pattern: "hollow", glow: 110, generation: 9, trait: "seeker", trait2: "fertile" });
    expect(checkStory(state).map((b) => b.id)).toEqual(["first-bred", "first-hollow"]);
  });

  it("fires in order as the state progresses, and never twice", () => {
    const state = createInitialState();
    // A fresh keeper has only just arrived:
    expect(checkStory(state).map((b) => b.id)).toEqual(["arrival"]);
    expect(checkStory(state)).toEqual([]); // nothing new, nothing repeated

    // First helper hired:
    state.generators[crab.id] = 1;
    state.totalGeneratorsBought = 1;
    expect(checkStory(state).map((b) => b.id)).toEqual(["first-helper"]);

    // 10,000 all-time Lumen:
    state.allTimeLumen = new Decimal(10_000);
    expect(checkStory(state).map((b) => b.id)).toEqual(["first-hoard"]);

    // Chain wakes at 10 generators:
    state.generators[crab.id] = 10;
    state.totalGeneratorsBought = 10;
    expect(checkStory(state).map((b) => b.id)).toEqual(["the-chain"]);

    // First Rekindle:
    state.totalRekindles = 1;
    expect(checkStory(state).map((b) => b.id)).toEqual(["first-rekindle"]);

    // Several triggers at once fire in beat order, not discovery order:
    state.moths.push({ id: "m1", name: "Testwing", pattern: "prismatic", glow: 90, generation: 2 });
    state.relics.push("brass-compass");
    state.storyFragmentIndex = 1;
    const fired = checkStory(state).map((b) => b.id);
    expect(fired).toEqual(["first-moth", "first-bottle", "first-relic", "first-bred", "prismatic"]);
    expect(state.storySeen).toContain("prismatic");
    // The log carries the story entries with their marker:
    expect(state.log.some((e) => e.message.startsWith("📖 A Rainbow, Kept"))).toBe(true);
  });

  it("the ending beat fires when The Hollow Light is lit", () => {
    const state = richState();
    lightAll(state);
    expect(state.endingSeen).toBe(true);
    const fired = checkStory(state).map((b) => b.id);
    expect(fired[fired.length - 1]).toBe("hollow-light");
  });
});

describe("the ending and the Next Keeping (NG+)", () => {
  function endedState(): GameState {
    const state = richState();
    lightAll(state);
    state.moths.push({ id: "m1", name: "Keeperwing", pattern: "starlit", glow: 77, generation: 3 });
    state.mothDuty.push("m1");
    state.relics.push("brass-compass", "tide-chart");
    state.emberPerks.push("head-start", "second-wind");
    state.completedChallenges.push("fogbound");
    state.upgrades.push("longer-wicks", "click-1");
    state.embers = 100;
    state.embersTotalEarned = 500;
    state.storySeen.push("arrival");
    state.buyAmount = "max";
    state.notation = "scientific";
    state.allTimeLumen = new Decimal(123_000_000_000);
    return state;
  }

  it("canStartNgPlus requires The Hollow Light lit", () => {
    const state = richState();
    expect(canStartNgPlus(state)).toBe(false);
    expect(startNgPlus(state)).toBe(false);
    lightAll(state);
    expect(canStartNgPlus(state)).toBe(true);
  });

  it("keeps the keeper, resets the keeping — exactly as specced", () => {
    const state = endedState();
    expect(startNgPlus(state)).toBe(true);
    expect(state.ngPlusCount).toBe(1);

    // Kept:
    expect(state.moths).toHaveLength(1);
    expect(state.mothDuty).toEqual(["m1"]);
    expect(state.relics).toEqual(["brass-compass", "tide-chart"]);
    expect(state.emberPerks).toEqual(["head-start", "second-wind"]);
    expect(state.completedChallenges).toEqual(["fogbound"]);
    expect(state.upgrades).toEqual(["longer-wicks"]); // permanent knowledge only
    expect(state.storySeen).toContain("arrival");
    expect(state.endingSeen).toBe(true);
    expect(state.buyAmount).toBe("max");
    expect(state.notation).toBe("scientific");
    expect(state.allTimeLumen.toNumber()).toBe(123_000_000_000);

    // Reset:
    expect(state.generators).toEqual({});
    expect(state.lifetimeLumen.toNumber()).toBe(0);
    expect(state.litLighthouses).toEqual([FIRST_LIGHT_ID]);
    expect(Object.keys(state.chainBoards)).toEqual([FIRST_LIGHT_ID]);
    expect(state.chainBoards[FIRST_LIGHT_ID]).toEqual({ wick: 1, oil: 1, lens: 1, beam: 0 });
    expect(state.activeChallenge).toBeNull();
    // The Ember ledger starts fresh; the inheritance (5 × Keepings) is
    // granted to the HELD balance only, never to total earned:
    expect(state.embers).toBe(5);
    expect(state.embersTotalEarned).toBe(0);
    // Head Start (a kept perk) still fills the purse:
    expect(state.lumen.toNumber()).toBe(1_000);
  });

  it("legacy bonus: ×(1 + 0.25 × Keepings) on production", () => {
    const fresh = createInitialState();
    fresh.generators[crab.id] = 10;
    expect(legacyMultiplier(fresh)).toBe(1);
    const once = createInitialState();
    once.generators[crab.id] = 10;
    once.ngPlusCount = 1;
    expect(legacyMultiplier(once)).toBe(1.25);
    expect(productionPerSecond(once).div(productionPerSecond(fresh)).toNumber()).toBeCloseTo(1.25, 9);
    const twice = createInitialState();
    twice.generators[crab.id] = 10;
    twice.ngPlusCount = 2;
    expect(productionPerSecond(twice).div(productionPerSecond(fresh)).toNumber()).toBeCloseTo(1.5, 9);
  });

  it("a second Keeping grants 10 starting Embers and ×1.5 legacy", () => {
    const state = endedState();
    expect(startNgPlus(state)).toBe(true);
    // Relight the shore in the new Keeping:
    state.generators[crab.id] = 10;
    state.lumen = new Decimal("1e60");
    lightAll(state);
    expect(startNgPlus(state)).toBe(true);
    expect(state.ngPlusCount).toBe(2);
    expect(state.embers).toBe(10);
    expect(state.embersTotalEarned).toBe(0);
    expect(legacyMultiplier(state)).toBe(1.5);
  });
});

describe("notation setting", () => {
  it("scientific notation formats large values as e-notation", () => {
    expect(formatNumber(1_234_567, "scientific")).toBe("1.23e6");
    expect(formatNumber(1_234_567, "standard")).toBe("1.23M");
    expect(formatNumber(999, "scientific")).toBe("999");
    expect(formatNumber(60_000_000_000, "scientific")).toBe("6.00e10");
  });
});

describe("save export/import and the v5 → v6 migration", () => {
  it("round-trips through the serializer (the export/import path)", () => {
    const state = richState();
    lightAll(state);
    state.storySeen.push("arrival", "gull-rock");
    state.ngPlusCount = 1;
    state.notation = "scientific";
    const exported = JSON.stringify(serializeState(state));
    const imported = deserializeState(JSON.parse(exported));
    expect(imported).not.toBeNull();
    expect(serializeState(imported!)).toEqual(serializeState(state));
  });

  it("a v5 save migrates: Gull Rock stays lit, Sprint 5 fields default", () => {
    const v5Save = {
      version: 5,
      lumen: "12345",
      lifetimeLumen: "6789",
      allTimeLumen: "90000",
      embers: 7,
      embersTotalEarned: 12,
      emberPerks: [],
      activeChallenge: null,
      completedChallenges: [],
      generators: { "candle-crab": 12 },
      upgrades: [],
      buyAmount: 1,
      litLighthouses: ["first-light", "gull-rock"],
      chainBoards: {
        "first-light": { wick: 3, oil: 2, lens: 2, beam: 1 },
        "gull-rock": { wick: 1, oil: 0, lens: 0, beam: 0 },
      },
      moths: [],
      mothDuty: [],
      roostExpansions: 0,
      cocoon: null,
      expedition: null,
      relics: [],
      storyFragmentIndex: 0,
      totalClicks: 42,
      totalGeneratorsBought: 12,
      totalRekindles: 1,
      playTimeSeconds: 600,
      lastSeen: 1_700_000_000_000,
      log: [],
    };
    const restored = deserializeState(JSON.parse(JSON.stringify(v5Save)));
    expect(restored).not.toBeNull();
    expect(restored?.version).toBe(14);
    expect(restored?.litLighthouses).toEqual([FIRST_LIGHT_ID, GULL_ROCK_ID]); // Gull Rock stays lit
    expect(restored?.chainBoards[GULL_ROCK_ID]).toEqual({ wick: 1, oil: 0, lens: 0, beam: 0 });
    expect(restored?.storySeen).toEqual([]);
    expect(restored?.endingSeen).toBe(false);
    expect(restored?.ngPlusCount).toBe(0);
    expect(restored?.notation).toBe("standard");
    expect(restored?.embers).toBe(7);
  });
});
