import { CHAIN_LIGHTHOUSES, HOLLOW_LIGHT_ID } from "../game/config";
import { chainStatus } from "../game/chain";
import { productionPerSecond } from "../game/engine";
import { dutyMoths, patternById } from "../game/moths";
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
  /** 0 = no Seventh Light; 0.3 with one, rising to 1 at 25 (a halo round the lamp). */
  seventh: number;
  /** Collected moths on duty, drawn larger, in their wing colours. */
  duty: SceneMoth[];
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
    seventh: owned("seventh-light") > 0 ? 0.3 + 0.7 * Math.min(1, owned("seventh-light") / 25) : 0,
    duty: dutyMoths(state).map((m) => {
      const pattern = patternById(m.pattern);
      return { color: MOTH_WING_COLORS[pattern.id] ?? MOTH_WING_COLORS.plain, glow: m.glow / 100, tier: pattern.tier };
    }),
  };
}
