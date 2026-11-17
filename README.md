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

**Sprint 1 — full generator economy + upgrades.** Sprint 0's foundation
(click, buy, Rekindle, offline earnings) is now a complete economy: bulk
buying and a 22-upgrade system on top of the 8 generator tiers. The full
design lives in [docs/DESIGN.md](docs/DESIGN.md); the build roadmap is in
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
- **Rekindle, honestly priced** — gain preview, the recommended-40 marker,
  and kept/lost lists that name your upgrades. Two of them (Longer Wicks,
  Ember Resonance) are keeper knowledge and survive the reset.
- **Offline earnings** — 50% of your rate for up to 8 hours (75% once you
  learn Longer Wicks), reported when you return.
- Balance-checked: a greedy-bot simulation reaches the first Rekindle in
  ~41 minutes (`npm run sim`).

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
- **Tabs** — Light · Upgrades · Lighthouses · Rekindle · Log. One view
  at a time.
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
