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

## ✅ Sprint 2 — Bottleneck chain + second lighthouse

- [x] Supply chain (`src/game/chain.ts`): every lit lighthouse has a board
      of Wick → Oil → Lens → Beam. Supply levels support production
      (Wick 20/s, Oil 15/s, Lens 10/s per level, summed across boards);
      efficiency = min over supply nodes of support ÷ base production,
      and the chain factor is 0.25 + 0.75 × efficiency — the chain can
      never cut production below 25%. Beam levels add +5% final
      production each, across all boards. Unlocks at 10 total generators;
      before that the factor is 1 and the board shows a locked teaser.
      Production ordering: generators (milestones, upgrades) × Keeper's
      Focus × Ember bonus × lighthouse bonuses = base (= chain demand)
      × chain factor × beam bonus = final.
- [x] Gull Rock Light, the second lighthouse: relight for 2,000,000 Lumen
      with the chain unlocked and current efficiency ≥ 50%. Lit state is
      permanent (survives Rekindle) and grants +50% all production; its
      board starts empty (0/0/0/0 — an empty board adds no support, so it
      can't drag efficiency down) and its node costs are ×8. Rekindle
      resets every board to its starting levels but keeps lighthouses lit;
      the Rekindle view's kept/lost lists say so.
- [x] Lighthouses view is functional: a card per lighthouse (relight
      button shows cost, the efficiency gate, and why it's disabled),
      board switcher when two boards exist, and the flow board — four
      node boxes with level, support vs demand, efficiency %, status
      word + icon + colour (FLOWING / STRAINED / STARVED, never colour
      alone), and the bottleneck flagged "⚠ BOTTLENECK" with its
      shortfall. The Light view shows beam efficiency % and a bottleneck
      banner that jumps to the board. All views remain separate tabs.
- [x] Save format v3: lit lighthouses + chain boards persisted; v2 (and
      v1) saves migrate on load with First Light lit and its starting
      board (1/1/1/0).
- [x] Balance pass — the sim bot now feeds the chain (buys the
      bottleneck node's next First Light level whenever efficiency
      < 95% and it's affordable, before generator purchases) and
      relights Gull Rock when eligible: **first Rekindle in 115.0
      simulated minutes** (band 40–120). Gull Rock was never lit in the
      sim — the greedy bot never holds 2,000,000 Lumen and ≥ 50%
      efficiency at the same moment; the gate is test-covered instead.
      Tuning applied — chain node costs/growth only (generator and
      Sprint 1 upgrade numbers untouched): Wick 1,000/1.22 → **100/1.10**,
      Oil 5,000/1.24 → **200/1.11**, Lens 25,000/1.26 → **400/1.12**,
      Beam 100,000/1.30 → **25,000/1.22**. At the original prices the sim
      took 146.2 min: support grows linearly per level while demand grows
      exponentially, so the bot rode the 25% floor almost the whole run.
      Even tuned, late-run efficiency sits in single digits — the floor
      is the late-game norm and the chain's real bite is the early/mid
      run, which is where the sim's time is won.
- [x] Three pre-Sprint-2 test assertions moved from `productionPerSecond`
      to the per-generator rate (`generatorProduction`): the milestone
      test and the two upgrade-stacking tests asserted totals in states
      where the chain now legitimately taxes production (their intent —
      milestone/upgrade/Focus multipliers — is unchanged and still
      asserted exactly). Save-version assertions bumped 2 → 3.
- Not in this sprint (from the original Sprint 2 sketch): resource
  sidebar pinned across views, keeper-manager automation — both deferred;
  the sketch's "Tidemere" became Gull Rock Light per the Sprint 2 spec.

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
