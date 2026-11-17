// ── Seeded RNG (Sprint 4) ────────────────────────────────────────────────────
// A tiny deterministic PRNG (mulberry32). Every random system in Sprint 4 —
// moth attracting/breeding, expedition relic rolls, tide selection — takes
// an `rng: () => number` parameter returning values in [0, 1). Game code
// passes Math.random; tests pass mulberry32(seed) or hand-built stubs, so
// every outcome is reproducible.

/** mulberry32: a fast, small seeded PRNG. Same seed → same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mix an integer (e.g. a tide time-bucket index) into a well-spread 32-bit
 * seed, so neighbouring buckets land far apart in PRNG space.
 */
export function hashSeed(n: number): number {
  let h = (n >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
