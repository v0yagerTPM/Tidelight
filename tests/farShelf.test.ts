import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { BELLWETHER_ID, CORMORANT_ROOST_ID, GULL_ROCK_ID, SIRENS_REST_ID, WIDOWS_WALK_ID } from "../src/game/config";
import { EMBER_PERKS, buyPerk, kindleAll, offlineCapSeconds, perkOpen, shopOffers } from "../src/game/emberShop";
import { ECHO_FLASHES_PER_SECOND, clickBeam, echoCharges } from "../src/game/engine";
import { routeById, sendExpedition, tendBottles, voyageMs } from "../src/game/expeditions";
import { mothProductionMultiplier } from "../src/game/moths";
import { rekindle } from "../src/game/prestige";
import { createInitialState, deserializeState, serializeState, startBoard } from "../src/game/state";
import type { GameState } from "../src/game/types";
import { buyUpgrade } from "../src/game/upgrades";

/** A keeper with lights lit up to `upTo` (inclusive), a fat purse of Embers and Lumen. */
function keeper(upTo: string | null = SIRENS_REST_ID): GameState {
  const state = createInitialState(0);
  state.embers = 1e14;
  state.embersTotalEarned = 1e14;
  state.lumen = new Decimal("1e40");
  state.generators["candle-crab"] = 10;
  for (const id of [GULL_ROCK_ID, CORMORANT_ROOST_ID, WIDOWS_WALK_ID, BELLWETHER_ID, SIRENS_REST_ID]) {
    if (upTo === null) break;
    state.litLighthouses.push(id);
    state.chainBoards[id] = startBoard(id);
    if (id === upTo) break;
  }
  return state;
}

describe("the far shelf", () => {
  const far = EMBER_PERKS.filter((p) => p.shelf === "far");

  it("has three perks, ten times apart, and opens only when Siren's Rest burns", () => {
    expect(far.map((p) => p.id)).toEqual(["second-memory", "moth-watch", "full-hearth"]);
    expect(far.map((p) => p.costEmbers)).toEqual([1e11, 1e12, 1e13]);
    const early = keeper(BELLWETHER_ID);
    for (const p of far) {
      expect(perkOpen(early, p)).toBe(false);
      expect(buyPerk(early, p.id)).toBe(false);
    }
    expect(shopOffers(early).some((o) => far.some((p) => p.id === o.id))).toBe(false);
    kindleAll(early, 1);
    expect(early.emberPerks.some((id) => far.some((p) => p.id === id))).toBe(false);
    const late = keeper();
    for (const p of far) expect(buyPerk(late, p.id)).toBe(true);
  });

  it("Second Memory keeps every helper's second upgrade through a Rekindle, as Ember Memory keeps the first", () => {
    const state = keeper();
    buyPerk(state, "ember-memory");
    buyPerk(state, "second-memory");
    state.upgrades = ["candle-crab-u1", "candle-crab-u2", "candle-crab-u3", "keepers-focus"];
    state.lifetimeLumen = new Decimal("1e9");
    rekindle(state);
    expect(state.upgrades.sort()).toEqual(["candle-crab-u1", "candle-crab-u2"]);
  });

  it("Moth-Watch doubles what the duty moths add to the beam", () => {
    const state = keeper();
    state.moths = [{ id: "a", name: "A", pattern: "prismatic", glow: 100, generation: 1 }];
    state.mothDuty = ["a"];
    const before = mothProductionMultiplier(state);
    buyPerk(state, "moth-watch");
    expect(mothProductionMultiplier(state) - 1).toBeCloseTo((before - 1) * 2, 9);
  });

  it("Full Hearth starts each run with ten of each of the first six helpers that can be hired", () => {
    const state = keeper(GULL_ROCK_ID); // Storm Lanterns answer Cormorant Roost: not yet
    buyPerk(state, "warm-hearth");
    state.lifetimeLumen = new Decimal("1e9");
    rekindle(state);
    expect(Object.keys(state.generators).length).toBe(3);
    state.emberPerks.push("full-hearth");
    state.lifetimeLumen = new Decimal("1e9");
    rekindle(state);
    expect(state.generators).toEqual({ "candle-crab": 10, "lantern-moth": 10, "tide-bell": 10, "oil-keeper": 10, "lens-polisher": 10 });
  });
});

describe("Glass Charts: bottles set out again", () => {
  it("nothing shortens a voyage any more", () => {
    const state = keeper();
    const drift = routeById("drift")!;
    const before = voyageMs(state, drift);
    buyPerk(state, "glass-charts");
    state.kindlings = { tailwind: 10 };
    expect(voyageMs(state, drift)).toBe(before);
  });

  it("without the perk, a returned bottle waits for its keeper", () => {
    const state = keeper();
    sendExpedition(state, "drift", 0);
    expect(tendBottles(state, () => 0.99, 1e9).voyages).toBe(0);
    expect(state.expedition?.returnsAt).toBe(600_000);
  });

  it("claims a bottle that has come home and sends it out again on the standing route", () => {
    const state = keeper();
    buyPerk(state, "glass-charts");
    sendExpedition(state, "drift", 0);
    expect(state.bottleRoute).toBe("drift");
    state.lumen = new Decimal(10_000);
    const result = tendBottles(state, () => 0.99, 600_000);
    expect(result.voyages).toBe(1);
    expect(result.lumen.toNumber()).toBeGreaterThan(0);
    expect(state.lumen.div(result.lumen.add(10_000 - routeById("drift")!.cost)).toNumber()).toBeCloseTo(1, 9);
    expect(state.expedition).toMatchObject({ routeId: "drift", startedAt: 600_000, returnsAt: 1_200_000 });
    // The keeper picks another route for the next voyage.
    state.bottleRoute = "coastal";
    tendBottles(state, () => 0.99, 1_200_000);
    expect(state.expedition?.routeId).toBe("coastal");
    expect(state.log.filter((e) => e.message.startsWith("Glass Charts:")).length).toBe(2);
  });

  it("while away, voyages are counted inside the offline cap, and summed up in one line", () => {
    const state = keeper();
    buyPerk(state, "glass-charts");
    sendExpedition(state, "drift", 0);
    const logBefore = state.log.length;
    const week = 7 * 24 * 3600 * 1000;
    const result = tendBottles(state, () => 0.99, week);
    // The first comes home at ten minutes; then only voyages inside the offline cap.
    const inCap = offlineCapSeconds(state) / 600;
    expect(result.voyages).toBeGreaterThanOrEqual(inCap);
    expect(result.voyages).toBeLessThanOrEqual(inCap + 2);
    expect(state.expedition!.returnsAt).toBeGreaterThan(week);
    const lines = state.log.slice(logBefore).filter((e) => e.message.startsWith("Glass Charts:"));
    expect(lines.length).toBe(1);
  });

  it("with no bottle out, sets one out on the standing route", () => {
    const state = keeper();
    buyPerk(state, "glass-charts");
    state.bottleRoute = "crossing";
    tendBottles(state, () => 0.99, 5_000);
    expect(state.expedition?.routeId).toBe("crossing");
  });

  it("v16 keeps the standing route; an unknown one is dropped", () => {
    const state = keeper();
    state.bottleRoute = "coastal";
    expect(deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!.bottleRoute).toBe("coastal");
    const junk = serializeState(state) as unknown as Record<string, unknown>;
    junk.bottleRoute = "atlantis";
    expect(deserializeState(junk)!.bottleRoute).toBeNull();
  });
});

describe("the echo's marks", () => {
  it("count down with each echoing flash and refill after a second", () => {
    const state = keeper();
    state.lifetimeLumen = new Decimal("1e17");
    buyUpgrade(state, "echo-1");
    const t0 = 1_700_000_000_000;
    expect(echoCharges(state, t0)).toBe(ECHO_FLASHES_PER_SECOND);
    clickBeam(state, t0);
    clickBeam(state, t0 + 10);
    expect(echoCharges(state, t0 + 20)).toBe(ECHO_FLASHES_PER_SECOND - 2);
    clickBeam(state, t0 + 30);
    clickBeam(state, t0 + 40); // past the marks: a plain flash, not counted
    expect(echoCharges(state, t0 + 50)).toBe(0);
    expect(echoCharges(state, t0 + 1_000)).toBe(1);
    expect(echoCharges(state, t0 + 1_031)).toBe(ECHO_FLASHES_PER_SECOND);
    expect(echoCharges(state)).toBe(ECHO_FLASHES_PER_SECOND); // no clock: always full
  });
});
