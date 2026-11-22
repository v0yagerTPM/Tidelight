import Decimal from "break_infinity.js";
import { QUARTERMASTER_SHARE, quartermasterActive } from "./automation";
import { chainUnlocked } from "./chain";
import { productionPerSecond } from "./engine";
import { feedQuote, nodeName, stewardActive } from "./supply";
import type { GameState } from "./types";
import { UPGRADES, isUnlocked } from "./upgrades";

// ── The best buy that isn't a hire ───────────────────────────────────────────
// The Light view marks the best buy, but it weighed only the helpers: a
// starving beam's "Feed Lens before hiring more" sat under a gold Tide Bell,
// and a new keeper following the gold learned no lessons in five minutes
// with two ×2 lessons affordable (design review 6). This weighs the other
// buys a keeper can make from there: a feed on the supply chain (unless the
// Chain Steward is feeding it) and an affordable lesson, each by the Lumen/s
// it adds, measured on the game's own production.

export interface OtherBuy {
  kind: "feed" | "lesson";
  /** A supply node ("wick", "oil", "lens", "beam") or an upgrade id. */
  id: string;
  name: string;
  gain: Decimal;
  cost: Decimal;
}

/**
 * Lumen/s each feed and lesson would add, now: those affordable, and those
 * within `withinSeconds` of your production (worth saving for: a keeper who
 * spends the moment a hire is affordable never reaches a lesson otherwise).
 * `before`: today's Lumen/s, if the caller has it.
 */
export function otherBuys(state: GameState, now?: number, before?: Decimal, withinSeconds = 60): OtherBuy[] {
  before ??= productionPerSecond(state, now);
  const reach = state.lumen.add(before.mul(withinSeconds));
  const out: OtherBuy[] = [];
  if (chainUnlocked(state) && !stewardActive(state)) {
    for (const nodeId of ["wick", "oil", "lens", "beam"] as const) {
      const q = feedQuote(state, nodeId, now);
      if (!q.board || !q.cost || q.cost.gt(reach)) continue;
      const board = state.chainBoards[q.board];
      if (!board) continue;
      board[nodeId] += 1;
      const after = productionPerSecond(state, now);
      board[nodeId] -= 1;
      out.push({ kind: "feed", id: nodeId, name: nodeName(nodeId), gain: Decimal.max(0, after.sub(before)), cost: q.cost });
    }
  }
  for (const u of UPGRADES) {
    if (state.upgrades.includes(u.id) || !isUnlocked(state, u) || reach.lt(u.cost)) continue;
    // The Quartermaster is about to learn it (within its quarter of your Lumen): no need to say so.
    if (quartermasterActive(state) && state.lumen.mul(QUARTERMASTER_SHARE).gte(u.cost)) continue;
    state.upgrades.push(u.id);
    const after = productionPerSecond(state, now);
    state.upgrades.pop();
    out.push({ kind: "lesson", id: u.id, name: u.name, gain: Decimal.max(0, after.sub(before)), cost: new Decimal(u.cost) });
  }
  return out;
}
