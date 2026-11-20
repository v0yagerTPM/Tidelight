# Tidelight — Design Summary

*Full research and planning: the "Idle Game Plan" design document (2026-11-17).
This file is the in-repo summary.*

## Pitch

A cozy narrative idle game about relighting seven lighthouses on a sea
turned to glass. You are the Keeper. The light is the game.

## Core loop

Flash the beam → earn **Lumen** → buy generators (8 tiers, Candle Crab →
The Seventh Light) → production accelerates → unlock the next lighthouse →
hit the wall → **Rekindle** → relight faster and further.

- Generator cost: `ceil(baseCost × growth^owned)`, growth 1.13–1.15.
- Production is linear per copy, **doubled at 25 / 50 / 100 owned**.
- Automation retires verbs in order: click → generator → keeper → allocation.
  The lighthouses bring it: Gull Rock a Quartermaster (learns upgrades),
  Cormorant Roost a Lamp Crew (hires helpers), Widow's Walk the Chain
  Steward (feeds the chain).

## Signature systems (all shipped)

1. **Bottleneck chain** — wick → oil → lens → beam, with the limiting node
   always visible and named. Every lit lighthouse runs its own board;
   support sums across boards, efficiency is support ÷ production, and
   the chain factor (0.25 + 0.75 × efficiency) never cuts production
   below 25%. Each level supports a little more than the last (geometric
   support, growing just slower than cost), so keeping the chain fed
   costs a steady slice of production at every scale — it stays a live
   decision all game, and a fresh lighthouse board is the best-value
   support there is.
2. **Tide & weather planning** — a deterministic 30-minute tide (Low /
   High / Glass Calm / Stormfront) bends production, clicking and chain
   support; the forecast is exact, so what you queue before bed matters.
3. **Lantern-moth breeding** — individual moths with inherited wing
   patterns; up to three on duty feed a global production bonus.
4. **Bottle expeditions** — bottles sent out return with Lumen caches,
   story fragments, and eight permanent relics — never just a timer and
   a chest.
5. **The seven lighthouses** — relit in order, each gated on the
   previous light, chain efficiency and cost, each granting a different
   permanent bonus (production, chain support, Ember gain, offline
   earnings). Efficiency gates climb down the coast (50% → 80%): only a
   well-fed beam reaches the far lights, and an hour of production fed
   to the chain clears even 80% at any scale, so growing never locks the
   ending. Relights also bring the upper generator tiers: Lens Polishers
   with Gull Rock, Storm Lanterns with Cormorant Roost, Beacon Whales
   with Widow's Walk, The Seventh Light with Siren's Rest — so the
   economy climbs a staircase with the story instead of leaping ahead
   of it.

## Prestige — Rekindle

- Embers gained = `floor(sqrt(lifetimeLumenThisRun / 5000))`.
  (1,000,000 lifetime → 14 Embers; doubling Embers takes 4× the earnings.)
- Each Ember **held** gives +2% production — spending vs. holding is a
  decision, not a formality.
- The UI always previews the gain and marks the **recommended first Rekindle
  at 40 Embers**, so nobody falls for the genre's classic early-reset trap.
- Embers are spendable in the Ember Shop (eight permanent perks) — the
  production bonus applies to **held** Embers only, so spending is a
  real trade. Three opt-in challenges change the rules (half production,
  no clicking, tiers 1–3 only) for permanent rewards.
- The deeper prestige layer is the **Next Keeping** (NG+), unlocked by
  the ending: a legacy bonus of ×(1 + 0.25 × Keepings) on production and
  +5 inherited Embers per Keeping (held only, never counted as earned).

## Offline

Earnings = production rate × min(time away, cap) × rate. Base: 50%
rate, 8-hour cap — upgradeable to 75% (Longer Wicks), a 12h cap (The
Long Night), +10 points (Full Reservoir) and +5 points (Keeper's Coat),
hard-capped at 90%; Siren's Rest adds +10 points and +4 hours. Leaving
is always safe: no decay, no streak loss, no expiring currency. The
welcome-back log lines report the lump sum — and a hatched cocoon or a
returned bottle, when the Shore has news.

## Pacing targets

- First generator within ~30 seconds; a meaningful purchase every
  5–15 seconds early, every 1–5 minutes late.
- First Rekindle in the 45–90 minute band for an engaged first session
  (recommended threshold: 40 Embers). The pessimistic bot bound
  (`npm run sim`, no perks/moths/relics/tides): 70 minutes to the
  first Rekindle, +51 to the second. The chain wakes at ten helpers
  already fed (First Light's starting levels are warmed ×6 for a new
  keeper), so the first starving lands around minute ten.
- Full story: **35–50 hours** of engaged play to the ending, then the
  Next Keeping endless mode. The same no-everything bot relights the
  coast at 2.9 / 5.4 / 11.1 / 19.5 / 33.4 hours and reaches the ending
  at ~60 — each light taking a little under twice as long as the last.
  It is the floor, not the expectation; perks, moths, relics, tides and
  a keeper's own clicking should bring a real playthrough in around
  half that, though no player has measured it yet.

## Story

Three acts, 21 beats, delivered by unlock order — no cutscenes. Each
beat is a predicate over the player's own progress (first moth, first
relic, each lighthouse, 100 Embers earned, a Prismatic in the roost…),
fires once, and lands in the Log; the Log's Story section keeps every
beat readable, with silhouettes and hints for the ones ahead. The final
lighthouse reveals what stilled the sea. The game has a real ending;
the Next Keeping is framed as a new keeper inheriting the shore, not
an endless treadmill.

## Monetization

**$9.99 premium, no in-game store.** No gacha, no energy, no expiring
passes, no forced ads. If a free web demo exists, its only monetization
is an optional one-time supporter purchase. Players praise idle games
that respect their time; this design takes that as a hard rule.

## Visual direction — nocturne in glass

- Night ink and sea glass, with lamplight as the only saturated colour:
  anything the keeper owns gives off light; anything not yet reached is
  a silhouette.
- The Light view opens on a canvas scene (`src/scene/`) that draws the
  game's own state: the beam's strength and sputter follow the chain,
  the six far lighthouses light as you relight them, the glass cracks
  heal and, at the ending, turn to water; tides change the waterline,
  rain and mirror; each generator type appears as a creature or light.
- The scene reads a pure SceneModel built from game state 10×/s, never
  GameState itself; it runs only while the Light view is visible and
  holds still under prefers-reduced-motion.
- Every view with a world in it opens on its own scene: the Light view
  (the lamp), Lighthouses (the coast and the chain as pipes), the Shore
  (the moth meadow and the bottle at sea). Big events get a full-screen
  moment: Rekindle, each relight, the ending.
- Sound is synthesised (WebAudio): a quiet sea, a pluck per flash, chimes
  and bells for what the keeper does. Muting is a per-device preference.
- Type: IM Fell English (story, names, flavour), Figtree (interface),
  IBM Plex Mono (numbers) — bundled via @fontsource, so the Steam build
  needs no network. Icons are inline SVG (`src/ui/icons.ts`).

## UI rules

- Persistent header: Lumen, Lumen/s, Embers — never more than a glance.
- Generator tiers reveal one at a time: every tier up to one past the
  highest owned, then a single silhouette.
- Tab menu with separate views (Light / Upgrades / Lighthouses / Shore /
  Rekindle / Log), never one long scrolling page.
- Buy amounts ×1/×10/×100/Max, time-to-afford on every purchase,
  prestige preview with kept-vs-lost in two columns.
- Number formatting: full digits < 1000, then K/M/B/T…, e-notation beyond
  — or full scientific notation, switchable in the Keeper's Desk (Log
  view), where the save export/import and hard reset also live.
- Shipping: the web build ships to Steam in a Tauri v2 wrapper — see
  [STEAM.md](STEAM.md).
