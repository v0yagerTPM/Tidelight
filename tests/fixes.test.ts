import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { GULL_ROCK_ID } from "../src/game/config";
import { lighthouseStatus, relightLighthouse } from "../src/game/chain";
import { LIVE_GAP_LIMIT_SECONDS, advanceToNow, productionPerSecond } from "../src/game/engine";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";
import { TIDE_BUCKET_MS, tideAt, type TideId } from "../src/game/tides";

// Regression tests for the bugs found in the post-Sprint-5 playtest.

function firstBucketWith(id: TideId, from = 1_700_000_000_000): number {
  let t = from;
  while (tideAt(t).def.id !== id) t += TIDE_BUCKET_MS;
  return t + 1_000;
}

describe("save sanitizing drops ids this build doesn't know", () => {
  it("unknown perks, upgrades, relics, challenges, story beats and generators are filtered out", () => {
    const state = createInitialState();
    state.emberPerks = ["head-start"];
    state.upgrades = [];
    const raw = serializeState(state) as unknown as Record<string, unknown>;
    raw.emberPerks = ["head-start", "warm-lamp-oil", "head-start", 7];
    raw.upgrades = ["not-an-upgrade"];
    raw.relics = ["brass-compass", "moon-in-a-jar"];
    raw.activeChallenge = "underwater-basket-weaving";
    raw.completedChallenges = ["fogbound", "nope"];
    raw.storySeen = ["not-a-beat"];
    raw.generators = { "candle-crab": 3.7, "laser-shark": 12, "lantern-moth": "lots" };
    raw.log = [{ at: 1, message: "ok" }, { at: "x" }, null];

    const loaded = deserializeState(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.emberPerks).toEqual(["head-start"]);
    expect(loaded!.upgrades).toEqual([]);
    expect(loaded!.relics).toEqual(["brass-compass"]);
    expect(loaded!.activeChallenge).toBeNull();
    expect(loaded!.completedChallenges).toEqual(["fogbound"]);
    expect(loaded!.storySeen).toEqual([]);
    expect(loaded!.generators).toEqual({ "candle-crab": 3 });
    expect(loaded!.log).toEqual([{ at: 1, message: "ok" }]);
    // And the loaded state is safe to run: this used to throw every tick.
    expect(() => productionPerSecond(loaded!)).not.toThrow();
  });
});

describe("relighting reads the same tide as the Relight button", () => {
  function lowTideCase() {
    const state = createInitialState();
    state.generators["candle-crab"] = 10;
    state.generators["tide-bell"] = 1; // 22/s demand; lens supports 10/s → 45% neutral
    state.lumen = new Decimal(3_000_000);
    return state;
  }

  it("Low Tide's support can open the gate, and the action agrees with the button", () => {
    const now = firstBucketWith("low");
    const state = lowTideCase();
    expect(lighthouseStatus(state, GULL_ROCK_ID).canRelight).toBe(false); // neutral: 45%
    expect(lighthouseStatus(state, GULL_ROCK_ID, now).canRelight).toBe(true); // Low Tide: 54%
    expect(relightLighthouse(state, GULL_ROCK_ID, now)).toBe(true);
  });

  it("without a time the gate stays tide-neutral (sim and tests)", () => {
    expect(relightLighthouse(lowTideCase(), GULL_ROCK_ID)).toBe(false);
  });
});

describe("advanceToNow — real time while the page is open", () => {
  function running(now: number) {
    const state = createInitialState();
    state.generators["candle-crab"] = 4; // 2/s, chain still asleep
    state.lastSeen = now;
    return state;
  }

  it("a throttled background tick a minute later pays the full minute, not one second", () => {
    const t0 = firstBucketWith("calm"); // calm: no production multiplier
    const state = running(t0);
    const result = advanceToNow(state, t0 + 60_000);
    expect(result.mode).toBe("live");
    expect(result.gain.toNumber()).toBeCloseTo(120, 6);
    expect(state.lastSeen).toBe(t0 + 60_000);
  });

  it("a gap longer than the live limit pays by the offline rules", () => {
    const t0 = firstBucketWith("calm");
    const state = running(t0);
    const hour = 3_600_000;
    const result = advanceToNow(state, t0 + hour);
    expect(LIVE_GAP_LIMIT_SECONDS).toBeLessThan(3600);
    expect(result.mode).toBe("offline");
    expect(result.gain.toNumber()).toBeCloseTo(2 * 3600 * 0.5, 6); // 50% offline rate
    expect(state.lastSeen).toBe(t0 + hour);
  });

  it("a clock that runs backwards credits nothing", () => {
    const t0 = firstBucketWith("calm");
    const state = running(t0);
    expect(advanceToNow(state, t0 - 5_000).gain.toNumber()).toBe(0);
  });
});
