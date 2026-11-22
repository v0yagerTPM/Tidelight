import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { lureBankSize, lureRegrowMs } from "../src/game/almanac";
import { EXPEDITION_ROUTES, relicChanceFor, voyageMs } from "../src/game/expeditions";
import { autoHire, autoLearn, lampCrewActive, lampCrewUnlocked, quartermasterActive, quartermasterUnlocked } from "../src/game/automation";
import { chainStatus } from "../src/game/chain";
import { startChallenge } from "../src/game/challenges";
import { CORMORANT_ROOST_ID, EMBER_CURVE, GULL_ROCK_ID, effectiveEmbers } from "../src/game/config";
import { botShop } from "../src/game/bot";
import {
  EMBER_PERKS,
  KINDLINGS,
  buyKindling,
  buyPerk,
  kindlingCost,
  kindlingLevel,
  offlineCapSeconds,
} from "../src/game/emberShop";
import { productionPerSecond } from "../src/game/engine";
import { stewardPurseCapSeconds } from "../src/game/supply";
import { cocoonDurationMs } from "../src/game/moths";
import { rekindle } from "../src/game/prestige";
import { createInitialState, deserializeState, serializeState, startBoard } from "../src/game/state";
import { tideAt, tideSupportMultiplier, TIDE_BUCKET_MS } from "../src/game/tides";
import type { GameState, Moth } from "../src/game/types";

function keeper(embers = 1e12): GameState {
  const state = createInitialState(0);
  state.embers = embers;
  return state;
}

function withPerk(id: string, embers = 1e12): GameState {
  const state = keeper(embers);
  expect(buyPerk(state, id)).toBe(true);
  return state;
}

describe("the shop's shelves", () => {
  it("keeps the eight keeper perks and six late perks, ×10 apart from 50,000", () => {
    expect(EMBER_PERKS.filter((p) => p.shelf === "keeper")).toHaveLength(8);
    const late = EMBER_PERKS.filter((p) => p.shelf === "late");
    expect(late.map((p) => p.costEmbers)).toEqual([5e4, 5e5, 5e6, 5e7, 5e8, 5e9]);
    expect(EMBER_PERKS.some((p) => p.id === "quartermaster" || p.id === "lamp-crew")).toBe(false);
  });
});

describe("Kindlings", () => {
  it("cost base × growth^level and climb with each level", () => {
    const state = keeper();
    expect(kindlingCost(state, "ember-glow")).toBe(1_000);
    expect(buyKindling(state, "ember-glow")).toBe(true);
    expect(kindlingCost(state, "ember-glow")).toBe(10_000);
    expect(buyKindling(state, "ember-glow")).toBe(true);
    expect(kindlingLevel(state, "ember-glow")).toBe(2);
    expect(state.embers).toBe(1e12 - 11_000);
  });

  it("refuse when the Embers aren't there", () => {
    const state = keeper(999);
    expect(buyKindling(state, "ember-glow")).toBe(false);
    expect(state.embers).toBe(999);
  });

  it("Ember Glow adds 5% to all production a level, up to 10 levels", () => {
    const state = keeper(0);
    state.generators["candle-crab"] = 10;
    const p = productionPerSecond(state);
    state.kindlings["ember-glow"] = 2;
    expect(productionPerSecond(state).div(p).toNumber()).toBeCloseTo(1.1025, 9);
    state.kindlings["ember-glow"] = 10;
    expect(kindlingCost(state, "ember-glow")).toBe(Infinity);
  });

  it("the Shore Kindlings take 5% off lures and cocoons a level; Tailwind adds 2 points of relic chance", () => {
    const state = keeper(0);
    const a = { id: "a", name: "A", pattern: "plain", glow: 10 } as Moth;
    const lure = lureRegrowMs(state);
    const cocoon = cocoonDurationMs(a, a, state);
    const route = EXPEDITION_ROUTES[0];
    const voyage = voyageMs(state, route);
    const chance = relicChanceFor(state, route, null);
    state.kindlings = { "quick-lures": 2, "spinning-silk": 2, tailwind: 2 };
    expect(lureRegrowMs(state)).toBe(Math.round(lure * 0.9025));
    expect(cocoonDurationMs(a, a, state)).toBe(Math.round(cocoon * 0.9025));
    expect(voyageMs(state, route)).toBe(voyage);
    expect(relicChanceFor(state, route, null)).toBeCloseTo(chance + 0.04, 9);
  });

  it("Long Watch adds an hour of offline cap a level and stops at 8", () => {
    const state = keeper();
    const cap = offlineCapSeconds(state);
    state.kindlings["long-watch"] = 8;
    expect(offlineCapSeconds(state) - cap).toBe(8 * 3600);
    expect(kindlingCost(state, "long-watch")).toBe(Infinity);
    expect(buyKindling(state, "long-watch")).toBe(false);
  });

  it("round-trip through a save, junk dropped and caps kept", () => {
    const state = keeper();
    state.kindlings = { "ember-glow": 3, "long-watch": 99, bogus: 4 } as Record<string, number>;
    state.autoHire = false;
    const back = deserializeState(serializeState(state))!;
    expect(back.kindlings).toEqual({ "ember-glow": 3, "long-watch": 8 });
    expect(back.autoHire).toBe(false);
    expect(back.autoLearn).toBe(true);
    expect(KINDLINGS).toHaveLength(5);
  });
});

describe("late perks", () => {
  it("Warm Hearth starts each run with 10 of each of the first three helpers", () => {
    const state = withPerk("warm-hearth");
    state.litLighthouses.push(GULL_ROCK_ID);
    state.chainBoards[GULL_ROCK_ID] = startBoard(GULL_ROCK_ID);
    state.lifetimeLumen = new Decimal("1e9");
    rekindle(state);
    expect(state.generators["candle-crab"]).toBe(10);
    expect(state.generators["tide-bell"]).toBe(10);
    expect(state.generators["oil-keeper"]).toBeUndefined();
    expect(state.generators["lens-polisher"]).toBeUndefined();
  });

  it("Warm Hearth obeys a challenge's rules", () => {
    const state = withPerk("warm-hearth");
    state.litLighthouses.push(GULL_ROCK_ID);
    state.chainBoards[GULL_ROCK_ID] = startBoard(GULL_ROCK_ID);
    expect(startChallenge(state, "first-light-only")).toBe(true);
    expect(state.generators["tide-bell"]).toBe(10);
    expect(state.generators["oil-keeper"]).toBeUndefined();
  });

  it("The Steward's Ledger triples the Chain Steward's purse", () => {
    const state = keeper();
    const before = stewardPurseCapSeconds(state);
    buyPerk(state, "steward-ledger");
    expect(stewardPurseCapSeconds(state)).toBe(before * 3);
  });

  it("Ember Memory keeps every helper's first upgrade", () => {
    const state = withPerk("ember-memory");
    state.upgrades = ["candle-crab-u1", "candle-crab-u2", "tide-bell-u1", "longer-wicks", "keepers-focus"];
    state.lifetimeLumen = new Decimal("1e9");
    rekindle(state);
    expect(state.upgrades.sort()).toEqual(["candle-crab-u1", "longer-wicks", "tide-bell-u1"]);
  });

  it("Glass Charts no longer hurry a bottle (they send it out again: tests/farShelf.test.ts)", () => {
    const state = keeper();
    const route = EXPEDITION_ROUTES[1];
    const before = voyageMs(state, route);
    buyPerk(state, "glass-charts");
    expect(voyageMs(state, route)).toBe(before);
  });

  it("Storm Charts soften a Stormfront's drain to ×0.9", () => {
    let t = 0;
    while (tideAt(t).def.id !== "storm") t += TIDE_BUCKET_MS;
    const state = keeper();
    expect(tideSupportMultiplier(t, state)).toBe(0.8);
    buyPerk(state, "storm-charts");
    expect(tideSupportMultiplier(t, state)).toBe(0.9);
  });

  it("Moth Lantern adds a lure to the bank and spins cocoons 25% faster", () => {
    const state = keeper();
    const a = { id: "a", name: "A", pattern: "plain", glow: 10 } as Moth;
    const before = cocoonDurationMs(a, a, state);
    const bank = lureBankSize(state);
    buyPerk(state, "moth-lantern");
    expect(lureBankSize(state)).toBe(bank + 1);
    expect(cocoonDurationMs(a, a, state)).toBe(Math.round(before * 0.75));
  });
});

/** A keeper with these lighthouses lit (their boards at the starting levels). */
function withLit(...ids: string[]): GameState {
  const state = keeper();
  for (const id of ids) {
    state.litLighthouses.push(id);
    state.chainBoards[id] = startBoard(id);
  }
  return state;
}

describe("automation", () => {
  it("the Quartermaster comes with Gull Rock, the Lamp Crew with Cormorant Roost", () => {
    const dark = keeper();
    expect(quartermasterUnlocked(dark)).toBe(false);
    expect(lampCrewUnlocked(dark)).toBe(false);
    const gull = withLit(GULL_ROCK_ID);
    expect(quartermasterUnlocked(gull)).toBe(true);
    expect(lampCrewUnlocked(gull)).toBe(false);
    const roost = withLit(GULL_ROCK_ID, CORMORANT_ROOST_ID);
    expect(quartermasterUnlocked(roost)).toBe(true);
    expect(lampCrewUnlocked(roost)).toBe(true);
  });

  it("the Quartermaster learns upgrades costing up to a quarter of your Lumen, cheapest first", () => {
    const state = withLit(GULL_ROCK_ID);
    state.generators["candle-crab"] = 30;
    state.lumen = new Decimal(3000); // crab I costs 600, crab II 3,600
    expect(quartermasterActive(state)).toBe(true);
    expect(autoLearn(state)).toEqual(["Wax-Rich Diet"]);
    expect(state.lumen.toNumber()).toBe(2400);
    state.autoLearn = false;
    state.lumen = new Decimal(1e9);
    expect(autoLearn(state)).toEqual([]);
  });

  it("the Lamp Crew hires best value with a tenth of your Lumen", () => {
    const state = withLit(GULL_ROCK_ID, CORMORANT_ROOST_ID);
    state.lumen = new Decimal(1000);
    expect(lampCrewActive(state)).toBe(true);
    const hired = autoHire(state);
    expect(hired).toBeGreaterThan(0);
    expect(state.lumen.toNumber()).toBeGreaterThanOrEqual(1000 * 0.9 ** hired - 1);
  });

  it("the Lamp Crew never starves the beam", () => {
    const state = withLit(GULL_ROCK_ID, CORMORANT_ROOST_ID);
    state.embers = 0; // no lasting bonuses warming the chain
    state.generators["candle-crab"] = 400; // far more than the starting chain carries
    state.lumen = new Decimal("1e12");
    const eff = chainStatus(state).efficiency;
    expect(eff).toBeLessThan(0.9);
    expect(autoHire(state)).toBe(0);
  });

  it("does nothing before its lighthouse is lit", () => {
    const state = keeper();
    state.lumen = new Decimal(1e9);
    expect(autoHire(state)).toBe(0);
    expect(autoLearn(state)).toEqual([]);
  });

  it("a save that bought the retired perks gets the Embers back, once", () => {
    const state = keeper(1_000);
    const raw = serializeState(state) as unknown as { emberPerks: string[] };
    raw.emberPerks = ["warm-lamp", "quartermaster", "lamp-crew"];
    const loaded = deserializeState(raw)!;
    expect(loaded.embers).toBe(1_000 + 500 + 5_000);
    expect(loaded.emberPerks).toEqual(["warm-lamp"]);
    expect(loaded.log[loaded.log.length - 1]?.message).toMatch(/Quartermaster and Lamp Crew now come with the lighthouses/);
    const again = deserializeState(serializeState(loaded))!;
    expect(again.embers).toBe(6_500);
  });
});

describe("the held-Ember curve", () => {
  it("counts the first 100 Embers in full and the rest along the curve", () => {
    const saved = EMBER_CURVE.power;
    try {
      EMBER_CURVE.power = 0.8;
      expect(effectiveEmbers(50)).toBe(50);
      expect(effectiveEmbers(100)).toBe(100);
      expect(effectiveEmbers(10_000)).toBeCloseTo(100 * 100 ** 0.8, 6);
      EMBER_CURVE.power = 1;
      expect(effectiveEmbers(10_000)).toBe(10_000);
    } finally {
      EMBER_CURVE.power = saved;
    }
  });
});

describe("the bot in the Ember shop", () => {
  it("buys cheap perks and production that pays for itself, never more than it holds", () => {
    const state = keeper(400);
    const bought = botShop(state);
    expect(bought).toContain("Head Start");
    expect(state.embers).toBeGreaterThanOrEqual(0);
    // Nothing it skipped would have been both affordable and within its rules.
    expect(botShop(state)).toEqual([]);
  });

  it("buys nothing with a handful of Embers it needs for its bonus", () => {
    const state = keeper(40);
    expect(botShop(state)).toEqual([]);
  });
});
