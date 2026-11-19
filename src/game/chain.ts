import Decimal from "break_infinity.js";
import {
  BEAM_BONUS_PER_LEVEL,
  CHAIN_FLOOR,
  CHAIN_LIGHTHOUSES,
  CHAIN_NODES,
  CHAIN_UNLOCK_GENERATORS,
  FIRST_LIGHT_ID,
  GULL_ROCK_ID,
  HOLLOW_LIGHT_ID,
  SUPPLY_NODE_IDS,
  chainLighthouseById,
  litProductionMultiplier,
  litSupportMultiplier,
  previousLighthouseId,
  type ChainNodeId,
  type SupplyNodeId,
} from "./config";
// NOTE: engine ↔ chain is a deliberate, call-time-only cycle. Engine's
// productionPerSecond applies this module's chain factor and beam bonus;
// this module's chainStatus reads engine's baseProductionPerSecond as the
// chain's demand. Neither module calls the other at load time, and
// baseProductionPerSecond itself never calls back into the chain.
import { chainSupportMultiplier, gullRockRelightCost } from "./emberShop";
import { baseProductionPerSecond, lastingProductionMultiplier } from "./engine";
import { relicNodeCostMultiplier, relicSupportMultiplier } from "./expeditions";
import { postSupportMultiplier } from "./mothTraits";
import { addLog, startBoard } from "./state";
import { tideSupportMultiplier } from "./tides";
import type { ChainBoard, GameState } from "./types";
import { totalGeneratorsOwned, upgradeBeamMultiplier, upgradeSupportMultiplier } from "./upgrades";

// ── The supply chain: wick → oil → lens → beam ───────────────────────────────
// Production ordering (see engine.ts):
//   generators (milestones, upgrades, challenge tier reward) × Keeper's
//   Focus × Ember bonus × Second Wind × challenge rule/rewards
//   × moth duty bonus × Brass Compass (Sprint 4) × legacy bonus (Sprint 5)
//   × lighthouse production bonuses, multiplied together (Sprint 5)
//   =  BASE production — this is the chain's "demand"
//   × chain factor (0.25 + 0.75 × efficiency, or 1 while the chain is locked)
//   × beam bonus (1 + 5% × total Beam levels)
//   × tide production multiplier (Sprint 4; only when a time is passed)
//   =  final production.
//
// Each supply node's efficiency is min(1, totalSupport / demand), where
// totalSupport sums that node's support across every lit lighthouse's
// board — L levels on a board support supportPerLevel × boardScale ×
// (supportGrowth^L − 1)/(supportGrowth − 1), geometric since the
// post-launch rebalance (see config.ts) — and is scaled by Deep Wicks (×1.25), the Tide Chart relic (×1.15),
// Widow's Walk lit (×1.5, Sprint 5) and the tide (Low Tide ×1.2,
// Stormfront ×0.8 — only when a time is passed).
// The chain is only as strong as its weakest supply node.

export function isLit(state: GameState, lighthouseId: string): boolean {
  return state.litLighthouses.includes(lighthouseId);
}

export function boardFor(state: GameState, lighthouseId: string): ChainBoard | undefined {
  return state.chainBoards[lighthouseId];
}

/** The chain wakes once the player owns this many generators in total. */
export function chainUnlocked(state: GameState): boolean {
  return totalGeneratorsOwned(state) >= CHAIN_UNLOCK_GENERATORS;
}

// ── Levels, support, costs ───────────────────────────────────────────────────

/** Total levels of a node across all lit lighthouses' boards. */
export function totalNodeLevels(state: GameState, nodeId: ChainNodeId): number {
  let total = 0;
  for (const id of state.litLighthouses) total += state.chainBoards[id]?.[nodeId] ?? 0;
  return total;
}

/**
 * Lumen/s a supply node supports on one board at a given level, before any
 * multipliers: supportPerLevel × boardScale × (g^L − 1)/(g − 1), where
 * level k adds supportPerLevel × g^(k−1). Level 1 supports supportPerLevel.
 */
// Memoised: the same few (board, node, level) triples are asked for
// hundreds of times a second, and the levels only move when bought.
// Decimals are immutable, so sharing the cached value is safe.
const supportMemo = new Map<string, Decimal>();
const ZERO = new Decimal(0);

export function boardNodeSupport(lighthouseId: string, nodeId: SupplyNodeId, level: number): Decimal {
  if (level <= 0) return ZERO;
  const key = `${lighthouseId}|${nodeId}|${level}`;
  let cached = supportMemo.get(key);
  if (cached === undefined) {
    if (supportMemo.size > 20_000) supportMemo.clear();
    cached = computeBoardNodeSupport(lighthouseId, nodeId, level);
    supportMemo.set(key, cached);
  }
  return cached;
}

function computeBoardNodeSupport(lighthouseId: string, nodeId: SupplyNodeId, level: number): Decimal {
  const def = CHAIN_NODES[nodeId];
  const g = def.supportGrowth;
  const scale = chainLighthouseById(lighthouseId).boardScale;
  // Rounded to 12 significant digits so the closed form doesn't leave
  // float dust (level 1 is exactly supportPerLevel, not 1.0000000000000009×).
  const sum = g === 1 ? level : (Math.pow(g, level) - 1) / (g - 1);
  const levels = Number.isFinite(sum) ? new Decimal(Number(sum.toPrecision(12))) : new Decimal(g).pow(level).sub(1).div(g - 1);
  return levels.mul(def.supportPerLevel).mul(scale);
}

/**
 * First Light's warm start: the levels every run begins with (Wick 1,
 * Oil 1, Lens 1) support their usual amount × the keeper's lasting
 * production bonuses (engine.lastingProductionMultiplier). Those bonuses
 * survive a Rekindle and multiply what the first generators demand, so
 * without this a keeper holding 1,000 Embers (×21) began every run with
 * the chain at a new keeper's 20/15/10 against twenty-one times the
 * demand: 2–7% efficiency for the first minutes, 25% at five. With it,
 * every run starts as fed as a new keeper's first one. Levels bought on
 * top support their usual amounts, so feeding a growing run costs what it
 * always did, and late in a run the cushion is small beside demand.
 * Returns the EXTRA support beyond the starting levels' own, before the
 * support multipliers (which apply to it like any other support).
 */
export function startingCushion(state: GameState, nodeId: SupplyNodeId): Decimal {
  const startLevel = chainLighthouseById(FIRST_LIGHT_ID).startLevels[nodeId];
  const counted = Math.min(startLevel, state.chainBoards[FIRST_LIGHT_ID]?.[nodeId] ?? 0);
  if (counted <= 0) return new Decimal(0);
  const extra = lastingProductionMultiplier(state).sub(1);
  if (extra.lte(0)) return new Decimal(0);
  return boardNodeSupport(FIRST_LIGHT_ID, nodeId, counted).mul(extra);
}

/** Every support multiplier at once (perks, relics, lighthouses, tide). */
export function supportMultiplier(state: GameState, now?: number): number {
  return chainSupportMultiplier(state) * relicSupportMultiplier(state) * lighthouseSupportMultiplier(state) * tideSupportMultiplier(now);
}

/**
 * Lumen/s of support the NEXT level of a supply node adds on a board, with
 * every multiplier applied (what its Upgrade button buys).
 */
export function nextLevelSupportGain(state: GameState, lighthouseId: string, nodeId: SupplyNodeId, now?: number): Decimal {
  const level = state.chainBoards[lighthouseId]?.[nodeId] ?? 0;
  return boardNodeSupport(lighthouseId, nodeId, level + 1)
    .sub(boardNodeSupport(lighthouseId, nodeId, level))
    .mul(postSupportMultiplier(state, lighthouseId))
    .mul(supportMultiplier(state, now))
    .mul(upgradeSupportMultiplier(state, nodeId));
}

/**
 * Total Lumen/s a supply node supports across all boards.
 * Deep Wicks (Ember perk, Sprint 3) raises every node's support by +25%;
 * the Tide Chart relic (Sprint 4) adds +15%; Widow's Walk lit (Sprint 5)
 * adds +50%; the tide scales support when a time is passed (Low Tide
 * ×1.2, Stormfront ×0.8). A moth at a lighthouse post (mothTraits.ts)
 * strengthens that one board: +glow × 0.2%, doubled for a Chain-tender.
 */
export function totalSupport(state: GameState, nodeId: SupplyNodeId, now?: number): Decimal {
  let raw = startingCushion(state, nodeId);
  for (const id of state.litLighthouses) {
    raw = raw.add(boardNodeSupport(id, nodeId, state.chainBoards[id]?.[nodeId] ?? 0).mul(postSupportMultiplier(state, id)));
  }
  return raw
    .mul(chainSupportMultiplier(state))
    .mul(relicSupportMultiplier(state))
    .mul(lighthouseSupportMultiplier(state))
    .mul(tideSupportMultiplier(now))
    .mul(upgradeSupportMultiplier(state, nodeId));
}

/** Multiplicative support bonus from lit lighthouses (Widow's Walk ×1.5). */
export function lighthouseSupportMultiplier(state: GameState): number {
  return litSupportMultiplier(state.litLighthouses);
}

/**
 * Cost of raising a node from `level` to `level + 1` on a given board:
 * ceil(baseCost × growth^level × boardScale). Gull Rock's board works at
 * ×8. When the keeper's state is passed, the Gull Feather relic (Sprint 4)
 * takes 20% off.
 */
export function nodeCost(lighthouseId: string, nodeId: ChainNodeId, level: number, state?: GameState): Decimal {
  const def = CHAIN_NODES[nodeId];
  const lh = chainLighthouseById(lighthouseId);
  return new Decimal(def.baseCost)
    .mul(new Decimal(def.growth).pow(level))
    .mul(lh.boardScale)
    .mul(state ? relicNodeCostMultiplier(state) : 1)
    .ceil();
}

/** Cost of the next level of a node on a board, at its current level. */
export function nextNodeCost(state: GameState, lighthouseId: string, nodeId: ChainNodeId): Decimal {
  const level = state.chainBoards[lighthouseId]?.[nodeId] ?? 0;
  return nodeCost(lighthouseId, nodeId, level, state);
}

// ── Lighthouse & beam bonuses ────────────────────────────────────────────────

/**
 * Multiplicative production bonus from lit lighthouses — the bonuses
 * multiply together: Gull Rock ×1.5, Cormorant Roost ×1.75, The Hollow
 * Light ×2.5 (all seven lit: ×6.5625 before anything else).
 */
export function lighthouseMultiplier(state: GameState): Decimal {
  return new Decimal(litProductionMultiplier(state.litLighthouses));
}

export function totalBeamLevels(state: GameState): number {
  return totalNodeLevels(state, "beam");
}

/** Final-production multiplier from Beam levels: 1 + 5% per level (7.5% with Bell Chorus), additive. */
export function beamMultiplier(state: GameState): Decimal {
  return new Decimal(1 + BEAM_BONUS_PER_LEVEL * upgradeBeamMultiplier(state) * totalBeamLevels(state));
}

// ── Status ───────────────────────────────────────────────────────────────────

export interface SupplyNodeStatus {
  nodeId: SupplyNodeId;
  /** Total levels across all boards. */
  levels: number;
  /** Total Lumen/s this node supports across all boards. */
  support: Decimal;
  /** min(1, support / demand); 1 when there is no demand. */
  efficiency: number;
}

export interface ChainStatus {
  unlocked: boolean;
  /** Base production (pre-chain, pre-beam) the chain must support. */
  demand: Decimal;
  nodes: SupplyNodeStatus[];
  /** The weakest supply node's efficiency. */
  efficiency: number;
  /** The supply node holding the beam back, or null at full efficiency. */
  bottleneck: SupplyNodeId | null;
  /** How much support the bottleneck lacks, in Lumen/s (0 when none). */
  shortfall: Decimal;
  /** 0.25 + 0.75 × efficiency once unlocked; 1 while locked. */
  chainFactor: number;
  beamLevels: number;
  beamMultiplier: Decimal;
}

export function chainStatus(state: GameState, now?: number): ChainStatus {
  const demand = baseProductionPerSecond(state);
  const nodes: SupplyNodeStatus[] = SUPPLY_NODE_IDS.map((nodeId) => {
    const support = totalSupport(state, nodeId, now);
    const efficiency = demand.lte(0) ? 1 : Math.min(1, support.div(demand).toNumber());
    return { nodeId, levels: totalNodeLevels(state, nodeId), support, efficiency };
  });
  let efficiency = 1;
  for (const n of nodes) efficiency = Math.min(efficiency, n.efficiency);
  let bottleneck: SupplyNodeId | null = null;
  let shortfall = new Decimal(0);
  if (efficiency < 1) {
    const weakest = nodes.reduce((a, b) => (b.efficiency < a.efficiency ? b : a));
    bottleneck = weakest.nodeId;
    const lack = demand.sub(weakest.support);
    shortfall = lack.gt(0) ? lack : new Decimal(0);
  }
  const unlocked = chainUnlocked(state);
  return {
    unlocked,
    demand,
    nodes,
    efficiency,
    bottleneck,
    shortfall,
    chainFactor: unlocked ? CHAIN_FLOOR + (1 - CHAIN_FLOOR) * efficiency : 1,
    beamLevels: totalBeamLevels(state),
    beamMultiplier: beamMultiplier(state),
  };
}

/** The chain's production factor on its own (1 while the chain is locked). */
export function chainFactor(state: GameState, now?: number): number {
  return chainStatus(state, now).chainFactor;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Raise one chain node by a level on a lit lighthouse's board.
 * Fails cleanly (false, no change) while the chain is locked, the
 * lighthouse is dark, or the player can't afford the next level.
 */
export function buyNodeUpgrade(state: GameState, lighthouseId: string, nodeId: ChainNodeId, log = true): boolean {
  if (!chainUnlocked(state)) return false;
  const board = state.chainBoards[lighthouseId];
  if (!isLit(state, lighthouseId) || !board) return false;
  const cost = nodeCost(lighthouseId, nodeId, board[nodeId], state);
  if (state.lumen.lt(cost)) return false;
  state.lumen = state.lumen.sub(cost);
  board[nodeId] += 1;
  const lh = chainLighthouseById(lighthouseId);
  if (log) addLog(state, `${CHAIN_NODES[nodeId].name} at ${lh.name} raised to level ${board[nodeId]}.`);
  return true;
}

// ── Relighting the seven lighthouses (generalized in Sprint 5) ──────────────
// Lighthouses relight IN ORDER: LH(n) requires LH(n−1) lit, the chain
// awake, beam efficiency at or above the lighthouse's own requirement,
// and its Lumen cost. Lighting one is PERMANENT (it survives Rekindle;
// only New Game+ darkens the shore again) and starts a fresh, empty chain
// board — an empty board adds no support, so it can never drag efficiency
// down. Lighting The Hollow Light sets state.endingSeen (the ending).

export interface LighthouseStatus {
  lighthouseId: string;
  lit: boolean;
  /** Relight cost for this keeper (Friend of Gulls halves Gull Rock only). */
  cost: Decimal;
  /** The previous lighthouse in the order is lit (always true for LH1). */
  previousLit: boolean;
  /** Id of the previous lighthouse, or null for First Light. */
  previousId: string | null;
  /** Chain must be unlocked first. */
  chainUnlocked: boolean;
  /** Current chain efficiency, and what this lighthouse demands. */
  efficiency: number;
  efficiencyRequired: number;
  efficiencyOk: boolean;
  affordable: boolean;
  canRelight: boolean;
}

/** The relight cost of a lighthouse for this keeper. */
export function relightCost(state: GameState, lighthouseId: string): Decimal {
  // Friend of Gulls (Ember perk, Sprint 3) halves Gull Rock's cost — and
  // only Gull Rock's; the gulls have no cousins further out.
  if (lighthouseId === GULL_ROCK_ID) return gullRockRelightCost(state);
  return new Decimal(chainLighthouseById(lighthouseId).relightCost ?? 0);
}

export function lighthouseStatus(state: GameState, lighthouseId: string, now?: number): LighthouseStatus {
  const def = chainLighthouseById(lighthouseId);
  const status = chainStatus(state, now);
  const cost = relightCost(state, lighthouseId);
  const previousId = previousLighthouseId(lighthouseId);
  const previousLit = previousId === null || isLit(state, previousId);
  const affordable = state.lumen.gte(cost);
  const efficiencyOk = status.efficiency >= def.efficiencyRequirement;
  const lit = isLit(state, lighthouseId);
  return {
    lighthouseId,
    lit,
    cost,
    previousLit,
    previousId,
    chainUnlocked: status.unlocked,
    efficiency: status.efficiency,
    efficiencyRequired: def.efficiencyRequirement,
    efficiencyOk,
    affordable,
    canRelight: !lit && previousLit && status.unlocked && efficiencyOk && affordable,
  };
}

/** The first dark lighthouse in relight order, or null when all seven burn. */
export function nextLighthouseId(state: GameState): string | null {
  for (const def of CHAIN_LIGHTHOUSES) {
    if (def.relightCost !== null && !isLit(state, def.id)) return def.id;
  }
  return null;
}

const RELIGHT_LOG_LINES: Record<string, string> = {
  [GULL_ROCK_ID]: "Gull Rock Light burns again — every flame you tend burns half again as bright. (+50% production)",
  "cormorant-roost": "Cormorant Roost burns again — the cormorants approve, in their hundreds, all facing the light. (+75% production)",
  "widows-walk": "The Widow's Walk burns again — and in its store-rooms, a century of careful keeping, and a steward who never stopped keeping it. Every supply chain you tend runs half again as strong, and the Chain Steward now feeds it for you. (chain support +50%; the Chain Steward, on the Light view)",
  bellwether: "The Bellwether burns again — somewhere across the glass, its bell rings once, and the ships that are mostly memory turn toward it. Every ember you bank from now on weighs more. (Ember gain +25%; Memory Ships can be hired)",
  "sirens-rest": "Siren's Rest burns again — the sirens stir, stretch, and go back to sleep, mollified. The night itself works harder for you now. (offline rate +10 pts, offline cap +4h)",
  [HOLLOW_LIGHT_ID]: "THE HOLLOW LIGHT BURNS. From Candlewick Point to the heart of the sea, seven lights stand in a row across the glass — and the glass, all at once, remembers it was water. (+150% production)",
};

/**
 * Relight a lighthouse: permanent bonuses and a fresh chain board.
 * Enforces the full gate — order, chain awake, efficiency, cost — and
 * returns true on success. Lighting The Hollow Light also sets
 * state.endingSeen: the ending has been witnessed.
 * `now` is optional, as everywhere in the chain: the UI passes Date.now()
 * so the action checks the SAME tide-adjusted efficiency the Relight button
 * shows (Low Tide's ×1.2 support can open a gate; Stormfront can close one).
 * Omit it and the gate is checked tide-neutral, as the sim and tests do.
 */
export function relightLighthouse(state: GameState, lighthouseId: string, now?: number): boolean {
  const status = lighthouseStatus(state, lighthouseId, now);
  if (!status.canRelight) return false;
  state.lumen = state.lumen.sub(status.cost);
  state.litLighthouses.push(lighthouseId);
  state.chainBoards[lighthouseId] = startBoard(lighthouseId);
  const def = chainLighthouseById(lighthouseId);
  addLog(state, RELIGHT_LOG_LINES[lighthouseId] ?? `${def.name} burns again.`);
  if (def.triggersEnding) state.endingSeen = true;
  return true;
}

// ── Gull Rock Light (Sprint 2 API, kept as a thin wrapper) ──────────────────

export type GullRockStatus = LighthouseStatus;

export function gullRockStatus(state: GameState, now?: number): GullRockStatus {
  return lighthouseStatus(state, GULL_ROCK_ID, now);
}

/** Relight Gull Rock Light (see relightLighthouse for the general case). */
export function relightGullRock(state: GameState): boolean {
  return relightLighthouse(state, GULL_ROCK_ID);
}
