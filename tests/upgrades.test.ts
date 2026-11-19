import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { generatorById } from "../src/game/config";
import {
  bulkCost,
  buyQuote,
  buyWithAmount,
  clickBeam,
  clickValue,
  generatorProduction,
  offlineEarnings,
  productionPerSecond,
} from "../src/game/engine";
import { rekindle } from "../src/game/prestige";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import {
  UPGRADES,
  buyUpgrade,
  emberBonusPerEmber,
  isUnlocked,
  offlineRateFor,
  totalGeneratorsOwned,
  upgradeById,
} from "../src/game/upgrades";

const crab = generatorById("candle-crab");
const moth = generatorById("lantern-moth");

function richState(lumen: number) {
  const state = createInitialState();
  state.lumen = new Decimal(lumen);
  return state;
}

describe("buy amounts", () => {
  it("×10 buys exactly 10 at the closed-form bulk cost", () => {
    const state = richState(100_000);
    const expectedCost = bulkCost(crab, 0, 10);
    expect(buyWithAmount(state, crab.id, 10)).toBe(true);
    expect(state.generators[crab.id]).toBe(10);
    expect(state.lumen.toNumber()).toBe(100_000 - expectedCost.toNumber());
    expect(state.totalGeneratorsBought).toBe(10);
  });

  it("Max buys maxAffordable copies and no more", () => {
    const state = richState(bulkCost(crab, 0, 7).toNumber());
    expect(buyWithAmount(state, crab.id, "max")).toBe(true);
    expect(state.generators[crab.id]).toBe(7);
    expect(state.lumen.toNumber()).toBe(0);
    // Nothing left: a second Max buy is a clean no-op.
    expect(buyWithAmount(state, crab.id, "max")).toBe(false);
  });

  it("a fixed amount fails cleanly when the full batch is unaffordable", () => {
    const state = richState(bulkCost(crab, 0, 99).toNumber()); // one short of ×100
    const quote = buyQuote(state, crab, 100);
    expect(quote.count).toBe(100);
    expect(quote.cost.toNumber()).toBe(bulkCost(crab, 0, 100).toNumber());
    expect(quote.affordable).toBe(false);
    expect(buyWithAmount(state, crab.id, 100)).toBe(false);
    expect(state.generators[crab.id] ?? 0).toBe(0);
    expect(state.lumen.toNumber()).toBe(bulkCost(crab, 0, 99).toNumber());
  });

  it("quotes report count, cost, and production gain for the selected amount", () => {
    const state = createInitialState();
    const quote = buyQuote(state, crab, 10);
    expect(quote.count).toBe(10);
    expect(quote.cost.toNumber()).toBe(bulkCost(crab, 0, 10).toNumber());
    expect(quote.affordable).toBe(false);
    // 10 crabs × 0.5/s, no milestones yet.
    expect(quote.productionGain.toNumber()).toBe(5);
  });

  it("Max quote with an empty purse points at the next single copy", () => {
    const state = createInitialState();
    const quote = buyQuote(state, crab, "max");
    expect(quote.count).toBe(0);
    expect(quote.cost.toNumber()).toBe(15);
    expect(quote.affordable).toBe(false);
  });
});

describe("upgrade definitions", () => {
  it("has 45 per-generator upgrades (five per helper), 3 click, 3 echo, 6 synergies, 12 lighthouse lessons and 3 globals", () => {
    expect(UPGRADES.filter((u) => u.kind === "generator")).toHaveLength(45);
    expect(UPGRADES.filter((u) => u.kind === "click")).toHaveLength(3);
    expect(UPGRADES.filter((u) => u.kind === "echo")).toHaveLength(3);
    expect(UPGRADES.filter((u) => u.kind === "synergy")).toHaveLength(6);
    expect(UPGRADES.filter((u) => u.kind === "lighthouse")).toHaveLength(12);
    expect(UPGRADES.filter((u) => u.kind === "global")).toHaveLength(3);
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
  });

  it("per-generator costs are 40× and 240× base cost, unlocked at 10 and 30 owned", () => {
    // (40×/240× after the Sprint 1 balance tune; originally specced 25×/150×.)
    const u1 = upgradeById("candle-crab-u1");
    const u2 = upgradeById("candle-crab-u2");
    expect(u1.cost).toBe(15 * 40);
    expect(u2.cost).toBe(15 * 240);
    expect(u1.name).toBe("Wax-Rich Diet");
    expect(u2.name).toBe("Second Claw Lamp");
    expect(upgradeById("beacon-whale-u1").cost).toBe(31_000_000 * 40);
  });

  it("only Longer Wicks and Ember Resonance are permanent", () => {
    const permanent = UPGRADES.filter((u) => u.permanent).map((u) => u.id).sort();
    expect(permanent).toEqual(["ember-resonance", "longer-wicks"]);
  });
});

describe("upgrade unlock conditions", () => {
  it("generator upgrades unlock at 10 and 30 owned of that generator", () => {
    const state = createInitialState();
    state.generators[crab.id] = 9;
    expect(isUnlocked(state, upgradeById("candle-crab-u1"))).toBe(false);
    state.generators[crab.id] = 10;
    expect(isUnlocked(state, upgradeById("candle-crab-u1"))).toBe(true);
    expect(isUnlocked(state, upgradeById("candle-crab-u2"))).toBe(false);
    state.generators[crab.id] = 30;
    expect(isUnlocked(state, upgradeById("candle-crab-u2"))).toBe(true);
    // Owning crabs doesn't unlock moth upgrades.
    expect(isUnlocked(state, upgradeById("lantern-moth-u1"))).toBe(false);
  });

  it("click upgrades unlock on run-lifetime Lumen", () => {
    const state = createInitialState();
    state.lifetimeLumen = new Decimal(499);
    expect(isUnlocked(state, upgradeById("click-1"))).toBe(false);
    state.lifetimeLumen = new Decimal(500);
    expect(isUnlocked(state, upgradeById("click-1"))).toBe(true);
    expect(isUnlocked(state, upgradeById("click-2"))).toBe(false);
    state.lifetimeLumen = new Decimal(1_000_000);
    expect(isUnlocked(state, upgradeById("click-3"))).toBe(true);
  });

  it("globals unlock on total generators, all-time Lumen, and Embers held", () => {
    const state = createInitialState();
    state.generators[crab.id] = 30;
    state.generators[moth.id] = 19;
    expect(totalGeneratorsOwned(state)).toBe(49);
    expect(isUnlocked(state, upgradeById("keepers-focus"))).toBe(false);
    state.generators[moth.id] = 20;
    expect(isUnlocked(state, upgradeById("keepers-focus"))).toBe(true);

    expect(isUnlocked(state, upgradeById("longer-wicks"))).toBe(false);
    state.allTimeLumen = new Decimal(2_000_000);
    expect(isUnlocked(state, upgradeById("longer-wicks"))).toBe(true);

    expect(isUnlocked(state, upgradeById("ember-resonance"))).toBe(false);
    state.embers = 10;
    expect(isUnlocked(state, upgradeById("ember-resonance"))).toBe(true);
  });

  it("buying fails while locked or unaffordable, and can't be bought twice", () => {
    const state = richState(1_000_000);
    // Locked (no crabs owned):
    expect(buyUpgrade(state, "candle-crab-u1")).toBe(false);
    state.generators[crab.id] = 10;
    // Unlocked but too poor for the second tier's sibling check:
    const poor = createInitialState();
    poor.generators[crab.id] = 10;
    expect(buyUpgrade(poor, "candle-crab-u1")).toBe(false);
    // Happy path, then double-buy:
    expect(buyUpgrade(state, "candle-crab-u1")).toBe(true);
    expect(state.lumen.toNumber()).toBe(1_000_000 - 600);
    expect(buyUpgrade(state, "candle-crab-u1")).toBe(false);
  });
});

describe("upgrade effects", () => {
  it("per-generator ×2 stacks multiplicatively with milestone ×2 and the Ember bonus", () => {
    const state = createInitialState();
    state.generators[crab.id] = 25; // milestone ×2
    state.embers = 50; // +100% at +2% each
    state.lumen = new Decimal(10_000);
    expect(buyUpgrade(state, "candle-crab-u1")).toBe(true);
    // 25 × 0.5 × 2 (milestone) × 2 (upgrade) × 2 (Embers) = 100/s of
    // generator production (the Sprint 2 chain then taxes the total —
    // that stacking is what this test is about, so it reads the
    // per-generator rate, which is pre-chain by definition).
    expect(generatorProduction(state, crab).toNumber()).toBe(100);
    // Second upgrade doubles again:
    state.generators[crab.id] = 30;
    state.lumen = new Decimal(10_000);
    expect(buyUpgrade(state, "candle-crab-u2")).toBe(true);
    // 30 × 0.5 × 2 × 4 (two upgrades) × 2 (Embers) = 240/s
    expect(generatorProduction(state, crab).toNumber()).toBe(240);
  });

  it("click upgrades double the click value: 1 → 2 → 4 → 8", () => {
    const state = createInitialState();
    state.lifetimeLumen = new Decimal(1_000_000);
    state.allTimeLumen = new Decimal(1_000_000);
    state.lumen = new Decimal(1_000_000);
    expect(clickValue(state).toNumber()).toBe(1);
    expect(buyUpgrade(state, "click-1")).toBe(true);
    expect(clickValue(state).toNumber()).toBe(2);
    expect(buyUpgrade(state, "click-2")).toBe(true);
    expect(clickValue(state).toNumber()).toBe(4);
    expect(buyUpgrade(state, "click-3")).toBe(true);
    expect(clickValue(state).toNumber()).toBe(8);
    const before = state.lumen.toNumber();
    clickBeam(state);
    expect(state.lumen.toNumber()).toBe(before + 8);
  });

  it("Keeper's Focus adds +25% to all production", () => {
    const state = createInitialState();
    state.generators[crab.id] = 50;
    state.generators[moth.id] = 1; // 51 total — Focus unlocked
    state.lumen = new Decimal(200_000);
    // Read the per-generator rate: Focus multiplies it by exactly 1.25.
    // (The final rate also moves the Sprint 2 chain's demand, so its
    // ratio is 1.25 × a slightly changed chain factor — not exactly 1.25.)
    const base = generatorProduction(state, crab).toNumber();
    expect(buyUpgrade(state, "keepers-focus")).toBe(true);
    expect(generatorProduction(state, crab).toNumber()).toBeCloseTo(base * 1.25, 9);
  });

  it("Longer Wicks raises offline earnings from 50% to 75%", () => {
    const state = createInitialState(0);
    state.generators[crab.id] = 10; // 5/s
    state.allTimeLumen = new Decimal(2_000_000);
    state.lumen = new Decimal(300_000);
    state.lastSeen = 0;
    expect(offlineRateFor(state)).toBe(0.5);
    expect(buyUpgrade(state, "longer-wicks")).toBe(true);
    expect(offlineRateFor(state)).toBe(0.75);
    const result = offlineEarnings(state, 3600 * 1000);
    expect(result.gain.toNumber()).toBe(5 * 3600 * 0.75);
  });

  it("Ember Resonance raises the per-Ember bonus from +2% to +3%", () => {
    const state = createInitialState();
    state.embers = 10;
    state.lumen = new Decimal(6_000_000);
    expect(emberBonusPerEmber(state)).toBe(0.02);
    expect(buyUpgrade(state, "ember-resonance")).toBe(true);
    expect(emberBonusPerEmber(state)).toBe(0.03);
    state.generators[crab.id] = 10; // 5/s base
    // 5 × (1 + 10 × 0.03) = 6.5/s
    expect(productionPerSecond(state).toNumber()).toBeCloseTo(6.5, 9);
  });
});

describe("rekindle and upgrades", () => {
  it("keeps permanent upgrades, removes the rest, and keeps the buy amount", () => {
    const state = createInitialState();
    state.lifetimeLumen = new Decimal(8_000_000); // worth exactly 40 Embers
    state.allTimeLumen = new Decimal(8_000_000);
    state.embers = 10;
    state.lumen = new Decimal(10_000_000);
    state.generators[crab.id] = 30;
    state.buyAmount = 100;

    expect(buyUpgrade(state, "longer-wicks")).toBe(true); // permanent
    expect(buyUpgrade(state, "ember-resonance")).toBe(true); // permanent
    expect(buyUpgrade(state, "candle-crab-u1")).toBe(true); // resets
    expect(buyUpgrade(state, "click-1")).toBe(true); // resets

    const gained = rekindle(state);
    expect(gained).toBe(40);
    expect(state.embers).toBe(50);
    expect(state.upgrades.sort()).toEqual(["ember-resonance", "longer-wicks"]);
    expect(state.buyAmount).toBe(100);
    // Effects of the kept knowledge are live in the new run:
    expect(emberBonusPerEmber(state)).toBe(0.03);
    expect(offlineRateFor(state)).toBe(0.75);
    // And the forgotten click upgrade is gone:
    expect(clickValue(state).toNumber()).toBe(1);
  });
});

describe("save migration (Sprint 0 → Sprint 1)", () => {
  it("loads a Sprint 0-shaped save (version 1, no upgrades/buyAmount) with defaults", () => {
    const sprint0Save = {
      version: 1,
      lumen: "1234",
      lifetimeLumen: "5000",
      allTimeLumen: "9000",
      embers: 3,
      generators: { "candle-crab": 7 },
      totalClicks: 42,
      totalGeneratorsBought: 7,
      totalRekindles: 0,
      playTimeSeconds: 600,
      lastSeen: 1_700_000_000_000,
      log: [],
    };
    const restored = deserializeState(JSON.parse(JSON.stringify(sprint0Save)));
    expect(restored).not.toBeNull();
    expect(restored?.version).toBe(11); // migrated forward (v6 in Sprint 5)
    expect(restored?.lumen.toNumber()).toBe(1234);
    expect(restored?.embers).toBe(3);
    expect(restored?.generators["candle-crab"]).toBe(7);
    expect(restored?.upgrades).toEqual([]);
    expect(restored?.buyAmount).toBe(1);
  });

  it("round-trips upgrades and buy amount at version 6", () => {
    const state = createInitialState();
    state.upgrades = ["candle-crab-u1", "longer-wicks"];
    state.buyAmount = "max";
    const saved = serializeState(state);
    expect(saved.version).toBe(11);
    expect(saved.upgrades).toEqual(["candle-crab-u1", "longer-wicks"]);
    expect(saved.buyAmount).toBe("max");
    const restored = deserializeState(JSON.parse(JSON.stringify(saved)));
    expect(restored?.upgrades).toEqual(["candle-crab-u1", "longer-wicks"]);
    expect(restored?.buyAmount).toBe("max");
  });

  it("sanitizes a junk buy amount and non-string upgrade ids", () => {
    const junk = {
      version: 2,
      lumen: "0",
      lifetimeLumen: "0",
      allTimeLumen: "0",
      embers: 0,
      generators: {},
      upgrades: ["click-1", 42, null],
      buyAmount: 7,
      totalClicks: 0,
      totalGeneratorsBought: 0,
      totalRekindles: 0,
      playTimeSeconds: 0,
      lastSeen: 0,
      log: [],
    };
    const restored = deserializeState(junk);
    expect(restored?.upgrades).toEqual(["click-1"]);
    expect(restored?.buyAmount).toBe(1);
  });
});
