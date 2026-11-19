import Decimal from "break_infinity.js";
import {
  BELLWETHER_ID,
  CORMORANT_ROOST_ID,
  EMBER_PRODUCTION_BONUS,
  GENERATORS,
  GULL_ROCK_ID,
  HOLLOW_LIGHT_ID,
  OFFLINE_RATE,
  SIRENS_REST_ID,
  WIDOWS_WALK_ID,
  chainLighthouseById,
  generatorById,
  priceCeiling,
  litOfflineRateBonus,
  type SupplyNodeId,
} from "./config";
import { OFFLINE_RATE_HARD_CAP, emberHeartBonus, offlineRateBonus } from "./emberShop";
import { relicOfflineRateBonus } from "./expeditions";
import { formatNumber } from "./format";
import { mothOfflineRateBonus } from "./mothTraits";
import { addLog } from "./state";
import type { GameState } from "./types";

// ── Upgrades ─────────────────────────────────────────────────────────────────
// One-time purchases, defined as data. Six families:
//   generator  — one helper ×2 at 10 and 30 copies, then ×2 / ×3 / ×5 at
//                75, 150 and 250 copies (five per helper)
//   click      — ×2 to the Flash the Beam click value (three tiers)
//   echo       — Flash Echo: each flash also pays a share of a second's
//                production, so flashing still matters late (three tiers)
//   synergy    — one helper +1% per copy of another (six pairs)
//   lighthouse — two lessons per lit lighthouse: supply nodes, the beam,
//                groups of helpers, all production, Ember gain
//   global     — keeper-wide effects (production, offline rate, Ember bonus)
// Most upgrades are lost on Rekindle; the two marked `permanent` are keeper
// knowledge and survive it.

export type UpgradeKind = "generator" | "click" | "echo" | "synergy" | "lighthouse" | "global";

export type UnlockCondition =
  | { kind: "generator-owned"; generatorId: string; count: number }
  | { kind: "run-lifetime"; amount: number }
  | { kind: "total-generators"; count: number }
  | { kind: "all-time-lumen"; amount: number }
  | { kind: "embers"; count: number }
  | { kind: "lighthouse-lit"; lighthouseId: string }
  | { kind: "generators-pair"; generatorIds: [string, string]; count: number };

export interface UpgradeDef {
  id: string;
  name: string;
  kind: UpgradeKind;
  /** Plain-words effect, shown in the UI. */
  effect: string;
  /** Cost in Lumen. */
  cost: number;
  unlock: UnlockCondition;
  /** Permanent upgrades are keeper knowledge: they survive Rekindle. */
  permanent: boolean;
  /** The helper a generator upgrade (or synergy) multiplies. */
  generatorId?: string;
  /** Helpers a lighthouse lesson multiplies together. */
  generatorIds?: readonly string[];
  /** The factor for generatorId / generatorIds (default ×2). */
  multiplier?: number;
  /** Synergy: the helper whose copies count, and the bonus per copy. */
  sourceId?: string;
  perCopy?: number;
  /** Lighthouse lessons: a supply node's support ×supportMultiplier. */
  supportNode?: SupplyNodeId;
  supportMultiplier?: number;
  /** Lighthouse lessons: Beam levels' bonus ×beamMultiplier. */
  beamMultiplier?: number;
  /** All production ×productionMultiplier (lighthouse lessons). */
  productionMultiplier?: number;
  /** Embers from a Rekindle ×emberGainMultiplier. */
  emberGainMultiplier?: number;
  /** Flash Echo: each flash also pays this share of a second's production. */
  echoShare?: number;
}

// ── Effect constants ─────────────────────────────────────────────────────────
/** Keeper's Focus: all production ×1.25. */
export const KEEPERS_FOCUS_MULTIPLIER = 1.25;
/** Ember Resonance: each held Ember gives +3% instead of +2%. */
export const EMBER_RESONANCE_BONUS = 0.03;
/** Longer Wicks: offline earnings rate (up from OFFLINE_RATE = 50%). */
export const LONGER_WICKS_OFFLINE_RATE = 0.75;

// ── Per-generator upgrades ───────────────────────────────────────────────────
// Tiers I–II: ×2 at 10 and 30 copies, costing 40× and 240× the helper's base
// cost (tuned up from 25×/150× in the Sprint 1 balance pass).
// Tiers III–V: ×2, ×3 and ×5 at 75, 150 and 250 copies, each costing about
// 10× the price of that copy. Late runs reach 250+ copies of every helper,
// and before these the Upgrades tab ran dry at 30 (see docs/SPRINTS.md).
const GENERATOR_UPGRADE_TIERS = [
  { count: 10, multiplier: 2, cost: (base: number) => base * 40 },
  { count: 30, multiplier: 2, cost: (base: number) => base * 240 },
  { count: 75, multiplier: 2, cost: (base: number, growth: number) => 10 * base * growth ** 75 },
  { count: 150, multiplier: 3, cost: (base: number, growth: number) => 10 * base * growth ** 150 },
  { count: 250, multiplier: 5, cost: (base: number, growth: number) => 10 * base * growth ** 250 },
] as const;

const GENERATOR_UPGRADE_NAMES: Record<string, readonly [string, string, string, string, string]> = {
  "candle-crab": ["Wax-Rich Diet", "Second Claw Lamp", "Tallow Shells", "The Crab Procession", "Moonlit Molt"],
  "lantern-moth": ["Powdered Moonlight", "Twin-Wing Glide", "Dusk Swarm", "Moth-Silk Shades", "The Thousand Wings"],
  "tide-bell": ["Salt-Cured Clapper", "Harbour Resonance", "Bronze Chorus", "Bells Beneath the Glass", "The Tolling Deep"],
  "oil-keeper": ["Steady Hands", "The Long Trim", "Deep Cellar Casks", "The Lamplighters' Guild", "The Bottomless Cask"],
  "lens-polisher": ["Silk Sleeves", "Flawless Finish", "Fresnel Rings", "Sea-Glass Grinding", "The Perfect Lens"],
  "storm-lantern": ["Gale-Proof Wick", "Lightning Crown", "Thunderhead Glass", "Eye of the Storm", "Gale-Born Flame"],
  "beacon-whale": ["Luminous Plankton", "Song of Deep Light", "The Glowing Pod", "Whale Fall", "The Leviathan Lamp"],
  "memory-ship": ["Lanterns at Every Rail", "The Homeward Chart", "Ghost Lanterns", "Crew of Recollection", "The Fleet Remembered"],
  "seventh-light": ["Become the Wick", "The Final Brightening", "Seven-Fold Flame", "Light Without Shore", "The Endless Beam"],
};

const ROMAN = ["I", "II", "III", "IV", "V"] as const;

const GENERATOR_UPGRADES: readonly UpgradeDef[] = GENERATORS.flatMap((gen) =>
  GENERATOR_UPGRADE_TIERS.map((tier, i) => ({
    id: `${gen.id}-u${i + 1}`,
    name: GENERATOR_UPGRADE_NAMES[gen.id]?.[i] ?? `${gen.name} Mastery ${ROMAN[i]}`,
    kind: "generator" as const,
    effect: `${gen.name} production ×${tier.multiplier}`,
    cost: Math.min(Math.ceil(tier.cost(gen.baseCost, gen.growth)), priceCeiling()),
    unlock: { kind: "generator-owned" as const, generatorId: gen.id, count: tier.count },
    permanent: false,
    generatorId: gen.id,
    multiplier: tier.multiplier,
  })),
);

/** Which tier (1–5) a generator upgrade is, from its id ("candle-crab-u3" → 3). */
export function generatorUpgradeTier(def: UpgradeDef): number {
  const m = /-u(\d)$/.exec(def.id);
  return m ? Number(m[1]) : 1;
}

// ── Click upgrades: each doubles the beam's click value (1 → 2 → 4 → 8) ───
const CLICK_UPGRADES: readonly UpgradeDef[] = [
  {
    id: "click-1",
    name: "Polished Hand-Lens",
    kind: "click",
    effect: "Flash the Beam click value ×2",
    cost: 400,
    unlock: { kind: "run-lifetime", amount: 500 },
    permanent: false,
  },
  {
    id: "click-2",
    name: "Keeper's Rhythm",
    kind: "click",
    effect: "Flash the Beam click value ×2",
    cost: 20_000,
    unlock: { kind: "run-lifetime", amount: 25_000 },
    permanent: false,
  },
  {
    id: "click-3",
    name: "Storm-Focusing Grip",
    kind: "click",
    effect: "Flash the Beam click value ×2",
    cost: 800_000,
    unlock: { kind: "run-lifetime", amount: 1_000_000 },
    permanent: false,
  },
];

// ── Flash Echo: flashing that keeps up with the light ───────────────────────
// Each tier adds a share of a second's production to every flash (they
// stack: 5% + 10% + 20% = 35% at all three). Eight Lumen a flash is nothing
// at 10^20 a second; this keeps the beam worth flashing in an active session.
export const FLASH_ECHO_SHARES = [0.05, 0.1, 0.2] as const;
const ECHO_UPGRADES: readonly UpgradeDef[] = [
  { name: "Echo off the Glass", unlockAt: 1e8, cost: 5e7 },
  { name: "Echo off the Cliffs", unlockAt: 1e12, cost: 5e11 },
  { name: "Echo off the Horizon", unlockAt: 1e16, cost: 5e15 },
].map((e, i) => ({
  id: `echo-${i + 1}`,
  name: e.name,
  kind: "echo" as const,
  effect: `Each flash also pays ${Math.round(FLASH_ECHO_SHARES[i] * 100)}% of a second's production`,
  cost: e.cost,
  unlock: { kind: "run-lifetime" as const, amount: e.unlockAt },
  permanent: false,
  echoShare: FLASH_ECHO_SHARES[i],
}));

// ── Synergies: a higher helper +1% per copy of a lower one ──────────────────
// Unlock with 50 of each; cost 10× the price of the target's 50th copy. Late
// runs own ~250 of everything, so each is worth about ×3.5 there, and the
// cheap low helpers stay worth buying.
const SYNERGY_PAIRS: readonly { id: string; name: string; target: string; source: string }[] = [
  { id: "syn-bell-moths", name: "Moths in the Belfry", target: "tide-bell", source: "lantern-moth" },
  { id: "syn-keeper-bells", name: "Keepers Keep Time", target: "oil-keeper", source: "tide-bell" },
  { id: "syn-storm-lens", name: "Polished Storm Glass", target: "storm-lantern", source: "lens-polisher" },
  { id: "syn-whale-oil", name: "Whale-Oil Lamps", target: "beacon-whale", source: "oil-keeper" },
  { id: "syn-ship-whales", name: "Whales Guide the Ships", target: "memory-ship", source: "beacon-whale" },
  { id: "syn-seventh-storm", name: "Storm-Lit Seventh", target: "seventh-light", source: "storm-lantern" },
];
export const SYNERGY_PER_COPY = 0.01;
const SYNERGY_UPGRADES: readonly UpgradeDef[] = SYNERGY_PAIRS.map((p) => {
  const target = generatorById(p.target);
  const source = generatorById(p.source);
  return {
    id: p.id,
    name: p.name,
    kind: "synergy" as const,
    effect: `${target.name} +1% production per ${source.name} owned`,
    cost: Math.min(Math.ceil(10 * target.baseCost * target.growth ** 50), priceCeiling()),
    unlock: { kind: "generators-pair" as const, generatorIds: [p.target, p.source] as [string, string], count: 50 },
    permanent: false,
    generatorId: p.target,
    sourceId: p.source,
    perCopy: SYNERGY_PER_COPY,
  };
});

// ── Lighthouse lessons: two per lit lighthouse ───────────────────────────────
// Learned again each run, like any lesson; they surface the moment their
// lighthouse is lit. Prices are 10% and 100% of that lighthouse's relight
// cost, so each is a goal partway through a run.
type LessonEffect = Pick<
  UpgradeDef,
  "generatorIds" | "multiplier" | "supportNode" | "supportMultiplier" | "beamMultiplier" | "productionMultiplier" | "emberGainMultiplier"
>;
const LESSONS: readonly ({ id: string; name: string; lighthouseId: string; share: number; effect: string } & LessonEffect)[] = [
  { id: "lesson-gull-wicks", name: "Gull-Feather Wicks", lighthouseId: GULL_ROCK_ID, share: 0.1, effect: "Wick support ×2 on every board", supportNode: "wick", supportMultiplier: 2 },
  { id: "lesson-gull-spray", name: "Salt-Spray Polish", lighthouseId: GULL_ROCK_ID, share: 1, effect: "Candle Crabs, Lantern Moths and Tide Bells ×3", generatorIds: ["candle-crab", "lantern-moth", "tide-bell"], multiplier: 3 },
  { id: "lesson-roost-oil", name: "Roost Oil", lighthouseId: CORMORANT_ROOST_ID, share: 0.1, effect: "Oil support ×2 on every board", supportNode: "oil", supportMultiplier: 2 },
  { id: "lesson-roost-dive", name: "Diving Lamps", lighthouseId: CORMORANT_ROOST_ID, share: 1, effect: "Oil Keepers and Lens Polishers ×3", generatorIds: ["oil-keeper", "lens-polisher"], multiplier: 3 },
  { id: "lesson-widow-glass", name: "Widow's Glass", lighthouseId: WIDOWS_WALK_ID, share: 0.1, effect: "Lens support ×2 on every board", supportNode: "lens", supportMultiplier: 2 },
  { id: "lesson-widow-log", name: "The Long Watch Log", lighthouseId: WIDOWS_WALK_ID, share: 1, effect: "Storm Lanterns and Beacon Whales ×3", generatorIds: ["storm-lantern", "beacon-whale"], multiplier: 3 },
  { id: "lesson-bell-chorus", name: "Bell Chorus", lighthouseId: BELLWETHER_ID, share: 0.1, effect: "Each Beam level adds +7.5% instead of +5%", beamMultiplier: 1.5 },
  { id: "lesson-bell-home", name: "Homeward Bells", lighthouseId: BELLWETHER_ID, share: 1, effect: "Memory Ships ×3", generatorIds: ["memory-ship"], multiplier: 3 },
  { id: "lesson-siren-song", name: "Siren Song", lighthouseId: SIRENS_REST_ID, share: 0.1, effect: "All production ×2", productionMultiplier: 2 },
  { id: "lesson-siren-flame", name: "The Seventh Flame", lighthouseId: SIRENS_REST_ID, share: 1, effect: "The Seventh Light ×3", generatorIds: ["seventh-light"], multiplier: 3 },
  { id: "lesson-hollow-echo", name: "Hollow Echo", lighthouseId: HOLLOW_LIGHT_ID, share: 0.1, effect: "All production ×3", productionMultiplier: 3 },
  { id: "lesson-hollow-last", name: "The Last Lesson", lighthouseId: HOLLOW_LIGHT_ID, share: 1, effect: "Embers from a Rekindle ×1.25", emberGainMultiplier: 1.25 },
];
const LIGHTHOUSE_UPGRADES: readonly UpgradeDef[] = LESSONS.map(({ lighthouseId, share, ...l }) => ({
  ...l,
  cost: share * (chainLighthouseById(lighthouseId).relightCost ?? 0),
  kind: "lighthouse" as const,
  unlock: { kind: "lighthouse-lit" as const, lighthouseId },
  permanent: false,
}));

// ── Global upgrades ──────────────────────────────────────────────────────────
const GLOBAL_UPGRADES: readonly UpgradeDef[] = [
  {
    id: "keepers-focus",
    name: "Keeper's Focus",
    kind: "global",
    effect: "All production +25%",
    cost: 100_000, // tuned up from 50,000 in the Sprint 1 balance pass
    unlock: { kind: "total-generators", count: 50 },
    permanent: false,
  },
  {
    id: "longer-wicks",
    name: "Longer Wicks",
    kind: "global",
    effect: "Offline earnings rise from 50% to 75% of your production rate",
    cost: 250_000,
    unlock: { kind: "all-time-lumen", amount: 2_000_000 },
    permanent: true,
  },
  {
    id: "ember-resonance",
    name: "Ember Resonance",
    kind: "global",
    effect: "Each Ember held gives +3% production instead of +2%",
    cost: 5_000_000,
    unlock: { kind: "embers", count: 10 },
    permanent: true,
  },
];

export const UPGRADES: readonly UpgradeDef[] = [
  ...GENERATOR_UPGRADES,
  ...CLICK_UPGRADES,
  ...ECHO_UPGRADES,
  ...SYNERGY_UPGRADES,
  ...LIGHTHOUSE_UPGRADES,
  ...GLOBAL_UPGRADES,
];

const UPGRADES_BY_ID: ReadonlyMap<string, UpgradeDef> = new Map(UPGRADES.map((u) => [u.id, u]));

/**
 * Per helper: the upgrades that multiply it (its own tiers and lighthouse
 * lessons) and the synergies that boost it, so its multiplier doesn't scan
 * every upgrade.
 */
const GENERATOR_UPGRADE_DEFS: ReadonlyMap<string, readonly UpgradeDef[]> = (() => {
  const map = new Map<string, UpgradeDef[]>();
  const add = (genId: string, def: UpgradeDef) => map.set(genId, [...(map.get(genId) ?? []), def]);
  for (const def of UPGRADES) {
    if (def.kind === "generator" && def.generatorId) add(def.generatorId, def);
    else if (def.kind === "synergy" && def.generatorId) add(def.generatorId, def);
    else if (def.generatorIds) for (const id of def.generatorIds) add(id, def);
  }
  return map;
})();
/** The lighthouse lessons and Flash Echoes (small lists, scanned per call). */
const LESSON_DEFS = UPGRADES.filter((u) => u.kind === "lighthouse");
const ECHO_DEFS = UPGRADES.filter((u) => u.kind === "echo");

export function upgradeById(id: string): UpgradeDef {
  const def = UPGRADES_BY_ID.get(id);
  if (!def) throw new Error(`Unknown upgrade id: ${id}`);
  return def;
}

// ── Unlocks ──────────────────────────────────────────────────────────────────

export function totalGeneratorsOwned(state: GameState): number {
  let total = 0;
  for (const id of Object.keys(state.generators)) total += state.generators[id] ?? 0;
  return total;
}

export function isUnlocked(state: GameState, def: UpgradeDef): boolean {
  const u = def.unlock;
  switch (u.kind) {
    case "generator-owned":
      return (state.generators[u.generatorId] ?? 0) >= u.count;
    case "run-lifetime":
      return state.lifetimeLumen.gte(u.amount);
    case "total-generators":
      return totalGeneratorsOwned(state) >= u.count;
    case "all-time-lumen":
      return state.allTimeLumen.gte(u.amount);
    case "embers":
      return state.embers >= u.count;
    case "lighthouse-lit":
      return state.litLighthouses.includes(u.lighthouseId);
    case "generators-pair":
      return u.generatorIds.every((id) => (state.generators[id] ?? 0) >= u.count);
  }
}

/**
 * How close an upgrade is to unlocking, 0–1 (1 once unlocked). Shown as a
 * bar on silhouetted upgrades in the Upgrades view.
 */
export function unlockProgress(state: GameState, def: UpgradeDef): number {
  const u = def.unlock;
  const frac = (have: number, need: number): number => (need <= 0 ? 1 : Math.max(0, Math.min(1, have / need)));
  switch (u.kind) {
    case "generator-owned":
      return frac(state.generators[u.generatorId] ?? 0, u.count);
    case "run-lifetime":
      return frac(state.lifetimeLumen.div(u.amount).toNumber(), 1);
    case "total-generators":
      return frac(totalGeneratorsOwned(state), u.count);
    case "all-time-lumen":
      return frac(state.allTimeLumen.div(u.amount).toNumber(), 1);
    case "embers":
      return frac(state.embers, u.count);
    case "lighthouse-lit":
      return state.litLighthouses.includes(u.lighthouseId) ? 1 : 0;
    case "generators-pair":
      return Math.min(...u.generatorIds.map((id) => frac(state.generators[id] ?? 0, u.count)));
  }
}

/** Human-readable unlock condition, shown on silhouetted (locked) upgrades. */
export function unlockText(def: UpgradeDef): string {
  const u = def.unlock;
  switch (u.kind) {
    case "generator-owned": {
      const gen = GENERATORS.find((g) => g.id === u.generatorId);
      return `Own ${u.count} × ${gen?.name ?? u.generatorId}`;
    }
    case "run-lifetime":
      return `Earn ${formatNumber(u.amount)} lifetime Lumen in one run`;
    case "total-generators":
      return `Own ${u.count} generators in total`;
    case "all-time-lumen":
      return `Earn ${formatNumber(u.amount)} all-time Lumen`;
    case "embers":
      return `Hold ${u.count} Embers`;
    case "lighthouse-lit":
      return `Relight ${chainLighthouseById(u.lighthouseId).name}`;
    case "generators-pair": {
      const [a, b] = u.generatorIds.map((id) => GENERATORS.find((g) => g.id === id)?.name ?? id);
      return `Own ${u.count} × ${a} and ${u.count} × ${b}`;
    }
  }
}

// ── Ownership & effects ──────────────────────────────────────────────────────

export function hasUpgrade(state: GameState, id: string): boolean {
  return state.upgrades.includes(id);
}

export function isPermanentUpgrade(id: string): boolean {
  const def = UPGRADES_BY_ID.get(id);
  return def?.permanent ?? false;
}

/**
 * Production multiplier one generator gets from upgrades: its own tiers
 * (×2, ×2, ×2, ×3, ×5), lighthouse lessons that name it (×3), and synergies
 * (+1% per copy of their source helper).
 */
export function generatorUpgradeMultiplier(state: GameState, generatorId: string): number {
  let mult = 1;
  for (const def of GENERATOR_UPGRADE_DEFS.get(generatorId) ?? []) {
    if (!hasUpgrade(state, def.id)) continue;
    if (def.kind === "synergy") mult *= 1 + (def.perCopy ?? 0) * (state.generators[def.sourceId ?? ""] ?? 0);
    else mult *= def.multiplier ?? 2;
  }
  return mult;
}

/** A supply node's support multiplier from lighthouse lessons (Wick, Oil, Lens ×2). */
export function upgradeSupportMultiplier(state: GameState, nodeId: SupplyNodeId): number {
  let mult = 1;
  for (const def of LESSON_DEFS) if (def.supportNode === nodeId && hasUpgrade(state, def.id)) mult *= def.supportMultiplier ?? 1;
  return mult;
}

/** Beam bonus multiplier from lighthouse lessons (Bell Chorus: +5% → +7.5% a level). */
export function upgradeBeamMultiplier(state: GameState): number {
  let mult = 1;
  for (const def of LESSON_DEFS) if (def.beamMultiplier && hasUpgrade(state, def.id)) mult *= def.beamMultiplier;
  return mult;
}

/** Ember gain multiplier from lighthouse lessons (The Last Lesson ×1.25). */
export function upgradeEmberGainMultiplier(state: GameState): number {
  let mult = 1;
  for (const def of LESSON_DEFS) if (def.emberGainMultiplier && hasUpgrade(state, def.id)) mult *= def.emberGainMultiplier;
  return mult;
}

/** Flash Echo: the share of a second's production each flash also pays (0–0.35). */
export function flashEchoShare(state: GameState): number {
  let share = 0;
  for (const def of ECHO_DEFS) if (hasUpgrade(state, def.id)) share += def.echoShare ?? 0;
  return share;
}

/** Click value multiplier from click upgrades (×2 each: 1 → 2 → 4 → 8). */
export function clickMultiplier(state: GameState): number {
  let mult = 1;
  for (const def of UPGRADES) {
    if (def.kind === "click" && hasUpgrade(state, def.id)) mult *= 2;
  }
  return mult;
}

/** Keeper's Focus ×1.25, and lighthouse lessons (Siren Song ×2, Hollow Echo ×3). */
export function globalProductionMultiplier(state: GameState): number {
  let mult = hasUpgrade(state, "keepers-focus") ? KEEPERS_FOCUS_MULTIPLIER : 1;
  for (const def of LESSON_DEFS) if (def.productionMultiplier && hasUpgrade(state, def.id)) mult *= def.productionMultiplier;
  return mult;
}

/**
 * Production bonus per Ember held: +2% base, +3% with Ember Resonance,
 * and the Ember Heart perk (Sprint 3) adds a further +1% either way
 * (so 3% base, 4% with Resonance).
 */
export function emberBonusPerEmber(state: GameState): number {
  const base = hasUpgrade(state, "ember-resonance") ? EMBER_RESONANCE_BONUS : EMBER_PRODUCTION_BONUS;
  return base + emberHeartBonus(state);
}

/**
 * Offline earnings rate: 75% with Longer Wicks, else the base 50%; the
 * Full Reservoir perk (Sprint 3) adds +10 percentage points, the Keeper's
 * Coat relic (Sprint 4) +5 more, and Siren's Rest lit (Sprint 5) +10
 * more — all hard-capped at 90%.
 */
export function offlineRateFor(state: GameState): number {
  const base = hasUpgrade(state, "longer-wicks") ? LONGER_WICKS_OFFLINE_RATE : OFFLINE_RATE;
  return Math.min(
    OFFLINE_RATE_HARD_CAP,
    base + offlineRateBonus(state) + relicOfflineRateBonus(state) + litOfflineRateBonus(state.litLighthouses) + mothOfflineRateBonus(state),
  );
}

// ── Buying ───────────────────────────────────────────────────────────────────

/**
 * Buy an upgrade. Returns true if the purchase happened.
 * Fails (false, no state change) when already owned, still locked, or
 * the player can't afford it.
 */
export function buyUpgrade(state: GameState, id: string, log = true): boolean {
  const def = upgradeById(id);
  if (hasUpgrade(state, id)) return false;
  if (!isUnlocked(state, def)) return false;
  const cost = new Decimal(def.cost);
  if (state.lumen.lt(cost)) return false;
  state.lumen = state.lumen.sub(cost);
  state.upgrades.push(id);
  if (log) addLog(state, `Upgrade learned: ${def.name} — ${def.effect}.`);
  return true;
}
