# Tidelight — Keepers of the Hollow Sea

> Keep the light on. They'll find their way home.

A cozy narrative idle game about relighting seven lighthouses on a sea that
turned to glass. You are the new Keeper of Candlewick Point. Ships don't sail
the Hollow Sea anymore — memories do, and they get lost in the dark.

Flash the beam, hire candle crabs and lantern moths, polish the lens, and
spread the light from lighthouse to lighthouse. When the numbers wall you,
**Rekindle**: let the light gutter out and light it again, stronger, banking
Embers that make every future flame burn brighter.

## Status

**Sprint 4 — the Shore is alive.** Lantern moths to collect and breed,
bottle expeditions that bring home permanent relics and story
fragments, and a deterministic tide that turns every half hour and
bends production, clicking and the supply chain. The full design lives
in [docs/DESIGN.md](docs/DESIGN.md); the build roadmap is in
[docs/SPRINTS.md](docs/SPRINTS.md).

## What's playable

- **The full early loop** — Flash the Beam, hire all 8 generator tiers,
  and watch milestones double production at 25/50/100 owned (progress to
  the next one is shown on every row).
- **Buy amounts** — a ×1 / ×10 / ×100 / Max toggle prices the whole batch
  (cost + production gain on every row) and remembers your choice.
- **22 upgrades** in their own tab — per-generator ×2s, click tiers that
  take the beam from +1 to +8, and keeper-wide globals. Locked upgrades
  appear as silhouettes with their unlock conditions.
- **The supply chain** — at 10 generators the chain wakes: Wick, Oil and
  Lens levels support your production rate, and the weakest node caps
  your beam efficiency (never below 25%). The flow board in the
  Lighthouses tab names the bottleneck and its shortfall; Beam levels
  add +5% production each. A banner in the Light view warns you when a
  node is starving the beam.
- **Gull Rock Light** — relight the second lighthouse for 2,000,000
  Lumen (your beam must be running at 50% efficiency or better) for a
  permanent +50% production and a second, pricier chain board.
  Lighthouses stay lit through Rekindle; chain boards reset.
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
  light home (Shore tab). Six wing patterns from Plain to Prismatic,
  each with its own glow; put up to 3 on duty for +(glow × 0.2)%
  production each. Breed two moths and the child inherits their wings —
  usually the rarer parent's pattern, the average of their glows, and a
  little chaos. Moths are permanent: Rekindle can't touch the roost.
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
  and relics), reported when you return. Cocoons hatch and bottles wash
  back while you're away, too.
- Balance-checked: a greedy-bot simulation that also feeds the chain
  reaches the first Rekindle in ~115 minutes and the second ~76 minutes
  later (`npm run sim`) — without buying perks, running challenges,
  keeping moths, sending bottles or minding the tides, so real keepers
  will be faster.

## Run it

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest suite
npm run build      # typecheck + production build to dist/
```

## Controls

- **Flash the Beam** — +1 Lumen per click (upgradable to +8).
- **Buy** — hire generators at the selected buy amount (×1/×10/×100/Max).
  Unaffordable buttons show how long until you can afford the batch.
- **Upgrades tab** — spend Lumen on one-time upgrades as they unlock.
- **Lighthouses tab** — relight Gull Rock, switch chain boards, and
  upgrade Wick / Oil / Lens / Beam nodes to keep the beam fed.
- **Rekindle tab** — Rekindle for Embers (with a recovery-time preview),
  spend held Embers in the Ember Shop, and start or abandon challenges.
- **Shore tab** — attract, roster and breed lantern moths; send and
  claim bottle expeditions; admire the relic shelf.
- **Tabs** — Light · Upgrades · Lighthouses · Shore · Rekindle · Log.
  One view at a time.
- Progress saves automatically to your browser (localStorage,
  `tidelight-save-v1`), including offline earnings for up to 8 hours.

## Tech stack (locked decision, 2026-11-17)

- **TypeScript + HTML/CSS, web first** — this is a menu-and-numbers game;
  the web stack is the fastest way to playtest it on phone and desktop.
- **Vite** for dev/build, **Vitest** for tests.
- **break_infinity.js** `Decimal` for all Lumen values, so numbers stay
  exact long past where plain JS numbers give up (~9 quadrillion).
- Steam release later ships the *same code* in a Tauri/Electron wrapper.
  Python and Unity/Godot were considered and ruled out.
