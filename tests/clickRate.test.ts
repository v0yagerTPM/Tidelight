import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { FLASH_WINDOW_MS, FlashRate } from "../src/game/clickRate";

describe("flash rate", () => {
  it("is zero with no flashes", () => {
    expect(new FlashRate().rate(0).toNumber()).toBe(0);
  });

  it("averages a steady burst of flashes over the window", () => {
    const r = new FlashRate();
    // 5 flashes a second worth 10 each for the whole window = 50/s.
    for (let t = 0; t < FLASH_WINDOW_MS; t += 200) r.add(t, new Decimal(10));
    expect(r.rate(FLASH_WINDOW_MS - 1).toNumber()).toBeCloseTo(50, 0);
  });

  it("doesn't read one flash as a huge rate", () => {
    const r = new FlashRate();
    r.add(1000, new Decimal(10));
    expect(r.rate(1000).toNumber()).toBe(10); // averaged over at least a second
  });

  it("fades to zero once you stop", () => {
    const r = new FlashRate();
    r.add(0, new Decimal(10));
    r.add(100, new Decimal(10));
    expect(r.rate(500).gt(0)).toBe(true);
    expect(r.rate(100 + FLASH_WINDOW_MS).toNumber()).toBe(0);
  });

  it("ignores flashes worth nothing (Still Hands)", () => {
    const r = new FlashRate();
    r.add(0, new Decimal(0));
    expect(r.rate(10).toNumber()).toBe(0);
  });
});
