import { afterAll, beforeAll } from "vitest";
import { FIRST_LIGHT_WARMTH } from "../src/game/config";

/**
 * Pins First Light's starting warmth at ×1 for a whole test file, so the
 * file can check chain math (tides, relics, perks, gates, posts) against
 * the plain 20 / 15 / 10 Lumen/s that level 1 supports. The warmth itself
 * is tested in tests/openingChain.test.ts.
 */
export function atBaseWarmth(): void {
  let saved = FIRST_LIGHT_WARMTH.factor;
  beforeAll(() => {
    saved = FIRST_LIGHT_WARMTH.factor;
    FIRST_LIGHT_WARMTH.factor = 1;
  });
  afterAll(() => {
    FIRST_LIGHT_WARMTH.factor = saved;
  });
}
