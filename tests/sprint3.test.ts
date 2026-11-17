import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { gullRockStatus, relightGullRock, totalSupport } from "../src/game/chain";
import {
  abandonChallenge,
  canBuyGenerator,
  challengeProductionMultiplier,
  startChallenge,
} from "../src/game/challenges";
import {
  EMBER_PERKS,
  buyPerk,
  gullRockRelightCost,
  hasPerk,
} from "../src/game/emberShop";
import {
  buyGenerator,
  clickBeam,
  clickValue,
  emberMultiplier,
  generatorProduction,
  offlineEarnings,
  productionPerSecond,
  tick,
} from "../src/game/engine";
import { estimateRecoveryMinutes } from "../src/game/estimate";
import { canRekindle, rekindle } from "../src/game/prestige";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import type { GameState } from "../src/game/types";
import { buyUpgrade, emberBonusPerEmber, offlineRateFor } from "../src/game/upgrades";
import { generatorById } from "../src/game/config";

const crab = generatorById("candle-crab");
const keeper = generatorById("oil-keeper");

function emberState(embers: number): GameState {
  const state = createInitialState();
  state.embers = embers;
  state.embersTotalEarned = embers;
  return state;
}

describe("ember economy", () => {
  it("the shop has the eight specced perks at the specced prices", () => {
    expect(EMBER_PERKS.map((p) => [p.id, p.costEmbers])).toEqual([
      ["head-start", 5],
      ["warm-lamp", 8],
      ["gull-friend", 10],
      ["deep-wicks", 12],
      ["long-night", 20],
      ["full-lamp", 25],
      ["ember-heart", 30],
      ["second-wind", 40],
    ]);
  });

  it("spending reduces the held bonus but never the lifetime total earned", () => {
    const state = emberState(50); // held bonus ×2.00 at +2% each
    expect(emberMultiplier(state).toNumber()).toBe(2);
    expect(buyPerk(state, "head-start")).toBe(true);
    expect(state.embers).toBe(45);
    expect(state.embersTotalEarned).toBe(50); // unchanged by spending
    expect(emberMultiplier(state).toNumber()).toBeCloseTo(1.9, 9); // 45 × 2%
    // Can't buy twice, can't buy what you can't afford:
    expect(buyPerk(state, "head-start")).toBe(false);
    expect(buyPerk(state, "second-wind")).toBe(true); // 45 ≥ 40
    expect(state.embers).toBe(5);
    expect(buyPerk(state, "warm-lamp")).toBe(false); // 5 < 8
    expect(state.embersTotalEarned).toBe(50);
  });

  it("Rekindle adds gained Embers to BOTH the held balance and the total earned", () => {
    const state = emberState(10);
    state.lifetimeLumen = new Decimal(8_000_000); // worth 40
    expect(rekindle(state)).toBe(40);
    expect(state.embers).toBe(50);
    expect(state.embersTotalEarned).toBe(50);
  });

  it("perks are permanent: they survive Rekindle", () => {
    const state = emberState(50);
    expect(buyPerk(state, "warm-lamp")).toBe(true);
    state.lifetimeLumen = new Decimal(8_000_000);
    rekindle(state);
    expect(hasPerk(state, "warm-lamp")).toBe(true);
    expect(clickValue(state).toNumber()).toBe(2);
  });
});

describe("ember perk effects", () => {
  it("Head Start: a Rekindle (run reset) starts the new run with 1,000 Lumen", () => {
    const state = emberState(10);
    expect(buyPerk(state, "head-start")).toBe(true);
    state.lifetimeLumen = new Decimal(8_000_000);
    rekindle(state);
    expect(state.lumen.toNumber()).toBe(1_000);
    // The purse is granted, not earned — it does not inflate the new run:
    expect(state.lifetimeLumen.toNumber()).toBe(0);
  });

  it("Warm Lamp Oil: click power ×2", () => {
    const state = emberState(10);
    expect(clickValue(state).toNumber()).toBe(1);
    expect(buyPerk(state, "warm-lamp")).toBe(true);
    expect(clickValue(state).toNumber()).toBe(2);
    const before = state.lumen.toNumber();
    clickBeam(state);
    expect(state.lumen.toNumber()).toBe(before + 2);
  });

  it("Friend of Gulls: Gull Rock's relight cost halves to 1,000,000", () => {
    const state = emberState(10);
    state.generators[crab.id] = 10; // chain unlocked, full efficiency
    state.lumen = new Decimal(1_000_000);
    expect(gullRockRelightCost(state).toNumber()).toBe(2_000_000);
    expect(gullRockStatus(state).canRelight).toBe(false); // can't afford 2M
    expect(buyPerk(state, "gull-friend")).toBe(true);
    expect(gullRockRelightCost(state).toNumber()).toBe(1_000_000);
    expect(gullRockStatus(state).cost.toNumber()).toBe(1_000_000);
    expect(relightGullRock(state)).toBe(true);
    expect(state.lumen.toNumber()).toBe(0);
  });

  it("Deep Wicks: chain support +25% on every supply node", () => {
    const state = emberState(20);
    expect(totalSupport(state, "wick").toNumber()).toBe(20);
    expect(totalSupport(state, "lens").toNumber()).toBe(10);
    expect(buyPerk(state, "deep-wicks")).toBe(true);
    expect(totalSupport(state, "wick").toNumber()).toBe(25);
    expect(totalSupport(state, "oil").toNumber()).toBe(18.75);
    expect(totalSupport(state, "lens").toNumber()).toBe(12.5);
  });

  it("The Long Night: offline cap rises from 8h to 12h", () => {
    const state = emberState(25);
    state.generators[crab.id] = 10; // 5/s
    state.lastSeen = 0;
    const tenHours = 10 * 3600 * 1000;
    expect(offlineEarnings(state, tenHours).creditedSeconds).toBe(8 * 3600);
    expect(buyPerk(state, "long-night")).toBe(true);
    const result = offlineEarnings(state, tenHours);
    expect(result.creditedSeconds).toBe(10 * 3600);
    // Production is 5/s × 1.1 (5 Embers still held after the purchase):
    expect(result.gain.toNumber()).toBe(5.5 * 10 * 3600 * 0.5);
  });

  it("Full Reservoir: offline rate +10 points, stacking with Longer Wicks, capped at 90%", () => {
    const state = emberState(100);
    expect(offlineRateFor(state)).toBe(0.5);
    expect(buyPerk(state, "full-lamp")).toBe(true);
    expect(offlineRateFor(state)).toBeCloseTo(0.6, 9); // 50% + 10
    // Longer Wicks (the Lumen upgrade) + Full Reservoir: 75% + 10 = 85%.
    state.allTimeLumen = new Decimal(2_000_000);
    state.lumen = new Decimal(300_000);
    expect(buyUpgrade(state, "longer-wicks")).toBe(true);
    expect(offlineRateFor(state)).toBeCloseTo(0.85, 9);
    expect(offlineRateFor(state)).toBeLessThanOrEqual(0.9);
  });

  it("Ember Heart: +1% per Ember — 2%→3% base, 3%→4% with Ember Resonance", () => {
    const state = emberState(100);
    expect(emberBonusPerEmber(state)).toBe(0.02);
    expect(buyPerk(state, "ember-heart")).toBe(true);
    expect(emberBonusPerEmber(state)).toBe(0.03);
    state.lumen = new Decimal(6_000_000);
    expect(buyUpgrade(state, "ember-resonance")).toBe(true);
    expect(emberBonusPerEmber(state)).toBe(0.04);
  });

  it("Second Wind: all production +50%", () => {
    const state = emberState(50);
    state.generators[crab.id] = 5; // 2.5/s, chain still locked
    expect(generatorProduction(state, crab).toNumber()).toBeCloseTo(2.5 * 2, 9); // ×2 from 50 Embers
    expect(buyPerk(state, "second-wind")).toBe(true); // 10 Embers left held
    // 2.5 × (1 + 10×2%) × 1.5 = 4.5
    expect(generatorProduction(state, crab).toNumber()).toBeCloseTo(4.5, 9);
    expect(productionPerSecond(state).toNumber()).toBeCloseTo(4.5, 9);
  });
});

describe("recovery preview", () => {
  function midGameState(lifetime: number): GameState {
    const state = createInitialState();
    state.generators[crab.id] = 25;
    state.generators[generatorById("lantern-moth").id] = 10;
    state.lifetimeLumen = new Decimal(lifetime);
    state.allTimeLumen = new Decimal(lifetime);
    return state;
  }

  it("returns a positive, finite estimate for a mid-game state", () => {
    const estimate = estimateRecoveryMinutes(midGameState(8_000_000));
    expect(estimate).not.toBeNull();
    expect(estimate!).toBeGreaterThan(0);
    expect(estimate!).toBeLessThanOrEqual(600);
  });

  it("recovery is faster when the Rekindle banks more Embers", () => {
    // Same portfolio, same current production (the recovery target) — the
    // only difference is how many Embers the Rekindle banks: 40 vs 100.
    // More banked Embers = a bigger held bonus in the new run = less of
    // the portfolio to rebuild before the old rate is matched.
    const small = estimateRecoveryMinutes(midGameState(8_000_000)); // gain 40
    const large = estimateRecoveryMinutes(midGameState(50_000_000)); // gain 100
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    expect(large!).toBeLessThan(small!);
  });

  it("is null when there is nothing to recover or no Rekindle available", () => {
    expect(estimateRecoveryMinutes(createInitialState())).toBeNull(); // no production
    const state = midGameState(8_000_000);
    state.lifetimeLumen = new Decimal(100); // not even one Ember
    expect(estimateRecoveryMinutes(state)).toBeNull();
  });

  it("does not mutate the state it estimates from", () => {
    const state = midGameState(8_000_000);
    const before = serializeState(state);
    estimateRecoveryMinutes(state);
    expect(serializeState(state)).toEqual(before);
  });
});

describe("challenges", () => {
  it("starting a challenge resets the run but grants NO Embers", () => {
    const state = emberState(7);
    state.generators[crab.id] = 30;
    state.lumen = new Decimal(50_000);
    state.lifetimeLumen = new Decimal(8_000_000); // would be worth 40 Embers
    expect(startChallenge(state, "fogbound")).toBe(true);
    expect(state.activeChallenge).toBe("fogbound");
    expect(state.generators).toEqual({});
    expect(state.lifetimeLumen.toNumber()).toBe(0);
    expect(state.lumen.toNumber()).toBe(0);
    expect(state.embers).toBe(7); // untouched — no gain, no spend
    expect(state.embersTotalEarned).toBe(7);
    expect(state.totalRekindles).toBe(0);
  });

  it("only one challenge at a time, and Rekindle is disabled during one", () => {
    const state = createInitialState();
    expect(startChallenge(state, "fogbound")).toBe(true);
    expect(startChallenge(state, "still-hands")).toBe(false);
    state.lifetimeLumen = new Decimal(8_000_000);
    expect(canRekindle(state)).toBe(false);
    expect(rekindle(state)).toBe(0);
    expect(state.embers).toBe(0);
  });

  it("Fogbound halves all production while active", () => {
    const plain = createInitialState();
    plain.generators[crab.id] = 5; // 2.5/s, chain locked
    const fogged = createInitialState();
    expect(startChallenge(fogged, "fogbound")).toBe(true);
    fogged.generators[crab.id] = 5;
    expect(productionPerSecond(plain).toNumber()).toBe(2.5);
    expect(productionPerSecond(fogged).toNumber()).toBe(1.25);
    expect(challengeProductionMultiplier(fogged)).toBe(0.5);
  });

  it("Still Hands: clicking yields 0 while active", () => {
    const state = createInitialState();
    expect(startChallenge(state, "still-hands")).toBe(true);
    expect(clickValue(state).toNumber()).toBe(0);
    clickBeam(state);
    expect(state.lumen.toNumber()).toBe(0);
    expect(state.lifetimeLumen.toNumber()).toBe(0);
  });

  it("First Light Only: tiers 4+ cannot be bought, tiers 1–3 can", () => {
    const state = createInitialState();
    expect(startChallenge(state, "first-light-only")).toBe(true);
    state.lumen = new Decimal(10_000_000);
    expect(canBuyGenerator(state, keeper.id)).toBe(false);
    expect(buyGenerator(state, keeper.id)).toBe(false);
    expect(state.generators[keeper.id] ?? 0).toBe(0);
    expect(canBuyGenerator(state, crab.id)).toBe(true);
    expect(buyGenerator(state, crab.id)).toBe(true);
  });

  it("reaching the goal completes the challenge: reward banked, run CONTINUES", () => {
    const state = createInitialState();
    expect(startChallenge(state, "still-hands")).toBe(true); // goal 250,000
    state.generators[crab.id] = 10; // 5/s base, chain unlocked at exactly 10
    tick(state, 60_000); // 300,000 lifetime — crosses the goal mid-tick
    expect(state.activeChallenge).toBeNull();
    expect(state.completedChallenges).toEqual(["still-hands"]);
    // The run was NOT reset:
    expect(state.generators[crab.id]).toBe(10);
    expect(state.lifetimeLumen.toNumber()).toBe(300_000);
    // Patient Keeper reward is live: 5 × 1.2 = 6/s (still fully supported):
    expect(challengeProductionMultiplier(state)).toBeCloseTo(1.2, 9);
    expect(productionPerSecond(state).toNumber()).toBeCloseTo(6, 9);
    // Clicking works again:
    expect(clickValue(state).toNumber()).toBe(1);
  });

  it("challenge rewards survive Rekindle", () => {
    const state = createInitialState();
    expect(startChallenge(state, "still-hands")).toBe(true);
    state.generators[crab.id] = 10;
    tick(state, 60_000); // completes Still Hands
    state.lifetimeLumen = new Decimal(8_000_000);
    expect(rekindle(state)).toBe(40);
    expect(state.completedChallenges).toEqual(["still-hands"]);
    state.generators[crab.id] = 5; // 2.5/s base in the new run
    // 2.5 × 1.2 (Patient Keeper) × 1.8 (40 Embers held) = 5.4
    expect(generatorProduction(state, crab).toNumber()).toBeCloseTo(5.4, 9);
  });

  it("Humble Mastery doubles tiers 1–3 only, once earned", () => {
    const state = createInitialState();
    expect(startChallenge(state, "first-light-only")).toBe(true); // goal 100,000
    state.generators[crab.id] = 10; // 5/s
    tick(state, 20_000); // exactly 100,000
    expect(state.completedChallenges).toEqual(["first-light-only"]);
    // Crabs doubled: 10 × 0.5 × 2 = 10/s of generator production.
    expect(generatorProduction(state, crab).toNumber()).toBe(10);
    // Tier 4 is NOT doubled (and can be bought again — the run continues):
    state.lumen = new Decimal(100_000);
    expect(buyGenerator(state, keeper.id)).toBe(true);
    expect(generatorProduction(state, keeper).toNumber()).toBe(95);
  });

  it("abandoning resets the run with no reward and no Embers", () => {
    const state = emberState(3);
    expect(startChallenge(state, "fogbound")).toBe(true);
    state.generators[crab.id] = 20;
    state.lifetimeLumen = new Decimal(500_000); // halfway to the Fogbound goal
    expect(abandonChallenge(state)).toBe(true);
    expect(state.activeChallenge).toBeNull();
    expect(state.completedChallenges).toEqual([]);
    expect(state.generators).toEqual({});
    expect(state.lifetimeLumen.toNumber()).toBe(0);
    expect(state.embers).toBe(3);
    expect(challengeProductionMultiplier(state)).toBe(1); // no Fog Lamps
    expect(abandonChallenge(state)).toBe(false); // nothing to abandon
  });

  it("a completed challenge cannot be started again", () => {
    const state = createInitialState();
    expect(startChallenge(state, "still-hands")).toBe(true);
    state.generators[crab.id] = 10;
    tick(state, 60_000);
    expect(state.completedChallenges).toEqual(["still-hands"]);
    expect(startChallenge(state, "still-hands")).toBe(false);
    expect(state.activeChallenge).toBeNull();
  });
});

describe("save migration (v3 → v4)", () => {
  it("a Sprint 2 (v3) save gains Sprint 3 fields, total earned := held Embers", () => {
    const v3Save = {
      version: 3,
      lumen: "500",
      lifetimeLumen: "5000",
      allTimeLumen: "9000",
      embers: 12,
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
    const restored = deserializeState(JSON.parse(JSON.stringify(v3Save)));
    expect(restored).not.toBeNull();
    expect(restored?.version).toBe(5);
    expect(restored?.embers).toBe(12);
    expect(restored?.embersTotalEarned).toBe(12); // := embers, per the migration spec
    expect(restored?.emberPerks).toEqual([]);
    expect(restored?.activeChallenge).toBeNull();
    expect(restored?.completedChallenges).toEqual([]);
    expect(restored?.chainBoards["first-light"].wick).toBe(2); // v3 fields intact
  });

  it("round-trips the Sprint 3 fields at version 5, sanitizing junk", () => {
    const state = emberState(33);
    state.emberPerks = ["head-start", "deep-wicks"];
    state.completedChallenges = ["fogbound"];
    const saved = serializeState(state);
    expect(saved.version).toBe(5);
    expect(saved.embersTotalEarned).toBe(33);
    const restored = deserializeState(JSON.parse(JSON.stringify(saved)));
    expect(restored?.emberPerks).toEqual(["head-start", "deep-wicks"]);
    expect(restored?.completedChallenges).toEqual(["fogbound"]);
    expect(restored?.activeChallenge).toBeNull();

    const junk = { ...saved, emberPerks: ["head-start", 7, null], activeChallenge: 42 };
    const cleaned = deserializeState(junk);
    expect(cleaned?.emberPerks).toEqual(["head-start"]);
    expect(cleaned?.activeChallenge).toBeNull();
  });
});
