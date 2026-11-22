# Tidelight — Keepers of the Hollow Sea

> Keep the light on. They'll find their way home.

A cozy narrative idle game about relighting seven lighthouses on a sea that
turned to glass. You are the new Keeper of Candlewick Point. Ships don't sail
the Hollow Sea anymore — memories do, and they get lost in the dark.

Flash the beam, hire candle crabs and lantern moths, polish the lens, and
spread the light from lighthouse to lighthouse. When the numbers wall you,
**Rekindle**: let the light gutter out and light it again, stronger, banking
Embers that make every future flame burn brighter.

**Play it in your browser:** https://v0yagertpm.github.io/Tidelight/ —
deployed from `main` by `.github/workflows/pages.yml` whenever it changes
(only if the typecheck and tests pass). Progress saves in your browser;
use Export / Import in the Log tab to carry a save between devices.

## Status

**Sprint 5 — complete. All five sprints shipped.** All seven
lighthouses relightable in order, a 27-beat story in three acts, the
ending, New Game+ ("the Next Keeping"), and the Keeper's Desk with
save export/import. The full design lives in
[docs/DESIGN.md](docs/DESIGN.md); the build roadmap is in
[docs/SPRINTS.md](docs/SPRINTS.md); the Steam wrapper guide is
[docs/STEAM.md](docs/STEAM.md).

**Post-launch — playtest fixes and Overhaul phase 1.** Five bugs from
the first full playtest are fixed (see SPRINTS.md), and the graphics
overhaul has begun: the Light view opens on a living scene of
Candlewick Point — the beam, the glass sea, the tides, the seven
lighthouses on the horizon, and every kind of helper you've hired —
with a new type and colour system, illustrated generator rows, and a
bottom tab bar on phones. Later phases added a coast panorama of all
seven lighthouses and a flowing supply chain, a moth meadow on the
Shore, full-screen moments for a Rekindle, each relight and the ending,
synthesised sound (toggle in the header), and illustrated cards for
upgrades, Ember perks and challenges, with the Rekindle view opening on
a hearth whose fire grows with the Embers you'd bank.

## What's playable

- **The full early loop** — Flash the Beam, hire the first four generator
  tiers, and watch milestones double production at 25/50/100 owned
  (progress to the next one is shown on every row). The upper four answer
  the relit lighthouses: Lens Polishers come with Gull Rock, Storm
  Lanterns with Cormorant Roost, Beacon Whales with Widow's Walk, and The
  Seventh Light with Siren's Rest.
- **Buy amounts** — a ×1 / ×10 / ×100 / Max toggle prices the whole batch
  (cost + production gain on every row) and remembers your choice.
- **72 upgrades** in their own tab, with the nearest locked ones shown as
  silhouettes with their unlock conditions:
  - five tiers per helper (×2 at 10 and 30 copies, then ×2 / ×3 / ×5 at
    75, 150 and 250);
  - click tiers that take the beam from +1 to +8, and **Flash Echo**, which
    adds 2% / 4% / 6% of a second's production to a flash, on up to three
    flashes a second (quicker ones pay the plain flash: three marks on
    the button empty and refill, and a quick flash says "echo resting");
  - six **synergies** (a helper +1% per copy of another, at 50 of each);
  - two **lighthouse lessons** per lit lighthouse: Wick, Oil or Lens support
    ×2, Beam levels worth +7.5%, groups of helpers ×3, all production ×2
    or ×3, Ember gain ×1.25;
  - keeper-wide globals.
  **Learn all affordable** buys every lesson that fits, cheapest first.
- **The supply chain** — at 10 generators the chain wakes: Wick, Oil and
  Lens levels support your production rate, and the weakest node caps
  your beam efficiency (never below 25%). Each level supports a little
  more than the last, so keeping the chain fed costs a steady slice of
  production however large the light grows; each Upgrade button shows
  the support its next level adds. The flow board in the
  Lighthouses tab names the bottleneck and its shortfall; Beam levels
  add +5% production each. A line under the supply strip always says
  where the chain stands, and turns into a warning when the beam is
  starving (below 50%). First Light's starting levels support six times
  their usual amount, so the chain wakes fed and the first starving lands
  around minute ten, once there's Lumen to feed it.
- **All seven lighthouses** — they relight in order, each gated on the
  last, on the chain being awake, on a beam-efficiency requirement, and
  on its cost — and each grants something different: Gull Rock (+50%
  production, and a **Quartermaster** who learns upgrades for you),
  Cormorant Roost (+75%, and a **Lamp Crew** who hires helpers for you
  without starving the beam), Widow's Walk (chain support +50%, and the
  Chain Steward), The Bellwether (Ember gain +25%), Siren's Rest (better offline
  earnings, +4h cap), and The Hollow Light (+150% — and the ending).
  The gates climb from 50% to 80% beam efficiency, so the far lights
  need a well-fed chain. The Hollow Light is reached by **the
  Crossing**: three waymarks on the deep glass, lit in order through its
  Relight button, each with its own story beat and gift: The Drowned
  Bell (chain support +25%), The Glass Stair (the thrown beam +25%) and
  The Last Lantern (one more moth can stand duty). Each also asks for an
  **offering from the Shore** that halves its price, never a gate: a moth
  posted at Siren's Rest, a bottle home from the Deep Glass Crossing, a
  moth glowing 80 or brighter on duty. The card and the Shore both name
  the next one. They stand on the
  coast panorama between Siren's Rest and The Hollow Light, stay lit
  through Rekindle, and go dark with the lighthouses in a Next Keeping. Every lit lighthouse adds its own chain board,
  working at a bigger scale. Lighthouses stay lit through Rekindle;
  chain boards reset.
- **The story** — 27 beats in three acts ("The Dark Shore", "The Hollow
  Sea", "The Relighting") that arrive as you play: the first moth, the
  first relic, each lighthouse, the ending itself. Collected beats live
  at the top of the Log, readable in full; the ones you haven't reached
  show as silhouettes with hints.
- **The ending, and the Next Keeping** — light The Hollow Light and the
  sea remembers it was water. Then, if you choose, begin the Next
  Keeping (NG+): the shore goes dark and the Ember ledger starts fresh,
  but your moths, relics, story, perks and challenge rewards come with
  you — plus a legacy bonus of +25% production per Keeping, forever,
  and a handful of inherited Embers to start with.
- **The Keeper's Desk** — at the bottom of the Log: switch number
  notation between standard (1.23M, turning to 1.23e15 past T) and
  scientific (1.23e6), export
  your save as JSON (with Copy) or import one back — handy for backups
  and for carrying a save to the Steam build one day — and a two-step
  hard reset for keepers who truly want a cold lamp.
- **Rekindle, honestly priced** — gain preview, the recommended-40 marker,
  then the **Rekindle moment**: the hearth fills with the run's Ember
  growth and flares (a dot lights on the Rekindle tab) once the run has
  done its best work, or says to relight a light that's within half an
  hour first. It is the rule the balance bot plays by. Also
  a recovery-time estimate ("~X min to recover your current Lumen/s",
  simulated by the same greedy bot the balance checks use), and kept/lost
  lists that name your upgrades, Ember perks, and challenge rewards. Two
  upgrades (Longer Wicks, Ember Resonance) are keeper knowledge and
  survive the reset. The first Rekindle, and every tenth, plays the full
  moment; the rest flare the hearth and leave a line under the button.
  Under the Ember numbers, a plain line says what a Rekindle does to the
  light ("×1.6 as bright"), since bonuses in the trillions say little.
- **The Ember Shop** — four shelves, all bought with held Embers.
  Spending lowers your held-Ember bonus, and each card shows how much.
  **Kindle all under 1%** buys every perk and Kindling level that costs
  no more than a hundredth of the Embers you hold, cheapest first.
  - **Keeper's perks** (one-time): Head Start (runs open with 1,000 Lumen),
    Warm Lamp Oil (click ×2), Friend of Gulls (Gull Rock at half price),
    Deep Wicks (chain support +25%), The Long Night (12h offline cap), Full
    Reservoir (offline rate +10 points, cap 90%), Ember Heart (+1% per held
    Ember), Second Wind (+50% production).
  - **Kindlings** (bought again and again, each level dearer than the
    last): Ember Glow (+5% production a level, 10 levels, ×10 a level),
    Long Watch (+1h offline cap, 8 levels, ×4), Quick Lures and Spinning
    Silk (lures and cocoons 5% sooner a level) and Tailwind (relic chance
    +2 points a level), 20 levels each, ×3.
  - **Late perks** (one-time, 50,000 to 5 billion Embers):
    - Warm Hearth starts each run with 10 of each of the first three helpers.
    - The Steward's Ledger lets the Chain Steward's purse hold 30 minutes.
    - Storm Charts halve a Stormfront's drain on the chain.
    - Moth Lantern adds a lure to the bank and spins cocoons 25% faster.
    - Ember Memory keeps every helper's first upgrade through a Rekindle.
    - Glass Charts claim a bottle that washes home and set it out again,
      on the route you choose, even while you're away (counted inside the
      offline cap).
  - **The far shelf** (opens when Siren's Rest burns, 100 billion to 10
    trillion Embers), so the shop doesn't run dry halfway through the
    story: Second Memory (every helper's second upgrade survives a
    Rekindle too), Moth-Watch (moths on duty light the beam twice as
    brightly) and Full Hearth (Warm Hearth's crew covers the first six
    helpers).
  It is a comfort shop on purpose: production boosts compound through
  Embers, so the shop mostly buys time away, a quicker Shore and a few
  conveniences. (The Quartermaster and Lamp Crew used to be sold here;
  they now come with Gull Rock and Cormorant Roost, each with an on/off
  switch beside the controls it automates, and a save that bought them
  gets its 500 and 5,000 Embers back.)
- **Challenges** — opt-in rule-changing runs for permanent rewards:
  Fogbound (half the thrown beam), Still Hands (no clicking), First
  Light Only (tiers 1–3 only). Starting resets your run with no Embers,
  and your held Embers rest (no production bonus) until it ends, so each
  is a real climb at any point in the game; goals grow with your lit
  lighthouses and perks. Finishing banks the reward and the run
  continues: Fog Lamps (+12.5% to the beam), Patient Keeper (+10%),
  Humble Mastery (tiers 1–3 ×2).
- **Lantern moths** — hire a Lantern Moth and the wild ones follow your
  light home (Shore tab). Each one costs a lure: you hold up to 3 and one
  regrows every 20 minutes, even offline (a rush lure costs Lumen when
  you can't wait). Six wing patterns from Plain to Prismatic, each with a
  glow ceiling (Plain 40 … Prismatic 100); put up to 3 on duty for
  +(glow × 0.1)% to the thrown beam each (glow 100 → +10%). Like Beam
  levels and the tide, the beam bonus comes after the supply chain, so
  it never adds to what the chain must carry. Breed two moths (30–75 minutes a
  cocoon) and the child inherits their wings — usually the rarer
  parent's pattern, about the average of their glows, and a little
  chaos. Prismatic wings are unstable. A perfect roster is a long chase.
  The roost has **nests**: two cocoons spin at once from the start, each
  from its own pair, and a bigger roost makes room for more (a third at 3
  roost expansions, a fourth at 6). Hatch them one by one, or all at once.
  Some moths carry a **trait** (Lamp-loyal, Night-flier, Chain-tender,
  Seeker, Fertile, Tidewise) that children can inherit, and every lit
  lighthouse has a **moth post**: a posted moth adds +(glow × 0.2)% to
  that lighthouse's chain support. The **Wing Almanac** has a page for
  every wing and trait (56 in all) and rewards you at 6, 12, 24, 36, 42,
  49 and every page (42 pages: A Fifth Nest, one more cocoon); released moths leave **Wing Scales** (and only those) that buy scented
  lures. **Release spares** lets go, in one tap, of every moth that isn't
  on duty, posted, in a cocoon or among the best of its pattern or page,
  and **Let spares go** releases such a moth the moment it arrives. A cocoon that opens in a Stormfront may hatch a rare **Tidelit**
  moth (a Starlit or Prismatic cocoon can be told to wait for the next
  Stormfront and open by itself), and a moth can **ride a bottle** for better relic odds. After the
  ending, two perfect Prismatics may hatch a **Hollow** moth: glow up to
  120 and two traits. Moths are permanent: Rekindle can't touch the roost.
  The roost starts at 6 moths; each expansion adds 2 and costs about 3
  minutes of your production (×1.5 per expansion), or a small starting
  price early on. Attract becomes a Rush lure (Lumen) when no lure is
  ready; Scented lure shows your scales toward the 8 it needs.
- **A price ceiling** — no single purchase (upgrade, relight, roost
  expansion or rush lure) costs more than The Hollow Light's relight,
  8.80e30: a keeper who has lit it can afford anything.
- **Bottle expeditions** — send a bottle out on the glass sea (10
  minutes to 6 hours) and claim what washes back: a Lumen cache (half
  the light for as long as the bottle was out), a
  story fragment for the Log, and maybe one of eight permanent RELICS —
  a Brass Compass (+5% to the beam), a Storm in a Bottle, a Gull
  Feather that trims chain costs, and five more.
- **Tide & weather** — the sea turns every 30 minutes, the same for
  every keeper: Low Tide eases the supply chain, High Tide lifts
  production, Glass Calm doubles your clicking, and Stormfront pays
  +30% production while starving the chain. The tides are dealt like
  weather, never the same twice in a row: every 10 hours bring 6 Low
  Tides, 6 High, 5 Glass Calms and 3 Stormfronts, in a shuffled order.
  The Light view shows the current tide and the forecast, so you can
  plan around the storm.
- **Offline earnings** — 50% of your rate for up to 8 hours (75% once you
  learn Longer Wicks; up to 12 hours and 90% with the right Ember perks
  and relics; Siren's Rest adds +10 points and +4 hours more). After 5
  minutes or more away, a **Welcome back** card shows what your keepers
  earned, the time paid against the cap, the rate, how often the tide
  turned, and the news: lures regrown, a cocoon ready, a bottle home (with
  a Go to the Shore button), the Chain Steward's work and story pages
  found. It shows on a fresh visit and when a sleeping laptop wakes.
  Cocoons hatch and bottles wash back while you're away, too.
- Balance-checked end to end: the greedy-bot simulation (`npm run sim`)
  reaches the first Rekindle in ~70 minutes and the second ~50 minutes
  later, then simply plays on — growing, keeping the chain fed, saving
  for each light as it comes within reach, and Rekindling when a run's
  Ember growth has peaked — and relights the coast at 2.9h, 4.7h, 7.4h,
  11.8h and 16.7h, crosses the deep glass by the three waymarks at
  19.4h, 21.8h and 23.5h, and reaches the ending at ~30 simulated hours
  with all nine generator tiers hired, without buying perks, running
  challenges, keeping moths, sending bottles or minding the tides. With
  the Ember shop it is ~19 hours, and the engaged keeper of
  `scripts/worth.ts` ~19. A bot with the kit and habits of the one
  measured playthrough (five relics, five moths, bottles always out,
  tapping 2.4 times a second) takes ~8.5 hours; that keeper took 3.6
  hours of play, plus time away, before the re-pace. For every one of
  them the last step, from the Last Lantern to the tower, is the
  longest.
- The Wing Almanac has its own analysis (`npm run almanac`): a keeper
  bot plays the Shore with the game's own functions and chases every
  missing page, many times per kind of keeper, and the exact breeding and
  lure odds are worked out from the rules. A late-game keeper who looks in
  every 10 minutes fills all 56 pages in a median of ~10 days; hourly,
  ~26; every 4 hours, ~87. Without Ember-shop help and with a 6-moth
  roost, ~72 and ~98. The last pages are Hollow wings (two glow-100
  Prismatics, 2% a cocoon).

## Run it

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest suite
npm run build      # typecheck + production build to dist/
npm run sim        # the balance bot, start to ending
npm run almanac    # the Wing Almanac simulation, into out/almanac
```

## Controls

- **Flash the Beam** — +1 Lumen per click (upgradable to +8). Tap
  anywhere on the lighthouse scene, or use the button. While you keep
  flashing, the header's **per second** counts your flashes too (averaged
  over the last 3 seconds; hover it for the split).
- **Buy** — hire generators at the selected buy amount (×1/×10/×100/Max).
  Unaffordable buttons show how long until you can afford the batch.
- **Upgrades tab** — spend Lumen on one-time upgrades as they unlock.
- **Lighthouses tab** — relight the seven in order, switch chain
  boards, upgrade Wick / Oil / Lens / Beam nodes to keep the beam fed —
  and, once The Hollow Light burns, find the ending panel and the Next
  Keeping there.
- **Rekindle tab** — Rekindle for Embers (with a recovery-time preview),
  spend held Embers in the Ember Shop, and start or abandon challenges.
- **The supply strip** — under the scene on the Light view: Wick, Oil
  and Lens as gauges (the bottleneck glows), the Beam bonus, a one-tap
  **Feed** on each (the cheapest level on any lit board) and **Fill the
  chain**, which feeds until the beam is full and raises the Beam along
  the way (whenever its next level is cheaper, then with levels costing up
  to a tenth of your Lumen). Relight Widow's Walk and the **Chain Steward** feeds the chain
  from a share of your income, raising the Beam alongside the supplies
  (the cheaper first, and only the Beam once the chain is at its target;
  a switch in its panel turns the Beam off). Helper rows show what each
  helper adds to the Lumen/s at the top (after the lighthouses, the chain,
  the Beam and the lamp, so the rows add up to the header) and what the
  next hire really adds, and warn when a purchase would
  drop the beam 10 points or more. The Beam's bonus reads "+45%" while it
  is small and "×109" once it more than doubles the light. The Lighthouses tab keeps the board-by-board view.
  On phones the strip folds to one line (efficiency, Fill, Show) while
  the beam is at 90% or more, and opens by itself below 80%. A Lamp Crew
  that can't hire says why beside its switch ("waiting on the chain",
  "saving up").
- **Tips** — hover (or press and hold on a phone) anything with a dotted
  underline or an ⓘ for more about it.
- **How to play** — an eight-page guide, read a page at a time: a new
  keeper reads the first two (the shore, and making light), and each of
  the others opens by itself the first time its part of the game matters
  (lessons, the supply chain, the lighthouses, Rekindle, the Shore, the
  tides), at most one every 90 seconds. Reopen the whole guide any time
  with the **?** button at the top or from the Keeper's Desk.
- **Shore tab** — attract, roster and breed lantern moths; send and
  claim bottle expeditions; admire the relic shelf.
- **Log tab** — the story so far, the Keeper's Log, and the Keeper's
  Desk (notation, save export/import, hard reset).
- **Tabs** — Light · Upgrades · Lighthouses · Shore · Rekindle · Log.
  One view at a time; on phones they sit in a bottom bar. On screens
  1024px wide and up, the Light view puts the lamp (scene and supply
  chain) beside the helpers, so the buy rows are never below the fold.
- Progress saves automatically to your browser (localStorage,
  `tidelight-save-v1`), including offline earnings for up to 8 hours.

## Tech stack (locked decision, 2026-11-17)

- **TypeScript + HTML/CSS, web first** — this is a menu-and-numbers game;
  the web stack is the fastest way to playtest it on phone and desktop.
- **Vite** for dev/build, **Vitest** for tests.
- **break_infinity.js** `Decimal` for all Lumen values, so numbers stay
  exact long past where plain JS numbers give up (~9 quadrillion).
- Steam release later ships the *same code* in a Tauri wrapper — see
  [docs/STEAM.md](docs/STEAM.md). Python and Unity/Godot were considered
  and ruled out.
