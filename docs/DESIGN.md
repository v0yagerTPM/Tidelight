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
   Tides are dealt from a shuffled bag, never twice in a row: each
   10-hour cycle holds exactly 6 Low, 6 High, 5 Glass Calm and 3
   Stormfront (the same for every keeper, seeded by the cycle).
3. **Lantern-moth breeding** — individual moths with inherited wing
   patterns; up to three on duty brighten the thrown beam (+glow × 0.1%
   each), after the chain, and a moth posted at a lighthouse strengthens
   its supply board.
4. **Bottle expeditions** — bottles sent out return with Lumen caches,
   story fragments, and eight permanent relics — never just a timer and
   a chest. The cache is half the light for as long as the bottle was
   out, so a faster voyage (Tailwind, Glass Charts) is sooner, never
   richer: a bottle always out is worth +50% to income at any speed.
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
   of it. The last light is reached by **the Crossing**: three waymarks
   on the deep glass between Siren's Rest and The Hollow Light, lit in
   order (with The Hollow Light's gates), each with a story beat and a
   different gift (chain support, the thrown beam, a duty slot), so the
   final stretch has steps in it rather than one long save. Each waymark
   also asks for an **offering from the Shore** (`game/offerings.ts`) that
   halves its price: a moth posted at Siren's Rest, a bottle home from the
   Deep Glass Crossing, a moth glowing 80+ on duty. Never a gate, so the
   idle keeper (and the balance bot) pays full price; it pulls the systems
   the back half otherwise leaves alone into the main line.

## Prestige — Rekindle

- Embers gained = `floor(sqrt(lifetimeLumenThisRun / 5000))`.
  (1,000,000 lifetime → 14 Embers; doubling Embers takes 4× the earnings.)
- Each Ember **held** gives +2% production — spending vs. holding is a
  decision, not a formality.
- The UI always previews the gain and marks the **recommended first Rekindle
  at 40 Embers**, so nobody falls for the genre's classic early-reset trap.
- After that, the hearth teaches **the Rekindle moment**
  (`game/rekindleMoment.ts`): a run is worth how far it grows the Embers,
  ln(1 + gain ÷ held) per second of run plus 15 minutes to rebuild. That
  rate climbs, peaks and falls; once it is 2% under its best the hearth
  flares and a dot lights on the Rekindle tab ("This run has done its best
  work"), unless a light costs no more than half an hour of production,
  when it says to relight first. It is the same rule the balance bot plays
  by, because when to Rekindle moved the bot's ending more than anything
  else (42 hours to 15). The run's length and best rate are saved (v15).
- Embers are spendable in the Ember Shop (eight permanent perks) — the
  production bonus applies to **held** Embers only, so spending is a
  real trade. Three opt-in challenges change the rules (half the thrown
  beam, no clicking, tiers 1–3 only) for permanent rewards; held Embers
  rest through a challenge run, so each stays a real climb.
- **What the lamp's companions light.** Helpers make Lumen and the chain
  must carry it. Beam levels, the tide, moths on duty, the Brass Compass
  and the challenge lamps brighten the thrown beam after the chain and
  never add to its load. (On the helpers, the chain took most of a
  production bonus back: three perfect moths saved 2.5 of 47.5 bot
  hours. On the beam, at half the rate, an engaged keeper's moths, relics
  and challenges bring the ending from ~34 to ~24 hours.)
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
- Full story: **~30 hours for the no-everything bot** to the ending,
  then the Next Keeping endless mode. It relights the coast at 2.9 /
  4.7 / 7.4 / 11.8 / 16.7 hours, lights the Crossing's waymarks at
  19.4 / 21.8 / 23.5 and reaches the ending at ~30. With the Ember shop
  it is ~19 hours, the engaged keeper of `scripts/worth.ts` ~19, and a
  bot with the measured phone keeper's kit and habits ~8.5.
- **The last step is the longest, for everyone.** The Crossing was first
  tuned on the plain bot alone, and anyone faster sprinted the finale
  (the shop bot lit The Hollow Light 30 minutes after the Last Lantern).
  Now the waymarks come closer together and the tower costs more, checked
  on three bots: Last Lantern → The Hollow Light takes 6.4h (plain, after
  steps of 2.7 / 2.4 / 1.7), 2.0h (shop, after 1.7 / 1.3 / 1.3) and 1.0h
  (the phone keeper's habits, after 0.7 / 0.7 / 0.3).
  - Why 30, and why this bot (a real playthrough): the target was 35–50
    hours against a bot that Rekindled at +50% of the Embers held, 64
    times to the ending. The first measured playthrough, on a phone,
    reached the ending in 3.6 hours of play: the keeper Rekindled 8
    times, for far bigger jumps. The bot now Rekindles when a run's
    Ember growth peaks (scripts/simCore.ts), and the coast was re-priced
    on it for 30 hours (`scripts/autotune.ts`-style search, one light at
    a time).
- Clicking and bottles are capped so neither runs away with income: the
  Flash Echo (2 / 4 / 6%) rings on at most three flashes a second, +36%
  at most for a busy thumb (it was 5 / 10 / 20% with no ceiling, +84%
  for that keeper's 2.4 taps a second); a bottle always out is +50%
  (paid for the route's full length on a voyage 30% as long, it was
  +168%).

## Story

Three acts, 27 beats, delivered by unlock order — no cutscenes. Each
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
  needs no network. Icons are inline SVG (`src/ui/icons.ts`), including
  the small glyphs inside text (tides, moths, bottles, the story book):
  no system emoji, whose platform colours broke the palette. A moth's
  pattern shows as a dot of its own wing swatch.

## UI rules

- Persistent header: Lumen, Lumen/s, Embers — never more than a glance.
- Generator tiers reveal one at a time: every tier up to one past the
  highest owned, then a single silhouette.
- Tab menu with separate views (Light / Upgrades / Lighthouses / Shore /
  Rekindle / Log), never one long scrolling page.
- Buy amounts ×1/×10/×100/Max, time-to-afford on every purchase,
  prestige preview with kept-vs-lost in two columns.
- Number formatting: full digits < 1000, then K/M/B/T, e-notation from 1e15 (Qa, Qi, Sx… read as glyph soup)
  — or full scientific notation, switchable in the Keeper's Desk (Log
  view), where the save export/import and hard reset also live.
- Shipping: the web build ships to Steam in a Tauri v2 wrapper — see
  [STEAM.md](STEAM.md).
