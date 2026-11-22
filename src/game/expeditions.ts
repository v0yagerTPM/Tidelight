import Decimal from "break_infinity.js";
// NOTE: engine ↔ expeditions is a deliberate, call-time-only cycle (the
// same pattern as engine ↔ chain). claimExpedition reads engine's
// productionPerSecond and credits through engine's creditLumen; engine,
// chain, upgrades and prestige read this module's pure relic helpers.
// Nothing here runs at load time.
import { creditLumen, productionPerSecond } from "./engine";
import { recordAlmanac } from "./almanac";
import { SIRENS_REST_ID } from "./config";
import { hasPerk, offlineCapSeconds, tailwindRelicBonus, voyageMultiplier } from "./emberShop";
import { formatDuration, formatNumber } from "./format";
import { CROSSING_TRAIT_CHANCE, MOTH_TRAITS, mothRelicChanceBonus, riderOf, riderRelicBonus } from "./mothTraits";
import type { Moth } from "./types";
import { addLog } from "./state";
import type { GameState } from "./types";

// ── Bottle expeditions (Sprint 4) ────────────────────────────────────────────
// Load a message in a bottle, cast it onto the glass sea, and wait. One
// expedition at a time; the return is timestamp-based, so bottles wash
// back while you're away. Claiming pays a Lumen cache, may surface a
// RELIC — eight unique, permanent treasures — and always brings home one
// of the sea's story fragments for the Keeper's Log (the seed of Sprint
// 5's story acts). Relics and fragments are PERMANENT: untouched by
// Rekindle and challenge resets.
//
// Relic effect wiring (helpers below, called from the system each modifies):
//   brass-compass     → engine.lampMultiplier: the thrown beam ×1.05
//   tide-chart        → chain support ×1.15
//   salt-lens         → engine click value ×1.5
//   keepers-coat      → offline rate +5 points (upgrades.offlineRateFor, 90% cap)
//   gull-feather      → chain node costs ×0.8 (chain.nodeCost)
//   amber-heart       → Rekindle Ember gain ×1.1, floored (prestige.rekindleGain)
//   driftwood-cradle  → wild moths arrive with +5 glow (moths attract only)
//   storm-in-a-bottle → Stormfront production ×1.45 instead of ×1.30 (tides)

export interface ExpeditionRouteDef {
  id: string;
  name: string;
  flavor: string;
  durationMinutes: number;
  /** Lumen cost to send the bottle. */
  cost: number;
  /** Chance (0–1) the returning bottle carries a relic. */
  relicChance: number;
  /** The cache never pays less than this. */
  minCache: number;
}

export const EXPEDITION_ROUTES: readonly ExpeditionRouteDef[] = [
  { id: "drift",   name: "The Drift",           flavor: "Just past the point, where the glass is still warm from the lamp.", durationMinutes: 10,  cost: 1_000,   relicChance: 0.1,  minCache: 500 },
  { id: "coastal", name: "Coastal Run",         flavor: "Along the drowned shoreline, past the chimneys of the old harbour.", durationMinutes: 60,  cost: 25_000,  relicChance: 0.35, minCache: 5_000 },
  { id: "crossing", name: "Deep Glass Crossing", flavor: "All the way to where the sea is darkest and the glass rings like a bell.", durationMinutes: 360, cost: 500_000, relicChance: 0.8, minCache: 50_000 },
];

/**
 * A route's relic chance: its own, +5 points per Seeker moth on duty, and
 * a riding moth's glow ÷ 10 points (+10 more for a Seeker). `rider`
 * defaults to the moth on the bottle at sea; pass one to preview a send.
 */
export function relicChanceFor(state: GameState, route: ExpeditionRouteDef, rider: Moth | null = riderOf(state)): number {
  return Math.min(1, route.relicChance + mothRelicChanceBonus(state) + riderRelicBonus(rider) + tailwindRelicBonus(state));
}

export function routeById(id: string): ExpeditionRouteDef | undefined {
  return EXPEDITION_ROUTES.find((r) => r.id === id);
}

// ── Relics ───────────────────────────────────────────────────────────────────

export interface RelicDef {
  id: string;
  name: string;
  /** Plain-words effect, shown on the relics shelf. */
  effect: string;
}

export const BRASS_COMPASS_PRODUCTION_MULTIPLIER = 1.05;
export const TIDE_CHART_SUPPORT_MULTIPLIER = 1.15;
export const SALT_LENS_CLICK_MULTIPLIER = 1.5;
export const KEEPERS_COAT_OFFLINE_RATE_BONUS = 0.05;
export const GULL_FEATHER_NODE_COST_MULTIPLIER = 0.8;
export const AMBER_HEART_GAIN_MULTIPLIER = 1.1;
export const DRIFTWOOD_CRADLE_GLOW_BONUS = 5;

export const RELICS: readonly RelicDef[] = [
  { id: "brass-compass",     name: "Brass Compass",     effect: "The thrown beam +5%. It points at whatever light needs making." },
  { id: "tide-chart",        name: "Tide Chart",       effect: "Chain support +15%. Every shoal and current, charted in a keeper's hand." },
  { id: "salt-lens",         name: "Salt Lens",        effect: "Flash the Beam click value ×1.5. Ground from the glass sea itself." },
  { id: "keepers-coat",      name: "Keeper's Coat",    effect: "Offline earnings rate +5 percentage points (hard cap 90%). It still smells of lamp oil and rain." },
  { id: "gull-feather",      name: "Gull Feather",     effect: "Chain node upgrades cost 20% less. The gulls approve of thrift." },
  { id: "amber-heart",       name: "Amber Heart",      effect: "Rekindle Ember gain +10%. A coal that never finished going out." },
  { id: "driftwood-cradle",  name: "Driftwood Cradle", effect: "Wild moths arrive with +5 glow. Something in the wood remembers being warm." },
  { id: "storm-in-a-bottle", name: "Storm in a Bottle", effect: "Stormfront tides boost production ×1.45 instead of ×1.30. It rattles, faintly, at night." },
];

export function relicById(id: string): RelicDef | undefined {
  return RELICS.find((r) => r.id === id);
}

export function hasRelic(state: GameState, id: string): boolean {
  return state.relics.includes(id);
}

/** Relics not yet claimed (claiming grants a random one of these). */
export function unclaimedRelics(state: GameState): RelicDef[] {
  return RELICS.filter((r) => !state.relics.includes(r.id));
}

// ── Relic effect helpers (pure state reads) ─────────────────────────────────

export function relicProductionMultiplier(state: GameState): number {
  return hasRelic(state, "brass-compass") ? BRASS_COMPASS_PRODUCTION_MULTIPLIER : 1;
}

export function relicClickMultiplier(state: GameState): number {
  return hasRelic(state, "salt-lens") ? SALT_LENS_CLICK_MULTIPLIER : 1;
}

export function relicSupportMultiplier(state: GameState): number {
  return hasRelic(state, "tide-chart") ? TIDE_CHART_SUPPORT_MULTIPLIER : 1;
}

export function relicNodeCostMultiplier(state: GameState): number {
  return hasRelic(state, "gull-feather") ? GULL_FEATHER_NODE_COST_MULTIPLIER : 1;
}

export function relicOfflineRateBonus(state: GameState): number {
  return hasRelic(state, "keepers-coat") ? KEEPERS_COAT_OFFLINE_RATE_BONUS : 0;
}

/** Multiplier on Embers gained at Rekindle (Amber Heart), floored after. */
export function relicEmberGainMultiplier(state: GameState): number {
  return hasRelic(state, "amber-heart") ? AMBER_HEART_GAIN_MULTIPLIER : 1;
}

/** Glow bonus for newly created moths (Driftwood Cradle). */
export function relicMothGlowBonus(state: GameState): number {
  return hasRelic(state, "driftwood-cradle") ? DRIFTWOOD_CRADLE_GLOW_BONUS : 0;
}

// ── Story fragments ──────────────────────────────────────────────────────────
// One comes home with every claimed bottle, in order, no repeats until
// the set is exhausted (then it wraps). These seed Sprint 5's story acts.

export const STORY_FRAGMENTS: readonly string[] = [
  "The bottle came back holding a map drawn in salt: a coastline nobody remembers, labelled only 'almost home'.",
  "Inside the bottle: a tiny lighthouse, still lit. When you shook it, somewhere far off, a bell rang once.",
  "The bottle held a page from a keeper's log, dated next week. The handwriting is yours. It says: 'The sea is listening. Be kind.'",
  "A scrap of sailcloth, folded small. Embroidered in the corner, in patient thread: 'We saw your light. We turned.'",
  "The bottle held a glass key, warm as if just let go. It fits no lock in the lighthouse. Yet.",
  "A child's drawing, kept dry by wax: seven towers, seven beams, and a sea drawn entirely in gold crayon.",
  "Inside, a single sentence on water-stained paper: 'The dark was never empty. It was only waiting to be introduced.'",
  "The bottle held a coal of amber that pulses like a slow heartbeat. The moths gather round it at night, dreaming.",
];

// ── Expedition lifecycle ─────────────────────────────────────────────────────

/**
 * Send a bottle out on a route. One expedition at a time; fails (false,
 * no charge) while one is already out, the route is unknown, or the
 * keeper can't pay.
 */
/** How long a voyage on `route` takes for this keeper (emberShop.voyageMultiplier). */
export function voyageMs(state: GameState, route: ExpeditionRouteDef): number {
  return Math.round(route.durationMinutes * 60_000 * voyageMultiplier(state));
}

export function sendExpedition(state: GameState, routeId: string, now: number = Date.now(), riderId?: string, log = true): boolean {
  if (state.expedition !== null) return false;
  const route = routeById(routeId);
  if (!route) return false;
  const rider = riderId ? state.moths.find((m) => m.id === riderId) : undefined;
  if (riderId && (!rider || state.cocoons.some((c) => c.parentIds.includes(riderId)))) return false;
  const cost = new Decimal(route.cost);
  if (state.lumen.lt(cost)) return false;
  state.lumen = state.lumen.sub(cost);
  state.expedition = {
    routeId,
    startedAt: now,
    returnsAt: now + voyageMs(state, route),
    ...(rider ? { riderId: rider.id } : {}),
  };
  // The route Glass Charts sets the bottle out on again (tendBottles).
  state.bottleRoute = routeId;
  if (rider) {
    // A rider leaves duty and its post for the whole trip.
    state.mothDuty = state.mothDuty.filter((id) => id !== rider.id);
    for (const [lighthouseId, id] of Object.entries(state.mothPosts)) if (id === rider.id) delete state.mothPosts[lighthouseId];
  }
  if (log) addLog(state, `A bottle goes out on ${route.name} — a message, a hope, and a little lamplight for the journey${rider ? `, with ${rider.name} riding on the cork` : ""}. Back in ${formatDuration(voyageMs(state, route) / 1000)}.`, now);
  return true;
}

/** True when the bottle has washed back and can be claimed. */
export function expeditionReady(state: GameState, now: number = Date.now()): boolean {
  return state.expedition !== null && now >= state.expedition.returnsAt;
}

export interface ExpeditionClaim {
  /** The Lumen cache paid (before any all-relics bonus). */
  cache: Decimal;
  /** Extra Lumen paid when a relic roll succeeded but no relics remain (+50% of cache). */
  bonusLumen: Decimal;
  /** The relic granted, or null. */
  relic: RelicDef | null;
  /** The moth that rode along, if any, and the trait it brought home (Crossing only). */
  rider: Moth | null;
  riderTrait: string | null;
  /** The story fragment that came home. */
  fragment: string;
}

/**
 * The Lumen cache a returning expedition pays:
 * max(route minimum, current production/sec × voyage seconds × 0.5).
 * The voyage is this keeper's own (voyageMs: Glass Charts and Tailwind
 * shorten it), so faster bottles come home sooner, not richer: a bottle
 * always out pays half the light, whatever the speed. Why (a phone
 * playthrough): paid for the route's full length, bottles brought home in
 * 30% of the time added 168% to income, and one Coastal Run paid more than
 * The Hollow Light costs.
 * "Current production" is read at the given moment (tide included when the
 * caller passes a real time, as the UI does).
 */
export function expeditionCache(state: GameState, route: ExpeditionRouteDef, now?: number): Decimal {
  const fromRate = productionPerSecond(state, now).mul(voyageMs(state, route) / 1000).mul(0.5).floor();
  return Decimal.max(new Decimal(route.minCache), fromRate);
}

/**
 * Claim the returned bottle. Fails (null) when nothing is out or it hasn't
 * returned yet. The rng is consumed in a fixed order: relic roll, then
 * relic pick (only when a relic is granted). `quiet` (Glass Charts'
 * own claims, tendBottles) leaves out the routine lines — the salvage, a
 * rider's plain return and story fragments already read — and keeps the
 * news: relics, a changed rider, the Glass Stair's chart.
 */
export function claimExpedition(state: GameState, rng: () => number, now: number = Date.now(), quiet = false): ExpeditionClaim | null {
  const expedition = state.expedition;
  if (!expedition || now < expedition.returnsAt) return null;
  const route = routeById(expedition.routeId);
  if (!route) {
    state.expedition = null; // an unknown route (corrupt save) clears rather than bricks
    return null;
  }
  const rider = riderOf(state);
  const relicChance = relicChanceFor(state, route, rider);
  state.expedition = null;

  const cache = expeditionCache(state, route, now);
  creditLumen(state, cache);

  let relic: RelicDef | null = null;
  let bonusLumen = new Decimal(0);
  if (rng() < relicChance) {
    const remaining = unclaimedRelics(state);
    if (remaining.length > 0) {
      relic = remaining[Math.floor(rng() * remaining.length)];
      state.relics.push(relic.id);
    } else {
      // Every relic is already home: the sea pays in light instead.
      bonusLumen = cache.mul(0.5);
      creditLumen(state, bonusLumen);
    }
  }

  // Last roll: a traitless rider on the Deep Glass Crossing may come home changed.
  let riderTrait: string | null = null;
  if (rider && route.id === "crossing" && !rider.trait && rng() < CROSSING_TRAIT_CHANCE) {
    riderTrait = MOTH_TRAITS[Math.min(MOTH_TRAITS.length - 1, Math.floor(rng() * MOTH_TRAITS.length))].id;
    rider.trait = riderTrait;
    if (recordAlmanac(state, rider)) addLog(state, `A new page in the Wing Almanac (${state.almanac.length} filled).`, now);
  }

  // The Glass Stair's offering (offerings.ts): a bottle home from the deep
  // glass once Siren's Rest burns, charting the stair.
  const chartsStair = route.id === "crossing" && state.litLighthouses.includes(SIRENS_REST_ID) && !state.deepGlassBottle;
  if (chartsStair) state.deepGlassBottle = true;

  const freshFragment = state.storyFragmentIndex < STORY_FRAGMENTS.length;
  const fragment = STORY_FRAGMENTS[state.storyFragmentIndex % STORY_FRAGMENTS.length];
  state.storyFragmentIndex++;
  if (!quiet) addLog(state, `The bottle washes back from ${route.name}: +${formatNumber(cache, state.notation)} Lumen of salvage and driftwood.`, now);
  if (relic) addLog(state, `Nestled in the bottle's neck — a relic: ${relic.name}. ${relic.effect}`, now);
  if (bonusLumen.gt(0) && !quiet) addLog(state, `The sea, having no relics left to give, pays half again in light: +${formatNumber(bonusLumen, state.notation)} Lumen.`, now);
  if (rider && (!quiet || riderTrait)) {
    const trait = MOTH_TRAITS.find((t) => t.id === riderTrait);
    addLog(state, trait
      ? `${rider.name} comes home from the deep glass changed: ${trait.name.toLowerCase()} now. ${trait.effect}`
      : `${rider.name} hops off the cork and back into the roost, salt on its wings.`, now);
  }
  if (!quiet || freshFragment) addLog(state, `From the bottle: ${fragment}`, now);
  if (chartsStair && state.crossing < 2) {
    addLog(state, "Folded around the message: a chart of the Glass Stair, every lantern marked. Lighting it will cost half. (the Glass Stair's offering)", now);
  }
  return { cache, bonusLumen, relic, fragment, rider, riderTrait };
}

// ── Glass Charts: bottles that set out again ─────────────────────────────────
// Once a bottle paid for the voyage as sailed, a faster one was worth no
// Lumen, and Glass Charts (the dearest late perk, "25% sooner") lost its
// purpose (design review, round three). It now does the loop the phone
// keeper did by hand every few minutes: a bottle that washes home is
// claimed and set out again on the standing route (state.bottleRoute, the
// last one sent or chosen), live or while away. Away, voyages are only
// counted inside the offline cap, as the rest of the light is.

export interface TendResult {
  /** Voyages claimed and set out again. */
  voyages: number;
  /** Lumen they brought home (salvage, and the sea's bonus once every relic is home). */
  lumen: Decimal;
}

/** Claim every bottle that has come home and set it out again (Glass Charts). */
export function tendBottles(state: GameState, rng: () => number, now: number = Date.now()): TendResult {
  const out: TendResult = { voyages: 0, lumen: new Decimal(0) };
  if (!hasPerk(state, "glass-charts")) return out;
  if (state.bottleRoute === null && state.expedition) state.bottleRoute = state.expedition.routeId;
  const floor = now - offlineCapSeconds(state) * 1000;
  let routeName = "";
  for (let guard = 0; guard < 2_000; guard++) {
    const expedition = state.expedition;
    if (!expedition) {
      const route = routeById(state.bottleRoute ?? "");
      if (!route || !sendExpedition(state, route.id, now, undefined, false)) break;
      continue;
    }
    if (now < expedition.returnsAt) break;
    const at = expedition.returnsAt;
    const claim = claimExpedition(state, rng, at, true);
    if (!claim) break;
    out.voyages++;
    out.lumen = out.lumen.add(claim.cache).add(claim.bonusLumen);
    const route = routeById(state.bottleRoute ?? "");
    if (!route) break;
    routeName = route.name;
    // Set out again the moment it came home, or, after a long absence, from
    // the start of the time the offline cap counts.
    if (!sendExpedition(state, route.id, Math.max(at, floor), undefined, false)) break;
  }
  if (out.voyages > 0) {
    addLog(
      state,
      `Glass Charts: ${out.voyages === 1 ? "a bottle came" : `${out.voyages} bottles came`} home and set out again on ${routeName}. +${formatNumber(out.lumen, state.notation)} Lumen of salvage.`,
      now,
    );
  }
  return out;
}
