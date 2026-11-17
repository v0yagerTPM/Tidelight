import Decimal from "break_infinity.js";

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
