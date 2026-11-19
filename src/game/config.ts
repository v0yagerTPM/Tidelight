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
  /**
   * The lighthouse that must be lit before this tier can be hired
   * (post-launch rebalance; see GENERATOR UNLOCKS below). Copies already
   * owned keep producing either way.
   */
  unlockedBy?: string;
}

export const GENERATORS: readonly GeneratorDef[] = [
  { id: "candle-crab",     name: "Candle Crab",      flavor: "A crab, a candle, a calling.",              baseCost: 15,        baseProduction: 0.5,    growth: 1.15 },
  { id: "lantern-moth",    name: "Lantern Moth",     flavor: "It followed the light home. It stayed.",    baseCost: 120,       baseProduction: 3,      growth: 1.15 },
  { id: "tide-bell",       name: "Tide Bell",        flavor: "It rings for ships that are mostly memory.", baseCost: 1_300,    baseProduction: 17,     growth: 1.15 },
  { id: "oil-keeper",      name: "Oil Keeper",       flavor: "Trims the wick. Keeps the stories.",        baseCost: 14_000,    baseProduction: 95,     growth: 1.15 },
  { id: "lens-polisher",   name: "Lens Polisher",    flavor: "Every lens remembers a horizon.",           baseCost: 170_000,   baseProduction: 540,    growth: 1.14, unlockedBy: "gull-rock" },
  { id: "storm-lantern",   name: "Storm Lantern",    flavor: "Lit in a gale, on purpose.",                baseCost: 2_100_000, baseProduction: 3_200,  growth: 1.14, unlockedBy: "cormorant-roost" },
  { id: "beacon-whale",    name: "Beacon Whale",     flavor: "The sea's oldest lighthouse keeper.",      baseCost: 31_000_000, baseProduction: 19_000, growth: 1.13, unlockedBy: "widows-walk" },
  { id: "memory-ship",     name: "Memory Ship",      flavor: "Mostly memory, wholly lit. The Bellwether rang it home.", baseCost: 120_000_000, baseProduction: 47_000, growth: 1.13, unlockedBy: "bellwether" },
  { id: "seventh-light",   name: "The Seventh Light", flavor: "You don't hire this one. You become it.", baseCost: 460_000_000, baseProduction: 115_000, growth: 1.13, unlockedBy: "sirens-rest" },
];

// ── GENERATOR UNLOCKS (post-launch rebalance) ───────────────────────────────
// The upper five tiers answer the light of a relit lighthouse: Lens
// Polishers come with Gull Rock, Storm Lanterns with Cormorant Roost,
// Beacon Whales with Widow's Walk, Memory Ships with The Bellwether, The
// Seventh Light with Siren's Rest. (Memory Ships were added later: before
// them The Bellwether brought no helper, and the ladder stalled at Beacon
// Whales for a quarter of the game. Their cost and output sit on the
// geometric mean of the tiers either side.)
// Why: each tier out-produces the last ~6× for ~12× the price, so once
// Embers could buy the whole ladder, one run jumped production by seven
// orders of magnitude and the game flattened into a plateau after it. With
// the ladder tied to the coast, production climbs a staircase — steady
// Rekindle growth under a ceiling, and a higher ceiling with each relight.

const GENERATORS_BY_ID: ReadonlyMap<string, GeneratorDef> = new Map(GENERATORS.map((g) => [g.id, g]));

export function generatorById(id: string): GeneratorDef {
  const def = GENERATORS_BY_ID.get(id);
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
/**
 * The held-Ember curve: the first `knee` Embers count in full; beyond it,
 * Embers count as knee × (held / knee) ^ power. Power 1 is a straight line.
 * (An object, not constants, so the tuning harness can try other shapes.)
 */
export const EMBER_CURVE = { knee: 100, power: 1 };

/** Held Embers as the production bonus counts them (see EMBER_CURVE). */
export function effectiveEmbers(held: number): number {
  const { knee, power } = EMBER_CURVE;
  if (held <= knee || power === 1) return held;
  return knee * (held / knee) ** power;
}

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
  /**
   * Lumen/s of production the FIRST level supports (0 for Beam — it gives
   * a bonus, not support). Each further level supports supportGrowth×
   * more than the one before it.
   */
  supportPerLevel: number;
  /** Per-level growth of the support each new level adds (1 for Beam). */
  supportGrowth: number;
  /** Cost of the first upgrade level (level 0 → 1): ceil(baseCost × growth^level). */
  baseCost: number;
  growth: number;
}

// ── Support grows geometrically (post-launch rebalance) ─────────────────────
// Level k of a node adds supportPerLevel × supportGrowth^(k−1), so L levels
// support supportPerLevel × (supportGrowth^L − 1) / (supportGrowth − 1),
// times the board's scale. Costs grow at `growth`, a little faster than
// support, so a deep board slowly gets pricier per Lumen/s supported.
//
// Why: Sprints 2–5 gave every level the SAME support while costs grew
// geometrically and demand exponentially. Support could never keep pace,
// efficiency sat near 0% for most of the game, and every generator bought
// pushed the lighthouse gates further away — the sim's bot reached the
// ending only by refusing to grow, never owning a tier above Lens Polisher.
// Geometric support makes feeding the chain cost a fairly steady slice of
// production at every scale, so it stays a live decision all game, the
// gates can sit at real efficiencies, and growing never locks the ending.
// Level 1 is unchanged (20 / 15 / 10), so the first minutes play as before.
// See docs/SPRINTS.md for the before/after sim.
export const CHAIN_NODES: Record<ChainNodeId, ChainNodeDef> = {
  wick: { id: "wick", name: "Wick", flavor: "The flame itself. No wick, no light.", supportPerLevel: 20, supportGrowth: 1.095, baseCost: 500, growth: 1.10 },
  oil:  { id: "oil",  name: "Oil",  flavor: "Fuel for the long night.",              supportPerLevel: 15, supportGrowth: 1.105, baseCost: 1_000, growth: 1.11 },
  lens: { id: "lens", name: "Lens", flavor: "Glass that throws light across the sea.", supportPerLevel: 10, supportGrowth: 1.115, baseCost: 2_000, growth: 1.12 },
  beam: { id: "beam", name: "Beam", flavor: "The light, aimed and thrown far.",      supportPerLevel: 0,  supportGrowth: 1,     baseCost: 25_000, growth: 1.22 },
};

export const SUPPLY_NODE_IDS: readonly SupplyNodeId[] = ["wick", "oil", "lens"];
export const CHAIN_NODE_IDS: readonly ChainNodeId[] = ["wick", "oil", "lens", "beam"];

/** The chain wakes (and starts limiting the beam) at this many total generators. */
export const CHAIN_UNLOCK_GENERATORS = 10;
/** Chain factor = CHAIN_FLOOR + (1 − CHAIN_FLOOR) × efficiency. */
export const CHAIN_FLOOR = 0.25;
/** Each Beam level, across all boards, adds this much final production. */
export const BEAM_BONUS_PER_LEVEL = 0.05;

// ── The seven lighthouses (Sprint 2 system, generalized in Sprint 5) ───────
// Every lighthouse has a supply-chain board. They relight IN ORDER — each
// one demands the previous one lit, the chain awake, a minimum beam
// efficiency (a dark shore can only be reached by a well-fed beam), and a
// Lumen cost. Lit state and bonuses are PERMANENT (they survive Rekindle;
// only New Game+ darkens them again).
//
// GATES (post-launch rebalance): 50% → 60% → 65% → 70% → 75% → 80%. Until
// the rebalance they had to fall to 0.2%, because support grew linearly
// per level against exponential demand; with geometric support (see
// CHAIN_NODES) an hour of production fed to the chain clears even the 80%
// gate at any scale (tests/balance.test.ts), so the gates can ask for a
// genuinely well-fed beam. Relight costs are paced by the sim so the bot
// relights steadily up the coast (docs/SPRINTS.md); each relight from Gull
// Rock to Siren's Rest also brings the next generator tier (GENERATOR
// UNLOCKS above). Bonuses come in several flavours:
//   productionBonus        ×(1 + bonus) to all production, multiplicative
//   supportBonus           ×(1 + bonus) to every supply node's support
//   emberGainBonus         ×(1 + bonus) to Embers gained at Rekindle
//   offlineRateBonus       +points to the offline earnings rate (90% cap)
//   offlineCapBonusSeconds +seconds on the offline earnings cap
// The aggregator helpers below take the lit-id list (not the whole state)
// so config.ts stays dependency-free; chain.ts / engine.ts / upgrades.ts /
// emberShop.ts / prestige.ts wrap them for their own systems.
export interface ChainLighthouseDef {
  id: string;
  name: string;
  hint: string;
  /** Lumen cost to relight (null = lit from the start of the game). */
  relightCost: number | null;
  /** Chain efficiency (0–1) the beam must be running at to relight. */
  efficiencyRequirement: number;
  /** Permanent production bonus while lit (0.5 = +50%), multiplicative. */
  productionBonus: number;
  /** Permanent chain-support bonus while lit (0.5 = +50%), multiplicative. */
  supportBonus: number;
  /** Permanent Rekindle Ember-gain bonus while lit (0.25 = +25%). */
  emberGainBonus: number;
  /** Permanent offline-rate bonus while lit, in points (0.10 = +10 pts). */
  offlineRateBonus: number;
  /** Permanent offline-cap bonus while lit, in seconds. */
  offlineCapBonusSeconds: number;
  /** Lighting this lighthouse triggers the ending (The Hollow Light). */
  triggersEnding: boolean;
  /** Node levels a fresh board starts at (and Rekindle resets to). */
  startLevels: Record<ChainNodeId, number>;
  /**
   * The scale this lighthouse's board works at: its node costs AND the
   * support its levels give are both multiplied by this. Further lights
   * run bigger boards — and a fresh board's first levels are the cheapest
   * support per Lumen there is, so each relight renews the chain.
   */
  boardScale: number;
}

export const FIRST_LIGHT_ID = "first-light";
export const GULL_ROCK_ID = "gull-rock";
export const CORMORANT_ROOST_ID = "cormorant-roost";
export const WIDOWS_WALK_ID = "widows-walk";
export const BELLWETHER_ID = "bellwether";
export const SIRENS_REST_ID = "sirens-rest";
export const HOLLOW_LIGHT_ID = "hollow-light";

const NO_BONUS = {
  supportBonus: 0,
  emberGainBonus: 0,
  offlineRateBonus: 0,
  offlineCapBonusSeconds: 0,
  triggersEnding: false,
} as const;
const EMPTY_BOARD = { wick: 0, oil: 0, lens: 0, beam: 0 } as const;

export const CHAIN_LIGHTHOUSES: readonly ChainLighthouseDef[] = [
  {
    id: FIRST_LIGHT_ID,
    name: "First Light",
    hint: "Your first light, at Candlewick Point. Already burning — barely.",
    relightCost: null,
    efficiencyRequirement: 0,
    productionBonus: 0,
    ...NO_BONUS,
    startLevels: { wick: 1, oil: 1, lens: 1, beam: 0 },
    boardScale: 1,
  },
  {
    id: GULL_ROCK_ID,
    name: "Gull Rock Light",
    hint: "A squat tower on a rock the gulls never left. Relight it for +50% production — but only a beam running at 50% efficiency or better can reach it.",
    relightCost: 5_000_000,
    efficiencyRequirement: 0.5,
    productionBonus: 0.5,
    ...NO_BONUS,
    startLevels: { ...EMPTY_BOARD },
    boardScale: 8,
  },
  {
    id: CORMORANT_ROOST_ID,
    name: "Cormorant Roost",
    hint: "A tall, narrow tower the cormorants adopted as a cliff. They have been keeping the lens clean for a century, out of habit. Relight it for +75% production.",
    relightCost: 840_000_000,
    efficiencyRequirement: 0.6,
    productionBonus: 0.75,
    ...NO_BONUS,
    startLevels: { ...EMPTY_BOARD },
    boardScale: 20,
  },
  {
    id: WIDOWS_WALK_ID,
    name: "Widow's Walk",
    hint: "A railed platform above a keeper's cottage, worn smooth by pacing. Whoever waited here kept meticulous stores — relight it and every supply chain you tend runs +50% stronger, and a Chain Steward starts tending it for you.",
    relightCost: 3.4e12,
    efficiencyRequirement: 0.65,
    productionBonus: 0,
    ...NO_BONUS,
    supportBonus: 0.5,
    startLevels: { ...EMPTY_BOARD },
    boardScale: 50,
  },
  {
    id: BELLWETHER_ID,
    name: "The Bellwether",
    hint: "The lead light — the one the others were lit from, in the old order of things. Its bell still knows the way home, and so do the ships that heard it. Relight it and every Rekindle banks +25% more Embers.",
    relightCost: 7.6e18,
    efficiencyRequirement: 0.7,
    productionBonus: 0,
    ...NO_BONUS,
    emberGainBonus: 0.25,
    startLevels: { ...EMPTY_BOARD },
    boardScale: 120,
  },
  {
    id: SIRENS_REST_ID,
    name: "Siren's Rest",
    hint: "A low, lovely tower on the last rock before the deep glass. The sirens sleep here now, retired and harmless. Relight it and the night works harder for you: offline rate +10 points and the offline cap grows by 4 hours.",
    relightCost: 5e25, // 8.5e21 → 2.5e22 with Memory Ships → 5e25 with the late upgrades
    efficiencyRequirement: 0.75,
    productionBonus: 0,
    ...NO_BONUS,
    offlineRateBonus: 0.1,
    offlineCapBonusSeconds: 4 * 60 * 60,
    startLevels: { ...EMPTY_BOARD },
    boardScale: 300,
  },
  {
    id: HOLLOW_LIGHT_ID,
    name: "The Hollow Light",
    hint: "The last tower, at the heart of the Hollow Sea — the light the sea itself was named for. No keeper has relit it. No keeper has come back from trying. Yet. +150% production, and whatever waits beyond it.",
    relightCost: 1e31, // 3.2e24 → 6.5e24 with Memory Ships → 1e31 with the late upgrades
    efficiencyRequirement: 0.8,
    productionBonus: 1.5,
    ...NO_BONUS,
    triggersEnding: true,
    startLevels: { ...EMPTY_BOARD },
    boardScale: 750,
  },
];

// Looked up on every support calculation (several hundred times a second
// late in the game), so by map rather than a linear search.
const LIGHTHOUSES_BY_ID: ReadonlyMap<string, ChainLighthouseDef> = new Map(CHAIN_LIGHTHOUSES.map((l) => [l.id, l]));

/**
 * The most any single purchase costs: The Hollow Light's relight price.
 * A keeper who has lit it can afford anything in the game, so every
 * upgrade, roost expansion and rush lure is capped here (helper copies and
 * chain levels are bought one at a time and keep climbing, by design).
 */
export function priceCeiling(): number {
  return CHAIN_LIGHTHOUSES.find((l) => l.id === HOLLOW_LIGHT_ID)?.relightCost ?? Infinity;
}

export function chainLighthouseById(id: string): ChainLighthouseDef {
  const def = LIGHTHOUSES_BY_ID.get(id);
  if (!def) throw new Error(`Unknown chain lighthouse id: ${id}`);
  return def;
}

/** The lighthouse that must be lit before this one (null for First Light). */
export function previousLighthouseId(id: string): string | null {
  const idx = CHAIN_LIGHTHOUSES.findIndex((l) => l.id === id);
  return idx > 0 ? CHAIN_LIGHTHOUSES[idx - 1].id : null;
}

/** Chain efficiency Gull Rock demands before it can be relit. */
export const GULL_ROCK_EFFICIENCY_REQUIREMENT = 0.5;

// ── Lit-lighthouse bonus aggregators (pure, over the lit-id list) ───────────

/** Multiplicative production bonus from lit lighthouses: ∏(1 + bonus). */
export function litProductionMultiplier(lit: readonly string[]): number {
  let mult = 1;
  for (const def of CHAIN_LIGHTHOUSES) {
    if (lit.includes(def.id)) mult *= 1 + def.productionBonus;
  }
  return mult;
}

/** Multiplicative chain-support bonus from lit lighthouses (Widow's Walk). */
export function litSupportMultiplier(lit: readonly string[]): number {
  let mult = 1;
  for (const def of CHAIN_LIGHTHOUSES) {
    if (lit.includes(def.id)) mult *= 1 + def.supportBonus;
  }
  return mult;
}

/** Multiplicative Rekindle Ember-gain bonus from lit lighthouses (Bellwether). */
export function litEmberGainMultiplier(lit: readonly string[]): number {
  let mult = 1;
  for (const def of CHAIN_LIGHTHOUSES) {
    if (lit.includes(def.id)) mult *= 1 + def.emberGainBonus;
  }
  return mult;
}

/** Offline-rate bonus in points from lit lighthouses (Siren's Rest: +0.10). */
export function litOfflineRateBonus(lit: readonly string[]): number {
  let bonus = 0;
  for (const def of CHAIN_LIGHTHOUSES) {
    if (lit.includes(def.id)) bonus += def.offlineRateBonus;
  }
  return bonus;
}

/** Offline-cap bonus in seconds from lit lighthouses (Siren's Rest: +4h). */
export function litOfflineCapBonusSeconds(lit: readonly string[]): number {
  let bonus = 0;
  for (const def of CHAIN_LIGHTHOUSES) {
    if (lit.includes(def.id)) bonus += def.offlineCapBonusSeconds;
  }
  return bonus;
}
