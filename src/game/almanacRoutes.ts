import { almanacKeysOf } from "./almanac";
import { childOutcomes } from "./breedingOdds";
import { HOLLOW_CHANCE, MOTH_PATTERNS, TIDELIT_CHANCE, WILD_TRAIT_CHANCE, isCocoonParent, patternById } from "./moths";
import { CROSSING_TRAIT_CHANCE, MOTH_TRAITS, isAtSea, postOf, traitById } from "./mothTraits";
import type { GameState, Moth } from "./types";

// ── How to fill an Almanac page ──────────────────────────────────────────────
// The Almanac used to be a scoreboard: a missing page was a dot. Tap one now
// and it says how that page is filled, with the moths you hold: the lure
// odds, the Deep Glass Crossing for a trait, and the best pair in your roost
// to breed for it (exact odds, breedingOdds.childOutcomes). Design review 4.

export interface PageRoute {
  key: string;
  filled: boolean;
  /** Moths held now that fill this page. */
  holders: Moth[];
  /** Ways to fill it, likeliest kinds first, as sentences. */
  ways: string[];
  /** The best pair you could spin a cocoon from now for this page, and its chance a cocoon. */
  bestPair: { a: Moth; b: Moth; p: number; storm: boolean } | null;
  /** Cocoons already spinning that could fill it, and their chance. */
  spinning: { a: Moth; b: Moth; p: number }[];
}

const oneIn = (p: number): string => `about 1 in ${Math.max(1, Math.round(1 / p)).toLocaleString("en-US")}`;
const pctText = (p: number): string => (p >= 0.095 ? `${Math.round(p * 100)}%` : `${(p * 100).toFixed(1).replace(/\.0$/, "")}%`);

/** Moths free to spin a cocoon now: at home, not posted, not at sea, not already spinning. */
function breeders(state: GameState): Moth[] {
  return state.moths.filter((m) => postOf(state, m.id) === null && !isAtSea(state, m.id) && !isCocoonParent(state, m.id));
}

/** The pair (of moths free now) likeliest to fill `key` in one cocoon. */
export function bestPairFor(state: GameState, key: string): PageRoute["bestPair"] {
  const storm = key.startsWith("tidelit:");
  const free = breeders(state);
  let best: PageRoute["bestPair"] = null;
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const p = childOutcomes(free[i], free[j], { storm, endingSeen: state.endingSeen })
        .filter((o) => o.keys.includes(key))
        .reduce((s, o) => s + o.p, 0);
      if (p > 0 && (!best || p > best.p)) best = { a: free[i], b: free[j], p, storm };
    }
  }
  return best;
}

export function pageRoute(state: GameState, key: string): PageRoute {
  const [patternId, traitId] = key.split(":");
  const pattern = patternById(patternId);
  const trait = traitById(traitId);
  const holders = state.moths.filter((m) => almanacKeysOf(m).includes(key));
  const ways: string[] = [];
  const total = MOTH_PATTERNS.reduce((s, p) => s + p.weight, 0);
  const share = pattern.weight / total;

  if (patternId === "tidelit") {
    ways.push(`Tidelit wings never come wild. A Starlit or Prismatic cocoon that opens in a Stormfront is Tidelit ${pctText(TIDELIT_CHANCE)} of the time: tick "Open in the next Stormfront" on it and it waits for one by itself.`);
    ways.push(trait ? `The hatchling must also carry ${trait.name}: a parent with it passes it on half the time.` : "The hatchling must carry no trait: two traitless parents make that likeliest.");
  } else if (patternId === "hollow") {
    ways.push(`Hollow wings never come wild. ${state.endingSeen ? "Two" : "After the ending, two"} glow-100 Prismatics may hatch a Hollow moth: ${pctText(HOLLOW_CHANCE)} a cocoon.`);
    ways.push(trait ? `It carries up to two of its parents' traits, so one parent must carry ${trait.name}.` : "It carries its parents' traits, so for this page both parents must have no trait at all.");
    const perfect = state.moths.filter((m) => m.pattern === "prismatic" && m.glow >= 100);
    const kin = perfect.filter((m) => (trait ? m.trait === trait.id || m.trait2 === trait.id : !m.trait && !m.trait2));
    ways.push(`You hold ${perfect.length} glow-100 Prismatic${perfect.length === 1 ? "" : "s"}${trait ? `, ${kin.length} with ${trait.name}` : `, ${kin.length} without a trait`}.`);
  } else if (!trait) {
    ways.push(`A lure: ${oneIn(share * (1 - WILD_TRAIT_CHANCE))} brings a ${pattern.name} moth with no trait.`);
  } else {
    ways.push(`A scented lure (8 Wing Scales): ${oneIn(share / MOTH_TRAITS.length)} is ${pattern.name} with ${trait.name}. A plain lure: ${oneIn((share * WILD_TRAIT_CHANCE) / MOTH_TRAITS.length)}.`);
    const crossing = CROSSING_TRAIT_CHANCE / MOTH_TRAITS.length;
    const rider = state.moths.find((m) => m.pattern === patternId && !m.trait && !isCocoonParent(state, m.id) && !isAtSea(state, m.id));
    ways.push(
      rider
        ? `Send ${rider.name}, a traitless ${pattern.name}, on the Deep Glass Crossing: ${pctText(crossing)} it comes home ${trait.name} (${pctText(CROSSING_TRAIT_CHANCE)} it brings a trait at all).`
        : `A traitless ${pattern.name} riding the Deep Glass Crossing comes home ${trait.name} ${pctText(crossing)} of the time.`,
    );
  }
  const spinning: PageRoute["spinning"] = [];
  for (const c of state.cocoons) {
    const a = state.moths.find((m) => m.id === c.parentIds[0]);
    const b = state.moths.find((m) => m.id === c.parentIds[1]);
    if (!a || !b) continue;
    const p = childOutcomes(a, b, { storm: c.stormWait === true, endingSeen: state.endingSeen }).filter((o) => o.keys.includes(key)).reduce((s, o) => s + o.p, 0);
    if (p > 0) spinning.push({ a, b, p });
  }
  return { key, filled: state.almanac.includes(key), holders, ways, bestPair: bestPairFor(state, key), spinning };
}
