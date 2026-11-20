// What is a system worth in hours? (Balance tooling, not part of the game or CI.)
// Runs the sim's plain bot with one thing granted, from the first second or
// on a schedule, and prints when each lighthouse lights. Compare against
// SCEN=plain. Several can run at once, one per core:
//   SCEN=moths3 npx vite-node scripts/worth.ts
// Scenarios:
//   plain       the pessimistic bot (npm run sim's first line)
//   moths3      three glow-100 moths on duty from the first second
//   relics      all eight relics; compass / amber / chart: one each
//   challenges  all three challenge rewards
//   all         moths3 + relics + challenges, from the first second
//   engaged     an engaged keeper: moths brighten, relics and challenge
//               rewards arrive over the hours (the schedule below)
import { CHAIN_LIGHTHOUSES } from "../src/game/config";
import { RELICS } from "../src/game/expeditions";
import type { GameState, Moth } from "../src/game/types";
import { runSim } from "./simCore";

const moth = (i: number, glow: number): Moth => ({ id: `m${i}`, name: `M${i}`, pattern: "prismatic", glow, generation: 1 });
const duty = (n: number, glow: number) => (s: GameState) => {
  s.moths = Array.from({ length: n }, (_, i) => moth(i, glow));
  s.mothDuty = s.moths.map((m) => m.id);
};
const ALL_CHALLENGES = ["fogbound", "still-hands", "first-light-only"];

const scenarios: Record<string, (s: GameState) => void> = {
  plain: () => {},
  moths3: duty(3, 100),
  relics: (s) => {
    s.relics = RELICS.map((r) => r.id);
  },
  compass: (s) => {
    s.relics = ["brass-compass"];
  },
  amber: (s) => {
    s.relics = ["amber-heart"];
  },
  chart: (s) => {
    s.relics = ["tide-chart"];
  },
  challenges: (s) => {
    s.completedChallenges = [...ALL_CHALLENGES];
  },
  all: (s) => {
    duty(3, 100)(s);
    s.relics = RELICS.map((r) => r.id);
    s.completedChallenges = [...ALL_CHALLENGES];
  },
};

// An engaged keeper: three moths on duty whose glow climbs with breeding,
// a relic every 2.5 hours, and the three challenges done at 3, 8 and 14 hours.
const GLOW: [number, number][] = [[0, 20], [1, 30], [3, 50], [6, 60], [12, 70], [24, 85], [40, 100]];
const RELIC_ORDER = ["tide-chart", "brass-compass", "salt-lens", "keepers-coat", "gull-feather", "amber-heart", "driftwood-cradle", "storm-in-a-bottle"];
const CHALLENGE_AT: [number, string][] = [[3, "still-hands"], [8, "fogbound"], [14, "first-light-only"]];
function engaged(s: GameState, hours: number): void {
  const glow = GLOW.filter(([t]) => hours >= t).pop()![1];
  if (s.moths.length === 0 || s.moths[0].glow !== glow) duty(3, glow)(s);
  const relics = Math.min(RELIC_ORDER.length, Math.floor(hours / 2.5));
  if (s.relics.length < relics) s.relics = RELIC_ORDER.slice(0, relics);
  for (const [t, id] of CHALLENGE_AT) if (hours >= t && !s.completedChallenges.includes(id)) s.completedChallenges.push(id);
}

const name = process.env.SCEN ?? "plain";
if (name !== "engaged" && !scenarios[name]) throw new Error(`Unknown SCEN ${name}: try ${[...Object.keys(scenarios), "engaged"].join(", ")}`);
const r = name === "engaged" ? runSim({ during: engaged }) : runSim({ setup: scenarios[name] });
const lit = CHAIN_LIGHTHOUSES.slice(1).map((l) => r.litAtHours[l.id]?.toFixed(1) ?? "—").join(" / ");
console.log(`${name.padEnd(11)} lit ${lit} · ending ${r.endingHours?.toFixed(1)}h · first Rekindle ${r.firstRekindleMinutes?.toFixed(0)}m`);
