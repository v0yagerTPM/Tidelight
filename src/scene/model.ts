import { CHAIN_LIGHTHOUSES, HOLLOW_LIGHT_ID, type SupplyNodeId } from "../game/config";
import { hasAlmanacReward } from "../game/almanac";
import { chainStatus, lighthouseStatus, nextLighthouseId } from "../game/chain";
import { productionPerSecond } from "../game/engine";
import { EXPEDITION_ROUTES } from "../game/expeditions";
import { COCOON_BASE_MS, cocoonDurationMs, dutyMoths, mothById, mothsUnlocked, patternById } from "../game/moths";
import { tideAt, type TideId } from "../game/tides";
import type { GameState } from "../game/types";

// ── The scene model ──────────────────────────────────────────────────────────
// Everything the Light-view scene draws, derived from game state in one pure
// function. The game loop rebuilds it 10×/s (with the rest of the UI); the
// renderer reads it on every animation frame and never touches GameState.
// Keeping the mapping here — not in the renderer — makes it testable and
// keeps drawing code free of game rules.

/** Solid canvas colours for each wing pattern (the cards use CSS gradients). */
export const MOTH_WING_COLORS: Record<string, string> = {
  plain: "#f3ecdc",
  spotted: "#ffd27a",
  striped: "#ffab6b",
  crescent: "#c9b8ff",
  starlit: "#9fe6d2",
  prismatic: "#ff9be0",
  tidelit: "#5fd0e8",
  hollow: "#eef3ff",
};

export interface SceneMoth {
  color: string;
  /** 0–1, from the moth's glow (1–100). */
  glow: number;
  /** Rarity tier 0–5; higher tiers shimmer. */
  tier: number;
}

export interface SceneModel {
  /** Lit state of the six far lighthouses, in relight order (First Light is home). */
  farLit: boolean[];
  /** The Hollow Light burns: the glass has remembered it was water. */
  seaIsWater: boolean;
  tide: TideId;
  /** 0.25–1: how strong the thrown beam is (the chain factor). */
  beamStrength: number;
  /** True while the chain is awake and short of demand — the lamp sputters. */
  starved: boolean;
  /** Beam levels widen and lengthen the beam a little. */
  beamLevels: number;
  /** 0–1: how far the lamplight pushes back the dark (log-scaled production). */
  reach: number;
  // Generators, as visible counts (capped so the scene stays legible and fast).
  crabs: number;
  motes: number;
  bells: number;
  cottageWindows: number;
  lensGlints: number;
  stormLanterns: number;
  whales: number;
  /** Memory ships drifting home along the horizon (0–3). */
  ships: number;
  /** 0 = no Seventh Light; 0.3 with one, rising to 1 at 25 (a halo round the lamp). */
  seventh: number;
  /** Collected moths on duty, drawn larger, in their wing colours. */
  duty: SceneMoth[];
  /** The Wing Almanac's last reward: a halo in the brightest moth's wing colour, or null. */
  lampHalo: string | null;
}

/**
 * How many of a generator to draw: one per copy at first, then slowly
 * filling toward `cap` (cap × (1 − e^(−owned/cap))), never 0 once owned.
 */
export function visibleCount(owned: number, cap: number): number {
  if (owned <= 0) return 0;
  return Math.max(1, Math.min(cap, Math.round(cap * (1 - Math.exp(-owned / cap)))));
}

/**
 * Production → 0–1 lamplight reach. 1 Lumen/s barely lights the rocks;
 * each ×10 pushes the dark back further; ~1e12/s lights the whole sea.
 */
export function reachFor(perSecond: number): number {
  if (!(perSecond > 0)) return 0;
  return Math.max(0, Math.min(1, (Math.log10(perSecond) + 1) / 13));
}

export function buildSceneModel(state: GameState, now: number): SceneModel {
  const owned = (id: string): number => state.generators[id] ?? 0;
  const chain = chainStatus(state, now);
  const perSecond = productionPerSecond(state, now);
  return {
    farLit: CHAIN_LIGHTHOUSES.slice(1).map((l) => state.litLighthouses.includes(l.id)),
    seaIsWater: state.litLighthouses.includes(HOLLOW_LIGHT_ID),
    tide: tideAt(now).def.id,
    beamStrength: chain.chainFactor,
    starved: chain.unlocked && chain.efficiency < 1,
    beamLevels: chain.beamLevels,
    reach: reachFor(perSecond.toNumber()),
    crabs: visibleCount(owned("candle-crab"), 12),
    motes: visibleCount(owned("lantern-moth"), 16),
    bells: visibleCount(owned("tide-bell"), 6),
    cottageWindows: visibleCount(owned("oil-keeper"), 4),
    lensGlints: visibleCount(owned("lens-polisher"), 5),
    stormLanterns: visibleCount(owned("storm-lantern"), 6),
    whales: visibleCount(owned("beacon-whale"), 3),
    ships: visibleCount(owned("memory-ship"), 3),
    seventh: owned("seventh-light") > 0 ? 0.3 + 0.7 * Math.min(1, owned("seventh-light") / 25) : 0,
    lampHalo: lampHaloColor(state),
    duty: dutyMoths(state).map((m) => {
      const pattern = patternById(m.pattern);
      return { color: MOTH_WING_COLORS[pattern.id] ?? MOTH_WING_COLORS.plain, glow: Math.min(1, m.glow / 100), tier: pattern.tier };
    }),
  };
}

// ── The coast (Lighthouses view) ─────────────────────────────────────────────

export interface CoastTower {
  id: string;
  name: string;
  lit: boolean;
  /** The first dark lighthouse in relight order — the one you can reach for. */
  isNext: boolean;
  /**
   * For the next lighthouse: 0–1, how close every gate is (the weaker of
   * Lumen saved toward the cost and beam efficiency toward the requirement).
   * 1 for lit towers, 0 for the rest.
   */
  readiness: number;
}

export interface CoastModel {
  towers: CoastTower[];
  seaIsWater: boolean;
  tide: TideId;
}

export function buildCoastModel(state: GameState, now: number): CoastModel {
  const next = nextLighthouseId(state);
  let nextReadiness = 0;
  if (next) {
    const ls = lighthouseStatus(state, next, now);
    const costPart = ls.cost.lte(0) ? 1 : Math.min(1, state.lumen.div(ls.cost).toNumber());
    const effPart = !ls.chainUnlocked ? 0 : ls.efficiencyRequired <= 0 ? 1 : Math.min(1, ls.efficiency / ls.efficiencyRequired);
    nextReadiness = Math.max(0, Math.min(costPart, effPart));
  }
  return {
    towers: CHAIN_LIGHTHOUSES.map((def) => {
      const lit = state.litLighthouses.includes(def.id);
      const isNext = def.id === next;
      return { id: def.id, name: def.name, lit, isNext, readiness: lit ? 1 : isNext ? nextReadiness : 0 };
    }),
    seaIsWater: state.litLighthouses.includes(HOLLOW_LIGHT_ID),
    tide: tideAt(now).def.id,
  };
}

// ── The chain flow (Lighthouses view) ────────────────────────────────────────

export interface ChainFlowNode {
  id: SupplyNodeId;
  /** This node's own support ÷ demand, 0–1. */
  efficiency: number;
  /** What actually flows out of this node: the weakest efficiency so far. */
  flow: number;
  bottleneck: boolean;
}

export interface ChainFlowModel {
  /** Before the chain wakes, it is drawn asleep. */
  unlocked: boolean;
  nodes: ChainFlowNode[];
  /** 0.25–1, the beam's strength. */
  chainFactor: number;
  beamLevels: number;
}

export function buildChainFlowModel(state: GameState, now: number): ChainFlowModel {
  const status = chainStatus(state, now);
  let flow = 1;
  return {
    unlocked: status.unlocked,
    nodes: status.nodes.map((n) => {
      flow = Math.min(flow, n.efficiency);
      return { id: n.nodeId, efficiency: n.efficiency, flow, bottleneck: status.bottleneck === n.nodeId };
    }),
    chainFactor: status.chainFactor,
    beamLevels: status.beamLevels,
  };
}

// ── The Shore meadow ─────────────────────────────────────────────────────────

export interface MeadowMoth {
  id: string;
  color: string;
  /** 0–1, from the moth's glow. */
  glow: number;
  tier: number;
  duty: boolean;
  inCocoon: boolean;
}

export interface MeadowModel {
  /** The garden wakes with the first Lantern Moth hired (or any moth kept). */
  unlocked: boolean;
  moths: MeadowMoth[];
  /** progress 0–1 toward hatching. */
  cocoon: { progress: number; ready: boolean } | null;
  /**
   * The bottle at sea: progress 0–1 of its voyage (out, then home), how far
   * its route reaches (0–1: the Drift … the Deep Glass Crossing), and
   * whether it has washed back.
   */
  bottle: { progress: number; reach: number; ready: boolean } | null;
}

export function buildMeadowModel(state: GameState, now: number): MeadowModel {
  const duty = new Set(dutyMoths(state).map((m) => m.id));
  const cocoonIds = new Set(state.cocoon?.parentIds ?? []);
  const cocoonParents = state.cocoon ? state.cocoon.parentIds.map((id) => mothById(state, id)) : [];
  const cocoonSpan =
    cocoonParents[0] && cocoonParents[1] ? cocoonDurationMs(cocoonParents[0], cocoonParents[1], state) : COCOON_BASE_MS;
  const cocoon = state.cocoon
    ? {
        progress: Math.max(0, Math.min(1, 1 - (state.cocoon.readyAt - now) / cocoonSpan)),
        ready: now >= state.cocoon.readyAt,
      }
    : null;
  let bottle: MeadowModel["bottle"] = null;
  if (state.expedition) {
    const e = state.expedition;
    const span = Math.max(1, e.returnsAt - e.startedAt);
    const routeIndex = Math.max(0, EXPEDITION_ROUTES.findIndex((r) => r.id === e.routeId));
    bottle = {
      progress: Math.max(0, Math.min(1, (now - e.startedAt) / span)),
      reach: EXPEDITION_ROUTES.length > 1 ? routeIndex / (EXPEDITION_ROUTES.length - 1) : 1,
      ready: now >= e.returnsAt,
    };
  }
  return {
    unlocked: mothsUnlocked(state),
    moths: state.moths.map((m) => {
      const pattern = patternById(m.pattern);
      return {
        id: m.id,
        color: MOTH_WING_COLORS[pattern.id] ?? MOTH_WING_COLORS.plain,
        glow: Math.min(1, m.glow / 100),
        tier: pattern.tier,
        duty: duty.has(m.id),
        inCocoon: cocoonIds.has(m.id),
      };
    }),
    cocoon,
    bottle,
  };
}

/** The halo colour once the Wing Almanac is complete: the brightest moth's wings. */
export function lampHaloColor(state: GameState): string | null {
  if (!hasAlmanacReward(state, "lamp-halo") || state.moths.length === 0) return null;
  const brightest = [...state.moths].sort((a, b) => b.glow - a.glow || patternById(b.pattern).tier - patternById(a.pattern).tier)[0];
  return MOTH_WING_COLORS[brightest.pattern] ?? MOTH_WING_COLORS.plain;
}
