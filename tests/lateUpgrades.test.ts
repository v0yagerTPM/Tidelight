import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { beamMultiplier, totalSupport } from "../src/game/chain";
import { CHAIN_LIGHTHOUSES, GULL_ROCK_ID, HOLLOW_LIGHT_ID, generatorById } from "../src/game/config";
import { ECHO_FLASHES_PER_SECOND, clickBeam, clickValue, echoReady, generatorProduction, productionPerSecond } from "../src/game/engine";
import { rekindleGain } from "../src/game/prestige";
import { createInitialState, startBoard } from "../src/game/state";
import type { GameState } from "../src/game/types";
import {
  buyUpgrade,
  flashEchoShare,
  generatorUpgradeMultiplier,
  isUnlocked,
  unlockProgress,
  unlockText,
  upgradeById,
} from "../src/game/upgrades";

function rich(): GameState {
  const state = createInitialState(0);
  state.lumen = new Decimal("1e40");
  return state;
}

function light(state: GameState, id: string): void {
  state.litLighthouses.push(id);
  state.chainBoards[id] = startBoard(id);
}

describe("helper tiers III–V", () => {
  it("unlock at 75, 150 and 250 copies for ×2, ×3 and ×5", () => {
    const state = rich();
    const tiers = ["candle-crab-u3", "candle-crab-u4", "candle-crab-u5"].map(upgradeById);
    expect(tiers.map((t) => t.multiplier)).toEqual([2, 3, 5]);
    state.generators["candle-crab"] = 149;
    expect(tiers.map((t) => isUnlocked(state, t))).toEqual([true, false, false]);
    state.generators["candle-crab"] = 250;
    expect(tiers.every((t) => isUnlocked(state, t))).toBe(true);
    const before = generatorUpgradeMultiplier(state, "candle-crab");
    for (const t of tiers) expect(buyUpgrade(state, t.id)).toBe(true);
    expect(generatorUpgradeMultiplier(state, "candle-crab") / before).toBe(30);
  });

  it("cost about 10× the price of the copy that unlocks them", () => {
    const crab = generatorById("candle-crab");
    expect(upgradeById("candle-crab-u3").cost).toBe(Math.ceil(10 * crab.baseCost * crab.growth ** 75));
    expect(upgradeById("seventh-light-u5").cost).toBeGreaterThan(upgradeById("seventh-light-u4").cost);
  });
});

describe("synergies", () => {
  it("add +1% to the target per copy of the source, once 50 of each are owned", () => {
    const state = rich();
    const syn = upgradeById("syn-keeper-bells");
    state.generators["oil-keeper"] = 50;
    state.generators["tide-bell"] = 49;
    expect(isUnlocked(state, syn)).toBe(false);
    expect(unlockProgress(state, syn)).toBeCloseTo(0.98, 2);
    expect(unlockText(syn)).toBe("Own 50 × Oil Keeper and 50 × Tide Bell");
    state.generators["tide-bell"] = 200;
    const before = generatorProduction(state, generatorById("oil-keeper"));
    expect(buyUpgrade(state, syn.id)).toBe(true);
    const after = generatorProduction(state, generatorById("oil-keeper"));
    expect(after.div(before).toNumber()).toBeCloseTo(3, 6); // 1 + 200 × 1%
  });
});

describe("lighthouse lessons", () => {
  it("surface once their lighthouse is lit", () => {
    const state = rich();
    const wicks = upgradeById("lesson-gull-wicks");
    expect(isUnlocked(state, wicks)).toBe(false);
    expect(unlockText(wicks)).toBe("Relight Gull Rock Light");
    light(state, GULL_ROCK_ID);
    expect(isUnlocked(state, wicks)).toBe(true);
  });

  it("are priced at 10% and 100% of their lighthouse's relight cost", () => {
    const gull = CHAIN_LIGHTHOUSES.find((l) => l.id === GULL_ROCK_ID)!;
    expect(upgradeById("lesson-gull-wicks").cost).toBeCloseTo(0.1 * gull.relightCost!, 0);
    expect(upgradeById("lesson-gull-spray").cost).toBe(gull.relightCost);
  });

  it("Gull-Feather Wicks doubles Wick support", () => {
    const state = rich();
    light(state, GULL_ROCK_ID);
    const before = totalSupport(state, "wick");
    buyUpgrade(state, "lesson-gull-wicks");
    expect(totalSupport(state, "wick").div(before).toNumber()).toBeCloseTo(2, 6);
  });

  it("Salt-Spray Polish triples the three first helpers", () => {
    const state = rich();
    light(state, GULL_ROCK_ID);
    buyUpgrade(state, "lesson-gull-spray");
    for (const id of ["candle-crab", "lantern-moth", "tide-bell"]) expect(generatorUpgradeMultiplier(state, id)).toBe(3);
    expect(generatorUpgradeMultiplier(state, "oil-keeper")).toBe(1);
  });

  it("Bell Chorus makes each Beam level worth +7.5%", () => {
    const state = rich();
    light(state, "bellwether");
    state.chainBoards["bellwether"]!.beam = 4;
    const before = beamMultiplier(state).toNumber();
    buyUpgrade(state, "lesson-bell-chorus");
    const after = beamMultiplier(state).toNumber();
    expect(after - 1).toBeCloseTo((before - 1) * 1.5, 6);
  });

  it("Siren Song doubles all production; The Last Lesson raises Ember gain", () => {
    const state = rich();
    state.generators["candle-crab"] = 10;
    light(state, "sirens-rest");
    light(state, HOLLOW_LIGHT_ID);
    const p = productionPerSecond(state);
    buyUpgrade(state, "lesson-siren-song");
    expect(productionPerSecond(state).div(p).toNumber()).toBeCloseTo(2, 6);
    state.lifetimeLumen = new Decimal("1e20");
    const g = rekindleGain(state);
    buyUpgrade(state, "lesson-hollow-last");
    expect(rekindleGain(state)).toBeGreaterThan(g * 1.2);
  });
});

describe("Flash Echo", () => {
  it("adds a stacking share of a second's production to every flash", () => {
    const state = rich();
    state.generators["candle-crab"] = 100;
    state.lifetimeLumen = new Decimal("1e17");
    const base = clickValue(state);
    for (const id of ["echo-1", "echo-2", "echo-3"]) expect(buyUpgrade(state, id)).toBe(true);
    expect(flashEchoShare(state)).toBeCloseTo(0.12, 9);
    const expected = base.add(productionPerSecond(state).mul(0.12));
    expect(clickValue(state).div(expected).toNumber()).toBeCloseTo(1, 9);
  });

  it("rings back on at most three flashes a second; quicker ones pay the plain flash", () => {
    const state = rich();
    state.generators["candle-crab"] = 100;
    state.lifetimeLumen = new Decimal("1e17");
    for (const id of ["echo-1", "echo-2", "echo-3"]) buyUpgrade(state, id);
    const t0 = 1_700_000_000_000;
    // Glass Calm doubles a flash; compare against clickValue at the same moment.
    const full = clickValue(state, t0).toNumber();
    const plain = clickValue(state, t0, false).toNumber();
    expect(full).toBeGreaterThan(plain * 10);
    const paid = [0, 100, 200, 300, 400].map((dt) => clickBeam(state, t0 + dt).toNumber());
    expect(paid.slice(0, ECHO_FLASHES_PER_SECOND).every((v) => Math.abs(v / full - 1) < 1e-9)).toBe(true);
    expect(paid.slice(ECHO_FLASHES_PER_SECOND).every((v) => Math.abs(v / plain - 1) < 1e-9)).toBe(true);
    expect(echoReady(state, t0 + 999)).toBe(false);
    expect(echoReady(state, t0 + 1_000)).toBe(true); // the first echo has faded
    expect(state.totalClicks).toBe(5);
  });

  it("without a time (the sim and estimates) every flash echoes", () => {
    const state = rich();
    state.generators["candle-crab"] = 100;
    state.lifetimeLumen = new Decimal("1e17");
    buyUpgrade(state, "echo-1");
    const v = clickValue(state).toNumber();
    for (let i = 0; i < 10; i++) expect(clickBeam(state).toNumber()).toBe(v);
  });

  it("pays nothing under Still Hands", () => {
    const state = rich();
    state.generators["candle-crab"] = 100;
    state.lifetimeLumen = new Decimal("1e9");
    buyUpgrade(state, "echo-1");
    state.activeChallenge = "still-hands";
    expect(clickValue(state).toNumber()).toBe(0);
  });
});
