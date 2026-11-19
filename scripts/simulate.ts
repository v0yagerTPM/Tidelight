// ── Tidelight balance simulation (not run in CI) ─────────────────────────────
// Plays the current build with the shared greedy bot and reports pacing:
// the first two Rekindles, every relight, and the ending. The strategy and
// its assumptions are documented in scripts/simCore.ts. The bot is a
// PESSIMISTIC bound: no Ember perks, challenges, moths, relics, bottles or
// tides — a real keeper is faster everywhere. A second run then lets the
// same bot buy everything in the Ember shop, for the fast end of the range.
//
// Run with:  npm run sim
import { CHAIN_LIGHTHOUSES, GENERATORS, PRESTIGE_RECOMMENDED_EMBERS } from "../src/game/config";
import { ENDGAME_CAP_SECONDS, TARGET_LIFETIME, runSim } from "./simCore";

const r = runSim({ verbose: true });

console.log("\n── Simulation result ──────────────────────────────");
console.log(
  r.firstRekindleMinutes !== null
    ? `First Rekindle (${TARGET_LIFETIME.toNumber().toLocaleString()} lifetime Lumen = ${PRESTIGE_RECOMMENDED_EMBERS} Embers): ${r.firstRekindleMinutes.toFixed(1)} minutes`
    : "First Rekindle: NOT REACHED within the early sim cap.",
);
console.log(
  r.firstRekindleMinutes !== null && r.secondRekindleMinutes !== null
    ? `Second Rekindle: ${(r.secondRekindleMinutes - r.firstRekindleMinutes).toFixed(1)} minutes after the first (${r.secondRekindleMinutes.toFixed(1)} total)`
    : "Second Rekindle: NOT REACHED within the early sim cap.",
);
console.log("\n── Endgame result ─────────────────────────────────");
for (const def of CHAIN_LIGHTHOUSES.slice(1)) {
  const at = r.litAtHours[def.id];
  console.log(`  ${def.name}: ${at !== undefined ? `lit at ${at.toFixed(1)}h` : "never lit"}`);
}
console.log(
  r.endingHours !== null
    ? `★ THE HOLLOW LIGHT LIT — the ending at ${r.endingHours.toFixed(1)} simulated hours.`
    : `Ending: NOT REACHED within the ${ENDGAME_CAP_SECONDS / 3600}-hour cap.`,
);
console.log(`Highest generator tier owned: ${r.highestTierOwned} of ${GENERATORS.length}`);
console.log(
  `Chain through the endgame: mean efficiency ${(r.meanEfficiencyEndgame * 100).toFixed(0)}%, ` +
    `below 25% for ${(r.starvedShareEndgame * 100).toFixed(0)}% of the time; stalled saves: ${r.stalls}`,
);
console.log(`Rekindles: ${r.rekindles} · Embers held at stop: ${r.finalEmbers} · final production ${r.finalProduction.toExponential(3)} Lumen/s`);
console.log(`Generators owned at stop: ${JSON.stringify(r.finalGenerators)}`);
console.log("Endgame runs by lighthouses lit (average length · last upgrade bought · upgrades owned at the Rekindle):");
for (const [lit, x] of Object.entries(r.runsByLit)) {
  console.log(`  ${lit} lit: ${x.runs} runs · ${x.avgMinutes.toFixed(0)} min · last upgrade at ${x.lastUpgradeMinutes.toFixed(0)} min · ${x.upgradesOwned.toFixed(0)} upgrades`);
}
console.log(`Upgrades bought in the two early runs (${r.earlyUpgrades.length}):`);
for (const line of r.earlyUpgrades) console.log(`  ${line}`);
console.log("\n── A keeper who buys everything in the Ember shop ──");
const shopper = runSim({ shop: true });
console.log(
  `  lit at ${CHAIN_LIGHTHOUSES.slice(1).map((l) => (shopper.litAtHours[l.id] !== undefined ? `${shopper.litAtHours[l.id].toFixed(1)}h` : "—")).join(" / ")}` +
    ` · ending ${shopper.endingHours !== null ? `${shopper.endingHours.toFixed(1)}h` : "not reached"}`,
);
console.log(`  Ember perks bought: ${shopper.perksBought.join(" · ") || "none"}`);
console.log(`  Kindling levels at stop: ${JSON.stringify(shopper.finalKindlings)}`);
if (r.firstRekindleMinutes === null || r.secondRekindleMinutes === null || r.endingHours === null) {
  console.log("WARNING: a target was not reached within its sim cap.");
  process.exitCode = 1;
}
