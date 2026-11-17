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

## Signature systems (later sprints)

1. **Bottleneck chain** — wick → oil → lens → beam, with the limiting node
   always visible and named.
2. **Tide & weather planning** — what you queue before bed matters.
3. **Lantern-moth breeding** — individual moths with inherited wing patterns;
   the collection feeds a global production multiplier.
4. **Bottle expeditions** — bottles sent out return with permanent loot and
   story, never just a timer and a chest.

## Prestige — Rekindle

- Embers gained = `floor(sqrt(lifetimeLumenThisRun / 5000))`.
  (1,000,000 lifetime → 14 Embers; doubling Embers takes 4× the earnings.)
- Each Ember **held** gives +2% production — spending vs. holding is a
  decision, not a formality.
- The UI always previews the gain and marks the **recommended first Rekindle
  at 40 Embers**, so nobody falls for the genre's classic early-reset trap.
- A second, deeper prestige layer arrives in Sprint 3+, plus opt-in
  challenges that change the rules rather than just adding %.

## Offline

Earnings = production rate × min(time away, **8-hour cap**) × rate
(50% in Sprint 0, upgradeable later). Leaving is always safe: no decay,
no streak loss, no expiring currency. The welcome-back screen reports the
lump sum and points at the next affordable purchase.

## Pacing targets

- First generator within ~30 seconds; a meaningful purchase every
  5–15 seconds early, every 1–5 minutes late.
- First Rekindle in the 45–90 minute band for an engaged first session
  (recommended threshold: 40 Embers).
- Full story: **35–50 hours** to the ending, then New Game+ endless mode.

## Story

Three acts, delivered by unlock order — no cutscenes. Each lighthouse
relit reveals what stilled the sea. The game has a real ending; prestige
is framed as New Game+, not an endless treadmill.

## Monetization

**$9.99 premium, no in-game store.** No gacha, no energy, no expiring
passes, no forced ads. If a free web demo exists, its only monetization
is an optional one-time supporter purchase. Players praise idle games
that respect their time; this design takes that as a hard rule.

## UI rules

- Persistent header: Lumen, Lumen/s, Embers — never more than a glance.
- Tab menu with separate views (Light / Lighthouses / Rekindle / Log…),
  never one long scrolling page.
- Buy amounts ×1/×10/×100/Max (Sprint 1), time-to-afford and payback on
  every purchase, prestige preview with kept-vs-lost in two columns.
- Number formatting: full digits < 1000, then K/M/B/T…, e-notation beyond,
  with a scientific-notation setting.
