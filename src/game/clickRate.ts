import Decimal from "break_infinity.js";

// ── Flash rate: what your own hands add per second ───────────────────────────
// The header's "per second" should count the keeper too: while you flash the
// beam, the Lumen those flashes bring in is averaged over the last few
// seconds and added to what the helpers make. Stop flashing and it fades out
// within the window. Display only: nothing else (offline, Rekindle estimates,
// the supply chain's demand) counts flashes as production.

/** How far back flashes count toward the rate. */
export const FLASH_WINDOW_MS = 3000;
/** The shortest span a burst is averaged over, so a single flash doesn't read as a huge rate. */
const MIN_SPAN_MS = 1000;

export class FlashRate {
  private times: number[] = [];
  private values: Decimal[] = [];

  /** Record one flash worth `value` Lumen at `now`. */
  add(now: number, value: Decimal): void {
    if (value.lte(0)) return;
    this.times.push(now);
    this.values.push(value);
    this.prune(now);
  }

  /** Lumen per second from recent flashes (0 once you stop for the whole window). */
  rate(now: number): Decimal {
    this.prune(now);
    if (this.times.length === 0) return new Decimal(0);
    let sum = new Decimal(0);
    for (const v of this.values) sum = sum.add(v);
    const span = Math.min(FLASH_WINDOW_MS, Math.max(MIN_SPAN_MS, now - this.times[0]));
    return sum.mul(1000 / span);
  }

  clear(): void {
    this.times = [];
    this.values = [];
  }

  private prune(now: number): void {
    let drop = 0;
    while (drop < this.times.length && now - this.times[drop] >= FLASH_WINDOW_MS) drop++;
    if (drop > 0) {
      this.times.splice(0, drop);
      this.values.splice(0, drop);
    }
  }
}
