// ── The Almanac report's data files (balance tooling) ────────────────────────
// Turns scripts/almanac.ts's summaries (<IN>/<scenario>.json, <IN>/odds.json)
// into flat row files for the report: one JSON file per table, each
// {rows, meta} with the code that made it in `meta`, so a reader can see how
// every number was worked out.
//
//   IN=out/almanac OUT=out/almanac/report npx vite-node scripts/almanacReport.ts

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const IN = process.env.IN ?? "out/almanac";
const OUT = process.env.OUT ?? `${IN}/report`;
mkdirSync(OUT, { recursive: true });

const code = (file: string) => ({ label: basename(file), value: readFileSync(file, "utf8"), type: "code", lang: "typescript" });
const simMeta = [
  code("scripts/almanacSim.ts"),
  code("scripts/almanac.ts"),
  code("scripts/breedingOdds.ts"),
  code("scripts/almanacReport.ts"),
  { label: "Game rules", value: "src/game/moths.ts, src/game/almanac.ts, src/game/mothTraits.ts, src/game/expeditions.ts, src/game/tides.ts (Tidelight, the build this was run on)" },
];
const oddsMeta = [code("scripts/breedingOdds.ts"), code("scripts/almanac.ts"), code("scripts/almanacReport.ts")];

type Summary = {
  scenario: { id: string; name: string; checkMinutes: number; wakingHours: number; roostExpansions: number; mothLantern: boolean; quickLures: number; spinningSilk: number; maxDays: number };
  runs: number;
  completed: number;
  days: { p10: number | null; median: number | null; p90: number | null };
  completionDays: number[];
  sources: Record<string, number>;
  perKey: Record<string, { median: number | null; p90: number | null; filledShare: number; by: Record<string, number> }>;
  progress: { day: number; p10: number; median: number; p90: number }[];
  daysToCount: { pages: number; median: number | null; p10: number | null; p90: number | null; share: number }[];
  perRun: Record<string, number>;
};

const ORDER = ["devoted", "engaged", "casual", "devoted-fresh", "engaged-fresh", "every-30", "every-120"];
const summaries: Summary[] = readdirSync(IN)
  .filter((f) => f.endsWith(".json") && f !== "odds.json")
  .map((f) => JSON.parse(readFileSync(`${IN}/${f}`, "utf8")) as Summary)
  .sort((a, b) => ORDER.indexOf(a.scenario.id) - ORDER.indexOf(b.scenario.id));

const nests = (expansions: number) => Math.min(4, 2 + Math.floor(expansions / 3));
const round = (x: number | null, d = 3) => (x === null ? null : Number(x.toFixed(d)));
const write = (name: string, rows: unknown[], meta: unknown[]) => {
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ rows, meta }));
  console.log(`${name}: ${rows.length} rows`);
};

// One row per keeper: who they are, and what it took.
write(
  "scenarios",
  summaries.map((s) => ({
    scenario: s.scenario.id,
    name: s.scenario.name,
    check_minutes: s.scenario.checkMinutes,
    waking_hours: s.scenario.wakingHours,
    roost_expansions: s.scenario.roostExpansions,
    roost_size: 6 + 2 * s.scenario.roostExpansions,
    nests: nests(s.scenario.roostExpansions),
    ember_shop: s.scenario.mothLantern ? "Moth Lantern, Quick Lures 20, Spinning Silk 20" : "none",
    max_days: s.scenario.maxDays,
    runs: s.runs,
    finished: s.completed,
    finished_share: round(s.completed / s.runs),
    days_p10: round(s.days.p10, 1),
    days_median: round(s.days.median, 1),
    days_p90: round(s.days.p90, 1),
    lures: round(s.perRun.lures, 0),
    scented_lures: round(s.perRun.scented, 0),
    hatches: round(s.perRun.hatches, 0),
    releases: round(s.perRun.releases, 0),
    bottles: round(s.perRun.bottles, 0),
    storm_holds: round(s.perRun.stormHolds, 0),
  })),
  simMeta,
);

// Every run's finishing day (null when it didn't finish within max_days).
write(
  "runs",
  summaries.flatMap((s) => {
    const done = s.completionDays.map((d) => ({ scenario: s.scenario.id, days: round(d, 2), finished: true }));
    const left = Array.from({ length: s.runs - s.completed }, () => ({ scenario: s.scenario.id, days: null, finished: false }));
    return [...done, ...left];
  }),
  simMeta,
);

// Pages filled over time: the median keeper and the 10th–90th percentile band.
write(
  "progress",
  summaries.flatMap((s) => s.progress.map((p) => ({ scenario: s.scenario.id, day: round(p.day, 4), p10: p.p10, median: p.median, p90: p.p90 }))),
  simMeta,
);

// Each page: when it tends to fill, and how.
write(
  "pages",
  summaries.flatMap((s) =>
    Object.entries(s.perKey).map(([key, v]) => {
      const [pattern, trait] = key.split(":");
      const top = Object.entries(v.by).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { scenario: s.scenario.id, page: key, pattern, trait, median_days: round(v.median, 3), p90_days: round(v.p90, 3), filled_share: round(v.filledShare), usual_source: top };
    }),
  ),
  simMeta,
);

// How pages were filled, on average per keeper.
write(
  "sources",
  summaries.flatMap((s) => Object.entries(s.sources).map(([source, n]) => ({ scenario: s.scenario.id, source, pages: round(n / s.runs, 2) }))),
  simMeta,
);

// Days to each Almanac reward (6, 12, 24, 36, 49 pages) and to the full book.
const REWARDS: Record<number, string> = { 6: "A Deeper Bank", 12: "A Fourth Wing", 24: "Warm Silk", 36: "Sweet Oil", 49: "Every Living Wing", 56: "The Hollow Pages" };
write(
  "milestones",
  summaries.flatMap((s) =>
    s.daysToCount
      .filter((d) => REWARDS[d.pages])
      .map((d) => ({ scenario: s.scenario.id, pages: d.pages, reward: REWARDS[d.pages], days_median: round(d.median, 3), days_p10: round(d.p10, 3), days_p90: round(d.p90, 3), reached_share: round(d.share) })),
  ),
  simMeta,
);

// The exact odds.
const odds = JSON.parse(readFileSync(`${IN}/odds.json`, "utf8"));
write(
  "wild_odds",
  odds.wild.map((w: { name: string; pattern_p: number; perTraitLure: number; noTraitLure: number; perTraitScented: number }) => ({
    pattern: w.name,
    pattern_share: round(w.pattern_p, 4),
    lures_per_no_trait_page: round(1 / w.noTraitLure, 1),
    lures_per_trait_page: round(1 / w.perTraitLure, 1),
    scented_per_trait_page: round(1 / w.perTraitScented, 1),
  })),
  oddsMeta,
);
write(
  "breed_odds",
  odds.breeding
    .filter((b: { a: string; b: string }) => b.a === b.b)
    .flatMap((b: { a: string; child: Record<string, number> }) => Object.entries(b.child).map(([child, p]) => ({ parents: `${b.a} × ${b.a}`, child, p: round(p, 4) }))),
  oddsMeta,
);
