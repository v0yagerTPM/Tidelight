import Decimal from "break_infinity.js";
import { CHAIN_NODE_IDS, GENERATORS, type ChainNodeId } from "./config";
import {
  buyNodeUpgrade,
  chainStatus,
  nextLighthouseId,
  nextLevelSupportGain,
  nodeCost,
  relightLighthouse,
} from "./chain";
import { baseProductionPerSecond, buyGenerator, clickValue, costFor, lastingProductionMultiplier, productionPerSecond } from "./engine";
import { EMBER_PERKS, KINDLINGS, buyKindling, buyPerk, hasPerk, kindlingCost, kindlingLevel } from "./emberShop";
import { canBuyGenerator } from "./challenges";
import type { GameState } from "./types";
import { UPGRADES, buyUpgrade, isUnlocked } from "./upgrades";

// ── The greedy balance bot ───────────────────────────────────────────────────
// One shared playing strategy, used by scripts/simulate.ts (balance
// reports) and estimate.ts (the Rekindle recovery preview), so both always
// agree on what "greedy play" means:
//   • every step, buy whichever affordable action has the best payback
//     (cost ÷ production gain) — a generator copy, an upgrade, or a chain
//     node level on any lit board;
//   • once the supply chain is unlocked, keep it fed first: whenever
//     efficiency drops under 95%, buy the bottleneck node's next level
//     on the lit board giving the most support per Lumen, before other
//     purchases that step (support sums across boards);
//   • relight the next lighthouse (in order) the moment it is eligible;
//   • in "savings mode" (used by the endgame sim) it buys nothing but
//     chain feeding — the caller is saving for a lighthouse;
//   • click the beam once per 2 seconds for the first 10 minutes of a
//     run, like an engaged player who then goes idle (the clicking itself
//     is applied by the caller — this module only values it).

/** Clicking stops after this many seconds of a run. */
export const BOT_CLICK_WINDOW_SECONDS = 600;
/** Clicks per second while the bot is still clicking. */
export const BOT_CLICK_RATE = 0.5;

function productionWithGenerator(state: GameState, id: string): Decimal {
  state.generators[id] = (state.generators[id] ?? 0) + 1;
  const p = productionPerSecond(state);
  state.generators[id] = (state.generators[id] ?? 0) - 1;
  return p;
}

function productionWithUpgrade(state: GameState, id: string): Decimal {
  state.upgrades.push(id);
  const p = productionPerSecond(state);
  state.upgrades.pop();
  return p;
}

function clickWithUpgrade(state: GameState, id: string): Decimal {
  state.upgrades.push(id);
  const v = clickValue(state);
  state.upgrades.pop();
  return v;
}

function productionWithNodeUpgrade(state: GameState, lighthouseId: string, nodeId: ChainNodeId): Decimal {
  const board = state.chainBoards[lighthouseId];
  if (!board) return productionPerSecond(state);
  board[nodeId] += 1;
  const p = productionPerSecond(state);
  board[nodeId] -= 1;
  return p;
}

/**
 * The lit board where raising `nodeId` is the best value right now: most
 * support per Lumen for a supply node (boards work at different scales,
 * and deep levels cost more per Lumen/s), the cheapest level for Beam
 * (every Beam level adds the same +5%, whatever its board).
 */
export function bestBoardFor(state: GameState, nodeId: ChainNodeId): string | null {
  let best: string | null = null;
  let bestValue = -Infinity;
  for (const id of state.litLighthouses) {
    const board = state.chainBoards[id];
    if (!board) continue;
    const cost = nodeCost(id, nodeId, board[nodeId], state);
    const value =
      nodeId === "beam"
        ? -cost.toNumber()
        : nextLevelSupportGain(state, id, nodeId).div(cost).toNumber();
    if (value > bestValue) {
      best = id;
      bestValue = value;
    }
  }
  return best;
}

export interface BotAction {
  payback: number;
  /** The Lumen cost of the purchase (for reserve checks in savings mode). */
  cost: Decimal;
  run: () => boolean;
  label: string;
}

/** The single best-payback purchase available right now, or null. */
export function bestBotAction(state: GameState, tSeconds: number): BotAction | null {
  const production = productionPerSecond(state);
  const clickRate = tSeconds < BOT_CLICK_WINDOW_SECONDS ? BOT_CLICK_RATE : 0;
  let best: BotAction | null = null;
  const consider = (payback: number, run: () => boolean, label: string, cost: Decimal) => {
    if (Number.isFinite(payback) && payback >= 0 && (best === null || payback < best.payback)) {
      best = { payback, cost, run, label };
    }
  };

  for (const def of GENERATORS) {
    if (!canBuyGenerator(state, def.id)) continue; // a tier still waiting on its lighthouse
    const owned = state.generators[def.id] ?? 0;
    const cost = costFor(def, owned);
    if (state.lumen.lt(cost)) continue;
    const gain = productionWithGenerator(state, def.id).sub(production);
    if (gain.lte(0)) continue;
    consider(cost.div(gain).toNumber(), () => buyGenerator(state, def.id, 1), `buy ${def.name}`, cost);
  }

  for (const def of UPGRADES) {
    if (state.upgrades.includes(def.id)) continue;
    if (!isUnlocked(state, def)) continue;
    const cost = new Decimal(def.cost);
    if (state.lumen.lt(cost)) continue;
    const prodGain = productionWithUpgrade(state, def.id).sub(production);
    const clickGain = clickWithUpgrade(state, def.id).sub(clickValue(state)).mul(clickRate);
    const gain = prodGain.add(clickGain);
    if (gain.lte(0)) continue; // e.g. Longer Wicks: no value to an always-online bot
    consider(cost.div(gain).toNumber(), () => buyUpgrade(state, def.id), `buy upgrade ${def.name}`, cost);
  }

  // Chain node levels on any lit board (Sprint 5). A supply node only
  // pays while it is (jointly) the bottleneck — otherwise its measured
  // gain is 0 and it is skipped naturally; Beam levels always pay.
  if (chainStatus(state).unlocked) {
    for (const lighthouseId of state.litLighthouses) {
      const board = state.chainBoards[lighthouseId];
      if (!board) continue;
      for (const nodeId of CHAIN_NODE_IDS) {
        const cost = nodeCost(lighthouseId, nodeId, board[nodeId], state);
        if (state.lumen.lt(cost)) continue;
        const gain = productionWithNodeUpgrade(state, lighthouseId, nodeId).sub(production);
        if (gain.lte(0)) continue;
        consider(
          cost.div(gain).toNumber(),
          () => buyNodeUpgrade(state, lighthouseId, nodeId),
          `raise ${nodeId} at ${lighthouseId}`,
          cost,
        );
      }
    }
  }

  return best;
}

export interface BotHooks {
  /** Called with the upgrade id whenever the bot buys an upgrade. */
  onUpgradeBought?: (id: string) => void;
  /** Called with the lighthouse id whenever the bot relights one. */
  onLighthouseLit?: (id: string, tSeconds: number) => void;
}

export interface BotBuyOptions {
  /**
   * Savings mode: bank Lumen for the next lighthouse. Generator/upgrade
   * purchases stop (except, optionally, very cheap growth — see
   * growthPaybackCapSeconds); chain feeding continues, but only up to
   * feedUntilEfficiency and only out of Lumen above reserveLumen, so the
   * relight cost itself is never spent on wicks. The endgame sim's
   * lighthouse campaigns use this.
   */
  saveForLighthouse?: boolean;
  /** Stop feeding once chain efficiency reaches this (default 0.95). */
  feedUntilEfficiency?: number;
  /**
   * Feeding discipline (growth mode): never buy a bottleneck level whose
   * payback (cost ÷ production gain) exceeds this many seconds. Without
   * it, the late-game bot pours billions into levels that pay back over
   * geological time while demand outruns support anyway.
   */
  feedPaybackCapSeconds?: number;
  /**
   * Savings mode only: allow best-payback purchases whose payback is at
   * most this many seconds (cheap growth that barely moves demand).
   */
  growthPaybackCapSeconds?: number;
  /**
   * Feed patience (growth mode): when the chain is short and the next
   * bottleneck level costs no more than this many seconds of production,
   * save for it instead of spending on generators first. Without it, a bot
   * that spends every Lumen each step never affords a chain level and runs
   * starved however well feeding would pay.
   */
  saveToFeedSeconds?: number;
  /** Savings mode only: never let a purchase drop the purse below this. */
  reserveLumen?: Decimal;
  /**
   * Savings mode only: stop all growth purchases once base production
   * (the chain's demand) reaches this. A lighthouse campaign lives or
   * dies by its demand: support grows linearly and costs geometrically,
   * so past a point every extra generator makes the efficiency gate
   * LESS reachable, not more.
   */
  maxBaseProduction?: Decimal;
}

/**
 * One buy phase: the next lighthouse first (when eligible), then chain
 * feeding, then best-payback purchases until nothing affordable is worth
 * buying. In savings mode the last step is gated by the options above.
 */
export function botBuyPhase(
  state: GameState,
  tSeconds: number,
  hooks: BotHooks = {},
  options: BotBuyOptions = {},
): void {
  const feedUntil = options.feedUntilEfficiency ?? 0.95;
  const reserve = options.reserveLumen ?? new Decimal(0);
  for (let guard = 0; guard < 10_000; guard++) {
    const nextId = nextLighthouseId(state);
    if (nextId && relightLighthouse(state, nextId)) {
      hooks.onLighthouseLit?.(nextId, tSeconds);
      continue;
    }
    // Chain feeding: bottleneck first, cheapest board, up to the feed
    // target — and, when a discipline is set, only at a sane payback.
    const status = chainStatus(state);
    if (status.unlocked && status.efficiency < feedUntil && status.bottleneck) {
      const boardId = bestBoardFor(state, status.bottleneck);
      const board = boardId ? state.chainBoards[boardId] : undefined;
      if (boardId && board) {
        const cost = nodeCost(boardId, status.bottleneck, board[status.bottleneck], state);
        let worthIt = state.lumen.sub(cost).gte(reserve);
        if (worthIt && options.feedPaybackCapSeconds !== undefined) {
          const gain = productionWithNodeUpgrade(state, boardId, status.bottleneck).sub(
            productionPerSecond(state),
          );
          worthIt = gain.gt(0) && cost.div(gain).toNumber() <= options.feedPaybackCapSeconds;
        }
        if (worthIt && buyNodeUpgrade(state, boardId, status.bottleneck)) continue;
        if (
          !options.saveForLighthouse &&
          options.saveToFeedSeconds !== undefined &&
          state.lumen.lt(cost) &&
          cost.lte(productionPerSecond(state).mul(options.saveToFeedSeconds))
        ) {
          break; // wait a moment for a chain level worth more than more generators
        }
      }
    }
    // Purchases.
    if (
      options.maxBaseProduction !== undefined &&
      baseProductionPerSecond(state).gte(options.maxBaseProduction)
    ) {
      break; // demand cap reached: feed and save only
    }
    const action = bestBotAction(state, tSeconds);
    if (!action) break;
    if (options.saveForLighthouse) {
      // In savings mode only very cheap growth is allowed, and never out
      // of the reserve (the relight cost stays banked once reached).
      if (options.growthPaybackCapSeconds === undefined) break;
      if (action.payback > options.growthPaybackCapSeconds) break;
      if (state.lumen.sub(action.cost).lt(reserve)) break;
    }
    const before = state.upgrades.length;
    if (!action.run()) break;
    if (state.upgrades.length > before) {
      hooks.onUpgradeBought?.(state.upgrades[state.upgrades.length - 1]);
    }
  }
}

// ── The Ember shop, as the bot plays it ──────────────────────────────────────
// After each Rekindle the bot spends Embers the way a careful keeper would:
//   • a purchase that raises production (Second Wind, Ember Heart, Ember
//     Glow) only when the lasting multiplier is higher AFTER paying for it,
//     held-Ember bonus lost included;
//   • anything else (perks, Deep Draw, Long Wick, Long Watch) only when it
//     costs no more than a tenth of the Embers held.
// The automation perks change nothing for a bot that already buys
// everything itself; it still buys them under the tenth rule.

/** Share of held Embers the bot will spend on a perk that doesn't raise production directly. */
export const BOT_SHOP_SHARE = 0.1;
const PRODUCTION_PERKS = new Set(["second-wind", "ember-heart"]);

function lastingWith(state: GameState, apply: () => void, undo: () => void): Decimal {
  apply();
  const m = lastingProductionMultiplier(state);
  undo();
  return m;
}

/** Spend Embers in the shop; returns the names bought (in order). */
export function botShop(state: GameState): string[] {
  const bought: string[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const now = lastingProductionMultiplier(state);
    let pick: { name: string; run: () => boolean } | null = null;
    for (const def of EMBER_PERKS) {
      if (hasPerk(state, def.id) || state.embers < def.costEmbers) continue;
      const ok = PRODUCTION_PERKS.has(def.id)
        ? lastingWith(
            state,
            () => { state.emberPerks.push(def.id); state.embers -= def.costEmbers; },
            () => { state.emberPerks.pop(); state.embers += def.costEmbers; },
          ).gt(now)
        : def.costEmbers <= state.embers * BOT_SHOP_SHARE;
      if (ok) { pick = { name: def.name, run: () => buyPerk(state, def.id) }; break; }
    }
    if (!pick) {
      for (const def of KINDLINGS) {
        const cost = kindlingCost(state, def.id);
        if (!Number.isFinite(cost) || state.embers < cost) continue;
        const ok =
          def.id === "ember-glow"
            ? lastingWith(
                state,
                () => { state.kindlings[def.id] = kindlingLevel(state, def.id) + 1; state.embers -= cost; },
                () => { state.kindlings[def.id] = kindlingLevel(state, def.id) - 1; state.embers += cost; },
              ).gt(now)
            : cost <= state.embers * BOT_SHOP_SHARE;
        if (ok) { pick = { name: `${def.name} ${kindlingLevel(state, def.id) + 1}`, run: () => buyKindling(state, def.id) }; break; }
      }
    }
    if (!pick || !pick.run()) break;
    bought.push(pick.name);
  }
  return bought;
}
