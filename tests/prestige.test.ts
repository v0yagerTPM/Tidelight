import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { generatorById } from "../src/game/config";
import { canRekindle, embersForLifetime, rekindle, rekindleGain } from "../src/game/prestige";
import { createInitialState, deserializeState, serializeState } from "../src/game/state";

describe("prestige formula: floor(sqrt(lifetime / 5000))", () => {
  it("1,000,000 lifetime Lumen → 14 Embers", () => {
    expect(embersForLifetime(1_000_000)).toBe(14);
    expect(embersForLifetime(new Decimal(1_000_000))).toBe(14);
  });

  it("0 (and negative) lifetime → 0 Embers", () => {
    expect(embersForLifetime(0)).toBe(0);
    expect(embersForLifetime(-100)).toBe(0);
  });

  it("first Ember lands exactly at 5,000 lifetime", () => {
    expect(embersForLifetime(4_999)).toBe(0);
    expect(embersForLifetime(5_000)).toBe(1);
  });

  it("40 Embers — the recommended first Rekindle — needs 8,000,000 lifetime", () => {
    expect(embersForLifetime(8_000_000)).toBe(40);
  });
});

describe("rekindle", () => {
  it("resets the run but keeps Embers and stats", () => {
    const state = createInitialState();
    state.lumen = new Decimal(123_456);
    state.lifetimeLumen = new Decimal(1_000_000);
    state.allTimeLumen = new Decimal(2_000_000);
    state.generators[generatorById("candle-crab").id] = 7;
    state.totalClicks = 42;

    expect(canRekindle(state)).toBe(true);
    expect(rekindleGain(state)).toBe(14);
    const gained = rekindle(state);

    expect(gained).toBe(14);
    expect(state.embers).toBe(14);
    expect(state.totalRekindles).toBe(1);
    expect(state.lumen.toNumber()).toBe(0);
    expect(state.lifetimeLumen.toNumber()).toBe(0);
    expect(state.generators).toEqual({});
    // Kept:
    expect(state.allTimeLumen.toNumber()).toBe(2_000_000);
    expect(state.totalClicks).toBe(42);
  });

  it("is a no-op below one Ember", () => {
    const state = createInitialState();
    state.lifetimeLumen = new Decimal(100);
    expect(canRekindle(state)).toBe(false);
    expect(rekindle(state)).toBe(0);
    expect(state.embers).toBe(0);
  });
});

describe("save serialization", () => {
  it("round-trips Decimals as strings with the save version", () => {
    const state = createInitialState(1_700_000_000_000);
    state.lumen = new Decimal("1.23e45");
    state.embers = 7;
    const saved = serializeState(state);
    expect(saved.version).toBe(16); // bumped in Sprint 5 (v13: the Crossing; v14: the guide a page at a time) (v1–v5 saves migrate on load)
    expect(saved.lumen).toBe("1.23e+45"); // break_infinity's string form
    const restored = deserializeState(JSON.parse(JSON.stringify(saved)));
    expect(restored).not.toBeNull();
    expect(restored?.lumen.toString()).toBe("1.23e+45");
    expect(restored?.embers).toBe(7);
    expect(restored?.lastSeen).toBe(1_700_000_000_000);
  });

  it("rejects wrong versions and junk", () => {
    expect(deserializeState({ version: 99 })).toBeNull();
    expect(deserializeState("nope")).toBeNull();
    expect(deserializeState(null)).toBeNull();
  });
});
