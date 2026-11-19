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
lighthouses relightable in order, a 21-beat story in three acts, the
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
- **22 upgrades** in their own tab — per-generator ×2s, click tiers that
  take the beam from +1 to +8, and keeper-wide globals. Locked upgrades
  appear as silhouettes with their unlock conditions.
- **The supply chain** — at 10 generators the chain wakes: Wick, Oil and
  Lens levels support your production rate, and the weakest node caps
  your beam efficiency (never below 25%). Each level supports a little
  more than the last, so keeping the chain fed costs a steady slice of
  production however large the light grows; each Upgrade button shows
  the support its next level adds. The flow board in the
  Lighthouses tab names the bottleneck and its shortfall; Beam levels
  add +5% production each. A banner in the Light view warns you when a
  node is starving the beam.
- **All seven lighthouses** — they relight in order, each gated on the
  last, on the chain being awake, on a beam-efficiency requirement, and
  on its cost — and each grants something different: Gull Rock (+50%
  production), Cormorant Roost (+75%), Widow's Walk (chain support
  +50%), The Bellwether (Ember gain +25%), Siren's Rest (better offline
  earnings, +4h cap), and The Hollow Light (+150% — and the ending).
  The gates climb from 50% to 80% beam efficiency, so the far lights
  need a well-fed chain. Every lit lighthouse adds its own chain board,
  working at a bigger scale. Lighthouses stay lit through Rekindle;
  chain boards reset.
- **The story** — 21 beats in three acts ("The Dark Shore", "The Hollow
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
  notation between standard (1.23M) and scientific (1.23e6), export
  your save as JSON (with Copy) or import one back — handy for backups
  and for carrying a save to the Steam build one day — and a two-step
  hard reset for keepers who truly want a cold lamp.
- **Rekindle, honestly priced** — gain preview, the recommended-40 marker,
  a recovery-time estimate ("~X min to recover your current Lumen/s",
  simulated by the same greedy bot the balance checks use), and kept/lost
  lists that name your upgrades, Ember perks, and challenge rewards. Two
  upgrades (Longer Wicks, Ember Resonance) are keeper knowledge and
  survive the reset.
- **The Ember Shop** — eight permanent perks bought with held Embers:
  Head Start (runs open with 1,000 Lumen), Warm Lamp Oil (click ×2),
  Friend of Gulls (Gull Rock at half price), Deep Wicks (chain support
  +25%), The Long Night (12h offline cap), Full Reservoir (offline rate
  +10 points, cap 90%), Ember Heart (+1% per held Ember), Second Wind
  (+50% production). Spending lowers your held-Ember bonus — the shop
  shows exactly how much.
- **Challenges** — opt-in rule-changing runs for permanent rewards:
  Fogbound (half production), Still Hands (no clicking), First Light
  Only (tiers 1–3 only). Starting resets your run with no Embers;
  finishing banks the reward and the run continues.
- **Lantern moths** — hire a Lantern Moth and the wild ones follow your
  light home (Shore tab). Each one costs a lure: you hold up to 3 and one
  regrows every 20 minutes, even offline (a rush lure costs Lumen when
  you can't wait). Six wing patterns from Plain to Prismatic, each with a
  glow ceiling (Plain 40 … Prismatic 100); put up to 3 on duty for
  +(glow × 0.2)% production each. Breed two moths (30–75 minutes a
  cocoon) and the child inherits their wings — usually the rarer
  parent's pattern, about the average of their glows, and a little
  chaos. Prismatic wings are unstable. A perfect roster is a long chase.
  Some moths carry a **trait** (Lamp-loyal, Night-flier, Chain-tender,
  Seeker, Fertile, Tidewise) that children can inherit, and every lit
  lighthouse has a **moth post**: a posted moth adds +(glow × 0.2)% to
  that lighthouse's chain support. The **Wing Almanac** has a page for
  every wing and trait (49 in all) and rewards you at 6, 12, 24, 36 and
  every page; released moths leave **Wing Scales** that buy scented
  lures. A cocoon that opens in a Stormfront may hatch a rare **Tidelit**
  moth, and a moth can **ride a bottle** for better relic odds. After the
  ending, two perfect Prismatics may hatch a **Hollow** moth: glow up to
  120 and two traits. Moths are permanent: Rekindle can't touch the roost.
- **Bottle expeditions** — send a bottle out on the glass sea (10
  minutes to 6 hours) and claim what washes back: a Lumen cache, a
  story fragment for the Log, and maybe one of eight permanent RELICS —
  a Brass Compass (+10% production), a Storm in a Bottle, a Gull
  Feather that trims chain costs, and five more.
- **Tide & weather** — the sea turns every 30 minutes, the same for
  every keeper: Low Tide eases the supply chain, High Tide lifts
  production, Glass Calm doubles your clicking, and Stormfront pays
  +30% production while starving the chain. The Light view shows the
  current tide and the forecast, so you can plan around the storm.
- **Offline earnings** — 50% of your rate for up to 8 hours (75% once you
  learn Longer Wicks; up to 12 hours and 90% with the right Ember perks
  and relics; Siren's Rest adds +10 points and +4 hours more), reported
  when you return — the welcome-back line also mentions a cocoon ready
  to hatch or a bottle waiting on the glass. Cocoons hatch and bottles
  wash back while you're away, too.
- Balance-checked end to end: the greedy-bot simulation (`npm run sim`)
  reaches the first Rekindle in ~85 minutes and the second ~60 minutes
  later, then simply plays on — growing, keeping the chain fed, saving
  for each light as it comes within reach — and relights the coast at
  3.5h, 6.7h, 12.4h, 21.8h and 37.5h, reaching the ending at ~65
  simulated hours with all eight generator tiers hired, without buying
  perks, running challenges, keeping moths, sending bottles or minding
  the tides. Real keepers will be faster; the bot is the pessimistic
  bound.

## Run it

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest suite
npm run build      # typecheck + production build to dist/
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
  **Feed** on each (the best-value level on any lit board) and **Fill the
  chain**. Relight Widow's Walk and the **Chain Steward** feeds the chain
  from a share of your income. Helper rows warn when a purchase would
  starve the beam. The Lighthouses tab keeps the board-by-board view.
- **Tips** — hover (or press and hold on a phone) anything with a dotted
  underline or an ⓘ for more about it.
- **How to play** — new keepers start with an eight-page guide to the
  game; reopen it any time with the **?** button at the top or from the
  Keeper's Desk.
- **Shore tab** — attract, roster and breed lantern moths; send and
  claim bottle expeditions; admire the relic shelf.
- **Log tab** — the story so far, the Keeper's Log, and the Keeper's
  Desk (notation, save export/import, hard reset).
- **Tabs** — Light · Upgrades · Lighthouses · Shore · Rekindle · Log.
  One view at a time; on phones they sit in a bottom bar.
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
