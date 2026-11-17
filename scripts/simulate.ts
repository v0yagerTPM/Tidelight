// ── Tidelight balance simulation (not run in CI) ─────────────────────────────
// A greedy bot plays the current build, using the shared strategy in
// src/game/bot.ts: every step it buys whichever affordable action has the
// best payback (cost ÷ production gain) — a generator copy, an upgrade or
// a chain node level — it keeps the supply chain fed (bottleneck node
// first, on the cheapest board, whenever efficiency drops under 95%), it
// relights the next lighthouse the moment it's eligible, and it clicks
// the beam once per 2 seconds for the first 10 minutes of each run only,
// like an engaged player who then goes idle.
//
// Early game (Sprints 1–3): the bot plays through the first Rekindle
// (at the recommended 40 Embers) and on to the second, and the sim
// reports both times. The bot buys NO Ember perks and runs NO
// challenges, and (Sprint 4) ignores the Shore entirely — no moths, no
// bottle expeditions, no tides (it never passes a time to the engine, so
// its sea is permanently neutral; live tides average out mildly
// positive). All of that only makes a real keeper faster.
//
// Endgame (Sprint 5): after the second Rekindle the bot plays on to the
// ending. Its policy: Rekindle whenever the gain would at least double
// its held Embers (minimum 40); when the next lighthouse's cost comes
// within ~30 minutes of production, stop spending (chain feeding only)
// and save until it can be relit. Steps coarsen as the sim lengthens
// (2s → 10s → 60s) so a 500-hour bound stays computable. The bot is a
// PESSIMISTIC bound on a real keeper: no perks, no challenges, no moths,
// no relics, no tides, no Ember-shop spending, ever.
//
// Run with:  npm run sim
import Decimal from "break_infinity.js";
import {
  CHAIN_LIGHTHOUSES,
  CHAIN_NODES,
  FIRST_LIGHT_ID,
  HOLLOW_LIGHT_ID,
  PRESTIGE_RECOMMENDED_EMBERS,
  chainLighthouseById,
} from "../src/game/config";
import { BOT_CLICK_WINDOW_SECONDS, botBuyPhase } from "../src/game/bot";
import { chainStatus, lighthouseStatus, nextLighthouseId } from "../src/game/chain";
import { baseProductionPerSecond, clickBeam, productionPerSecond, tick } from "../src/game/engine";
import { embersForLifetime, rekindle, rekindleGain } from "../src/game/prestige";
import { createInitialState } from "../src/game/state";
import type { GameState } from "../src/game/types";
import { upgradeById } from "../src/game/upgrades";

const TARGET_LIFETIME = new Decimal(8_000_000); // 40 Embers
const EARLY_CAP_SECONDS = 12 * 3600;
const ENDGAME_CAP_SECONDS = 500 * 3600;

function fmtClock(totalSeconds: number): string {
  return `${(totalSeconds / 3600).toFixed(1)}h`;
}

function main(): void {
  const state = createInitialState(0);
  state.lastSeen = 0;
  let runT = 0; // seconds since the start of the CURRENT run (click window is per-run)
  let totalT = 0; // seconds since the start of the sim
  let firstRekindleAt: number | null = null;
  let secondRekindleAt: number | null = null;
  let endingAt: number | null = null;
  const upgradeLog: string[] = [];
  const lighthouseLitAt = new Map<string, number>();
  let nextReport = 0;

  const hooks = {
    onUpgradeBought: (id: string) => {
      upgradeLog.push(`${(totalT / 60).toFixed(1)}m: ${upgradeById(id).name}`);
    },
    onLighthouseLit: (id: string, tSeconds: number) => {
      if (!lighthouseLitAt.has(id)) lighthouseLitAt.set(id, totalT);
      console.log(`\n★ ${chainLighthouseById(id).name} lit at ${fmtClock(totalT)} (sim t=${tSeconds}s step).\n`);
    },
  };

  const clickPhase = (dt: number) => {
    if (runT >= BOT_CLICK_WINDOW_SECONDS) return;
    const clicks = Math.floor(dt * 0.5); // one click per 2 seconds
    for (let i = 0; i < clicks; i++) clickBeam(state);
  };

  // ── Phase A: the early game, exactly as Sprints 1–3 reported it ──────
  while (secondRekindleAt === null && totalT < EARLY_CAP_SECONDS) {
    botBuyPhase(state, runT, hooks);
    if (runT < BOT_CLICK_WINDOW_SECONDS && runT % 2 === 0) clickBeam(state);
    tick(state, 1);
    runT++;
    totalT++;

    if (rekindleGain(state) >= PRESTIGE_RECOMMENDED_EMBERS) {
      const gained = rekindle(state);
      if (gained >= 1) {
        if (firstRekindleAt === null) {
          firstRekindleAt = totalT;
          console.log(`\n★ First Rekindle at ${(totalT / 60).toFixed(1)} minutes (+${gained} Embers) — run 2 begins.\n`);
        } else {
          secondRekindleAt = totalT;
        }
        runT = 0;
        continue;
      }
    }

    if (totalT >= nextReport) {
      const st = chainStatus(state);
      console.log(
        `t=${(totalT / 60).toFixed(0).padStart(3)}m  lifetime=${state.lifetimeLumen.toNumber().toFixed(0).padStart(9)}  ` +
          `prod/s=${productionPerSecond(state).toNumber().toFixed(1).padStart(9)}  ` +
          `eff=${st.unlocked ? `${Math.round(st.efficiency * 100)}%`.padStart(4) : "  — "}  ` +
          `gens=${Object.values(state.generators).reduce((a, b) => a + b, 0)}  upgrades=${state.upgrades.length}  embers=${state.embers}`,
      );
      nextReport = totalT + 600;
    }
  }

  // The report's upgrade log covers the early game only — Phase B buys
  // would bury the headline under hours of bot shopping.
  const earlyUpgradeCount = upgradeLog.length;

  // ── Phase B: the endgame — on to The Hollow Light ────────────────────
  // Lighthouse campaigns. The governing fact of the chain: support grows
  // LINEARLY per node level while node costs grow GEOMETRICALLY and
  // generator demand grows EXPONENTIALLY — so an efficiency gate is only
  // reachable at a deliberately capped demand. A campaign therefore runs:
  //   GROW — normal greedy play (with feeding discipline) until base
  //     production reaches the campaign's demand cap;
  //   SAVE — growth stops at the cap; bank the relight cost, then feed
  //     the chain out of the surplus until the efficiency gate is met,
  //     allowing only very cheap growth below the cap — and relight.
  // If a save phase drags past its deadline, abandon the campaign:
  // Rekindle (resetting demand AND boards) and retry with a lower cap.
  console.log("\n── Endgame: playing on to The Hollow Light ────────");
  let endgameReport = totalT;
  interface Campaign {
    targetId: string;
    saving: boolean;
    saveStartedAt: number;
    /** Sim-seconds the save phase may run before it's declared stalled. */
    saveDeadlineSeconds: number;
    attempts: number;
  }
  let campaign: Campaign | null = null;
  const attemptsByTarget = new Map<string, number>();
  /**
   * Base-production (demand) cap for a campaign, sized from the gate:
   * the bot reserves ~9% of the relight cost as a Lens-feeding budget
   * (Lens is the dearest support per Lumen/s), works out how much
   * support that buys, and caps demand at the level that support can
   * gate (× 0.8 safety margin, lowered a further 20% per retry).
   */
  const demandCapFor = (cost: Decimal, gate: number, attempts: number): Decimal => {
    const lens = CHAIN_NODES.lens;
    const budget = cost.mul(0.09).toNumber();
    const levels = Math.max(
      1,
      Math.floor(Math.log(1 + (budget * (lens.growth - 1)) / lens.baseCost) / Math.log(lens.growth)),
    );
    const support = lens.supportPerLevel * levels;
    return new Decimal((support / gate) * 0.8 * 0.8 ** attempts);
  };

  while (endingAt === null && totalT < ENDGAME_CAP_SECONDS && secondRekindleAt !== null) {
    const dt = totalT < 6 * 3600 ? 2 : totalT < 24 * 3600 ? 10 : 60;
    const nextId = nextLighthouseId(state);

    if (nextId && (campaign === null || campaign.targetId !== nextId)) {
      campaign = {
        targetId: nextId,
        saving: false,
        saveStartedAt: 0,
        saveDeadlineSeconds: 16 * 3600,
        attempts: attemptsByTarget.get(nextId) ?? 0,
      };
    }

    if (campaign && nextId) {
      const status = lighthouseStatus(state, nextId);
      const cap = demandCapFor(status.cost, status.efficiencyRequired, campaign.attempts);
      if (!campaign.saving && baseProductionPerSecond(state).gte(cap)) {
        campaign.saving = true;
        campaign.saveStartedAt = totalT;
        // A flat 16h deadline, deliberately: a stalled campaign is not
        // wasted time — its forced Rekindle banks a large Ember gain,
        // and the retry starts from a stronger keeper. (A cost-scaled
        // deadline was tried; it made the total worse — the Hollow
        // Light campaigns spent up to 60h each proving they were stuck.)
        campaign.saveDeadlineSeconds = 16 * 3600;
      }
      if (campaign.saving) {
        botBuyPhase(state, runT, hooks, {
          saveForLighthouse: true,
          feedUntilEfficiency: status.efficiencyRequired + 0.02,
          growthPaybackCapSeconds: 1200,
          reserveLumen: status.cost,
          maxBaseProduction: cap,
        });
      } else {
        botBuyPhase(state, runT, hooks, { feedPaybackCapSeconds: 1800 });
      }
    } else {
      botBuyPhase(state, runT, hooks, { feedPaybackCapSeconds: 1800 });
    }

    if (state.litLighthouses.includes(HOLLOW_LIGHT_ID)) {
      endingAt = totalT;
      break;
    }
    if (campaign && state.litLighthouses.includes(campaign.targetId)) campaign = null;

    clickPhase(dt);
    tick(state, dt);
    runT += dt;
    totalT += dt;

    // Campaign deadlock: the save phase has run past its deadline
    // without lighting — the gate won't come at this demand. Rekindle
    // to reset demand and retry the campaign with a lower cap.
    if (
      campaign?.saving &&
      totalT - campaign.saveStartedAt > campaign.saveDeadlineSeconds &&
      !state.litLighthouses.includes(campaign.targetId)
    ) {
      attemptsByTarget.set(campaign.targetId, campaign.attempts + 1);
      console.log(
        `\nCampaign for ${chainLighthouseById(campaign.targetId).name} stalled (efficiency gate out of reach at this demand) — Rekindling to reset demand and retrying with a lower cap.\n`,
      );
      if (rekindle(state) >= 1) runT = 0;
      campaign = null;
      continue;
    }

    // Rekindle policy (growth phase only): the gain at least doubles the
    // held balance (minimum the recommended 40).
    if (
      !campaign?.saving &&
      rekindleGain(state) >= Math.max(PRESTIGE_RECOMMENDED_EMBERS, state.embers)
    ) {
      const gained = rekindle(state);
      if (gained >= 1) runT = 0;
    }

    if (totalT >= endgameReport) {
      const st = chainStatus(state);
      const next = nextId ? chainLighthouseById(nextId) : null;
      console.log(
        `t=${fmtClock(totalT).padStart(6)}  lifetime=${state.lifetimeLumen.toExponential(2).padStart(9)}  ` +
          `prod/s=${productionPerSecond(state).toExponential(2).padStart(9)}  ` +
          `eff=${st.unlocked ? `${(st.efficiency * 100).toFixed(1)}%` : "—"}  ` +
          `embers=${state.embers}  lit=${state.litLighthouses.length}/7  ` +
          (campaign?.saving && next
            ? `saving for ${next.name} (attempt ${campaign.attempts + 1})`
            : next
              ? `next: ${next.name}`
              : "all lit"),
      );
      endgameReport = totalT + 3600;
    }
  }

  // ── Reports ───────────────────────────────────────────────────────────
  const embers = embersForLifetime(state.lifetimeLumen);
  const finalStatus = chainStatus(state);
  console.log("\n── Simulation result ──────────────────────────────");
  if (firstRekindleAt !== null) {
    console.log(
      `Time to first Rekindle (${TARGET_LIFETIME.toNumber().toLocaleString()} lifetime Lumen = ${PRESTIGE_RECOMMENDED_EMBERS} Embers): ${(firstRekindleAt / 60).toFixed(1)} minutes`,
    );
  } else {
    console.log("Time to first Rekindle: NOT REACHED within the early sim cap.");
  }
  if (firstRekindleAt !== null && secondRekindleAt !== null) {
    console.log(
      `Time from first to second Rekindle: ${((secondRekindleAt - firstRekindleAt) / 60).toFixed(1)} minutes ` +
        `(second Rekindle at ${(secondRekindleAt / 60).toFixed(1)} minutes total)`,
    );
  } else {
    console.log("Time from first to second Rekindle: NOT REACHED within the early sim cap.");
  }
  console.log("\n── Endgame result ─────────────────────────────────");
  for (const def of CHAIN_LIGHTHOUSES) {
    if (def.relightCost === null) continue;
    const at = lighthouseLitAt.get(def.id);
    console.log(
      `  ${def.name}: ${at !== undefined ? `lit at ${fmtClock(at)} (${(at / 3600).toFixed(1)}h)` : "never lit"}`,
    );
  }
  if (endingAt !== null) {
    console.log(`★ THE HOLLOW LIGHT LIT — ending reached at ${fmtClock(endingAt)} (${(endingAt / 3600).toFixed(1)} simulated hours).`);
  } else {
    console.log(`Ending: NOT REACHED within the ${ENDGAME_CAP_SECONDS / 3600}-hour cap (stopped at ${fmtClock(totalT)}).`);
  }
  console.log(
    "Note: the bot buys no Ember perks, runs no challenges, and ignores moths, expeditions and tides — a real player will be faster everywhere.",
  );
  console.log(`Embers held at stop: ${state.embers} (current run's gain so far would be ${embers})`);
  console.log(`Final production: ${productionPerSecond(state).toExponential(3)} Lumen/s`);
  console.log(
    `Chain at stop: efficiency ${(finalStatus.efficiency * 100).toFixed(1)}%, ` +
      `First Light board ${JSON.stringify(state.chainBoards[FIRST_LIGHT_ID])}`,
  );
  console.log(`Generators owned: ${JSON.stringify(state.generators)}`);
  console.log(`Upgrades bought in the two early runs (${earlyUpgradeCount}):`);
  for (const line of upgradeLog.slice(0, earlyUpgradeCount)) console.log(`  ${line}`);
  if (firstRekindleAt === null || secondRekindleAt === null || endingAt === null) {
    console.log("WARNING: a target was not reached within its sim cap.");
    process.exitCode = 1;
  }
}

main();
