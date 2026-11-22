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
  /** Glow rating, an integer 1–120 (above 100 only for Hollow moths). Brighter moths work harder on duty. */
  glow: number;
  /** 1 for attracted moths; max(parents) + 1 for bred ones. */
  generation: number;
  /** A trait id (see mothTraits.ts), absent for a moth without one. */
  trait?: string;
  /** A Hollow moth's second trait (only Hollow moths carry two). */
  trait2?: string;
}

/** A breeding in progress: two parents, ready to hatch at `readyAt` (ms). */
export interface Cocoon {
  parentIds: [string, string];
  /** Unix timestamp (ms) when the cocoon can be hatched. */
  readyAt: number;
  /**
   * Wait for a Stormfront (v18): once ready, the cocoon opens by itself in
   * the next Stormfront, live or while away (moths.tendCocoons), so a
   * Starlit or Prismatic hatchling can turn Tidelit without the keeper there.
   */
  stormWait?: boolean;
}

/** A bottle expedition out at sea (see expeditions.ts). Timestamp-based. */
export interface ExpeditionState {
  routeId: string;
  /** Unix timestamp (ms) the bottle was sent. */
  startedAt: number;
  /** Unix timestamp (ms) it washes back. */
  returnsAt: number;
  /** A moth riding along (see mothTraits.ts), if any. */
  riderId?: string;
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
  /** Waymarks of the Crossing lit, 0–3 (config.ts WAYMARKS, in order). Permanent like the lighthouses. */
  crossing: number;
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
  /** Cocoons spinning, one per nest in use (moths.nestCount; v17, was a single cocoon). */
  cocoons: Cocoon[];
  /** Moth lures ready to spend (0–3); see moths.ts. */
  mothLures: number;
  /** Unix ms the lure regrow clock counts from (meaningless with a full bank). */
  mothLureAnchor: number;
  /** Rush lures bought since the bank last regrew one (prices the next). */
  mothLureRushes: number;
  /** Lighthouse id → the moth posted there (see mothTraits.ts). */
  mothPosts: Record<string, string>;
  /** Wing Almanac entries filled, as "pattern:trait" keys (see almanac.ts). */
  almanac: string[];
  /** Wing Scales from released moths, spent on scented lures. */
  wingScales: number;
  /** The Chain Steward (supply.ts): on/off, share of income, target efficiency, purse. */
  stewardOn: boolean;
  stewardShare: number;
  stewardTarget: number;
  stewardPurse: Decimal;
  /** Whether the Chain Steward also raises the Beam once the chain is fed. */
  stewardBeam: boolean;
  /** Kindling levels by id (Ember shop, v12). */
  kindlings: Record<string, number>;
  /** Quartermaster and Lamp Crew switches (they come with Gull Rock and Cormorant Roost; saved since v12). */
  autoLearn: boolean;
  autoHire: boolean;
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
  /** Guide pages read (game/guide.ts GUIDE_PAGE_IDS). Older saves count as having read them all. */
  guideSeen: string[];
  /**
   * Seconds this run has lasted (live play plus credited time away), for
   * the Rekindle moment (game/rekindleMoment.ts). -1 in a save from before
   * v15: estimated from the run's lifetime on first use.
   */
  runSeconds: number;
  /** The best Ember growth rate this run has reached (rekindleMoment.ts). */
  runBestGrowth: number;
  /**
   * A bottle has come home from the Deep Glass Crossing since Siren's Rest
   * was lit: the Glass Stair's offering (config.ts WAYMARKS). Goes dark
   * with the waymarks in a Next Keeping.
   */
  deepGlassBottle: boolean;
  /**
   * Let spares go on arrival (v18): a lured moth that fills no new Almanac
   * page and isn't brighter than the best of its wings already kept flies
   * straight back out, leaving its Wing Scales.
   */
  autoReleaseSpares: boolean;
  /** The route Glass Charts sets a returned bottle out on again (the last sent or chosen), or null. */
  bottleRoute: string | null;
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
  /** v13: waymarks of the Crossing lit (0–3). */
  crossing?: number;
  chainBoards: Record<string, ChainBoard>;
  moths: Moth[];
  mothDuty: string[];
  roostExpansions: number;
  /** Before v17: the single cocoon. */
  cocoon?: Cocoon | null;
  /** v17: every cocoon spinning. */
  cocoons?: Cocoon[];
  mothLures: number;
  mothLureAnchor: number;
  mothLureRushes: number;
  mothPosts: Record<string, string>;
  almanac: string[];
  wingScales: number;
  stewardOn: boolean;
  stewardShare: number;
  stewardTarget: number;
  stewardPurse: string;
  stewardBeam?: boolean;
  kindlings?: Record<string, number>;
  autoLearn?: boolean;
  autoHire?: boolean;
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
  /** v14: guide pages read; absent in older saves (they read the whole guide up front). */
  guideSeen?: string[];
  /** v15: the run's length and best Ember growth rate, and the Glass Stair's offering. */
  runSeconds?: number;
  runBestGrowth?: number;
  deepGlassBottle?: boolean;
  /** v18: let spares go on arrival. */
  autoReleaseSpares?: boolean;
  /** v16: Glass Charts' standing route. */
  bottleRoute?: string | null;
  lastSeen: number;
  log: LogEntry[];
}

/** Minimal storage surface so tests can inject a fake instead of localStorage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
