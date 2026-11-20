import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { GULL_ROCK_ID } from "../src/game/config";
import { GUIDE_OPENING, GUIDE_PAGE_IDS, GUIDE_TIDES_SECONDS, dueGuidePage, markGuideSeen } from "../src/game/guide";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import { tutorialPages } from "../src/ui/tutorial";

// The guide a page at a time (game/guide.ts).

function readOpening() {
  const state = createInitialState(0);
  markGuideSeen(state, GUIDE_OPENING);
  return state;
}

describe("the guide, a page at a time", () => {
  it("has a page id for every page of the tutorial, in the same order", () => {
    expect(tutorialPages()).toHaveLength(GUIDE_PAGE_IDS.length);
    expect(tutorialPages()[0].title).toBe("Welcome to Candlewick Point");
  });

  it("a new keeper reads the opening; nothing else is due before its time", () => {
    const fresh = createInitialState(0);
    expect(fresh.guideSeen).toEqual([]);
    expect(dueGuidePage(fresh)).toBe("welcome");
    expect(dueGuidePage(readOpening())).toBeNull();
  });

  it("each page comes due with its part of the game, one at a time, in the guide's order", () => {
    const state = readOpening();
    state.generators["candle-crab"] = 10; // a lesson to learn, and the chain wakes
    expect(dueGuidePage(state)).toBe("upgrades");
    markGuideSeen(state, ["upgrades"]);
    expect(dueGuidePage(state)).toBe("chain");
    markGuideSeen(state, ["chain"]);
    expect(dueGuidePage(state)).toBeNull();
    state.generators["lantern-moth"] = 1; // moths come home
    expect(dueGuidePage(state)).toBe("shore");
    markGuideSeen(state, ["shore"]);
    state.lumen = new Decimal(500_000); // a tenth of Gull Rock
    expect(dueGuidePage(state)).toBe("lighthouses");
    markGuideSeen(state, ["lighthouses"]);
    state.lifetimeLumen = new Decimal(500_000); // √(500,000 / 5,000) = 10 Embers
    expect(dueGuidePage(state)).toBe("rekindle");
    markGuideSeen(state, ["rekindle"]);
    state.playTimeSeconds = GUIDE_TIDES_SECONDS;
    expect(dueGuidePage(state)).toBe("tides");
    markGuideSeen(state, ["tides"]);
    expect(dueGuidePage(state)).toBeNull();
  });

  it("a keeper who has lit Gull Rock already knows the lighthouses are there", () => {
    const state = readOpening();
    markGuideSeen(state, ["upgrades", "chain"]);
    state.litLighthouses.push(GULL_ROCK_ID);
    expect(dueGuidePage(state)).toBe("lighthouses");
  });

  it("saves what was read; a save from before read the whole guide up front", () => {
    const state = readOpening();
    expect(deserializeState(JSON.parse(JSON.stringify(serializeState(state))))!.guideSeen).toEqual([...GUIDE_OPENING]);
    const old = serializeState(createInitialState(0)) as unknown as Record<string, unknown>;
    old.version = 13;
    delete old.guideSeen;
    expect(deserializeState(old)!.guideSeen).toEqual([...GUIDE_PAGE_IDS]);
    const junk = serializeState(createInitialState(0)) as unknown as Record<string, unknown>;
    junk.guideSeen = ["welcome", "nonsense", 7];
    expect(deserializeState(junk)!.guideSeen).toEqual(["welcome"]);
  });
});
