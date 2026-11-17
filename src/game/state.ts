import Decimal from "break_infinity.js";
import { CHAIN_LIGHTHOUSES, CHAIN_NODE_IDS, FIRST_LIGHT_ID, chainLighthouseById } from "./config";
import type { BuyAmount, ChainBoard, GameState, SavedState, StorageLike } from "./types";

export const SAVE_KEY = "tidelight-save-v1";
export const SAVE_VERSION = 3;
/** Older saves (Sprint 0 = v1, Sprint 1 = v2) migrate forward on load. */
const LEGACY_SAVE_VERSIONS: readonly number[] = [1, 2];

const MAX_LOG_ENTRIES = 60;

// ── Chain board defaults & sanitizing (shared by create/migrate) ───────────

export function startBoard(lighthouseId: string): ChainBoard {
  return { ...chainLighthouseById(lighthouseId).startLevels };
}

export function defaultChainBoards(): Record<string, ChainBoard> {
  return { [FIRST_LIGHT_ID]: startBoard(FIRST_LIGHT_ID) };
}

function sanitizeLevel(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1_000_000, Math.max(0, Math.floor(value)));
}

function sanitizeBoard(raw: unknown, lighthouseId: string): ChainBoard {
  const start = startBoard(lighthouseId);
  if (typeof raw !== "object" || raw === null) return start;
  const b = raw as Partial<ChainBoard>;
  const board = { ...start };
  for (const nodeId of CHAIN_NODE_IDS) board[nodeId] = sanitizeLevel(b[nodeId], start[nodeId]);
  return board;
}

/**
 * Normalize the Sprint 2 lighthouse fields of a loaded save: lit ids are
 * filtered to known lighthouses, First Light is always lit, and every lit
 * lighthouse has a board (starting levels when the save predates Sprint 2).
 */
function sanitizeChain(
  litRaw: unknown,
  boardsRaw: unknown,
): { litLighthouses: string[]; chainBoards: Record<string, ChainBoard> } {
  const known = new Set(CHAIN_LIGHTHOUSES.map((l) => l.id));
  const lit: string[] = Array.isArray(litRaw)
    ? litRaw.filter((id): id is string => typeof id === "string" && known.has(id))
    : [];
  if (!lit.includes(FIRST_LIGHT_ID)) lit.unshift(FIRST_LIGHT_ID);
  const boardsIn =
    typeof boardsRaw === "object" && boardsRaw !== null ? (boardsRaw as Record<string, unknown>) : {};
  const chainBoards: Record<string, ChainBoard> = {};
  for (const id of lit) chainBoards[id] = sanitizeBoard(boardsIn[id], id);
  return { litLighthouses: lit, chainBoards };
}

export function createInitialState(now: number = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    lumen: new Decimal(0),
    lifetimeLumen: new Decimal(0),
    allTimeLumen: new Decimal(0),
    embers: 0,
    generators: {},
    upgrades: [],
    buyAmount: 1,
    litLighthouses: [FIRST_LIGHT_ID],
    chainBoards: defaultChainBoards(),
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
    upgrades: [...state.upgrades],
    buyAmount: state.buyAmount,
    litLighthouses: [...state.litLighthouses],
    chainBoards: Object.fromEntries(
      Object.entries(state.chainBoards).map(([id, board]) => [id, { ...board }]),
    ),
    totalClicks: state.totalClicks,
    totalGeneratorsBought: state.totalGeneratorsBought,
    totalRekindles: state.totalRekindles,
    playTimeSeconds: state.playTimeSeconds,
    lastSeen: state.lastSeen,
    log: state.log.map((e) => ({ ...e })),
  };
}

function validBuyAmount(value: unknown): BuyAmount {
  return value === 10 || value === 100 || value === "max" ? value : 1;
}

export function deserializeState(raw: unknown): GameState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Partial<SavedState>;
  // Accept the current version and the legacy shapes. A v1 save has no
  // upgrades/buyAmount yet; a v2 save has no chain fields — the missing
  // fields default, which is the migration.
  if (s.version !== SAVE_VERSION && !(s.version !== undefined && LEGACY_SAVE_VERSIONS.includes(s.version))) {
    return null;
  }
  try {
    return {
      version: SAVE_VERSION,
      lumen: new Decimal(s.lumen ?? "0"),
      lifetimeLumen: new Decimal(s.lifetimeLumen ?? "0"),
      allTimeLumen: new Decimal(s.allTimeLumen ?? "0"),
      embers: typeof s.embers === "number" ? s.embers : 0,
      generators: typeof s.generators === "object" && s.generators !== null ? { ...s.generators } : {},
      upgrades: Array.isArray(s.upgrades)
        ? s.upgrades.filter((id): id is string => typeof id === "string")
        : [],
      buyAmount: validBuyAmount(s.buyAmount),
      ...sanitizeChain(s.litLighthouses, s.chainBoards),
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
