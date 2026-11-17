import Decimal from "break_infinity.js";
import {
  BEAM_BONUS_PER_LEVEL,
  CHAIN_FLOOR,
  CHAIN_NODES,
  CHAIN_UNLOCK_GENERATORS,
  GULL_ROCK_EFFICIENCY_REQUIREMENT,
  GULL_ROCK_ID,
  SUPPLY_NODE_IDS,
  chainLighthouseById,
  type ChainNodeId,
  type SupplyNodeId,
} from "./config";
// NOTE: engine ↔ chain is a deliberate, call-time-only cycle. Engine's
// productionPerSecond applies this module's chain factor and beam bonus;
// this module's chainStatus reads engine's baseProductionPerSecond as the
// chain's demand. Neither module calls the other at load time, and
// baseProductionPerSecond itself never calls back into the chain.
import { chainSupportMultiplier, gullRockRelightCost } from "./emberShop";
import { baseProductionPerSecond } from "./engine";
import { addLog, startBoard } from "./state";
import type { ChainBoard, GameState } from "./types";
import { totalGeneratorsOwned } from "./upgrades";

// ── The supply chain: wick → oil → lens → beam ───────────────────────────────
// Production ordering (see engine.ts):
//   generators (milestones, upgrades, challenge tier reward) × Keeper's
//   Focus × Ember bonus × Second Wind × challenge rule/rewards
//   × lighthouse bonuses  =  BASE production — this is the chain's "demand"
//   × chain factor (0.25 + 0.75 × efficiency, or 1 while the chain is locked)
//   × beam bonus (1 + 5% × total Beam levels)
//   =  final production.
//
// Each supply node's efficiency is min(1, totalSupport / demand), where
// totalSupport sums that node's levels across every lit lighthouse's board.
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
 * Total Lumen/s a supply node supports across all boards.
 * Deep Wicks (Ember perk, Sprint 3) raises every node's support by +25%.
 */
export function totalSupport(state: GameState, nodeId: SupplyNodeId): Decimal {
  return new Decimal(CHAIN_NODES[nodeId].supportPerLevel)
    .mul(totalNodeLevels(state, nodeId))
    .mul(chainSupportMultiplier(state));
}

/**
 * Cost of raising a node from `level` to `level + 1` on a given board:
 * ceil(baseCost × growth^level × boardCostMultiplier). The second
 * lighthouse's board costs ×8.
 */
export function nodeCost(lighthouseId: string, nodeId: ChainNodeId, level: number): Decimal {
  const def = CHAIN_NODES[nodeId];
  const lh = chainLighthouseById(lighthouseId);
  return new Decimal(def.baseCost)
    .mul(new Decimal(def.growth).pow(level))
    .mul(lh.boardCostMultiplier)
    .ceil();
}

/** Cost of the next level of a node on a board, at its current level. */
export function nextNodeCost(state: GameState, lighthouseId: string, nodeId: ChainNodeId): Decimal {
  const level = state.chainBoards[lighthouseId]?.[nodeId] ?? 0;
  return nodeCost(lighthouseId, nodeId, level);
}

// ── Lighthouse & beam bonuses ────────────────────────────────────────────────

/** Multiplicative production bonus from lit lighthouses (Gull Rock: ×1.5). */
export function lighthouseMultiplier(state: GameState): Decimal {
  let mult = new Decimal(1);
  for (const id of state.litLighthouses) {
    mult = mult.mul(1 + chainLighthouseById(id).productionBonus);
  }
  return mult;
}

export function totalBeamLevels(state: GameState): number {
  return totalNodeLevels(state, "beam");
}

/** Final-production multiplier from Beam levels: 1 + 5% per level, additive. */
export function beamMultiplier(state: GameState): Decimal {
  return new Decimal(1 + BEAM_BONUS_PER_LEVEL * totalBeamLevels(state));
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

export function chainStatus(state: GameState): ChainStatus {
  const demand = baseProductionPerSecond(state);
  const nodes: SupplyNodeStatus[] = SUPPLY_NODE_IDS.map((nodeId) => {
    const support = totalSupport(state, nodeId);
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
export function chainFactor(state: GameState): number {
  return chainStatus(state).chainFactor;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Raise one chain node by a level on a lit lighthouse's board.
 * Fails cleanly (false, no change) while the chain is locked, the
 * lighthouse is dark, or the player can't afford the next level.
 */
export function buyNodeUpgrade(state: GameState, lighthouseId: string, nodeId: ChainNodeId): boolean {
  if (!chainUnlocked(state)) return false;
  const board = state.chainBoards[lighthouseId];
  if (!isLit(state, lighthouseId) || !board) return false;
  const cost = nodeCost(lighthouseId, nodeId, board[nodeId]);
  if (state.lumen.lt(cost)) return false;
  state.lumen = state.lumen.sub(cost);
  board[nodeId] += 1;
  const lh = chainLighthouseById(lighthouseId);
  addLog(state, `${CHAIN_NODES[nodeId].name} at ${lh.name} raised to level ${board[nodeId]}.`);
  return true;
}

// ── Gull Rock Light ──────────────────────────────────────────────────────────

export interface GullRockStatus {
  lit: boolean;
  cost: Decimal;
  /** Chain must be unlocked first. */
  chainUnlocked: boolean;
  /** Current chain efficiency, and the 50% Gull Rock demands. */
  efficiency: number;
  efficiencyRequired: number;
  efficiencyOk: boolean;
  affordable: boolean;
  canRelight: boolean;
}

export function gullRockStatus(state: GameState): GullRockStatus {
  const status = chainStatus(state);
  // Friend of Gulls (Ember perk, Sprint 3) halves the relight cost.
  const cost = gullRockRelightCost(state);
  const affordable = state.lumen.gte(cost);
  const efficiencyOk = status.efficiency >= GULL_ROCK_EFFICIENCY_REQUIREMENT;
  const lit = isLit(state, GULL_ROCK_ID);
  return {
    lit,
    cost,
    chainUnlocked: status.unlocked,
    efficiency: status.efficiency,
    efficiencyRequired: GULL_ROCK_EFFICIENCY_REQUIREMENT,
    efficiencyOk,
    affordable,
    canRelight: !lit && status.unlocked && efficiencyOk && affordable,
  };
}

/**
 * Relight Gull Rock Light: a permanent +50% production bonus and a second
 * chain board (starting empty — an empty board adds no support, so it can
 * never drag efficiency down). Requires the chain unlocked, current chain
 * efficiency ≥ 50%, and the Lumen cost. Returns true on success.
 */
export function relightGullRock(state: GameState): boolean {
  const status = gullRockStatus(state);
  if (!status.canRelight) return false;
  state.lumen = state.lumen.sub(status.cost);
  state.litLighthouses.push(GULL_ROCK_ID);
  state.chainBoards[GULL_ROCK_ID] = startBoard(GULL_ROCK_ID);
  addLog(state, "Gull Rock Light burns again — every flame you tend burns half again as bright. (+50% production)");
  return true;
}
