import Decimal from "break_infinity.js";
import type { GameState, SavedState, StorageLike } from "./types";

export const SAVE_KEY = "tidelight-save-v1";
export const SAVE_VERSION = 1;

const MAX_LOG_ENTRIES = 60;

export function createInitialState(now: number = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    lumen: new Decimal(0),
    lifetimeLumen: new Decimal(0),
    allTimeLumen: new Decimal(0),
    embers: 0,
    generators: {},
    totalClicks: 0,
    totalGeneratorsBought: 0,
    totalRekindles: 0,
    playTimeSeconds: 0,
    lastSeen: now,
    log: [{ at: now, message: "You arrive at Candlewick Point. The lamp is cold. The sea is glass." }],
  };
}

/** Append an entry to the in-game event log (newest last, capped). */
export function addLog(state: GameState, message: string, now: number = Date.now()): void {
  state.log.push({ at: now, message });
  if (state.log.length > MAX_LOG_ENTRIES) {
    state.log.splice(0, state.log.length - MAX_LOG_ENTRIES);
  }
}

// ── Serialization ────────────────────────────────────────────────────────────

export function serializeState(state: GameState): SavedState {
  return {
    version: SAVE_VERSION,
    lumen: state.lumen.toString(),
    lifetimeLumen: state.lifetimeLumen.toString(),
    allTimeLumen: state.allTimeLumen.toString(),
    embers: state.embers,
    generators: { ...state.generators },
    totalClicks: state.totalClicks,
    totalGeneratorsBought: state.totalGeneratorsBought,
    totalRekindles: state.totalRekindles,
    playTimeSeconds: state.playTimeSeconds,
    lastSeen: state.lastSeen,
    log: state.log.map((e) => ({ ...e })),
  };
}

export function deserializeState(raw: unknown): GameState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Partial<SavedState>;
  if (s.version !== SAVE_VERSION) return null;
  try {
    return {
      version: SAVE_VERSION,
      lumen: new Decimal(s.lumen ?? "0"),
      lifetimeLumen: new Decimal(s.lifetimeLumen ?? "0"),
      allTimeLumen: new Decimal(s.allTimeLumen ?? "0"),
      embers: typeof s.embers === "number" ? s.embers : 0,
      generators: typeof s.generators === "object" && s.generators !== null ? { ...s.generators } : {},
      totalClicks: s.totalClicks ?? 0,
      totalGeneratorsBought: s.totalGeneratorsBought ?? 0,
      totalRekindles: s.totalRekindles ?? 0,
      playTimeSeconds: s.playTimeSeconds ?? 0,
      lastSeen: typeof s.lastSeen === "number" ? s.lastSeen : Date.now(),
      log: Array.isArray(s.log) ? s.log : [],
    };
  } catch {
    return null; // A corrupt Decimal string should never brick the game.
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveState(state: GameState, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  state.lastSeen = Date.now();
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(serializeState(state)));
  } catch {
    // Storage full/blocked: the game keeps running in memory.
  }
}

export function loadState(storage: StorageLike | null = defaultStorage()): GameState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    return deserializeState(JSON.parse(raw));
  } catch {
    return null;
  }
}
