import Decimal from "break_infinity.js";
import { CHAIN_LIGHTHOUSES, CHAIN_NODE_IDS, FIRST_LIGHT_ID, GENERATORS, chainLighthouseById } from "./config";
// The definition tables below are only read inside deserializeState (call
// time), so these imports form no load-time cycle with modules that import
// addLog from here.
import { CHALLENGES } from "./challenges";
import { EMBER_PERKS } from "./emberShop";
import { RELICS } from "./expeditions";
import { STORY_BEATS } from "./story";
import { UPGRADES } from "./upgrades";
import type {
  BuyAmount,
  ChainBoard,
  Cocoon,
  ExpeditionState,
  GameState,
  LogEntry,
  Moth,
  SavedState,
  StorageLike,
} from "./types";

export const SAVE_KEY = "tidelight-save-v1";
export const SAVE_VERSION = 6;
/** Older saves (Sprint 0 = v1 … Sprint 4 = v5) migrate on load. */
const LEGACY_SAVE_VERSIONS: readonly number[] = [1, 2, 3, 4, 5];

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

// ── Sprint 4 (Shore) field sanitizing ────────────────────────────────────────

const MAX_DUTY_MOTHS = 3;

function sanitizeMoth(raw: unknown): Moth | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Partial<Moth>;
  if (typeof m.id !== "string" || m.id.length === 0) return null;
  return {
    id: m.id,
    name: typeof m.name === "string" && m.name.length > 0 ? m.name : "Nameless",
    pattern: typeof m.pattern === "string" ? m.pattern : "plain",
    glow:
      typeof m.glow === "number" && Number.isFinite(m.glow)
        ? Math.max(1, Math.min(100, Math.floor(m.glow)))
        : 1,
    generation:
      typeof m.generation === "number" && Number.isFinite(m.generation)
        ? Math.max(1, Math.floor(m.generation))
        : 1,
  };
}

function sanitizeCocoon(raw: unknown, moths: Moth[]): Cocoon | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Partial<Cocoon>;
  if (!Array.isArray(c.parentIds) || c.parentIds.length !== 2) return null;
  const [a, b] = c.parentIds;
  if (typeof a !== "string" || typeof b !== "string" || a === b) return null;
  if (typeof c.readyAt !== "number" || !Number.isFinite(c.readyAt)) return null;
  // A cocoon whose parents are gone can never hatch — drop it.
  if (!moths.some((m) => m.id === a) || !moths.some((m) => m.id === b)) return null;
  return { parentIds: [a, b], readyAt: c.readyAt };
}

function sanitizeExpedition(raw: unknown): ExpeditionState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Partial<ExpeditionState>;
  if (typeof e.routeId !== "string") return null;
  if (typeof e.startedAt !== "number" || !Number.isFinite(e.startedAt)) return null;
  if (typeof e.returnsAt !== "number" || !Number.isFinite(e.returnsAt)) return null;
  return { routeId: e.routeId, startedAt: e.startedAt, returnsAt: e.returnsAt };
}

/**
 * Normalize the Sprint 4 fields of a loaded save: moths are structurally
 * validated, the duty roster is filtered to moths that actually exist
 * (and capped at 3), and a cocoon survives only while both parents do.
 * Saves before v5 simply have none of these fields — they default empty.
 */
function sanitizeShore(s: Partial<SavedState>): {
  moths: Moth[];
  mothDuty: string[];
  roostExpansions: number;
  cocoon: Cocoon | null;
  expedition: ExpeditionState | null;
  relics: string[];
  storyFragmentIndex: number;
} {
  const moths: Moth[] = Array.isArray(s.moths)
    ? s.moths.map(sanitizeMoth).filter((m): m is Moth => m !== null)
    : [];
  const mothIds = new Set(moths.map((m) => m.id));
  const mothDuty = sanitizeIdList(s.mothDuty)
    .filter((id) => mothIds.has(id))
    .slice(0, MAX_DUTY_MOTHS);
  return {
    moths,
    mothDuty,
    roostExpansions: sanitizeCount(s.roostExpansions),
    cocoon: sanitizeCocoon(s.cocoon, moths),
    expedition: sanitizeExpedition(s.expedition),
    relics: sanitizeIdList(s.relics, RELICS),
    storyFragmentIndex: sanitizeCount(s.storyFragmentIndex),
  };
}

export function createInitialState(now: number = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    lumen: new Decimal(0),
    lifetimeLumen: new Decimal(0),
    allTimeLumen: new Decimal(0),
    embers: 0,
    embersTotalEarned: 0,
    emberPerks: [],
    activeChallenge: null,
    completedChallenges: [],
    generators: {},
    upgrades: [],
    buyAmount: 1,
    litLighthouses: [FIRST_LIGHT_ID],
    chainBoards: defaultChainBoards(),
    moths: [],
    mothDuty: [],
    roostExpansions: 0,
    cocoon: null,
    expedition: null,
    relics: [],
    storyFragmentIndex: 0,
    storySeen: [],
    endingSeen: false,
    ngPlusCount: 0,
    notation: "standard",
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
    embersTotalEarned: state.embersTotalEarned,
    emberPerks: [...state.emberPerks],
    activeChallenge: state.activeChallenge,
    completedChallenges: [...state.completedChallenges],
    generators: { ...state.generators },
    upgrades: [...state.upgrades],
    buyAmount: state.buyAmount,
    litLighthouses: [...state.litLighthouses],
    chainBoards: Object.fromEntries(
      Object.entries(state.chainBoards).map(([id, board]) => [id, { ...board }]),
    ),
    moths: state.moths.map((m) => ({ ...m })),
    mothDuty: [...state.mothDuty],
    roostExpansions: state.roostExpansions,
    cocoon: state.cocoon ? { parentIds: [...state.cocoon.parentIds], readyAt: state.cocoon.readyAt } : null,
    expedition: state.expedition ? { ...state.expedition } : null,
    relics: [...state.relics],
    storyFragmentIndex: state.storyFragmentIndex,
    storySeen: [...state.storySeen],
    endingSeen: state.endingSeen,
    ngPlusCount: state.ngPlusCount,
    notation: state.notation,
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

function sanitizeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * Keep only string ids, and — when a table of known ids is given — only ids
 * that table defines, without duplicates. A save from a newer build or a
 * hand-edited import can name perks, relics or upgrades this build doesn't
 * know; looking those up throws, so they are dropped here instead.
 */
function sanitizeIdList(value: unknown, known?: readonly { id: string }[]): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = known ? new Set(known.map((d) => d.id)) : null;
  const out: string[] = [];
  for (const id of value) {
    if (typeof id !== "string" || out.includes(id)) continue;
    if (allowed && !allowed.has(id)) continue;
    out.push(id);
  }
  return out;
}

/** Generator counts for known generators only, as whole non-negative numbers. */
function sanitizeGenerators(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof value !== "object" || value === null) return out;
  const raw = value as Record<string, unknown>;
  for (const def of GENERATORS) {
    const count = sanitizeCount(raw[def.id]);
    if (count > 0) out[def.id] = count;
  }
  return out;
}

function sanitizeLog(value: unknown): LogEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is LogEntry => typeof e === "object" && e !== null && typeof e.at === "number" && typeof e.message === "string")
    .slice(-MAX_LOG_ENTRIES)
    .map((e) => ({ at: e.at, message: e.message }));
}

export function deserializeState(raw: unknown): GameState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Partial<SavedState>;
  // Accept the current version and the legacy shapes. A v1 save has no
  // upgrades/buyAmount yet; a v2 save has no chain fields; a v3 save has
  // no Sprint 3 fields; a v4 save has no Sprint 4 (Shore) fields; a v5
  // save has no Sprint 5 fields (story/ending/NG+/notation) — the missing
  // fields default, which is the migration. Lit lighthouses generalize
  // through sanitizeChain: a v5 keeper's Gull Rock simply stays lit.
  if (s.version !== SAVE_VERSION && !(s.version !== undefined && LEGACY_SAVE_VERSIONS.includes(s.version))) {
    return null;
  }
  try {
    const embers = sanitizeCount(s.embers);
    return {
      version: SAVE_VERSION,
      lumen: new Decimal(s.lumen ?? "0"),
      lifetimeLumen: new Decimal(s.lifetimeLumen ?? "0"),
      allTimeLumen: new Decimal(s.allTimeLumen ?? "0"),
      embers,
      // Sprint 3 migration: saves before v4 never tracked lifetime Embers,
      // so the held balance is the best (and only) lower bound for it.
      embersTotalEarned:
        typeof s.embersTotalEarned === "number" ? sanitizeCount(s.embersTotalEarned) : embers,
      emberPerks: sanitizeIdList(s.emberPerks, EMBER_PERKS),
      activeChallenge:
        typeof s.activeChallenge === "string" && CHALLENGES.some((c) => c.id === s.activeChallenge)
          ? s.activeChallenge
          : null,
      completedChallenges: sanitizeIdList(s.completedChallenges, CHALLENGES),
      generators: sanitizeGenerators(s.generators),
      upgrades: sanitizeIdList(s.upgrades, UPGRADES),
      buyAmount: validBuyAmount(s.buyAmount),
      ...sanitizeChain(s.litLighthouses, s.chainBoards),
      ...sanitizeShore(s),
      // Sprint 5 migration: story unseen, ending unwitnessed, no Keepings
      // yet, standard notation — unless the save says otherwise.
      storySeen: sanitizeIdList(s.storySeen, STORY_BEATS),
      endingSeen: s.endingSeen === true,
      ngPlusCount: sanitizeCount(s.ngPlusCount),
      notation: s.notation === "scientific" ? "scientific" : "standard",
      totalClicks: sanitizeCount(s.totalClicks),
      totalGeneratorsBought: sanitizeCount(s.totalGeneratorsBought),
      totalRekindles: sanitizeCount(s.totalRekindles),
      playTimeSeconds: typeof s.playTimeSeconds === "number" && Number.isFinite(s.playTimeSeconds) ? Math.max(0, s.playTimeSeconds) : 0,
      lastSeen: typeof s.lastSeen === "number" && Number.isFinite(s.lastSeen) ? s.lastSeen : Date.now(),
      log: sanitizeLog(s.log),
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
