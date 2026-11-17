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
