import Decimal from "break_infinity.js";

// ── Core game state ──────────────────────────────────────────────────────────
// Lumen values are break_infinity Decimals (they outgrow JS numbers fast).
// In the saved JSON they are serialized as strings; see state.ts.

export interface LogEntry {
  /** Unix timestamp (ms) when the entry was written. */
  at: number;
  message: string;
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
  /** Prestige currency currently held. Each held Ember boosts production. */
  embers: number;
  /** Generator id → copies owned. */
  generators: Record<string, number>;
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
  generators: Record<string, number>;
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
