import Decimal from "break_infinity.js";
import { ALMANAC_TRAITS, almanacKeysOf, isAlmanacKey } from "./almanac";
import { CHAIN_LIGHTHOUSES, CHAIN_NODE_IDS, FIRST_LIGHT_ID, GENERATORS, HOLLOW_LIGHT_ID, WAYMARKS, chainLighthouseById } from "./config";
// The definition tables below are only read inside deserializeState (call
// time), so these imports form no load-time cycle with modules that import
// addLog from here.
import { CHALLENGES } from "./challenges";
import { EMBER_PERKS, KINDLINGS, RETIRED_PERKS } from "./emberShop";
import { GUIDE_PAGE_IDS } from "./guide";
import { EXPEDITION_ROUTES, RELICS } from "./expeditions";
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
export const SAVE_VERSION = 17;
/** Older saves (Sprint 0 = v1 … Chain Steward = v11) migrate on load. */
const LEGACY_SAVE_VERSIONS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
/** supply.ts STEWARD_SHARES / STEWARD_TARGETS (literal: this module stays a leaf). */
const STEWARD_SHARE_CHOICES: readonly number[] = [0.1, 0.25, 0.5];
const STEWARD_TARGET_CHOICES: readonly number[] = [0.8, 0.9, 1];

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

/** mothTraits.ts trait ids (kept literal here so this module stays a leaf). */
const MOTH_TRAIT_IDS: readonly string[] = ALMANAC_TRAITS.filter((t) => t !== "none");
/** The largest lure bank (almanac.ts lureBankSize: 3, +1 Almanac, +1 Moth Lantern); kept literal: moths.ts imports this module. */
const LURE_BANK = 5;
/** Duty slots at most (almanac.ts dutySlots). */
const MAX_DUTY_SLOTS = 5;

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
        ? Math.max(1, Math.min(120, Math.floor(m.glow)))
        : 1,
    generation:
      typeof m.generation === "number" && Number.isFinite(m.generation)
        ? Math.max(1, Math.floor(m.generation))
        : 1,
    // v8: traits. A save before them has none; an unknown id is dropped.
    ...(typeof m.trait === "string" && MOTH_TRAIT_IDS.includes(m.trait) ? { trait: m.trait } : {}),
    // v10: a Hollow moth's second trait (kept only beside a different first one).
    ...(typeof m.trait === "string" && MOTH_TRAIT_IDS.includes(m.trait) && typeof m.trait2 === "string" && m.trait2 !== m.trait && MOTH_TRAIT_IDS.includes(m.trait2)
      ? { trait2: m.trait2 }
      : {}),
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

function sanitizeExpedition(raw: unknown, mothIds: Set<string> = new Set()): ExpeditionState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Partial<ExpeditionState>;
  if (typeof e.routeId !== "string") return null;
  if (typeof e.startedAt !== "number" || !Number.isFinite(e.startedAt)) return null;
  if (typeof e.returnsAt !== "number" || !Number.isFinite(e.returnsAt)) return null;
  const rider = typeof e.riderId === "string" && mothIds.has(e.riderId) ? { riderId: e.riderId } : {};
  return { routeId: e.routeId, startedAt: e.startedAt, returnsAt: e.returnsAt, ...rider };
}

/** A Decimal from a saved string; anything unreadable or negative is 0 (never bricks a save). */
function safeDecimal(raw: unknown): Decimal {
  if (typeof raw !== "string") return new Decimal(0);
  try {
    const d = new Decimal(raw);
    return Number.isFinite(d.mantissa) && Number.isFinite(d.exponent) && d.gte(0) ? d : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

function sanitizeAlmanac(raw: unknown, moths: Moth[]): string[] {
  const keys = Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string" && isAlmanacKey(k)) : [];
  for (const m of moths) keys.push(...almanacKeysOf(m));
  return [...new Set(keys)].filter(isAlmanacKey);
}

/**
 * Normalize the Sprint 4 fields of a loaded save: moths are structurally
 * validated, the duty roster is filtered to moths that actually exist
 * (and capped at 3), and a cocoon survives only while both parents do.
 * (v17: there can be several cocoons, one per nest.)
 * Saves before v5 simply have none of these fields — they default empty.
 */
function sanitizeShore(s: Partial<SavedState>): {
  moths: Moth[];
  mothDuty: string[];
  roostExpansions: number;
  cocoons: Cocoon[];
  mothLures: number;
  mothLureAnchor: number;
  mothLureRushes: number;
  mothPosts: Record<string, string>;
  almanac: string[];
  wingScales: number;
  expedition: ExpeditionState | null;
  relics: string[];
  storyFragmentIndex: number;
} {
  const moths: Moth[] = Array.isArray(s.moths)
    ? s.moths.map(sanitizeMoth).filter((m): m is Moth => m !== null)
    : [];
  const mothIds = new Set(moths.map((m) => m.id));
  // v8: lighthouse posts. One moth per lit lighthouse, each moth at one post,
  // and a posted moth is never also on duty. Saves before posts have none.
  const lit = new Set(Array.isArray(s.litLighthouses) ? s.litLighthouses : []);
  lit.add("first-light");
  const mothPosts: Record<string, string> = {};
  if (typeof s.mothPosts === "object" && s.mothPosts !== null) {
    const used = new Set<string>();
    for (const [lighthouseId, mothId] of Object.entries(s.mothPosts as Record<string, unknown>)) {
      if (typeof mothId !== "string" || !lit.has(lighthouseId) || !mothIds.has(mothId) || used.has(mothId)) continue;
      used.add(mothId);
      mothPosts[lighthouseId] = mothId;
    }
  }
  const posted = new Set(Object.values(mothPosts));
  const mothDuty = sanitizeIdList(s.mothDuty)
    .filter((id) => mothIds.has(id) && !posted.has(id))
    .slice(0, MAX_DUTY_SLOTS);
  return {
    moths,
    mothDuty,
    roostExpansions: sanitizeCount(s.roostExpansions),
    // v17: several nests. A v16 save's single cocoon becomes the first; no
    // moth sits in two, and a cocoon whose parents are gone is dropped.
    cocoons: (() => {
      const raw = Array.isArray(s.cocoons) ? s.cocoons : s.cocoon ? [s.cocoon] : [];
      const out: Cocoon[] = [];
      for (const r of raw) {
        const c = sanitizeCocoon(r, moths);
        if (c && !out.some((o) => o.parentIds.some((id) => c.parentIds.includes(id)))) out.push(c);
      }
      return out;
    })(),
    // The moth rebalance (v7) migration: a full lure bank, the clock from now.
    mothLures: typeof s.mothLures === "number" ? Math.min(LURE_BANK, sanitizeCount(s.mothLures)) : 3,
    mothLureAnchor:
      typeof s.mothLureAnchor === "number" && Number.isFinite(s.mothLureAnchor) ? s.mothLureAnchor : Date.now(),
    mothLureRushes: sanitizeCount(s.mothLureRushes),
    mothPosts,
    // v9: the Wing Almanac (every moth already held counts) and Wing Scales.
    almanac: sanitizeAlmanac(s.almanac, moths),
    wingScales: sanitizeCount(s.wingScales),
    expedition: sanitizeExpedition(s.expedition, mothIds),
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
    crossing: 0,
    chainBoards: defaultChainBoards(),
    moths: [],
    mothDuty: [],
    roostExpansions: 0,
    cocoons: [],
    mothLures: 3, // a full starting bank (almanac.ts lureBankSize)
    mothLureAnchor: now,
    mothLureRushes: 0,
    mothPosts: {},
    almanac: [],
    wingScales: 0,
    stewardOn: true,
    stewardShare: 0.25,
    stewardTarget: 1,
    stewardPurse: new Decimal(0),
    stewardBeam: true,
    kindlings: {},
    autoLearn: true,
    autoHire: true,
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
    guideSeen: [],
    runSeconds: 0,
    runBestGrowth: 0,
    deepGlassBottle: false,
    bottleRoute: null,
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
    crossing: state.crossing,
    chainBoards: Object.fromEntries(
      Object.entries(state.chainBoards).map(([id, board]) => [id, { ...board }]),
    ),
    moths: state.moths.map((m) => ({ ...m })),
    mothDuty: [...state.mothDuty],
    roostExpansions: state.roostExpansions,
    cocoons: state.cocoons.map((c) => ({ parentIds: [...c.parentIds] as [string, string], readyAt: c.readyAt })),
    mothLures: state.mothLures,
    mothLureAnchor: state.mothLureAnchor,
    mothLureRushes: state.mothLureRushes,
    mothPosts: { ...state.mothPosts },
    almanac: [...state.almanac],
    wingScales: state.wingScales,
    stewardOn: state.stewardOn,
    stewardShare: state.stewardShare,
    stewardTarget: state.stewardTarget,
    stewardPurse: state.stewardPurse.toString(),
    stewardBeam: state.stewardBeam,
    kindlings: { ...state.kindlings },
    autoLearn: state.autoLearn,
    autoHire: state.autoHire,
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
    guideSeen: [...state.guideSeen],
    runSeconds: state.runSeconds,
    runBestGrowth: state.runBestGrowth,
    deepGlassBottle: state.deepGlassBottle,
    bottleRoute: state.bottleRoute,
    lastSeen: state.lastSeen,
    log: state.log.map((e) => ({ ...e })),
  };
}

function validBuyAmount(value: unknown): BuyAmount {
  return value === 10 || value === 100 || value === "max" ? value : 1;
}

function sanitizeKindlings(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const def of KINDLINGS) {
    const level = sanitizeCount((value as Record<string, unknown>)[def.id]);
    if (level > 0) out[def.id] = def.maxLevel !== undefined ? Math.min(def.maxLevel, level) : level;
  }
  return out;
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
    // Perks no longer sold (the Quartermaster and Lamp Crew now come with
    // the lighthouses) are refunded once: the sanitized perk list drops
    // them, so the next save no longer holds them.
    const retired = RETIRED_PERKS.filter((p) => Array.isArray(s.emberPerks) && s.emberPerks.includes(p.id));
    const refund = retired.reduce((sum, p) => sum + p.costEmbers, 0);
    const embers = sanitizeCount(s.embers) + refund;
    const state: GameState = {
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
      crossing: 0, // set below, once the lit lighthouses are known
      ...sanitizeShore(s),
      // v11: the Chain Steward — on by default, a quarter of income, a full beam.
      stewardOn: s.stewardOn !== false,
      stewardShare: typeof s.stewardShare === "number" && STEWARD_SHARE_CHOICES.includes(s.stewardShare) ? s.stewardShare : 0.25,
      stewardTarget: typeof s.stewardTarget === "number" && STEWARD_TARGET_CHOICES.includes(s.stewardTarget) ? s.stewardTarget : 1,
      stewardPurse: safeDecimal(s.stewardPurse),
      // The Steward raising the Beam: on unless switched off (added within v12).
      stewardBeam: s.stewardBeam !== false,
      // v12: Kindling levels (known ids only, whole numbers, within any cap)
      // and the Quartermaster / Lamp Crew switches, on unless switched off.
      kindlings: sanitizeKindlings(s.kindlings),
      autoLearn: s.autoLearn !== false,
      autoHire: s.autoHire !== false,
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
      // v14: the guide opens a page at a time. A save from before it read
      // the whole guide up front, so it counts every page as read.
      guideSeen: Array.isArray(s.guideSeen)
        ? GUIDE_PAGE_IDS.filter((id) => (s.guideSeen as unknown[]).includes(id))
        : [...GUIDE_PAGE_IDS],
      // v15: a run from before the Rekindle moment has an unknown length
      // (-1); rekindleMoment.ts estimates it from the run's lifetime.
      runSeconds: typeof s.runSeconds === "number" && Number.isFinite(s.runSeconds) && s.runSeconds >= 0 ? s.runSeconds : -1,
      runBestGrowth: typeof s.runBestGrowth === "number" && Number.isFinite(s.runBestGrowth) && s.runBestGrowth >= 0 ? s.runBestGrowth : 0,
      deepGlassBottle: s.deepGlassBottle === true,
      // v16: Glass Charts' standing route; a v15 save's bottle at sea sets it.
      bottleRoute: typeof s.bottleRoute === "string" && EXPEDITION_ROUTES.some((r) => r.id === s.bottleRoute) ? s.bottleRoute : null,
      lastSeen: typeof s.lastSeen === "number" && Number.isFinite(s.lastSeen) ? s.lastSeen : Date.now(),
      log: sanitizeLog(s.log),
    };
    // v13: the Crossing. A keeper who already lit The Hollow Light crossed
    // the deep glass on the way (before the waymarks were charted).
    state.crossing = state.litLighthouses.includes(HOLLOW_LIGHT_ID)
      ? WAYMARKS.length
      : Math.min(WAYMARKS.length, sanitizeCount(s.crossing));
    if (refund > 0) {
      addLog(
        state,
        `${retired.map((p) => p.name).join(" and ")} now come${retired.length === 1 ? "s" : ""} with the lighthouses, so the ${refund.toLocaleString("en-US")} Embers you paid are back in the tin.`,
        state.lastSeen,
      );
    }
    return state;
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
