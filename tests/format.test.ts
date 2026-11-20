import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { affordableIn, formatDuration, formatNumber, withArticle } from "../src/game/format";

describe("formatNumber (standard)", () => {
  it("prints full digits under 1000", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(15)).toBe("15");
    expect(formatNumber(999)).toBe("999");
  });

  it("uses K/M/B/T suffixes with two decimals", () => {
    expect(formatNumber(1500)).toBe("1.50K");
    expect(formatNumber(2_340_000)).toBe("2.34M");
    expect(formatNumber(new Decimal("5.67e9"))).toBe("5.67B");
    expect(formatNumber(new Decimal("8.9e12"))).toBe("8.90T");
  });

  it("falls back to e-notation past the named suffixes", () => {
    // 1e36 is past Dc (1e33 tier); expect mantissa e-notation.
    expect(formatNumber(new Decimal("1.53e36"))).toBe("1.53e36");
    expect(formatNumber(new Decimal("1.53e24"))).toBe("1.53Sp"); // still named at 1e24
  });
});

describe("formatNumber (scientific)", () => {
  it("uses e-notation for anything ≥ 1000", () => {
    expect(formatNumber(1500, "scientific")).toBe("1.50e3");
    expect(formatNumber(999, "scientific")).toBe("999");
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes, hours, days", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(185)).toBe("3m 05s");
    expect(formatDuration(4800)).toBe("1h 20m");
    expect(formatDuration(190_000)).toBe("2d 4h");
    expect(formatDuration(Infinity)).toBe("—");
  });
});

describe("affordableIn and withArticle", () => {
  it("spells out waits up to a day, and says so plainly past it", () => {
    expect(affordableIn(45)).toBe("affordable in 45s");
    expect(affordableIn(86_400)).toBe("affordable in 1d 0h");
    expect(affordableIn(86_401)).toBe("more than a day away at this rate");
    expect(affordableIn(1.45e12)).toBe("more than a day away at this rate");
  });

  it("puts an before a vowel", () => {
    expect(withArticle("Oil Keeper")).toBe("an Oil Keeper");
    expect(withArticle("Tide Bell")).toBe("a Tide Bell");
  });
});
