// ── Tidelight balance configuration ─────────────────────────────────────────
// Everything numeric lives here so balancing is a data edit, not a code edit.
// Generator cost formula:  cost = ceil(baseCost × growth ^ owned)
// Generator production is linear per copy, doubled at each milestone.

export interface GeneratorDef {
  id: string;
  name: string;
  flavor: string;
  baseCost: number;
  /** Lumen per second produced by one copy, before milestones/bonuses. */
  baseProduction: number;
  /** Cost multiplier applied per copy already owned (1.13–1.15 band). */
  growth: number;
}

export const GENERATORS: readonly GeneratorDef[] = [
  { id: "candle-crab",     name: "Candle Crab",      flavor: "A crab, a candle, a calling.",              baseCost: 15,        baseProduction: 0.5,    growth: 1.15 },
  { id: "lantern-moth",    name: "Lantern Moth",     flavor: "It followed the light home. It stayed.",    baseCost: 120,       baseProduction: 3,      growth: 1.15 },
  { id: "tide-bell",       name: "Tide Bell",        flavor: "It rings for ships that are mostly memory.", baseCost: 1_300,    baseProduction: 17,     growth: 1.15 },
  { id: "oil-keeper",      name: "Oil Keeper",       flavor: "Trims the wick. Keeps the stories.",        baseCost: 14_000,    baseProduction: 95,     growth: 1.15 },
  { id: "lens-polisher",   name: "Lens Polisher",    flavor: "Every lens remembers a horizon.",           baseCost: 170_000,   baseProduction: 540,    growth: 1.14 },
  { id: "storm-lantern",   name: "Storm Lantern",    flavor: "Lit in a gale, on purpose.",                baseCost: 2_100_000, baseProduction: 3_200,  growth: 1.14 },
  { id: "beacon-whale",    name: "Beacon Whale",     flavor: "The sea's oldest lighthouse keeper.",      baseCost: 31_000_000, baseProduction: 19_000, growth: 1.13 },
  { id: "seventh-light",   name: "The Seventh Light", flavor: "You don't hire this one. You become it.", baseCost: 460_000_000, baseProduction: 115_000, growth: 1.13 },
];

export function generatorById(id: string): GeneratorDef {
  const def = GENERATORS.find((g) => g.id === id);
  if (!def) throw new Error(`Unknown generator id: ${id}`);
  return def;
}

// ── Milestones ───────────────────────────────────────────────────────────────
/** Owning at least this many copies of a generator doubles its production. */
export const MILESTONE_THRESHOLDS: readonly number[] = [25, 50, 100];
export const MILESTONE_MULTIPLIER = 2;

/** Total production multiplier a generator gets from its milestone count. */
export function milestoneMultiplier(owned: number): number {
  let mult = 1;
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (owned >= threshold) mult *= MILESTONE_MULTIPLIER;
  }
  return mult;
}

// ── Clicking ─────────────────────────────────────────────────────────────────
export const CLICK_LUMEN = 1;

// ── Prestige: Rekindle ───────────────────────────────────────────────────────
/** Embers gained on Rekindle = floor(sqrt(lifetimeLumenThisRun / DIVISOR)). */
export const PRESTIGE_DIVISOR = 5_000;
/** Designer-recommended point for a first Rekindle (shown in the UI). */
export const PRESTIGE_RECOMMENDED_EMBERS = 40;
/** Production bonus for each Ember held (not spent): +2%. */
export const EMBER_PRODUCTION_BONUS = 0.02;

// ── Offline earnings (Sprint 0 values) ───────────────────────────────────────
export const OFFLINE_CAP_SECONDS = 8 * 60 * 60; // 8 hours
export const OFFLINE_RATE = 0.5; // 50% of online production while away

// ── Supply chain: wick → oil → lens → beam (Sprint 2) ───────────────────────
// Every lit lighthouse has a chain board of four nodes. The three supply
// nodes (wick, oil, lens) each "support" a production rate; if total support
// across all boards falls short of what the generators produce, the beam
// runs at reduced efficiency. Beam nodes add flat production bonus instead.

export type SupplyNodeId = "wick" | "oil" | "lens";
export type ChainNodeId = SupplyNodeId | "beam";

export interface ChainNodeDef {
  id: ChainNodeId;
  name: string;
  flavor: string;
  /** Lumen/s of production one level supports (0 for Beam — it gives a bonus, not support). */
  supportPerLevel: number;
  /** Cost of the first upgrade level (level 0 → 1): ceil(baseCost × growth^level). */
  baseCost: number;
  growth: number;
}

// Node costs/growth were tuned down hard in the Sprint 2 balance pass
// (from 1,000/1.22, 5,000/1.24, 25,000/1.26, 100,000/1.30): support grows
// linearly per level while generator demand grows exponentially, so at the
// original prices the greedy-bot sim rode the 25% floor almost the whole
// run and reached the first Rekindle in 146 min — outside the 40–120 band.
// At these prices it lands at 115.0 min. See docs/SPRINTS.md.
export const CHAIN_NODES: Record<ChainNodeId, ChainNodeDef> = {
  wick: { id: "wick", name: "Wick", flavor: "The flame itself. No wick, no light.", supportPerLevel: 20, baseCost: 100, growth: 1.10 },
  oil:  { id: "oil",  name: "Oil",  flavor: "Fuel for the long night.",              supportPerLevel: 15, baseCost: 200, growth: 1.11 },
  lens: { id: "lens", name: "Lens", flavor: "Glass that throws light across the sea.", supportPerLevel: 10, baseCost: 400, growth: 1.12 },
  beam: { id: "beam", name: "Beam", flavor: "The light, aimed and thrown far.",      supportPerLevel: 0,  baseCost: 25_000, growth: 1.22 },
};

export const SUPPLY_NODE_IDS: readonly SupplyNodeId[] = ["wick", "oil", "lens"];
export const CHAIN_NODE_IDS: readonly ChainNodeId[] = ["wick", "oil", "lens", "beam"];

/** The chain wakes (and starts limiting the beam) at this many total generators. */
export const CHAIN_UNLOCK_GENERATORS = 10;
/** Chain factor = CHAIN_FLOOR + (1 − CHAIN_FLOOR) × efficiency. */
export const CHAIN_FLOOR = 0.25;
/** Each Beam level, across all boards, adds this much final production. */
export const BEAM_BONUS_PER_LEVEL = 0.05;

// ── Lighthouses with chain boards ────────────────────────────────────────────
export interface ChainLighthouseDef {
  id: string;
  name: string;
  hint: string;
  /** Lumen cost to relight (null = lit from the start of the game). */
  relightCost: number | null;
  /** Permanent production bonus while lit (0.5 = +50%), multiplicative. */
  productionBonus: number;
  /** Node levels a fresh board starts at (and Rekindle resets to). */
  startLevels: Record<ChainNodeId, number>;
  /** Node upgrade costs on this board are multiplied by this. */
  boardCostMultiplier: number;
}

export const FIRST_LIGHT_ID = "first-light";
export const GULL_ROCK_ID = "gull-rock";

export const CHAIN_LIGHTHOUSES: readonly ChainLighthouseDef[] = [
  {
    id: FIRST_LIGHT_ID,
    name: "First Light",
    hint: "Your first light. Already burning — barely.",
    relightCost: null,
    productionBonus: 0,
    startLevels: { wick: 1, oil: 1, lens: 1, beam: 0 },
    boardCostMultiplier: 1,
  },
  {
    id: GULL_ROCK_ID,
    name: "Gull Rock Light",
    hint: "A squat tower on a rock the gulls never left. Relight it for +50% production — but only a beam running at 50% efficiency or better can reach it.",
    relightCost: 2_000_000,
    productionBonus: 0.5,
    startLevels: { wick: 0, oil: 0, lens: 0, beam: 0 },
    boardCostMultiplier: 8,
  },
];

export function chainLighthouseById(id: string): ChainLighthouseDef {
  const def = CHAIN_LIGHTHOUSES.find((l) => l.id === id);
  if (!def) throw new Error(`Unknown chain lighthouse id: ${id}`);
  return def;
}

/** Chain efficiency Gull Rock demands before it can be relit. */
export const GULL_ROCK_EFFICIENCY_REQUIREMENT = 0.5;

/** The five lighthouses still dark (teasers until later sprints). */
export const TEASER_LIGHTHOUSES: readonly LighthouseDef[] = [
  { name: "Bell Shoal", hint: "Somewhere out there, a bell is still ringing. Reach it in a later sprint." },
  { name: "Oilhaven", hint: "The keepers' harbour. Its lamps went dark mid-sentence." },
  { name: "Lensmere", hint: "A tower of polished glass on a sea of glass. Bring light." },
  { name: "Stormwatch", hint: "The last light ships saw before the sea stilled." },
  { name: "The Seventh Light", hint: "No keeper has relit it. No keeper has come back from trying. Yet." },
];

// ── The seven lighthouses (teaser data for Sprint 0) ────────────────────────
export interface LighthouseDef {
  name: string;
  hint: string;
}

export const LIGHTHOUSES: readonly LighthouseDef[] = [
  { name: "Candlewick Point", hint: "Your first light. Already burning — barely." },
  { name: "Tidemere", hint: "Unlocks when the first lighthouse burns bright enough to be seen across the glass." },
  { name: "Bell Shoal", hint: "Somewhere out there, a bell is still ringing. Reach it in a later sprint." },
  { name: "Oilhaven", hint: "The keepers' harbour. Its lamps went dark mid-sentence." },
  { name: "Lensmere", hint: "A tower of polished glass on a sea of glass. Bring light." },
  { name: "Stormwatch", hint: "The last light ships saw before the sea stilled." },
  { name: "The Seventh Light", hint: "No keeper has relit it. No keeper has come back from trying. Yet." },
];
