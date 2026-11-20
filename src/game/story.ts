import {
  BELLWETHER_ID,
  CORMORANT_ROOST_ID,
  GULL_ROCK_ID,
  SIRENS_REST_ID,
  WIDOWS_WALK_ID,
} from "./config";
import { chainUnlocked, isLit } from "./chain";
import { RELICS } from "./expeditions";
import { addLog } from "./state";
import type { GameState } from "./types";

// ── The story of the Hollow Sea (Sprint 5) ───────────────────────────────────
// Twenty-four beats in three acts, delivered by unlock order — no
// cutscenes, no interruptions. Each beat is a pure predicate over the
// state; checkStory (called from the main loop and on load) fires every
// beat whose moment has arrived and hasn't been seen, in the order the
// beats are listed here, exactly once, ever. Seen beats live in the Log
// (with story styling) and in the Story section of the Log view, where
// uncollected beats show as silhouettes with a hint. Beats survive
// Rekindle and NG+ — the story, once heard, is the keeper's own.

export interface StoryAct {
  act: number;
  name: string;
}

export const STORY_ACTS: readonly StoryAct[] = [
  { act: 1, name: "The Dark Shore" },
  { act: 2, name: "The Hollow Sea" },
  { act: 3, name: "The Relighting" },
];

export interface StoryBeat {
  id: string;
  act: number;
  title: string;
  text: string;
  /** Shown on the silhouette in the Story section before the beat fires. */
  hint: string;
  trigger: (state: GameState) => boolean;
}

const ownsGenerator = (id: string) => (state: GameState) => (state.generators[id] ?? 0) >= 1;
const hasMothOfGeneration = (gen: number) => (state: GameState) =>
  state.moths.some((m) => m.generation >= gen);

export const STORY_BEATS: readonly StoryBeat[] = [
  // ── Act I — The Dark Shore ─────────────────────────────────────────────
  {
    id: "arrival",
    act: 1,
    title: "Cold Lamp",
    hint: "Begin.",
    trigger: () => true,
    text: "You arrive at Candlewick Point with a bag of tools, a kettle, and a letter of appointment nobody signed. The lamp at the top of the tower is cold. The sea below is not water but glass — smooth, grey, and silent all the way to the horizon, as if the whole world had been holding its breath for a hundred years. Well. Somebody has to strike the first match.",
  },
  {
    id: "first-helper",
    act: 1,
    title: "A Crab, a Candle",
    hint: "Hire your first helper.",
    trigger: (s) => s.totalGeneratorsBought >= 1,
    text: "The candle crab comes up out of a rock pool at dusk, candle already lit, and looks at your one sputtering flame the way professionals look at amateurs everywhere. It takes the night shift without being asked. You understand, suddenly, that you will not be doing this alone — the shore has been waiting for someone to start, and everything on it intends to help.",
  },
  {
    id: "first-hoard",
    act: 1,
    title: "Ten Thousand Lights",
    hint: "Earn 10,000 Lumen, all told.",
    trigger: (s) => s.allTimeLumen.gte(10_000),
    text: "Ten thousand Lumen. It sounds like a fortune until you learn what Lumen is: not gold, not oil — attention. The measure of how long the dark has been looked at by something that refuses to look away. The old keepers banked it the way misers bank coin, and spent it the way gardeners spend seed. You are rich, a little. Spend like a gardener.",
  },
  {
    id: "the-chain",
    act: 1,
    title: "Wick, Oil, Lens",
    hint: "Own 10 generators, and wake the supply chain.",
    trigger: (s) => chainUnlocked(s),
    text: "A light is not a flame. A light is a flame, fed — wick drinking oil, oil feeding fire, fire thrown by glass across ten miles of dark. The night your helpers grow too many for one pair of hands, you find the old chain-room under the tower, its ledgers still open at the last page: WICK. OIL. LENS. BEAM. Underneath, in pencil: 'Mind the weakest link. It is always the weakest link.'",
  },
  {
    id: "first-rekindle",
    act: 1,
    title: "The Guttering",
    hint: "Rekindle for the first time.",
    trigger: (s) => s.totalRekindles >= 1,
    text: "Every keeper learns it eventually, usually at 3 a.m., usually in the rain: a flame that is never allowed to gutter is a flame that never learns to roar. You let the light die on purpose, and it is the hardest thing you have ever done on this shore. Then you light it again — and it comes back the way dawn comes back, like it had only been waiting to be asked properly.",
  },
  {
    id: "gull-rock",
    act: 1,
    title: "The Gulls Were Waiting",
    hint: "Relight Gull Rock Light.",
    trigger: (s) => isLit(s, GULL_ROCK_ID),
    text: "The gulls of Gull Rock never left. A hundred years they sat on a dark tower, in the rain that no longer falls, watching a sea that no longer moves — because a gull's faith is simple: where there was a light, there will be a light. The night your beam first touches the rock, every one of them lifts into the air at once, screaming with joy, and does a lap of the tower. So do you. Quietly. In your head.",
  },
  // ── Act II — The Hollow Sea ────────────────────────────────────────────
  {
    id: "first-moth",
    act: 2,
    title: "It Followed the Light Home",
    hint: "Welcome your first lantern moth.",
    trigger: (s) => s.moths.length >= 1,
    text: "Nobody knows where the lantern moths lived during the dark century. Perhaps in the hollow of the sea itself, folded small, dreaming of lamps. The first one arrives an hour after the beam steadies — enormous, soft as snowfall, wings full of quiet light — and settles on the lamp-room glass like it is reading the light by touch. It is. That is exactly what it is doing.",
  },
  {
    id: "first-bottle",
    act: 2,
    title: "What the Bottle Carried",
    hint: "Claim your first returned bottle.",
    trigger: (s) => s.storyFragmentIndex >= 1,
    text: "You did not expect the bottle to come back. Bottles are supposed to be one-way — a message thrown at the future, no reply requested. But the glass sea is not an ocean; it does not swallow things, it keeps them, the way ice keeps a fly. Whatever you send out on it comes back changed, carrying the shore's side of the conversation. From now on, you write your messages more carefully.",
  },
  {
    id: "first-relic",
    act: 2,
    title: "What the Sea Gives Back",
    hint: "Recover your first relic.",
    trigger: (s) => s.relics.length >= 1,
    text: "The relic comes up out of the glass sea the way a word comes back to you in a dream — slowly, and then all at once, and obviously yours. The old keepers lost a century of tools, charts and treasures when the sea stilled. The sea, it turns out, is not a thief. The sea is a librarian with a very slow returns desk.",
  },
  {
    id: "first-bred",
    act: 2,
    title: "Generation Two",
    hint: "Hatch a moth of the second generation.",
    trigger: hasMothOfGeneration(2),
    text: "The cocoon opens at the exact moment the beam swings past, as if the small thing inside had been waiting for the light to look at it. It has its mother's wings and its father's glow and something else entirely that belongs to neither — the sea's contribution, perhaps, or the lamp's. You write its name in the roost ledger with ridiculous ceremony. Some things deserve ridiculous ceremony.",
  },
  {
    id: "first-trait",
    act: 2,
    title: "A Moth With Habits",
    hint: "Keep a moth with a trait.",
    trigger: (s) => s.moths.some((m) => m.trait !== undefined),
    text: "Most moths are content to be moths. This one has opinions. It will only sleep on the left-hand side of the lamp; it is first to the glass when the tide turns; it has, you are almost sure, been counting the bottles. The old roost ledger has a column for this, headed in faded ink: habits. You had assumed it was a joke. You fill it in now, carefully, because the old keepers never wrote down anything that did not matter.",
  },
  {
    id: "first-post",
    act: 2,
    title: "A Moth on Watch",
    hint: "Post a moth at a lighthouse.",
    trigger: (s) => Object.keys(s.mothPosts).length > 0,
    text: "You carry the moth up the tower stairs cupped in both hands, and it walks off your palm onto the lamp-room sill as though it has been waiting a century for the job. It has, probably. The old towers all had one — a moth on watch, the ledgers say, as plainly as they say oil and wick — and you had thought it a figure of speech. The beam leans a little steadier on the glass that night. The moth does not look round. It is working.",
  },
  {
    id: "cormorant",
    act: 2,
    title: "The Roost at Cormorant",
    hint: "Relight Cormorant Roost.",
    trigger: (s) => isLit(s, CORMORANT_ROOST_ID),
    text: "The cormorants kept the lens clean for a hundred years. Nobody taught them; nobody paid them; a cormorant simply cannot abide a dirty lens, the way you cannot abide an unmade bed in a burning house. When the Roost lights, they do not celebrate. They inspect. One ancient bird walks the lamp-room twice, peers at the flame, and gives a single approving croak — the highest honour the shore bestows.",
  },
  {
    id: "widows-walk",
    act: 2,
    title: "The Widow's Vigil",
    hint: "Relight Widow's Walk.",
    trigger: (s) => isLit(s, WIDOWS_WALK_ID),
    text: "Her name was Maren, and she was not a widow when she started waiting. The log in the cottage below the Walk is forty years of the same entry, in a hand that gets older and never less steady: 'Lamp lit. Stores full. Sea still. Waiting.' She out-waited the dark by decades and left the stores so well kept that your chains run stronger just for opening them. Some vigils are a kind of lighthouse too.",
  },
  {
    id: "first-challenge",
    act: 2,
    title: "A Keeper's Wager",
    hint: "Complete a challenge run.",
    trigger: (s) => s.completedChallenges.length >= 1,
    text: "The old keepers had a saying: a light you cannot tend in the fog is a fair-weather friend. You took the wager — the fog, the still hands, the small beginning, whatever form it took — and you kept the light anyway, with one hand tied by your own rules. The shore respects this enormously. The shore has seen keepers quit over less, and says so, in gull, at length.",
  },
  {
    id: "hundred-embers",
    act: 2,
    title: "A Hundred Small Suns",
    hint: "Earn 100 Embers across your keepership.",
    trigger: (s) => s.embersTotalEarned >= 100,
    text: "One hundred Embers. Each one is a night the light died on purpose and came back stronger; each one is a small, banked refusal to let the dark have the last word. Keepers used to carry them in a tin box by the lamp, and on the worst nights — the still, glassy, hopeless nights — they would open the box and just look at them. You understand the tin box now.",
  },
  // ── Act III — The Relighting ───────────────────────────────────────────
  {
    id: "bellwether",
    act: 3,
    title: "The Bell That Leads",
    hint: "Relight The Bellwether.",
    trigger: (s) => isLit(s, BELLWETHER_ID),
    text: "The Bellwether was the first light lit on this shore and the last one the old order lit the others from — bellwether, the sheep that leads the flock, the flame that leads the flames. When it burns again, every lighthouse you tend stands a little straighter, the way a choir stands when the first voice is true. Somewhere across the glass, faint and far, its bell rings the hour. It is whatever hour you need it to be.",
  },
  {
    id: "sirens-rest",
    act: 3,
    title: "Where the Sirens Sleep",
    hint: "Relight Siren's Rest.",
    trigger: (s) => isLit(s, SIRENS_REST_ID),
    text: "The sirens are not what the stories said. They are tired old singers who lured ships because ships were the only audience the sea ever sent them, and when the sea stilled they sang to the dark until their voices gave out, and then they slept. Your light wakes them gently, the way dawn wakes a harbour. They do not sing for ships anymore. Some nights, if the tide is right, they harmonize with the lamp's hum — for the keeper, who stayed.",
  },
  {
    id: "seventh-helper",
    act: 3,
    title: "You Become the Wick",
    hint: "Hire The Seventh Light.",
    trigger: ownsGenerator("seventh-light"),
    text: "There is a helper on the roster you did not write there. The wage is your shadow; the hours are the hours the light keeps, which is all of them. Old keepers called it 'taking the seventh post' and spoke of it the way sailors speak of the horizon — as a place you can walk toward forever. You sign the roster anyway. Your handwriting looks, for the first time, like the handwriting in the letter of appointment.",
  },
  {
    id: "drowned-bell",
    act: 3,
    title: "The Drowned Bell",
    hint: "Light the first waymark of the Crossing.",
    trigger: (s) => s.crossing >= 1,
    text: "Past Siren's Rest the glass goes deep and dark, and every chart in the lamp room simply stops. But someone went further. Half a day out you find a bell-buoy sunk to its shoulders in the glass, its clapper frozen mid-swing, a lantern still screwed to its crown. You light it. For the first time in a hundred years the bell rings, not because the sea moved, but because the light did. Somewhere ahead, very faint, something rings back.",
  },
  {
    id: "glass-stair",
    act: 3,
    title: "The Glass Stair",
    hint: "Light the second waymark of the Crossing.",
    trigger: (s) => s.crossing >= 2,
    text: "The waymarks were not set by ships. They were set on foot. A stair of lanterns runs out across the glass, each a day's walk from the last, each a little more carefully made than the one before, as if whoever carried them got better at hope as they went. You light them one by one, and the glass steps catch your beam and throw it on, further than any tower ever could.",
  },
  {
    id: "last-lantern",
    act: 3,
    title: "The Last Lantern",
    hint: "Light the third waymark of the Crossing.",
    trigger: (s) => s.crossing >= 3,
    text: "The last lantern stands a stone's throw from The Hollow Light, close enough to see its door. Its keeper never reached the door. The wick is trimmed, the oil is full, and in a tin beside it is a journal whose last page says only: 'Nearly. Leave a light for whoever comes next.' You light it. A moth you don't remember bringing settles on the lantern's handle and will not be moved. It seems right that something should keep watch here.",
  },
  {
    id: "prismatic",
    act: 3,
    title: "A Rainbow, Kept",
    hint: "Keep a Prismatic moth.",
    trigger: (s) => s.moths.some((m) => m.pattern === "prismatic"),
    text: "A prismatic moth is the sea's rarest sentence. Its wings do not have a colour; they have all of them, in an order that changes when you are sad, the way a friend's voice changes. The other moths treat it with enormous respect and steal its seat by the lamp at every opportunity. It lets them. That, the old keepers wrote, is how you can tell a true prismatic: it has all the colours, and it shares the warm spot.",
  },
  {
    id: "all-relics",
    act: 3,
    title: "The Whole of the Wreck",
    hint: "Recover all eight relics.",
    trigger: (s) => s.relics.length >= RELICS.length,
    text: "Compass, chart, lens, coat, feather, heart, cradle, storm — the whole of the wreck, home again. Lay them out on the lamp-room table and they stop being treasures and become a sentence: the sea kept everything, because the sea knew somebody was coming back for it. Nothing was lost. It was only ever in storage, waiting out the dark with more patience than anyone had a right to expect.",
  },
  {
    id: "hollow-light",
    act: 3,
    title: "The Sea Remembers",
    hint: "Relight The Hollow Light.",
    trigger: (s) => s.endingSeen,
    text: "The last tower stands at the heart of the Hollow Sea, where the glass is deepest and the dark is oldest. You climb it the way you climbed the first one — kettle, tools, ridiculous hope — and at the top you find the lamp already laid: wick trimmed, oil full, lens polished, a century of some keeper's faith that this night would come. You strike the match. And the light goes out across the glass in a widening ring, tower answering tower, Candlewick to Gull Rock to the Roost, the Walk, the Bellwether, the Rest — and where the light touches, the glass remembers it was water. It begins, very gently, to move. A wave. A real one, small as a held breath let go. The ships that are mostly memory turn, all together, toward home — and the memories, at last, arrive. You did that. Keeper, you did that.",
  },
  {
    id: "first-hollow",
    act: 3,
    title: "The Shape the Light Leaves",
    hint: "After the ending, breed two perfect Prismatic moths and hope.",
    trigger: (s) => s.moths.some((m) => m.pattern === "hollow"),
    text: "It hatches the colour of nothing at all — not dark, not pale, but the exact shape the beam leaves on the glass after it has passed. The other moths go very quiet. A Hollow moth, the ledger calls it, in a hand that is not quite steady: a moth the sea made only after the light came home, out of the space where the dark used to be. It settles on the lamp and the lamp, for one long breath, burns brighter than it has any right to. The Hollow Sea, it seems, has one more thing to say. It is saying thank you.",
  },
  {
    id: "next-keeping",
    act: 3,
    title: "The Next Keeping",
    hint: "Begin a New Game+ Keeping.",
    trigger: (s) => s.ngPlusCount >= 1,
    text: "The letter of appointment was never signed because it was never finished — it is a roster, and keepers sign it one after another, in the same hand, which is to say in yours. The shore goes dark again, as shores do; that is not failure, that is weather. But the moths remember the way to the lamp, the relics remember their keeper, and you remember everything. Light it again. You know how, now. You know how.",
  },
];

export function storyBeatById(id: string): StoryBeat | undefined {
  return STORY_BEATS.find((b) => b.id === id);
}

/**
 * Fire every story beat whose trigger now holds and that hasn't been
 * seen, in beat order. Each fires exactly once, ever (ids live in
 * state.storySeen) and appends a one-line 📖 entry to the Log. Returns the beats
 * fired by this call. Called from the main loop and on load.
 */
export function checkStory(state: GameState, now: number = Date.now()): StoryBeat[] {
  const fired: StoryBeat[] = [];
  for (const beat of STORY_BEATS) {
    if (state.storySeen.includes(beat.id)) continue;
    if (!beat.trigger(state)) continue;
    state.storySeen.push(beat.id);
    // Title only: the Story section at the top of the Log holds the text.
    addLog(state, `📖 ${beat.title} — a new page in The Story So Far`, now);
    fired.push(beat);
  }
  return fired;
}
