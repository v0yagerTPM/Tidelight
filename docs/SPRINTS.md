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

## ✅ Sprint 3 — Rekindle layer, complete

- [x] Spendable Embers (`src/game/emberShop.ts`): `embers` is now the
      HELD balance — the production bonus applies to held Embers only —
      and `embersTotalEarned` tracks the lifetime total (only grows;
      Rekindle adds the gain to both). The header shows held Embers; the
      Rekindle view shows held, total earned, and the current held-bonus %.
- [x] Ember Shop: eight one-time perks, all PERMANENT (they survive
      Rekindle and challenge resets), bought with held Embers — so every
      purchase visibly trades held bonus for a perk, and the shop card
      says exactly how much bonus you'd lose. Head Start (5 E, runs start
      with 1,000 Lumen), Warm Lamp Oil (8 E, click ×2), Friend of Gulls
      (10 E, Gull Rock relight cost halved to 1,000,000), Deep Wicks
      (12 E, chain support +25% on both boards), The Long Night (20 E,
      offline cap 8h → 12h), Full Reservoir (25 E, offline rate +10
      points — 50→60, 75→85 — hard-capped at 90%), Ember Heart (30 E,
      held bonus +1%/Ember: 2→3% base, 3→4% with Ember Resonance),
      Second Wind (40 E, all production +50%). Multiplier ordering
      extended in engine.ts: … × Keeper's Focus × Ember bonus × Second
      Wind × challenge multiplier × lighthouse bonus = base × chain
      factor × beam bonus.
- [x] Recovery preview (`src/game/estimate.ts`): the Rekindle view shows
      "estimated ~X min to recover your current Lumen/s" (or "over
      10 hours" past the 600-minute cap). It clones the state through the
      save serializer, applies the Rekindle, and replays the new run with
      the greedy bot — now factored into `src/game/bot.ts` and shared
      with the balance sim, so the preview and the sim can never drift
      apart. Deterministic, bounded (10-second steps), computed on view
      render / material change and cached — never per tick.
- [x] Challenges (`src/game/challenges.ts`): three opt-in rule-changing
      runs. Starting one resets the run exactly like a Rekindle but
      grants no Embers; normal Rekindle is disabled while one is active.
      The goal tracks run lifetime Lumen and completes the moment it's
      reached (checked on every credit) — the reward banks permanently,
      the challenge ends, and the run CONTINUES. Abandon (two-step
      confirm) resets the run with no Embers and no reward. Completed
      challenges can't be repeated. Fogbound (production ×0.5 → 1,000,000
      → Fog Lamps +25%), Still Hands (clicking yields 0 → 250,000 →
      Patient Keeper +20%), First Light Only (only tiers 1–3 buyable →
      100,000 → Humble Mastery: tiers 1–3 ×2). Rules/rewards flow through
      the engine (production, click value, buy gating); the Light view
      shows a live progress banner; the Rekindle view's kept list names
      perks and challenge rewards.
- [x] Save format v4: held/total Embers, perk ids, active + completed
      challenges persisted and sanitized; v3 (and v1/v2) saves migrate on
      load with `embersTotalEarned := embers`, no perks, no challenges.
- [x] Balance pass — the sim bot now plays through the first Rekindle
      (at 40 Embers) and on to the second, still buying no Ember perks
      and running no challenges: **first Rekindle in 115.0 simulated
      minutes** (unchanged, band 40–120), **second Rekindle 76.4 minutes
      after the first** (191.4 total). A real player spending Embers on
      perks will reach the second faster. No tuning was needed — no
      numbers moved this sprint.
- [x] One test-expectation correction worth noting: the recovery estimate
      falls as the *banked gain* grows, not as held Embers grow — holding
      more Embers raises the recovery target (your current rate) by the
      full bonus while the post-Rekindle bonus only grows by the gain,
      so the estimate test compares equal portfolios banking 40 vs 100
      Embers. The Long Night test also accounts for the held-Ember bonus
      on the production it measures.
- Deferred from the original Sprint 3 sketch (not in this sprint's
  scope): second prestige layer, Ember respec, prestige automation.

## Sprint 4 — Moths, bottles, weather

- Lantern-moth breeding: inherited wing patterns, collection multiplier
- Bottle expeditions: loadout-and-wait missions with permanent loot + story
- Tide & weather system: forecast, stockpile decisions, seasonal events

## Sprint 5 — Story, ending, polish, Steam

- Three story acts wired to unlock order; the Seventh Light; the ending
- New Game+ endless mode
- Audio (night ambience, soft chimes), accessibility pass, save export/import
- Tauri/Electron wrapper, Steam page, $9.99 premium launch build
