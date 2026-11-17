// ── Tidelight balance simulation (not run in CI) ─────────────────────────────
// A greedy bot plays the current build, using the shared strategy in
// src/game/bot.ts: every simulated second it buys whichever affordable
// action has the best payback (cost ÷ production gain) — a generator copy
// or an upgrade — it keeps the supply chain fed (bottleneck node first,
// whenever efficiency drops under 95%), it relights Gull Rock the moment
// it's eligible, and it clicks the beam once per 2 seconds for the first
// 10 minutes of each run only, like an engaged player who then goes idle.
//
// Sprint 3: the bot now plays THROUGH the first Rekindle. When its run is
// worth the recommended 40 Embers it Rekindles, and the sim reports both
// the minutes to the first Rekindle and the minutes from the first to the
// second. The bot buys NO Ember perks and runs NO challenges — a real
// player spending Embers will reach the second Rekindle faster than this.
//
// Sprint 4: the bot also ignores the Shore entirely — no moths, no bottle
// expeditions, and no tides (it never passes a time to the engine, so its
// sea is permanently neutral; live tides average out mildly positive).
// All three only make a real keeper faster than this baseline.
//
// Run with:  npm run sim
import Decimal from "break_infinity.js";
import { FIRST_LIGHT_ID, PRESTIGE_RECOMMENDED_EMBERS } from "../src/game/config";
import { BOT_CLICK_WINDOW_SECONDS, botBuyPhase } from "../src/game/bot";
import { chainStatus } from "../src/game/chain";
import { clickBeam, productionPerSecond, tick } from "../src/game/engine";
import { embersForLifetime, rekindle, rekindleGain } from "../src/game/prestige";
import { createInitialState } from "../src/game/state";
import type { GameState } from "../src/game/types";
import { upgradeById } from "../src/game/upgrades";

const TARGET_LIFETIME = new Decimal(8_000_000); // 40 Embers
const MAX_SECONDS = 12 * 3600;

function main(): void {
  const state = createInitialState(0);
  state.lastSeen = 0;
  let t = 0; // seconds since the start of the CURRENT run (click window is per-run)
  let totalT = 0; // seconds since the start of the sim
  let firstRekindleAt: number | null = null;
  let secondRekindleAt: number | null = null;
  const upgradeLog: string[] = [];
  let gullRockAt: number | null = null;
  let nextReport = 0;

  const hooks = {
    onUpgradeBought: (id: string) => {
      upgradeLog.push(`${(totalT / 60).toFixed(1)}m: ${upgradeById(id).name}`);
    },
    onGullRockLit: () => {
      if (gullRockAt === null) gullRockAt = totalT;
    },
  };

  while (secondRekindleAt === null && totalT < MAX_SECONDS) {
    botBuyPhase(state, t, hooks);
    // Click phase: engaged for the first 10 minutes of each run only.
    if (t < BOT_CLICK_WINDOW_SECONDS && t % 2 === 0) clickBeam(state);
    tick(state, 1);
    t++;
    totalT++;

    // Rekindle the moment the run is worth the recommended 40 Embers.
    if (rekindleGain(state) >= PRESTIGE_RECOMMENDED_EMBERS) {
      const gained = rekindle(state);
      if (gained >= 1) {
        if (firstRekindleAt === null) {
          firstRekindleAt = totalT;
          console.log(
            `\n★ First Rekindle at ${(totalT / 60).toFixed(1)} minutes (+${gained} Embers) — run 2 begins.\n`,
          );
        } else {
          secondRekindleAt = totalT;
        }
        t = 0; // the click window restarts with the new run
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

  const embers = embersForLifetime(state.lifetimeLumen);
  const finalStatus = chainStatus(state);
  console.log("\n── Simulation result ──────────────────────────────");
  if (firstRekindleAt !== null) {
    console.log(
      `Time to first Rekindle (${TARGET_LIFETIME.toNumber().toLocaleString()} lifetime Lumen = ${PRESTIGE_RECOMMENDED_EMBERS} Embers): ${(firstRekindleAt / 60).toFixed(1)} minutes`,
    );
  } else {
    console.log("Time to first Rekindle: NOT REACHED within the sim cap.");
  }
  if (firstRekindleAt !== null && secondRekindleAt !== null) {
    console.log(
      `Time from first to second Rekindle: ${((secondRekindleAt - firstRekindleAt) / 60).toFixed(1)} minutes ` +
        `(second Rekindle at ${(secondRekindleAt / 60).toFixed(1)} minutes total)`,
    );
  } else {
    console.log("Time from first to second Rekindle: NOT REACHED within the sim cap.");
  }
  console.log(
    "Note: the bot buys no Ember perks, runs no challenges, and ignores moths, expeditions and tides — a real player will be faster to the second Rekindle.",
  );
  console.log(`Embers held at stop: ${state.embers} (run-3 gain so far would be ${embers})`);
  console.log(`Final production: ${productionPerSecond(state).toNumber().toFixed(1)} Lumen/s`);
  console.log(
    `Chain at stop: efficiency ${Math.round(finalStatus.efficiency * 100)}%, ` +
      `First Light board ${JSON.stringify(state.chainBoards[FIRST_LIGHT_ID])}, ` +
      `Gull Rock ${gullRockAt === null ? "never lit" : `lit at ${(gullRockAt / 60).toFixed(1)}m`}`,
  );
  console.log(`Generators owned: ${JSON.stringify(state.generators)}`);
  console.log(`Upgrades bought (${upgradeLog.length}):`);
  for (const line of upgradeLog) console.log(`  ${line}`);
  if (firstRekindleAt === null || secondRekindleAt === null) {
    console.log("WARNING: a Rekindle target was not reached within the 12-hour sim cap.");
    process.exitCode = 1;
  }
}

main();
