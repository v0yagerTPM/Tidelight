import Decimal from "break_infinity.js";
import { bestBoardFor } from "./bot";
import { buyNodeUpgrade, chainStatus, chainUnlocked, nextLevelSupportGain, nodeCost, totalSupport } from "./chain";
import { CHAIN_NODES, SUPPLY_NODE_IDS, WIDOWS_WALK_ID, type ChainNodeId, type SupplyNodeId } from "./config";
import { baseProductionPerSecond, productionPerSecond } from "./engine";
import { addLog } from "./state";
import type { GameState } from "./types";

// ── Feeding the supply chain from the Light view, and the Chain Steward ────
// The chain used to be tended one board at a time on the Lighthouses tab:
// find the weakest of Wick, Oil and Lens, then work out which lit board gives
// the most support per Lumen. That second step is arithmetic, and the sim's
// bot already does it (bot.ts bestBoardFor), so "feed Oil" here means "buy
// the best-value Oil level on any board". The Lighthouses tab keeps the
// board-by-board view for keepers who like to plan.
//
// The Chain Steward (Widow's Walk: "whoever waited here kept meticulous
// stores") tends the chain by itself: it sets aside a share of what the
// keeper earns and spends it feeding the bottleneck until the beam reaches
// the keeper's target efficiency.

/** What feeding a node would do now: the board, the price and the result. */
export interface FeedQuote {
  nodeId: ChainNodeId;
  /** The best-value board for this node, or null (nothing lit / chain asleep). */
  board: string | null;
  cost: Decimal | null;
  affordable: boolean;
  /** Lumen/s of support the level adds (0 for Beam). */
  supportGain: Decimal;
  /** Beam efficiency after the purchase (unchanged for Beam). */
  efficiencyAfter: number;
}

export function feedQuote(state: GameState, nodeId: ChainNodeId, now?: number): FeedQuote {
  const before = chainStatus(state, now);
  const board = chainUnlocked(state) ? bestBoardFor(state, nodeId) : null;
  if (!board) return { nodeId, board: null, cost: null, affordable: false, supportGain: new Decimal(0), efficiencyAfter: before.efficiency };
  const cost = nodeCost(board, nodeId, state.chainBoards[board]?.[nodeId] ?? 0, state);
  if (nodeId === "beam") {
    return { nodeId, board, cost, affordable: state.lumen.gte(cost), supportGain: new Decimal(0), efficiencyAfter: before.efficiency };
  }
  const gain = nextLevelSupportGain(state, board, nodeId, now);
  const demand = before.demand;
  let efficiencyAfter = 1;
  for (const n of before.nodes) {
    const support = n.nodeId === nodeId ? n.support.add(gain) : n.support;
    efficiencyAfter = Math.min(efficiencyAfter, demand.lte(0) ? 1 : Math.min(1, support.div(demand).toNumber()));
  }
  return { nodeId, board, cost, affordable: state.lumen.gte(cost), supportGain: gain, efficiencyAfter };
}

/** Buy the best-value level of a node on any lit board. */
export function feedNode(state: GameState, nodeId: ChainNodeId, log = true): boolean {
  const board = chainUnlocked(state) ? bestBoardFor(state, nodeId) : null;
  return board !== null && buyNodeUpgrade(state, board, nodeId, log);
}

export interface FillResult {
  levels: number;
  spent: Decimal;
  efficiency: number;
}

/**
 * Feed the bottleneck, again and again, until the beam reaches `target`
 * efficiency or the next level costs more than `budget` (default: the whole
 * purse). One log line for the lot.
 */
export function fillChain(state: GameState, target = 1, budget: Decimal = state.lumen, now?: number, log = true): FillResult {
  let spent = new Decimal(0);
  let levels = 0;
  for (let guard = 0; guard < 5000; guard++) {
    const st = chainStatus(state, now);
    if (!st.unlocked || st.efficiency >= target || !st.bottleneck) break;
    const board = bestBoardFor(state, st.bottleneck);
    if (!board) break;
    const cost = nodeCost(board, st.bottleneck, state.chainBoards[board][st.bottleneck], state);
    if (spent.add(cost).gt(budget) || state.lumen.lt(cost)) break;
    if (!buyNodeUpgrade(state, board, st.bottleneck, false)) break;
    spent = spent.add(cost);
    levels++;
  }
  const efficiency = chainStatus(state, now).efficiency;
  if (log && levels > 0) {
    addLog(state, `You walk the supply line and see to it: ${levels} level${levels === 1 ? "" : "s"} of supplies, the beam at ${Math.round(efficiency * 100)}%.`);
  }
  return { levels, spent, efficiency };
}

/** Beam efficiency if base production (the chain's demand) rose by `extraDemand`. */
export function efficiencyAtDemand(state: GameState, extraDemand: Decimal, now?: number): number {
  if (!chainUnlocked(state)) return 1;
  const demand = baseProductionPerSecond(state).add(extraDemand);
  if (demand.lte(0)) return 1;
  let efficiency = 1;
  for (const nodeId of SUPPLY_NODE_IDS) efficiency = Math.min(efficiency, Math.min(1, totalSupport(state, nodeId, now).div(demand).toNumber()));
  return efficiency;
}

/** The weakest node if demand rose by `extraDemand` (null when all keep up). */
export function bottleneckAtDemand(state: GameState, extraDemand: Decimal, now?: number): SupplyNodeId | null {
  if (!chainUnlocked(state)) return null;
  const demand = baseProductionPerSecond(state).add(extraDemand);
  let worst: SupplyNodeId | null = null;
  let worstRatio = 1;
  for (const nodeId of SUPPLY_NODE_IDS) {
    const ratio = demand.lte(0) ? 1 : totalSupport(state, nodeId, now).div(demand).toNumber();
    if (ratio < worstRatio) {
      worstRatio = ratio;
      worst = nodeId;
    }
  }
  return worst;
}

export function nodeName(nodeId: ChainNodeId): string {
  return CHAIN_NODES[nodeId].name;
}

// ── The Chain Steward ────────────────────────────────────────────────────────

export const STEWARD_SHARES: readonly number[] = [0.1, 0.25, 0.5];
export const STEWARD_TARGETS: readonly number[] = [0.8, 0.9, 1];
/** The steward's purse never holds more than this many seconds of production. */
export const STEWARD_PURSE_CAP_SECONDS = 600;

/** Widow's Walk lit: the steward is at work (if the keeper leaves it on). */
export function stewardUnlocked(state: GameState): boolean {
  return state.litLighthouses.includes(WIDOWS_WALK_ID);
}

export function stewardActive(state: GameState): boolean {
  return stewardUnlocked(state) && state.stewardOn && chainUnlocked(state);
}

/**
 * The steward's turn: set aside its share of `earned`, then feed the
 * bottleneck from that purse until the beam reaches the target or the next
 * level is out of reach. Quiet: no log line per level. Returns the levels bought.
 */
export function tendChain(state: GameState, earned: Decimal, now?: number): number {
  if (!stewardActive(state)) return 0;
  if (earned.gt(0)) state.stewardPurse = state.stewardPurse.add(earned.mul(state.stewardShare));
  const cap = productionPerSecond(state, now).mul(STEWARD_PURSE_CAP_SECONDS);
  if (state.stewardPurse.gt(cap)) state.stewardPurse = cap;
  const budget = Decimal.min(state.stewardPurse, state.lumen);
  const result = fillChain(state, state.stewardTarget, budget, now, false);
  state.stewardPurse = Decimal.max(0, state.stewardPurse.sub(result.spent));
  return result.levels;
}
