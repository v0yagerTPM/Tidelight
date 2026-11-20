import Decimal from "break_infinity.js";

export type Notation = "standard" | "scientific";

const SUFFIXES = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

function toDecimal(value: Decimal | number | string): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** 1.53e24 style, always two decimal places on the mantissa. */
function eNotation(d: Decimal): string {
  if (d.eq(0)) return "0";
  const exponent = Math.floor(d.log10());
  const mantissa = d.div(new Decimal(10).pow(exponent));
  return `${mantissa.toFixed(2)}e${exponent}`;
}

/**
 * Format a Lumen-style quantity.
 * Standard: full digits under 1000, then 1.50K / 2.34M / 5.67B / 8.90T,
 * then e-notation once the named suffixes run out.
 * Scientific: e-notation for anything ≥ 1000.
 */
export function formatNumber(value: Decimal | number | string, notation: Notation = "standard"): string {
  const d = toDecimal(value);
  if (d.lt(0)) return `-${formatNumber(d.neg(), notation)}`;
  if (d.lt(1000)) {
    // Whole numbers print plain; fractional early-game values get one decimal.
    return Number.isInteger(d.toNumber()) ? d.toFixed(0) : d.toFixed(1);
  }
  if (notation === "scientific") return eNotation(d);

  const tier = Math.floor(d.log10() / 3); // 1 = K, 2 = M, …
  if (tier - 1 < SUFFIXES.length) {
    const scaled = d.div(new Decimal(10).pow(tier * 3));
    return `${scaled.toFixed(2)}${SUFFIXES[tier - 1]}`;
  }
  return eNotation(d);
}

/** "45s", "3m 05s", "1h 20m", "2d 4h" — for time-to-afford and offline reports. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "—";
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

/**
 * The longest wait a time-to-afford note spells out. Past a day the number
 * stops meaning anything ("affordable in 16807078d 15h" for a lighthouse
 * one relight too far), so the note says so plainly instead.
 */
export const AFFORD_HORIZON_SECONDS = 86_400;

/** "affordable in 3m 05s", or "more than a day away at this rate" past the horizon. */
export function affordableIn(seconds: number): string {
  return seconds > AFFORD_HORIZON_SECONDS ? "more than a day away at this rate" : `affordable in ${formatDuration(seconds)}`;
}

/** "a Tide Bell", "an Oil Keeper": the indefinite article for a name. */
export function withArticle(name: string): string {
  return `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`;
}
