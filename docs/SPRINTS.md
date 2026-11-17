# Tidelight — Sprint Roadmap

## ✅ Sprint 0 — Foundation + playable seed

- [x] Project scaffold: TypeScript (strict) + Vite + Vitest, CI on GitHub Actions
- [x] Data-driven generator table: 8 tiers, exponential costs (1.13–1.15),
      ×2 milestones at 25/50/100 owned
- [x] Engine: tick, production (milestones + Ember bonus), bulk-buy math,
      click, offline earnings (8h cap × 50%)
- [x] Save/load to localStorage (`tidelight-save-v1`, versioned, Decimals
      serialized as strings)
- [x] Prestige math: Rekindle Embers = √(lifetime ÷ 5,000), recommended-40
      marker, working reset (keeps Embers + stats)
- [x] Number formatting (standard + scientific) and duration formatting
- [x] UI: persistent header, tab menu with separate views — Light (Flash the
      Beam + generators), Lighthouses (teaser), Rekindle (preview +
      kept/lost), Log
- [x] Tests: cost growth, bulk cost, milestones, prestige, offline cap, formatting

## ✅ Sprint 1 — Full generator economy + upgrades

- [x] Buy amounts ×1 / ×10 / ×100 / Max — global toggle in the Light view,
      persisted in the save. Fixed amounts buy the full batch or nothing
      (the button prices the whole batch); Max buys maxAffordable.
      Closed-form bulk-cost math throughout.
- [x] Upgrades system (data-driven, `src/game/upgrades.ts`): 22 one-time
      upgrades — 16 per-generator (production ×2, unlocked at 10 owned;
      ×2 again at 30 owned), 3 click tiers (beam value 1 → 2 → 4 → 8),
      3 globals: Keeper's Focus (+25% all production), Longer Wicks
      (offline rate 50% → 75%), Ember Resonance (Ember bonus +2% → +3%)
- [x] Permanent upgrades: Longer Wicks and Ember Resonance are keeper
      knowledge — they survive Rekindle; all other upgrades reset. The
      Rekindle view's kept/lost lists name them.
- [x] Upgrades tab (Light · Upgrades · Lighthouses · Rekindle · Log):
      Available with cost + plain-words effect, locked upgrades as
      silhouettes showing their unlock condition, Learned section.
      Generator rows show milestone progress ("Next ×2 at 25 — 18/25")
      and the selected amount's cost + production gain.
- [x] Save format v2 (same `tidelight-save-v1` key): purchased upgrade ids
      and the buy-amount setting persisted. Sprint 0 (v1) saves migrate
      on load — missing fields default (no upgrades, buy ×1).
- [x] Balance pass — greedy-bot sim (`npm run sim`, scripts/simulate.ts;
      best-payback purchases, clicking 1/2s for the first 10 min only):
      **first Rekindle (40 Embers) in 41.0 simulated minutes**
      (target band 40–120; a human plays slower than the bot, which keeps
      the 45–90 min engaged-session target in reach).
      Tuning applied — upgrade numbers only, generator base costs/growth
      untouched: per-generator upgrade costs 25×/150× → **40×/240×** base
      cost, Keeper's Focus 50,000 → **100,000**. Before tuning the sim
      landed at 36.8 min, just under the floor.
- Deferred from the original Sprint 1 sketch (not in this sprint's scope):
  buy-until-milestone, achievements feeding a production multiplier,
  notation setting in the UI.

## Sprint 2 — Bottleneck chain + second lighthouse

- Wick → oil → lens → beam production chain with named bottleneck status
- Tidemere, the second lighthouse: unlock, travel, local generators
- Resource sidebar pinned across all views
- Automation: first keeper-managers retire the click verb per generator

## Sprint 3 — Rekindle layer, complete

- Ember spending tree (hold-vs-spend made real), cheap early respec
- Second prestige layer (deeper reset, new decision space)
- Challenges: opt-in rule-changing runs for permanent rewards
- Prestige automation for earlier layers

## Sprint 4 — Moths, bottles, weather

- Lantern-moth breeding: inherited wing patterns, collection multiplier
- Bottle expeditions: loadout-and-wait missions with permanent loot + story
- Tide & weather system: forecast, stockpile decisions, seasonal events

## Sprint 5 — Story, ending, polish, Steam

- Three story acts wired to unlock order; the Seventh Light; the ending
- New Game+ endless mode
- Audio (night ambience, soft chimes), accessibility pass, save export/import
- Tauri/Electron wrapper, Steam page, $9.99 premium launch build
