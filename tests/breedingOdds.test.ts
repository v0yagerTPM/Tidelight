import { describe, expect, it } from "vitest";
import { childOutcomes } from "../src/game/breedingOdds";
import { hatchCocoon, startBreeding } from "../src/game/moths";
import { mulberry32 } from "../src/game/rng";
import { createInitialState } from "../src/game/state";
import { TIDE_BUCKET_MS, tideAt } from "../src/game/tides";
import type { Moth } from "../src/game/types";

// src/game/breedingOdds.ts works the cocoon odds out from the rules; these
// tests sample the game's own hatchCocoon and check the two agree.

function sample(a: Moth, b: Moth, n: number, opts: { storm: boolean; endingSeen: boolean }): Map<string, number> {
  const rng = mulberry32(7);
  let at = 0;
  while ((tideAt(at).def.id === "storm") !== opts.storm) at += TIDE_BUCKET_MS;
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const state = createInitialState(0);
    state.endingSeen = opts.endingSeen;
    state.roostExpansions = 10;
    state.moths = [{ ...a }, { ...b }];
    startBreeding(state, a.id, b.id, at - 10 * 3_600_000);
    const child = hatchCocoon(state, rng, at)!;
    const keys = [`${child.pattern}:${child.trait ?? "none"}`, ...(child.trait2 ? [`${child.pattern}:${child.trait2}`] : [])].join("+");
    counts.set(keys, (counts.get(keys) ?? 0) + 1);
  }
  for (const [k, c] of counts) counts.set(k, c / n);
  return counts;
}

function exact(a: Moth, b: Moth, opts: { storm: boolean; endingSeen: boolean }): Map<string, number> {
  const out = new Map<string, number>();
  for (const o of childOutcomes(a, b, opts)) {
    const k = o.keys.join("+");
    out.set(k, (out.get(k) ?? 0) + o.p);
  }
  return out;
}

const m = (id: string, pattern: string, glow: number, trait?: string): Moth => ({ id, name: id, pattern, glow, generation: 1, ...(trait ? { trait } : {}) });

describe("breeding odds match the game", () => {
  const cases: [string, Moth, Moth, { storm: boolean; endingSeen: boolean }][] = [
    ["plain × crescent, one trait", m("a", "plain", 20, "seeker"), m("b", "crescent", 40), { storm: false, endingSeen: false }],
    ["starlit × prismatic in a storm, two traits", m("a", "starlit", 60, "fertile"), m("b", "prismatic", 70, "tidewise"), { storm: true, endingSeen: false }],
    ["two perfect prismatics after the ending", m("a", "prismatic", 100, "lamp-loyal"), m("b", "prismatic", 100), { storm: false, endingSeen: true }],
  ];
  for (const [name, a, b, opts] of cases) {
    it(name, () => {
      const n = 40_000;
      const got = sample(a, b, n, opts);
      const want = exact(a, b, opts);
      const total = [...want.values()].reduce((s, p) => s + p, 0);
      expect(total).toBeCloseTo(1, 9);
      for (const k of new Set([...got.keys(), ...want.keys()])) {
        const p = want.get(k) ?? 0;
        const tolerance = 4 * Math.sqrt((p * (1 - p)) / n) + 1e-4;
        expect(Math.abs((got.get(k) ?? 0) - p), k).toBeLessThan(tolerance);
      }
    });
  }
});
