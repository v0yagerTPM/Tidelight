// ── What it takes to fill the Wing Almanac (balance tooling) ─────────────────
// Runs scripts/almanacSim.ts many times for each keeper scenario and writes
// a summary (JSON) for the report: days to finish, the Almanac's progress
// over time, when each page tends to fill and how, and the lure and cocoon
// counts. Also writes the exact breeding and lure odds.
//
//   npx vite-node scripts/almanac.ts                 every scenario, 60 runs each
//   SCEN=devoted RUNS=200 npx vite-node scripts/almanac.ts
//   OUT=out/almanac npx vite-node scripts/almanac.ts (default: out/almanac)
//
// One file per scenario (<OUT>/<id>.json) plus <OUT>/odds.json, so scenarios
// can run in parallel, one process each.

import { mkdirSync, writeFileSync } from "node:fs";
import { ALMANAC_PATTERNS, ALMANAC_SIZE, ALMANAC_TRAITS } from "../src/game/almanac";
import { MOTH_PATTERNS, SCENTED_LURE_SCALES, WILD_TRAIT_CHANCE, patternByTier } from "../src/game/moths";
import { MOTH_TRAITS } from "../src/game/mothTraits";
import type { Moth } from "../src/game/types";
import { childTierOdds } from "./breedingOdds";
import { ALMANAC_KEYS, type AlmanacRun, type AlmanacScenario, type Source, simulateAlmanac } from "./almanacSim";

const late = { roostExpansions: 7, mothLantern: true, quickLures: 20, spinningSilk: 20, endingSeen: true, maxDays: 365 };
const fresh = { roostExpansions: 0, mothLantern: false, quickLures: 0, spinningSilk: 0, endingSeen: true, maxDays: 365 };

export const SCENARIOS: AlmanacScenario[] = [
  { id: "devoted", name: "Devoted (late game): every 10 min, 16 h a day", checkMinutes: 10, wakingHours: 16, ...late },
  { id: "engaged", name: "Engaged (late game): every hour, 16 h a day", checkMinutes: 60, wakingHours: 16, ...late },
  { id: "casual", name: "Casual (late game): every 4 h, 16 h a day", checkMinutes: 240, wakingHours: 16, ...late },
  { id: "devoted-fresh", name: "Devoted, no Ember-shop help, a 6-moth roost", checkMinutes: 10, wakingHours: 16, ...fresh },
  { id: "engaged-fresh", name: "Engaged, no Ember-shop help, a 6-moth roost", checkMinutes: 60, wakingHours: 16, ...fresh },
  { id: "every-30", name: "Late game, every 30 min", checkMinutes: 30, wakingHours: 16, ...late },
  { id: "every-120", name: "Late game, every 2 h", checkMinutes: 120, wakingHours: 16, ...late },
];

const quantile = (xs: number[], q: number) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo);
};

export function summarize(sc: AlmanacScenario, runs: AlmanacRun[]) {
  const done = runs.map((r) => r.daysToComplete).filter((d): d is number => d !== null);
  const sources: Record<Source, number> = { lure: 0, scented: 0, bred: 0, tidelit: 0, hollow: 0, rider: 0 };
  for (const r of runs) for (const s of Object.values(r.sourceOf)) sources[s]++;
  const perKey = Object.fromEntries(
    ALMANAC_KEYS.map((k) => {
      const days = runs.map((r) => r.filledAt[k]).filter((d): d is number => d !== undefined);
      const by: Partial<Record<Source, number>> = {};
      for (const r of runs) if (r.sourceOf[k]) by[r.sourceOf[k]] = (by[r.sourceOf[k]] ?? 0) + 1;
      return [k, { median: quantile(days, 0.5), p90: quantile(days, 0.9), filledShare: days.length / runs.length, by }];
    }),
  );
  // Pages filled by day d: median and the 10th/90th percentile across runs.
  const horizon = Math.ceil(Math.max(...runs.map((r) => r.daysToComplete ?? sc.maxDays)));
  const progress = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const d = (horizon * i) / steps;
    const counts = runs.map((r) => r.daysAtCount.filter((x, n) => n > 0 && x <= d).length);
    progress.push({ day: d, p10: quantile(counts, 0.1), median: quantile(counts, 0.5), p90: quantile(counts, 0.9) });
  }
  // Days to reach each Almanac reward and each page count.
  const daysToCount = Array.from({ length: ALMANAC_SIZE + 1 }, (_, n) => {
    const days = runs.map((r) => r.daysAtCount[n]).filter((d): d is number => d !== undefined);
    return { pages: n, median: quantile(days, 0.5), p10: quantile(days, 0.1), p90: quantile(days, 0.9), share: days.length / runs.length };
  });
  const mean = (f: (r: AlmanacRun) => number) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  return {
    scenario: sc,
    runs: runs.length,
    completed: done.length,
    days: { p10: quantile(done, 0.1), median: quantile(done, 0.5), p90: quantile(done, 0.9), min: quantile(done, 0), max: quantile(done, 1) },
    completionDays: done,
    sources,
    perKey,
    progress,
    daysToCount,
    perRun: { lures: mean((r) => r.lures), scented: mean((r) => r.scented), hatches: mean((r) => r.hatches), releases: mean((r) => r.releases), releaseActions: mean((r) => r.releaseActions), autoReleases: mean((r) => r.autoReleases ?? 0), bottles: mean((r) => r.bottles), stormHolds: mean((r) => r.stormHolds) },
  };
}

/** The exact odds the report shows beside the simulation. */
export function odds() {
  const totalWeight = MOTH_PATTERNS.reduce((s, p) => s + p.weight, 0);
  const wild = MOTH_PATTERNS.filter((p) => p.weight > 0).map((p) => ({
    pattern: p.id,
    name: p.name,
    pattern_p: p.weight / totalWeight,
    // A given trait page from a plain lure, and from a scented one.
    perTraitLure: (p.weight / totalWeight) * (WILD_TRAIT_CHANCE / MOTH_TRAITS.length),
    noTraitLure: (p.weight / totalWeight) * (1 - WILD_TRAIT_CHANCE),
    perTraitScented: (p.weight / totalWeight) / MOTH_TRAITS.length,
  }));
  const tiers = [0, 1, 2, 3, 4, 5];
  const moth = (tier: number): Moth => ({ id: `t${tier}`, name: "", pattern: patternByTier(tier).id, glow: 50, generation: 1 });
  const breeding = tiers.flatMap((a) =>
    tiers.filter((b) => b >= a).map((b) => ({
      a: patternByTier(a).name,
      b: patternByTier(b).name,
      child: Object.fromEntries([...childTierOdds(moth(a), moth(b))].map(([t, p]) => [patternByTier(t).name, p])),
    })),
  );
  return {
    wild,
    breeding,
    constants: { wildTraitChance: WILD_TRAIT_CHANCE, scentedScales: SCENTED_LURE_SCALES, traits: MOTH_TRAITS.length, patterns: ALMANAC_PATTERNS, traitColumns: ALMANAC_TRAITS },
  };
}

{
  const out = process.env.OUT ?? "out/almanac";
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/odds.json`, JSON.stringify(odds(), null, 1));
  const runsPer = Number(process.env.RUNS ?? 60);
  const chosen = SCENARIOS.filter((s) => !process.env.SCEN || process.env.SCEN.split(",").includes(s.id));
  for (const sc of chosen) {
    const t0 = Date.now();
    const runs: AlmanacRun[] = [];
    for (let seed = 1; seed <= runsPer; seed++) runs.push(simulateAlmanac(sc, seed * 7919));
    const summary = summarize(sc, runs);
    writeFileSync(`${out}/${sc.id}.json`, JSON.stringify(summary));
    const d = summary.days;
    console.log(
      `${sc.id.padEnd(14)} ${summary.completed}/${runs.length} finished · days p10 ${d.p10?.toFixed(1)} median ${d.median?.toFixed(1)} p90 ${d.p90?.toFixed(1)} · ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    );
  }
}
