import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { chainStatus, nodeCost, totalBeamLevels } from "../src/game/chain";
import { CHAIN_LIGHTHOUSES, WIDOWS_WALK_ID } from "../src/game/config";
import { createInitialState, deserializeState, serializeState, startBoard } from "../src/game/state";
import {
  STEWARD_PURSE_CAP_SECONDS,
  cheapestBoardFor,
  efficiencyAtDemand,
  feedNode,
  feedQuote,
  fillChain,
  stewardActive,
  stewardUnlocked,
  tendChain,
} from "../src/game/supply";
import { productionPerSecond } from "../src/game/engine";
import type { GameState } from "../src/game/types";

/** A keeper whose chain is awake and starved: lots of crabs, four lights, full purse. */
function starved(lumen = 1e12): GameState {
  const state = createInitialState(0);
  state.generators["candle-crab"] = 400;
  state.generators["lantern-moth"] = 200;
  for (const lh of CHAIN_LIGHTHOUSES.slice(1, 4)) {
    state.litLighthouses.push(lh.id);
    state.chainBoards[lh.id] = startBoard(lh.id);
  }
  state.lumen = new Decimal(lumen);
  return state;
}

describe("feeding the chain from the Light view", () => {
  it("feeding a node buys its cheapest level on any lit board", () => {
    const state = starved();
    const board = cheapestBoardFor(state, "oil")!;
    for (const id of state.litLighthouses) {
      expect(nodeCost(board, "oil", state.chainBoards[board].oil, state).lte(nodeCost(id, "oil", state.chainBoards[id].oil, state))).toBe(true);
    }
    const before = state.chainBoards[board].oil;
    expect(feedNode(state, "oil")).toBe(true);
    expect(state.chainBoards[board].oil).toBe(before + 1);
  });

  it("a quote names the board, the price and the efficiency the purchase reaches", () => {
    const state = starved();
    const st = chainStatus(state);
    const quote = feedQuote(state, st.bottleneck!);
    expect(quote.board).toBe(cheapestBoardFor(state, st.bottleneck!));
    expect(quote.affordable).toBe(true);
    const lumenBefore = state.lumen;
    feedNode(state, st.bottleneck!);
    expect(lumenBefore.sub(state.lumen).toNumber()).toBeCloseTo(quote.cost!.toNumber(), 6);
    expect(chainStatus(state).efficiency).toBeCloseTo(quote.efficiencyAfter, 9);
    expect(quote.efficiencyAfter).toBeGreaterThan(st.efficiency);
  });

  it("nothing to feed while the chain sleeps", () => {
    const state = createInitialState(0);
    expect(feedQuote(state, "wick").board).toBeNull();
    expect(feedNode(state, "wick")).toBe(false);
  });

  it("filling the chain feeds the bottleneck until the target, within the budget, with one log line", () => {
    const state = starved();
    const logBefore = state.log.length;
    const full = fillChain(state, 0.9);
    expect(full.levels).toBeGreaterThan(0);
    expect(full.efficiency).toBeGreaterThanOrEqual(0.9);
    expect(state.log.length).toBe(logBefore + 1);
    const tight = starved();
    const spent = fillChain(tight, 1, new Decimal(5_000));
    expect(spent.spent.toNumber()).toBeLessThanOrEqual(5_000);
  });

  it("efficiencyAtDemand predicts the beam after extra demand", () => {
    const state = starved();
    expect(efficiencyAtDemand(state, new Decimal(0))).toBeCloseTo(chainStatus(state).efficiency, 9);
    expect(efficiencyAtDemand(state, new Decimal(1e9))).toBeLessThan(chainStatus(state).efficiency);
  });
});

describe("the Chain Steward", () => {
  it("is unlocked by Widow's Walk and on by default", () => {
    const state = starved();
    expect(stewardUnlocked(state)).toBe(true);
    expect(stewardActive(state)).toBe(true);
    state.litLighthouses = state.litLighthouses.filter((id) => id !== WIDOWS_WALK_ID);
    expect(stewardUnlocked(state)).toBe(false);
    expect(tendChain(state, new Decimal(1e12))).toBe(0);
  });

  it("sets aside its share of what you earn and spends it feeding the bottleneck, quietly", () => {
    const state = starved();
    const logBefore = state.log.length;
    const effBefore = chainStatus(state).efficiency;
    const levels = tendChain(state, new Decimal(1e9));
    expect(levels).toBeGreaterThan(0);
    expect(chainStatus(state).efficiency).toBeGreaterThan(effBefore);
    expect(state.log.length).toBe(logBefore); // no log line per level
    // It never spends more than it was given: a quarter of 1e9.
    expect(new Decimal(1e12).sub(state.lumen).toNumber()).toBeLessThanOrEqual(0.25e9 + 1);
  });

  it("stops at its target and does nothing when switched off", () => {
    const state = starved();
    state.stewardTarget = 0.8;
    // Tick by tick, as in the game (its purse holds at most 10 minutes of production).
    for (let i = 0; i < 500 && chainStatus(state).efficiency < 0.8; i++) tendChain(state, new Decimal(1e10));
    expect(chainStatus(state).efficiency).toBeGreaterThanOrEqual(0.8);
    expect(chainStatus(state).efficiency).toBeLessThan(0.95);
    const off = starved();
    off.stewardOn = false;
    expect(tendChain(off, new Decimal(1e13))).toBe(0);
    expect(off.lumen.toNumber()).toBe(1e12);
  });

  it("raises the Beam with its whole purse once the chain is fed", () => {
    const state = starved();
    fillChain(state, 1); // the chain at 100%, the Steward's target
    state.stewardPurse = productionPerSecond(state).mul(STEWARD_PURSE_CAP_SECONDS);
    const beamBefore = totalBeamLevels(state);
    expect(tendChain(state, new Decimal(0))).toBeGreaterThan(0);
    expect(totalBeamLevels(state)).toBeGreaterThan(beamBefore);
    // It spent until the next Beam level cost more than what was left.
    const board = cheapestBoardFor(state, "beam")!;
    expect(state.stewardPurse.lt(nodeCost(board, "beam", state.chainBoards[board].beam, state))).toBe(true);
  });

  it("keeps the Beam in step while it feeds: the cheaper of the two comes first", () => {
    const state = starved();
    state.stewardTarget = 1;
    let beam = 0;
    let supply = 0;
    for (let i = 0; i < 200 && chainStatus(state).efficiency < 1; i++) {
      const before = totalBeamLevels(state);
      const bought = tendChain(state, new Decimal(1e9));
      beam += totalBeamLevels(state) - before;
      supply += bought - (totalBeamLevels(state) - before);
    }
    expect(chainStatus(state).efficiency).toBeGreaterThanOrEqual(1);
    expect(supply).toBeGreaterThan(0);
    expect(beam).toBeGreaterThan(0); // Beam levels came along before the chain was full
  });

  it("leaves the Beam alone when switched off, or while the chain is short", () => {
    const off = starved();
    fillChain(off, 1);
    off.stewardBeam = false;
    off.stewardPurse = productionPerSecond(off).mul(STEWARD_PURSE_CAP_SECONDS);
    const beamOff = totalBeamLevels(off);
    tendChain(off, new Decimal(0));
    expect(totalBeamLevels(off)).toBe(beamOff);

    const short = starved(1e3); // too poor to feed: the chain stays starved
    short.stewardPurse = new Decimal(1e3);
    const beamShort = totalBeamLevels(short);
    tendChain(short, new Decimal(0));
    expect(totalBeamLevels(short)).toBe(beamShort);
  });

  it("its purse never holds more than ten minutes of production", () => {
    const state = starved(0); // nothing to spend: everything stays in the purse
    tendChain(state, new Decimal("1e30"));
    expect(state.stewardPurse.toNumber()).toBeCloseTo(productionPerSecond(state).mul(STEWARD_PURSE_CAP_SECONDS).toNumber(), 0);
  });

  it("saves keep its settings; a v10 save gets the defaults; junk never bricks a save", () => {
    const state = starved();
    state.stewardOn = false;
    state.stewardShare = 0.5;
    state.stewardTarget = 0.9;
    state.stewardPurse = new Decimal(1234);
    const restored = deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!;
    expect([restored.stewardOn, restored.stewardShare, restored.stewardTarget, restored.stewardPurse.toNumber()]).toEqual([false, 0.5, 0.9, 1234]);
    const v10 = { ...serializeState(createInitialState()), version: 10 } as Record<string, unknown>;
    for (const k of ["stewardOn", "stewardShare", "stewardTarget", "stewardPurse"]) delete v10[k];
    const fresh = deserializeState(v10)!;
    expect([fresh.stewardOn, fresh.stewardShare, fresh.stewardTarget, fresh.stewardPurse.toNumber()]).toEqual([true, 0.25, 1, 0]);
    const junk = deserializeState({ ...serializeState(createInitialState()), stewardShare: 7, stewardTarget: "x", stewardPurse: "banana" })!;
    expect([junk.stewardShare, junk.stewardTarget, junk.stewardPurse.toNumber()]).toEqual([0.25, 1, 0]);
  });
});
