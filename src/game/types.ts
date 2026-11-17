import Decimal from "break_infinity.js";
import type { Notation } from "./format";

// ── Core game state ──────────────────────────────────────────────────────────
// Lumen values are break_infinity Decimals (they outgrow JS numbers fast).
// In the saved JSON they are serialized as strings; see state.ts.

export interface LogEntry {
  /** Unix timestamp (ms) when the entry was written. */
  at: number;
  message: string;
}

/** Global generator buy-amount setting: a fixed count, or "max affordable". */
export type BuyAmount = 1 | 10 | 100 | "max";

/** One lighthouse's supply-chain board: node id → level. */
export interface ChainBoard {
  wick: number;
  oil: number;
  lens: number;
  beam: number;
}

// ── Sprint 4: moths, expeditions ─────────────────────────────────────────────

/** A collected lantern moth (see moths.ts). Permanent — survives Rekindle. */
export interface Moth {
  id: string;
  name: string;
  /** Wing pattern id (see MOTH_PATTERNS in moths.ts). */
  pattern: string;
  /** Glow rating, an integer 1–100. Brighter moths work harder on duty. */
  glow: number;
  /** 1 for attracted moths; max(parents) + 1 for bred ones. */
  generation: number;
}

/** A breeding in progress: two parents, ready to hatch at `readyAt` (ms). */
export interface Cocoon {
  parentIds: [string, string];
  /** Unix timestamp (ms) when the cocoon can be hatched. */
  readyAt: number;
}

/** A bottle expedition out at sea (see expeditions.ts). Timestamp-based. */
export interface ExpeditionState {
  routeId: string;
  /** Unix timestamp (ms) the bottle was sent. */
  startedAt: number;
  /** Unix timestamp (ms) it washes back. */
  returnsAt: number;
}

export interface GameState {
  /** Save-format version, for future migrations. */
  version: number;
  /** Spendable Lumen right now. */
  lumen: Decimal;
  /** Lumen earned in the current run — this is what Rekindle reads. */
  lifetimeLumen: Decimal;
  /** All-time Lumen earned across every run (a kept stat, never reset). */
  allTimeLumen: Decimal;
  /** Prestige currency currently held (spendable). Each HELD Ember boosts production. */
  embers: number;
  /** Lifetime Embers ever earned (Sprint 3). Only grows — spending never reduces it. */
  embersTotalEarned: number;
  /** Purchased Ember-shop perk ids (see emberShop.ts). Permanent, never reset. */
  emberPerks: string[];
  /** Id of the challenge run in progress (see challenges.ts), or null. */
  activeChallenge: string | null;
  /** Ids of challenges completed (reward banked permanently). Never reset. */
  completedChallenges: string[];
  /** Generator id → copies owned. */
  generators: Record<string, number>;
  /** Purchased upgrade ids (see upgrades.ts). Permanent ones survive Rekindle. */
  upgrades: string[];
  /** Global buy-amount setting for generator purchases. */
  buyAmount: BuyAmount;
  /** Ids of lighthouses that have been lit. Permanent — survives Rekindle. */
  litLighthouses: string[];
  /** Lighthouse id → its supply-chain board. Boards reset on Rekindle. */
  chainBoards: Record<string, ChainBoard>;
  // Sprint 4 — the Shore. Moths, relics and expeditions are PERMANENT:
  // none of these fields are touched by Rekindle or challenge resets.
  /** The lantern-moth collection. */
  moths: Moth[];
  /** Ids of moths currently on duty (max 3). */
  mothDuty: string[];
  /** Roost expansions bought (each adds 2 collection capacity). */
  roostExpansions: number;
  /** The breeding cocoon in progress, or null. */
  cocoon: Cocoon | null;
  /** The bottle expedition currently out, or null. */
  expedition: ExpeditionState | null;
  /** Relic ids claimed from expeditions (unique, permanent). */
  relics: string[];
  /** How many expedition story fragments have been delivered so far. */
  storyFragmentIndex: number;
  // Sprint 5 — story, ending, New Game+ and the Keeper's Desk.
  // Story, endingSeen and ngPlusCount are PERMANENT (they survive even
  // NG+); notation is a setting and likewise survives everything.
  /** Ids of story beats already delivered (see story.ts). Fire once, ever. */
  storySeen: string[];
  /** True once The Hollow Light has been lit and the ending witnessed. */
  endingSeen: boolean;
  /** How many Keepings (NG+ cycles) have been begun. Never resets. */
  ngPlusCount: number;
  /** Number-format setting: "standard" (1.23M) or "scientific" (1.23e6). */
  notation: Notation;
  // Kept stats (survive Rekindle):
  totalClicks: number;
  totalGeneratorsBought: number;
  totalRekindles: number;
  playTimeSeconds: number;
  /** Unix timestamp (ms) of the last save/tick — the offline-earnings anchor. */
  lastSeen: number;
  log: LogEntry[];
}

/** The JSON shape actually written to localStorage. Decimals become strings. */
export interface SavedState {
  version: number;
  lumen: string;
  lifetimeLumen: string;
  allTimeLumen: string;
  embers: number;
  embersTotalEarned: number;
  emberPerks: string[];
  activeChallenge: string | null;
  completedChallenges: string[];
  generators: Record<string, number>;
  upgrades: string[];
  buyAmount: BuyAmount;
  litLighthouses: string[];
  chainBoards: Record<string, ChainBoard>;
  moths: Moth[];
  mothDuty: string[];
  roostExpansions: number;
  cocoon: Cocoon | null;
  expedition: ExpeditionState | null;
  relics: string[];
  storyFragmentIndex: number;
  storySeen: string[];
  endingSeen: boolean;
  ngPlusCount: number;
  notation: Notation;
  totalClicks: number;
  totalGeneratorsBought: number;
  totalRekindles: number;
  playTimeSeconds: number;
  lastSeen: number;
  log: LogEntry[];
}

/** Minimal storage surface so tests can inject a fake instead of localStorage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
