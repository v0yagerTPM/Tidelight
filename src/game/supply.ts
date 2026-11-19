import Decimal from "break_infinity.js";
import { buyNodeUpgrade, chainStatus, chainUnlocked, nextLevelSupportGain, nodeCost, totalSupport } from "./chain";
import { CHAIN_NODES, SUPPLY_NODE_IDS, WIDOWS_WALK_ID, type ChainNodeId, type SupplyNodeId } from "./config";
import { baseProductionPerSecond, productionPerSecond } from "./engine";
import { STEWARD_LEDGER_PURSE_MULTIPLIER, hasPerk } from "./emberShop";
import { addLog } from "./state";
import type { GameState } from "./types";

// ── Feeding the supply chain from the Light view, and the Chain Steward ────
// The chain used to be tended one board at a time on the Lighthouses tab:
// find the weakest of Wick, Oil and Lens, then pick a board to raise it on.
// "Feed Oil" here buys the CHEAPEST Oil level on any lit board: every level
// helps the same node, and cheapest-first costs within a few percent of the
// best-value order when filling a starved chain (1–4% in tests at 3, 4 and 6
// lighthouses lit), while each press costs as little as it can. The
// Lighthouses tab keeps the board-by-board view for keepers who like to plan.
//
// The Chain Steward (Widow's Walk: "whoever waited here kept meticulous
// stores") tends the chain by itself: it sets aside a share of what the
// keeper earns and spends it feeding the bottleneck until the beam reaches
// the keeper's target efficiency. It treats the Beam as a fourth node and
// keeps it in step: below the target it buys whichever is cheaper, the
// bottleneck's next level or the next Beam level; at the target, it raises
// the Beam alone (a switch can stop that).

/** The lit board where the next level of `nodeId` is cheapest (null when none is lit). */
export function cheapestBoardFor(state: GameState, nodeId: ChainNodeId): string | null {
  let best: string | null = null;
  let bestCost: Decimal | null = null;
  for (const id of state.litLighthouses) {
    const board = state.chainBoards[id];
    if (!board) continue;
    const cost = nodeCost(id, nodeId, board[nodeId], state);
    if (bestCost === null || cost.lt(bestCost)) {
      best = id;
      bestCost = cost;
    }
  }
  return best;
}

/** What feeding a node would do now: the board, the price and the result. */
export interface FeedQuote {
  nodeId: ChainNodeId;
  /** The board with the cheapest next level of this node, or null (nothing lit / chain asleep). */
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
  const board = chainUnlocked(state) ? cheapestBoardFor(state, nodeId) : null;
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

/** Buy the cheapest level of a node on any lit board. */
export function feedNode(state: GameState, nodeId: ChainNodeId, log = true): boolean {
  const board = chainUnlocked(state) ? cheapestBoardFor(state, nodeId) : null;
  return board !== null && buyNodeUpgrade(state, board, nodeId, log);
}

export interface FillResult {
  levels: number;
  spent: Decimal;
  efficiency: number;
}

/**
 * Feed the bottleneck (cheapest level first), again and again, until the beam reaches `target`
 * efficiency or the next level costs more than `budget` (default: the whole
 * purse). One log line for the lot.
 */
export function fillChain(state: GameState, target = 1, budget: Decimal = state.lumen, now?: number, log = true): FillResult {
  let spent = new Decimal(0);
  let levels = 0;
  for (let guard = 0; guard < 5000; guard++) {
    const st = chainStatus(state, now);
    if (!st.unlocked || st.efficiency >= target || !st.bottleneck) break;
    const board = cheapestBoardFor(state, st.bottleneck);
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

/** The purse cap in seconds of production: 10 minutes, 30 with the Steward's Ledger (Ember perk). */
export function stewardPurseCapSeconds(state: GameState): number {
  return STEWARD_PURSE_CAP_SECONDS * (hasPerk(state, "steward-ledger") ? STEWARD_LEDGER_PURSE_MULTIPLIER : 1);
}

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
  const cap = productionPerSecond(state, now).mul(stewardPurseCapSeconds(state));
  if (state.stewardPurse.gt(cap)) state.stewardPurse = cap;
  let levels = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const step = stewardStep(state, now);
    if (!step) break;
    if (state.stewardPurse.lt(step.cost) || state.lumen.lt(step.cost)) break;
    if (!buyNodeUpgrade(state, step.board, step.nodeId, false)) break;
    state.stewardPurse = state.stewardPurse.sub(step.cost);
    levels++;
  }
  return levels;
}

/**
 * The Steward's next purchase. The Beam is its fourth node, kept in step
 * with the supplies: while the chain is short of the target, it buys the
 * cheaper of the bottleneck's next level and the next Beam level (+5%
 * production each); once the chain is at the target, it raises the Beam
 * alone. With "Then raise the Beam" off, it only feeds.
 */
function stewardStep(state: GameState, now?: number): { board: string; nodeId: ChainNodeId; cost: Decimal } | null {
  const st = chainStatus(state, now);
  if (!st.unlocked) return null;
  const level = (board: string, nodeId: ChainNodeId) => ({ board, nodeId, cost: nodeCost(board, nodeId, state.chainBoards[board][nodeId], state) });
  const feedBoard = st.efficiency < state.stewardTarget - 1e-9 && st.bottleneck ? cheapestBoardFor(state, st.bottleneck) : null;
  const feed = feedBoard && st.bottleneck ? level(feedBoard, st.bottleneck) : null;
  const beamBoard = state.stewardBeam ? cheapestBoardFor(state, "beam") : null;
  const beam = beamBoard ? level(beamBoard, "beam") : null;
  if (feed && beam) return beam.cost.lt(feed.cost) ? beam : feed;
  return feed ?? beam;
}
