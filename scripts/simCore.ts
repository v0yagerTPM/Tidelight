// ── The balance simulation, as a reusable function ───────────────────────────
// scripts/simulate.ts prints its report; tuning scripts can call runSim()
// after adjusting config values and compare results.
//
// A greedy bot plays the current build, using the shared strategy in
// src/game/bot.ts: every step it buys whichever affordable action has the
// best payback (cost ÷ production gain) — a generator copy, an upgrade or
// a chain node level — it keeps the supply chain fed (bottleneck node
// first, on the best-value board, whenever efficiency drops under 95%), it
// relights the next lighthouse the moment it's eligible, and it clicks the
// beam once per 2 seconds for the first 10 minutes of each run only, like
// an engaged player who then goes idle.
//
// Phase A — the early game: the bot plays through the first Rekindle (at
// the recommended 40 Embers) and on to the second.
//
// Phase B — the endgame, played plainly (post-launch rebalance): grow
// greedily, keep the chain fed (saving for a chain level when it costs no
// more than 10 minutes of production, as a keeper would), and once the next lighthouse costs no more
// than SAVE_WINDOW_SECONDS of production, stop growing and save for it
// (feeding the chain out of the surplus until its gate is met), then
// relight. Rekindle (minimum 40 Embers, never while saving) when the run's
// Ember growth rate is past its peak (REKINDLE_PAST_PEAK below), as a
// keeper does: a phone playthrough Rekindled 8 times to the ending where
// the old rule (at +50% of the Embers held) Rekindled 64. Before the rebalance this phase
// needed a "demand cap" — the bot had to refuse to grow, because every
// generator pushed the gates further away. It no longer does: if plain
// greedy play reaches the ending, growing never locks it.
//
// The bot is a PESSIMISTIC bound on a real keeper: no Ember perks, no
// challenges, no moths, no relics, no tides, no bottles.
import Decimal from "break_infinity.js";
import { BOT_CLICK_WINDOW_SECONDS, botBuyPhase, botShop } from "../src/game/bot";
import { CHAIN_LIGHTHOUSES, GENERATORS, HOLLOW_LIGHT_ID, PRESTIGE_RECOMMENDED_EMBERS, WAYMARKS } from "../src/game/config";
import { chainStatus, lighthouseStatus, nextLighthouseId } from "../src/game/chain";
import { clickBeam, productionPerSecond, tick } from "../src/game/engine";
import { rekindle, rekindleGain } from "../src/game/prestige";
import { createInitialState } from "../src/game/state";
import type { GameState } from "../src/game/types";
import { upgradeById } from "../src/game/upgrades";

const EARLY_CAP_SECONDS = 12 * 3600;
export const ENDGAME_CAP_SECONDS = 500 * 3600;
/** Start saving for the next lighthouse once it costs this much production or less. */
export const SAVE_WINDOW_SECONDS = 1800;
/** A save that runs this long without lighting is a stall: Rekindle and carry on. */
const STALL_SECONDS = 24 * 3600;

export interface SimResult {
  firstRekindleMinutes: number | null;
  secondRekindleMinutes: number | null;
  /** Hours from the start of the sim to each relight. */
  litAtHours: Record<string, number>;
  /** When each waymark of the Crossing was lit (config.ts WAYMARKS). */
  waymarkAtHours: Record<string, number>;
  endingHours: number | null;
  /** Highest generator tier (1–8) ever owned. */
  highestTierOwned: number;
  /** Time-weighted mean chain efficiency through Phase B (chain awake). */
  meanEfficiencyEndgame: number;
  /** Share of Phase B time spent below 25% efficiency. */
  starvedShareEndgame: number;
  /** Saves that stalled and had to Rekindle out. */
  stalls: number;
  rekindles: number;
  finalProduction: number;
  finalEmbers: number;
  finalGenerators: Record<string, number>;
  earlyUpgrades: string[];
  log: string[];
  /** log10(production/s) sampled at whole hours of Phase B time (sim clock). */
  curve: Record<number, number>;
  /**
   * Endgame runs grouped by lighthouses lit: how many, their average length,
   * and how far into the run the last upgrade was bought (minutes). The gap
   * between the two is time with nothing new to learn.
   */
  runsByLit: Record<number, { runs: number; avgMinutes: number; lastUpgradeMinutes: number; upgradesOwned: number }>;
  /** Ember perks in the order the bot bought them, with the sim hour. */
  perksBought: string[];
  /** Kindling levels at the stop. */
  finalKindlings: Record<string, number>;
}

/**
 * Endgame Rekindle policy (re-baselined after a real playthrough): a
 * keeper Rekindles when the run has done the most it can for the Embers.
 * Held Embers multiply production, so what a run is worth is how far it
 * grows them: ln(1 + gain / held) per hour of run. That rate climbs while
 * the run builds and falls once the √ in the Ember formula takes over; the
 * bot Rekindles (when not saving) once it has fallen this far below its
 * best. The old rule, Rekindle at +50% of the Embers held, Rekindled eight
 * times as often as a person did and set the pacing ~8× too slow.
 */
export const REKINDLE_PAST_PEAK = 0.98;
/**
 * What a Rekindle costs in time beyond the run itself: buying the helpers
 * and the chain back. Without it the rate looks best in a run's first
 * minute (the √ again) and the bot Rekindles thousands of times for
 * nothing. Fifteen minutes puts the bot at 10 Rekindles to the ending with
 * the phone keeper's kit, who Rekindled 8 times.
 */
export const REKINDLE_REBUILD_SECONDS = 900;

export interface SimOptions {
  verbose?: boolean;
  /**
   * The old fixed rule, for comparison: Rekindle once the gain is at least
   * this share of the Embers held. Omit for the peak-rate rule above.
   */
  rekindleGrowth?: number;
  /** Tuning shortcut: stop as soon as this lighthouse is lit. */
  stopWhenLit?: string;
  /** Tuning shortcut: stop as soon as this holds (checked each step of the long phase). */
  stopWhen?: (state: GameState) => boolean;
  /** Tuning shortcut: stop at this many sim hours. */
  stopAfterHours?: number;
  /**
   * Spend Embers in the shop after every Rekindle (bot.ts botShop). Off for
   * the pacing gate, the plain keeper the game has always been balanced on;
   * on for the "keeper who buys everything" line of the report.
   */
  shop?: boolean;
  /**
   * Tuning shortcut: change the fresh state before the first second (give
   * the bot moths on duty, relics or finished challenges, to measure what
   * those systems are worth in hours).
   */
  setup?: (state: GameState) => void;
  /** Tuning shortcut: called before every tick with the hours played, to grant things on a schedule. */
  during?: (state: GameState, hours: number) => void;
}

export function runSim(opts: SimOptions = {}): SimResult {
  const rekindleGrowth = opts.rekindleGrowth;
  // The best Ember growth rate this run has reached (peak-rate rule).
  let bestGrowth = 0;
  const rekindleDue = (): boolean => {
    const gain = rekindleGain(state);
    if (gain < PRESTIGE_RECOMMENDED_EMBERS) return false;
    if (rekindleGrowth !== undefined) return gain >= state.embers * rekindleGrowth;
    const growth = Math.log1p(gain / Math.max(1, state.embers)) / (runT + REKINDLE_REBUILD_SECONDS);
    if (growth > bestGrowth) bestGrowth = growth;
    return growth < bestGrowth * REKINDLE_PAST_PEAK;
  };
  const out: string[] = [];
  const say = (line: string) => {
    out.push(line);
    if (opts.verbose) console.log(line);
  };
  const state: GameState = createInitialState(0);
  state.lastSeen = 0;
  opts.setup?.(state);
  let runT = 0;
  let totalT = 0;
  let firstRekindleAt: number | null = null;
  let secondRekindleAt: number | null = null;
  let endingAt: number | null = null;
  let rekindles = 0;
  let stalls = 0;
  let highestTier = 0;
  const earlyUpgrades: string[] = [];
  const litAt: Record<string, number> = {};
  const waymarkAt: Record<string, number> = {};
  // Set when a waymark is lit: the bot's save for The Hollow Light starts over.
  let crossed = false;
  let inPhaseB = false;

  const noteTiers = () => {
    GENERATORS.forEach((def, i) => {
      if ((state.generators[def.id] ?? 0) > 0) highestTier = Math.max(highestTier, i + 1);
    });
  };
  let lastUpgradeRunT = 0;
  const perksBought: string[] = [];
  const shop = () => {
    if (!opts.shop) return;
    for (const name of botShop(state)) if (!/ \d+$/.test(name)) perksBought.push(`${(totalT / 3600).toFixed(1)}h: ${name}`);
  };
  const runStats: { lit: number; minutes: number; lastUpgrade: number; owned: number }[] = [];
  const noteRunEnd = () => {
    if (inPhaseB) runStats.push({ lit: state.litLighthouses.length, minutes: runT / 60, lastUpgrade: lastUpgradeRunT / 60, owned: state.upgrades.length });
    lastUpgradeRunT = 0;
  };
  const hooks = {
    onUpgradeBought: (id: string) => {
      lastUpgradeRunT = runT;
      if (!inPhaseB) earlyUpgrades.push(`${(totalT / 60).toFixed(1)}m: ${upgradeById(id).name}`);
    },
    onWaymarkLit: (id: string) => {
      if (waymarkAt[id] === undefined) waymarkAt[id] = totalT / 3600;
      crossed = true;
      say(`  ◆ ${WAYMARKS.find((w) => w.id === id)?.name} lit at ${(totalT / 3600).toFixed(1)}h (prod/s ${productionPerSecond(state).toExponential(2)}, embers ${state.embers})`);
    },
    onLighthouseLit: (id: string) => {
      if (litAt[id] === undefined) litAt[id] = totalT / 3600;
      say(
        `★ ${CHAIN_LIGHTHOUSES.find((l) => l.id === id)?.name} lit at ${(totalT / 3600).toFixed(1)}h ` +
          `(prod/s ${productionPerSecond(state).toExponential(2)}, embers ${state.embers}, eff ${(chainStatus(state).efficiency * 100).toFixed(0)}%)`,
      );
    },
  };

  // ── Phase A: the first two Rekindles ──
  let nextReport = 0;
  while (secondRekindleAt === null && totalT < EARLY_CAP_SECONDS) {
    botBuyPhase(state, runT, hooks);
    if (runT < BOT_CLICK_WINDOW_SECONDS && runT % 2 === 0) clickBeam(state);
    opts.during?.(state, totalT / 3600);
    tick(state, 1);
    runT++;
    totalT++;
    noteTiers();
    if (rekindleGain(state) >= PRESTIGE_RECOMMENDED_EMBERS) {
      const gained = rekindle(state);
      if (gained >= 1) {
        rekindles++;
        if (firstRekindleAt === null) firstRekindleAt = totalT;
        else secondRekindleAt = totalT;
        say(`★ Rekindle at ${(totalT / 60).toFixed(1)} min (+${gained} Embers)`);
        shop();
        runT = 0;
        bestGrowth = 0;
        continue;
      }
    }
    if (totalT >= nextReport) {
      const st = chainStatus(state);
      say(
        `t=${(totalT / 60).toFixed(0).padStart(4)}m  prod/s=${productionPerSecond(state).toNumber().toFixed(1).padStart(10)}  ` +
          `eff=${st.unlocked ? `${Math.round(st.efficiency * 100)}%` : "—"}  embers=${state.embers}`,
      );
      nextReport = totalT + 1200;
    }
  }

  // ── Phase B: on to The Hollow Light, played plainly ──
  inPhaseB = true;
  let effWeighted = 0;
  let starvedTime = 0;
  let awakeTime = 0;
  let savingSince: number | null = null;
  let report = totalT;
  const curve: Record<number, number> = {};
  const SAMPLE_HOURS = [2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128];
  const capSeconds = Math.min(ENDGAME_CAP_SECONDS, (opts.stopAfterHours ?? Infinity) * 3600);
  while (endingAt === null && totalT < capSeconds && secondRekindleAt !== null) {
    if (opts.stopWhenLit && state.litLighthouses.includes(opts.stopWhenLit)) break;
    if (opts.stopWhen?.(state)) break;
    if (crossed) {
      crossed = false;
      savingSince = null;
    }
    const dt = totalT < 6 * 3600 ? 2 : totalT < 24 * 3600 ? 10 : 60;
    const nextId = nextLighthouseId(state);
    let saving = false;
    if (nextId) {
      const ls = lighthouseStatus(state, nextId);
      saving = ls.cost.lte(productionPerSecond(state).mul(SAVE_WINDOW_SECONDS));
      if (saving) {
        if (savingSince === null) savingSince = totalT;
        botBuyPhase(state, runT, hooks, {
          saveForLighthouse: true,
          feedUntilEfficiency: Math.min(1, ls.efficiencyRequired + 0.05),
          growthPaybackCapSeconds: 600,
          reserveLumen: ls.cost,
        });
      }
    }
    if (!saving) {
      savingSince = null;
      botBuyPhase(state, runT, hooks, { saveToFeedSeconds: 600 });
    }
    noteTiers();
    if (state.litLighthouses.includes(HOLLOW_LIGHT_ID)) {
      endingAt = totalT;
      break;
    }
    if (nextId && state.litLighthouses.includes(nextId)) savingSince = null;

    if (runT < BOT_CLICK_WINDOW_SECONDS) for (let i = 0; i < Math.floor(dt * 0.5); i++) clickBeam(state);
    const st = chainStatus(state);
    if (st.unlocked) {
      awakeTime += dt;
      effWeighted += st.efficiency * dt;
      if (st.efficiency < 0.25) starvedTime += dt;
    }
    opts.during?.(state, totalT / 3600);
    tick(state, dt);
    runT += dt;
    totalT += dt;

    if (savingSince !== null && totalT - savingSince > STALL_SECONDS) {
      stalls++;
      say(`! Save for ${nextId} stalled at ${(totalT / 3600).toFixed(1)}h — Rekindling.`);
      noteRunEnd();
      if (rekindle(state) >= 1) {
        rekindles++;
        runT = 0;
        bestGrowth = 0;
        shop();
      }
      savingSince = null;
      continue;
    }
    if (!saving && rekindleDue()) {
      noteRunEnd();
      if (rekindle(state) >= 1) {
        rekindles++;
        runT = 0;
        bestGrowth = 0;
        shop();
      }
    }
    for (const hr of SAMPLE_HOURS) {
      if (curve[hr] === undefined && totalT >= hr * 3600) curve[hr] = Math.log10(Math.max(1, productionPerSecond(state).toNumber()));
    }
    if (totalT >= report) {
      say(
        `t=${(totalT / 3600).toFixed(1).padStart(6)}h  prod/s=${productionPerSecond(state).toExponential(2)}  ` +
          `eff=${(st.efficiency * 100).toFixed(1)}%  embers=${state.embers}  lit=${state.litLighthouses.length}/7` +
          (saving ? "  saving" : ""),
      );
      report = totalT + 2 * 3600;
    }
  }

  return {
    firstRekindleMinutes: firstRekindleAt === null ? null : firstRekindleAt / 60,
    secondRekindleMinutes: secondRekindleAt === null ? null : secondRekindleAt / 60,
    litAtHours: litAt,
    waymarkAtHours: waymarkAt,
    endingHours: endingAt === null ? null : endingAt / 3600,
    highestTierOwned: highestTier,
    meanEfficiencyEndgame: awakeTime > 0 ? effWeighted / awakeTime : 0,
    starvedShareEndgame: awakeTime > 0 ? starvedTime / awakeTime : 0,
    stalls,
    rekindles,
    finalProduction: productionPerSecond(state).toNumber(),
    finalEmbers: state.embers,
    finalGenerators: { ...state.generators },
    earlyUpgrades,
    log: out,
    curve,
    perksBought,
    finalKindlings: { ...state.kindlings },
    runsByLit: (() => {
      const out: SimResult["runsByLit"] = {};
      for (const lit of [...new Set(runStats.map((r) => r.lit))]) {
        const xs = runStats.filter((r) => r.lit === lit);
        const avg = (f: (r: (typeof xs)[number]) => number) => xs.reduce((a, r) => a + f(r), 0) / xs.length;
        out[lit] = { runs: xs.length, avgMinutes: avg((r) => r.minutes), lastUpgradeMinutes: avg((r) => r.lastUpgrade), upgradesOwned: avg((r) => r.owned) };
      }
      return out;
    })(),
  };
}

/** Lifetime Lumen the recommended first Rekindle needs (for the report). */
export const TARGET_LIFETIME = new Decimal(8_000_000);
