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

**Sprint 0 — foundation + playable seed.** The core loop runs: click for
Lumen, buy 8 tiers of generators, watch milestones double them, preview and
perform a Rekindle, and come back to offline earnings. The full design lives
in [docs/DESIGN.md](docs/DESIGN.md); the build roadmap is in
[docs/SPRINTS.md](docs/SPRINTS.md).

## Run it

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest suite
npm run build      # typecheck + production build to dist/
```

## Controls

- **Flash the Beam** — +1 Lumen per click.
- **Buy** — hire generators (×1 in Sprint 0; ×10/×100/Max arrive in Sprint 1).
  Unaffordable buttons show how long until you can afford them.
- **Tabs** — Light · Lighthouses · Rekindle · Log. One view at a time.
- Progress saves automatically to your browser (localStorage,
  `tidelight-save-v1`), including offline earnings at 50% for up to 8 hours.

## Tech stack (locked decision, 2026-11-17)

- **TypeScript + HTML/CSS, web first** — this is a menu-and-numbers game;
  the web stack is the fastest way to playtest it on phone and desktop.
- **Vite** for dev/build, **Vitest** for tests.
- **break_infinity.js** `Decimal` for all Lumen values, so numbers stay
  exact long past where plain JS numbers give up (~9 quadrillion).
- Steam release later ships the *same code* in a Tauri/Electron wrapper.
  Python and Unity/Godot were considered and ruled out.
