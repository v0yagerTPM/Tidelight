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

## ✅ Sprint 4 — Moths, bottles, weather

- [x] Seeded RNG (`src/game/rng.ts`): mulberry32 + a bucket-hash mixer.
      Every random system takes an `rng: () => number` — game code passes
      Math.random, tests pass seeded functions — and consumes it in a
      fixed, documented order, so outcomes are reproducible.
- [x] Lantern moths (`src/game/moths.ts`): the Moth Garden (new Shore tab)
      unlocks with the first Lantern Moth generator (and stays open once
      you keep moths). Six wing patterns in rarity tiers 0–5 (Plain →
      Prismatic, attract weights 40/25/16/10/6/3) and generated cozy names.
      Attract costs 500 × 2.2^(moths owned); the roost holds 6, +2 per
      expansion (10,000 × 6^expansions). Up to 3 moths on duty, each
      granting +(glow × 0.2)% production through the engine. Breeding:
      a 5-minute timestamped cocoon (progresses offline); the child takes
      a parent's pattern tier (weighted 65% to the rarer parent, then a
      10%/10% ±1 tier shift, clamped), glow = parental average −15..+15
      with a 5% bright mutation (+20..+35), generation = max(parents)+1,
      parents kept. Release pays 100 × glow × (tier+1) to the purse.
      Moths, duty, roost and cocoon are PERMANENT — Rekindle's kept list
      and log say so.
- [x] Bottle expeditions (`src/game/expeditions.ts`): one bottle at a
      time on three routes — The Drift (10 min, 1,000 Lumen, 10% relic),
      Coastal Run (1h, 25,000, 35%), Deep Glass Crossing (6h, 500,000,
      80%). Timestamp-based, so bottles wash back while you're away. The
      cache is max(route minimum, production/s × duration × 0.5). Eight
      unique permanent RELICS, each wired into its system: Brass Compass
      (production +10%), Tide Chart (chain support +15%), Salt Lens
      (click ×1.5), Keeper's Coat (offline rate +5 pts, 90% cap), Gull
      Feather (node costs −20%), Amber Heart (Ember gain +10%), Driftwood
      Cradle (new moths +10 glow), Storm in a Bottle (Stormfront ×1.45).
      Once all eight are home, a successful relic roll pays +50% of the
      cache in bonus Lumen instead. Every claim also brings home one of
      eight story fragments for the Log — rotating, no repeats until the
      set is exhausted; these seed Sprint 5's story acts.
- [x] Tide & weather (`src/game/tides.ts`): deterministic 30-minute
      buckets (seeded hash of the bucket index — every keeper sees the
      same sea, and the forecast is exact). Low Tide (support ×1.2),
      High Tide (production ×1.15), Glass Calm (click ×2), Stormfront
      (production ×1.30, ×1.45 with the relic, but support ×0.8), drawn
      at weights 30/30/25/15. Engine and chain functions take an optional
      `now`: the game loop passes Date.now(), so the header rate, the
      flow board and the Gull Rock gate all read the live tide, while
      the sim, the recovery estimate and offline earnings stay neutral
      (over hours away, tides average out). The tide multiplier lands on
      final production only — it never inflates chain demand. The Light
      view gains a tide strip: current tide, effect in words, countdown
      to the turn, and the next tide ("Next: Stormfront — shore up your
      chain").
- [x] Save format v5: moths, duty roster, roost expansions, cocoon,
      active expedition, relics and story-fragment index persisted and
      sanitized on load (duty ids filtered to moths that exist, a cocoon
      survives only while both parents do). v4 (and v1–v3) saves migrate
      with an empty Shore.
- [x] Balance pass — the sim bot ignores moths, expeditions and tides
      entirely (see scripts/simulate.ts), so its numbers are a floor:
      **first Rekindle in 115.0 simulated minutes** (unchanged, band
      40–120), second Rekindle 76.4 minutes after the first. No tuning
      was needed and no numbers moved this sprint.
- Not in this sprint (from the original Sprint 4 sketch): seasonal
  events — the tide system is the weather layer; seasonal events move
  to Sprint 5 polish if time allows.

## ✅ Sprint 5 — Story, the seven lighthouses, the ending, NG+, polish

**All sprints complete. Tidelight is feature-complete per the plan.**

- [x] All seven lighthouses (`config.ts` CHAIN_LIGHTHOUSES, generalized
      `chain.ts`): they relight IN ORDER, each gated on the previous
      light, the chain awake, its efficiency gate, and its cost — and
      each grants something different. First Light (always lit, board ×1),
      Gull Rock (2M, ≥50%, +50% production, ×8), Cormorant Roost (25M,
      ≥20%, +75% production, ×20), Widow's Walk (150M, ≥5%, chain
      support +50%, ×50), The Bellwether (1B, ≥2%, Ember gain +25%,
      ×120), Siren's Rest (8B, ≥0.5%, offline +10 pts and cap +4h,
      ×300), The Hollow Light (60B, ≥0.2%, +150% production, ×750 —
      lighting it is the ending). Lit state and bonuses are permanent
      across Rekindle; support sums across all lit boards. Production
      bonuses multiply (all seven lit: ×6.5625 before the legacy bonus).
      The Lighthouses view shows all seven cards with plain-language
      disabled reasons, a board switcher over lit boards, and the
      ending panel. Friend of Gulls still halves Gull Rock only.
- [x] Story (`src/game/story.ts`): 21 beats in three acts — I "The Dark
      Shore" (6), II "The Hollow Sea" (8), III "The Relighting" (7) —
      each a pure predicate over state, checked on load and every tick,
      firing once ever, in order, into the Log with 📖 styling. The Log
      view opens with a Story section: collected beats readable in full,
      uncollected shown as silhouettes with hint text. The expedition
      story fragments from Sprint 4 remain their own quieter thread.
- [x] The ending + New Game+ (`src/game/ngplus.ts`): lighting The Hollow
      Light sets `endingSeen` and raises "The Sea Remembers" — an ending
      panel with the keeping's stats and a two-step NG+ confirm with
      kept/lost lists. NG+ resets Lumen, generators, non-permanent
      upgrades, chain boards, all lighthouses but First Light, the
      active challenge, and the whole Ember ledger (held AND total
      earned) — and KEEPS moths + duty + roost + cocoon, expeditions,
      relics, story, Ember perks, challenge completions, permanent
      upgrades, settings, and all cumulative stats. Each Keeping grants
      a legacy production bonus ×(1 + 0.25 × ngPlusCount) and +5
      starting Embers per Keeping, granted to the HELD balance only
      (documented decision: they are an inheritance in hand, not
      earnings — `embersTotalEarned` starts at 0, so "100 Embers total"
      story beats and the like must be earned fresh each Keeping).
- [x] Polish — the Keeper's Desk (bottom of the Log view): a notation
      setting (standard / scientific, persisted, applied to every
      displayed number), save export (JSON in a textarea + Copy) and
      import (validated through the normal deserialize/sanitize path;
      invalid JSON shows an error and changes nothing), and a two-step
      hard reset. The welcome-back log now also reports a hatched
      cocoon and/or a returned bottle alongside offline earnings.
- [x] `docs/STEAM.md`: the Tauri v2 wrapper guide — config values
      (identifier `app.tidelight.game`), how localStorage behaves in the
      webview (persistent per app; NOT Steam Cloud by default), the
      export/import player-migration path, and a build/upload checklist.
      Documentation only; no Rust in the repo.
- [x] Save format v6: story seen ids, `endingSeen`, `ngPlusCount`, and
      the notation setting persisted and sanitized. v5 saves migrate —
      a lit Gull Rock stays lit, the new fields default (no story seen,
      no ending, 0 Keepings, standard notation).
- [x] Balance pass — full-game sim (`npm run sim`): the bot now plays
      whole campaigns per lighthouse (grow production to a gate-sized
      cap, then save — feeding the chain from surplus only — relight,
      repeat; a stalled campaign Rekindles and retries lower). The bot
      still uses no perks, challenges, moths, relics or tides, so this
      is a pessimistic bound: **first Rekindle 103.0 simulated minutes**
      (band 40–120; faster than Sprint 4's 115.0 because the shared bot
      now also buys Beam levels — a bot improvement, not a game
      retune), second Rekindle +69.2 min, then **Gull Rock 6.7h,
      Cormorant Roost 14.7h, Widow's Walk 26.4h, The Bellwether 42.0h,
      Siren's Rest 153.0h, The Hollow Light — the ending — at 200.9
      simulated hours**, inside the 500h cap. A human keeper with perks,
      moths, relics and clicking will finish far sooner.
      Tuning applied — the new lighthouse efficiency gates ONLY (costs
      and all Sprint 0–4 numbers untouched): the originally sketched
      gates (50/60/60/70/75%) are mathematically unreachable at endgame
      demand — support grows linearly per node level, node costs
      geometrically, demand exponentially, so the most support any purse
      can buy is a few thousand Lumen/s against demands of millions;
      even a 0.2% gate at Hollow-Light scale demands ~130 Lens levels
      and billions of Lumen of feeding. The shipped ladder (Gull 50%,
      Cormorant 20%, Widow's 5%, Bellwether 2%, Siren's 0.5%, Hollow
      0.2%) still bites hard in absolute terms — the percentages are
      small because the sea is big. The full derivation lives in a
      comment on CHAIN_LIGHTHOUSES in `config.ts`.
- [x] Tests: 139 passing (18 new in `tests/sprint5.test.ts` — order
      gating, every new bonus, board cost multipliers, story firing
      once and in order, the ending, NG+ kept/lost + legacy math +
      starting Embers, scientific notation, export/import round-trip,
      v5 → v6 migration). All 121 prior tests pass; the only edits were
      save-version assertions (5 → 6) and three test names.
- Not shipped from the original Sprint 5 sketch: audio (night ambience,
  chimes) and seasonal events — the delivered Sprint 5 scope (set when
  the sprint was specced) prioritised the full lighthouse ladder, the
  story, NG+ and the Steam guide; the tide system remains the weather
  layer. Both remain good post-launch candidates.

## ✅ Post-launch — playtest fixes

Found in the first full playtest (fresh keeper in Chromium, a late-game
save, and scripted probes against the game modules):

- [x] **Moth attract-and-release loop.** Attracting is priced on moths
      currently held, so an empty roost sold moths at 500 that released
      for ~11,000 — 200 cycles turned 500 Lumen into 2.3M. Release now
      pays at most 40% of the re-attract price (`releasePayout`), so the
      loop always loses; the "release to make room" design is unchanged.
- [x] **Unknown ids in a save.** Perks, upgrades, relics, challenges,
      story beats and generator counts are filtered against this build's
      definitions on load. An imported save naming an unknown perk used to
      throw on every tick, and autosave kept the broken state.
- [x] **Relight vs the tide.** `relightLighthouse` takes `now`, so the
      action checks the same tide-adjusted efficiency the button shows
      (Low Tide could light the button while the click did nothing).
- [x] **Background tabs.** The loop now credits the wall-clock gap
      (`advanceToNow`): gaps up to 90 s (a throttled background tab) at
      full rate, longer ones (a sleeping laptop) by the offline rules.
      The old 1-second clamp paid a throttled tab one second a minute.
- [x] **CI was red.** The milestone test in `tests/engine.test.ts` still
      asserted total production in a state where the chain taxes it; it
      now asserts the generator's own rate, as the Sprint 2 notes said.
- [x] Smaller: the Log only rebuilds when an entry arrives (it can be
      selected and copied); two-step confirms disarm after 5 s; the chain
      banner states the real beam strength (25% floor) and efficiencies
      under 1% show decimals; bottle and release log lines format their
      numbers; the empty-relic bonus text says +50%, as it pays.
- [x] Tests: `tests/fixes.test.ts` covers each fix.

## 🔨 Graphics overhaul

**Phase 1 — shipped.**

- [x] Visual identity: night-ink and sea-glass palette with lamplight as
      the only saturated colour; IM Fell English / Figtree / IBM Plex
      Mono, bundled locally; an SVG Tidelight mark (replacing 🗼, which is
      Tokyo Tower).
- [x] The Light-view scene (`src/scene/model.ts`, `src/scene/renderer.ts`):
      Canvas 2D, procedural, no image assets. Beam sweep speed and sputter
      follow the chain factor; lamplight reach grows with production; the
      six far lighthouses light with your relights; glass cracks heal as
      the coast relights and the sea turns to water at the ending; tides
      move the waterline (High/Low), mirror the tower (Glass Calm) and
      bring rain and lightning (Stormfront). Every generator type is drawn:
      candle crabs, lantern-moth motes, tide-bell buoys, lit cottage
      windows (oil keepers), lens glints, storm lanterns on a jetty,
      surfacing beacon whales, and the Seventh Light's halo. Duty moths fly
      in their wing colours. Tapping the scene flashes the beam (bloom,
      ring, floating gain). Runs only while the Light view is visible;
      still under prefers-reduced-motion. 60 fps on a late-game save.
- [x] Illustrated generator rows (SVG icons, a ring showing progress to
      the next ×2) that reveal one tier at a time, with a silhouette for
      the next.
- [x] Phones: tabs move to a bottom bar with icons; compact header; the
      Flash button sits clear of the lamp.
- [x] Tests: `tests/scene.test.ts` pins the state → scene mapping.

**Phase 2 — the Lighthouses view. Shipped.**

- [x] Shared canvas plumbing (`src/scene/canvas.ts`): sizing, pixel
      density, start/stop, reduced motion, and drawing helpers (glow,
      tower, sweeping beam, moth) used by every scene.
- [x] The coast panorama (`src/scene/coast.ts`): all seven towers
      receding to the horizon; lit ones burn and sweep, a path of light
      runs between them, and the next dark tower waits behind a ring that
      fills as its gates come within reach. Each tower is a labelled
      button (lit: show its chain board; dark: scroll to its card).
- [x] The chain as stations and pipes (`src/scene/chainFlow.ts`): each
      node's gauge, flow capped by the weakest node so far, the bottleneck
      glowing coral and sputtering, the beam thrown at the chain factor.
- [x] Lighthouse cards: lit and far-off ones are one-liners; the next one
      keeps its description and the Relight button.

**Phase 3 — the Shore. Shipped.**

- [x] The moth meadow (`src/scene/meadow.ts`): collected moths wander in
      their wing colours, duty moths circle a lantern, the cocoon hangs
      from a tree (glowing as it ripens, shaking when ready, its parents
      hovering), and the bottle drifts out along its route and home.
- [x] Moth cards show each moth's wings (the pattern cut to a moth).
- [x] The relic cabinet: lit niches with SVG icons; empty ones wait.

**Phase 4 — moments and sound. Shipped.**

- [x] Full-screen moments (`src/scene/moments.ts`): Rekindle (the lamp
      gutters, embers rise, the flame catches brighter — also used for the
      Next Keeping), each relight (a path of light reaches a dark tower and
      it catches), and the ending (the glass cracks, shatters into water,
      and seven lights stand across the sea). Continue, click or Escape
      closes them; the ending waits for the player.
- [x] Sound (`src/audio/sound.ts`), synthesised with WebAudio — no audio
      files: a quiet sea underneath, a pentatonic pluck for each flash,
      chimes for purchases and finds, a bell for each relight (a deep one
      for the ending), and the Rekindle's fall and rise. Starts on the
      first gesture; a header toggle mutes it (a per-device preference in
      localStorage, not the save); silent while the tab is hidden.
- [x] Tests for the coast, chain-flow and meadow models.

**Phase 5 — the Upgrades and Rekindle views. Shipped.**

- [x] The Upgrades view as a lesson book: lessons ready to learn are
      illustrated cards (a generator lesson shows its generator with a ×2
      seal; click lessons a hand-lens; keeper-wide lessons their own
      marks), sorted by price, with a time-to-afford note; keeper
      knowledge is marked. The six nearest undiscovered lessons show as
      silhouettes with a bar toward their unlock (`unlockProgress` in
      `upgrades.ts`), the rest summarised; learned lessons sit on a shelf
      of compact chips.
- [x] The Rekindle view opens on the hearth: a fire that grows with the
      Embers a Rekindle would bank (toward the recommended 40, then
      relative to the Embers held), the gain in large type, and the
      production bonus now → after. Bonuses past +1,000% read as a
      multiplier ("×65") rather than "+6.40K%", here and in the shop.
- [x] Ember Shop perks and Challenges as illustrated cards: eight perk
      icons with Ember prices; challenges show their rule, goal and
      reward as terms, an Under way / Completed badge, and progress.
- [x] Test for `unlockProgress`.

The overhaul's planned phases are complete.

## ✅ Post-launch — the rebalance

The playtest found the economy only held together because the chain
throttled it: support grew linearly per level against exponential demand,
efficiency sat near 0% for most of the game, every generator bought
pushed the lighthouse gates further away (they had to fall to 0.2%), and
the sim's bot reached the ending only through a "demand cap" — refusing
to grow — never owning a tier above Lens Polisher. Fixing the chain
alone exposed the rest: unthrottled, Embers let a single run climb the
whole generator ladder, production leapt seven orders of magnitude in an
hour, and the game flattened into a plateau after it.

- [x] **Geometric chain support** (`config.ts` CHAIN_NODES, `chain.ts`):
      level k adds supportPerLevel × supportGrowth^(k−1); support grows
      just slower than cost (1.095 / 1.105 / 1.115 vs 1.10 / 1.11 / 1.12),
      so feeding the chain costs a steady slice of production at every
      scale and deep boards slowly get dearer per Lumen/s. Level 1 is
      unchanged (20 / 15 / 10). Node prices ×5 (500 / 1,000 / 2,000) keep
      the first Rekindle near its old pace. Each lighthouse's board works
      at its own scale (`boardScale`, was `boardCostMultiplier`): costs
      and support both, so a fresh board is the best-value support there
      is. Upgrade buttons show the support their next level adds.
- [x] **Real gates**: 50 / 60 / 65 / 70 / 75 / 80% (were 50 / 20 / 5 /
      2 / 0.5 / 0.2%). `tests/balance.test.ts` shows an hour of
      production fed to the chain clears 80% at demands from 1e3 to
      1e15 — growing never locks the ending.
- [x] **The upper tiers answer the relit lighthouses**: Lens Polishers
      with Gull Rock, Storm Lanterns with Cormorant Roost, Beacon Whales
      with Widow's Walk, The Seventh Light with Siren's Rest. Production
      climbs a staircase with the story. Copies already owned keep
      producing. Locked rows name their lighthouse; the next lighthouse's
      card says what relighting it brings.
- [x] **Relight costs re-paced** with the sim: Gull Rock 5M, Cormorant
      Roost 840M, Widow's Walk 3.4T, The Bellwether 7.6e18, Siren's Rest
      8.5e21, The Hollow Light 3.2e24 (were 2M / 25M / 150M / 1B / 8B /
      60B — trivial once the chain stopped throttling production).
- [x] **Held Embers: left as they were.** The review flagged them as
      swamping other bonuses; on closer reading every bonus multiplies,
      so a +10% relic is still +10%. An Ember-curve knee (cube root past
      100 Embers) was tried to stop the runaway and proved unnecessary
      once the ladder was gated — with it the late game went flat — so
      it was removed. Ember counts now display through the number
      formatter (they reach the billions late).
- [x] **The sim** (`scripts/simCore.ts`, reported by `npm run sim`) plays
      the endgame plainly — no demand cap: grow greedily, keep the chain
      fed (saving for a chain level worth ≤10 minutes of production, as a
      keeper would; the old payback cap stalled feeding whenever two
      nodes tied), save for each light once it costs ≤30 minutes of
      production, Rekindle for +50% Embers. `scripts/tune.ts` and
      `scripts/autotune.ts` are the tuning tools used for the numbers
      above.

| Bot (`npm run sim`)            | Before    | After     |
| ------------------------------ | --------- | --------- |
| First Rekindle                 | 103 min   | 85 min    |
| Second Rekindle                | +69 min   | +60 min   |
| Gull Rock                      | 6.7h      | 3.5h      |
| Cormorant Roost                | 14.7h     | 6.7h      |
| Widow's Walk                   | 26.4h     | 12.4h     |
| The Bellwether                 | 42.0h     | 21.8h     |
| Siren's Rest                   | 153.0h    | 37.5h     |
| The Hollow Light (the ending)  | 200.9h    | 64.9h     |
| Highest generator tier hired   | 5 of 8    | 8 of 8    |
| Endgame chain efficiency, mean | ~0%       | 86%       |

Existing saves load unchanged, but a keeper partway up the coast meets
the new prices from their next relight on.

## ✅ Post-launch — the moth rebalance

Three Prismatic moths at glow 100 took 0.8–2.4 hours and at most 2.5M
Lumen, half the price of Gull Rock: the whole moth system was done
before the second lighthouse, then had nothing left to give. Measured
with the game's own moth code (breed the two best, keep the best six).

- [x] **Lures, not Lumen.** Attracting spends a lure: a bank of 3, one
      regrowing every 20 minutes, offline too. A rush lure (only with an
      empty bank) costs 0.5% of all-time Lumen, at least 500, tripling per
      rush until a lure regrows. All-time Lumen only grows, so a fresh
      Rekindle never makes moth prices cheap.
- [x] **Wild odds** 44 / 26 / 16 / 9 / 4.5 / 0.5 (Prismatic was 3%).
- [x] **Glow ceilings** per pattern: Plain 40, Spotted 55, Striped 70,
      Crescent 80, Starlit 90, Prismatic 100. Wild glow rolls 1 to 60% of
      the ceiling.
- [x] **Hatching:** glow is the parents' average − 1 ± 10 (a bright
      +8..+15 3% of the time, was ±15 and +20..+35 at 5%); above an
      average of 90 gains are halved; held to the child's ceiling. Tiers
      shift 8% up / 12% down; a Prismatic child stays Prismatic 60% of the
      time (was 90%), otherwise Starlit.
- [x] **Cocoons** take 30 min × (1 + 0.3 × the higher parent's tier):
      Plain 30 minutes, Prismatic 75 (were 5 minutes).
- [x] **Driftwood Cradle** +5 glow on wild moths only (was +10 on every
      moth). **Release** gives 10 × glow × (tier + 1) Lumen (was up to
      40% of the attract price). **Roost expansions** cost the larger of
      10,000 × 6ⁿ and 3% of all-time Lumen × 3ⁿ.
- [x] **Saves → v7.** Every keeper starts with a full lure bank; a
      cocoon already spinning keeps its finish time; moths above the new
      ceilings keep their glow, shown as "old light".

| Keeper breeding the two best, spending every lure | Before   | After (median, 400 runs) |
| ------------------------------------------------- | -------- | ------------------------ |
| First Prismatic                                   | minutes  | 13.8h (1 in 10 by 3.6h)  |
| Three Prismatics at glow 100                      | 0.8–2.4h | 100h (93h with the Cradle) |

Hours are cocoon time, which also passes offline. The game's ending
lands near 64 hours, so a perfect trio is a New Game+ goal. Traits,
lighthouse posts, the Wing Almanac and new patterns follow in later PRs.

## ✅ Post-launch — moth traits and lighthouse posts

The second moth PR: a reason to keep breeding after glow and pattern,
and a use for good moths beyond the three duty slots.

- [x] **Traits** (`src/game/mothTraits.ts`). A wild moth carries one 25%
      of the time; a child takes a parent's trait 50% of the time and
      otherwise gains a new one 3% of the time.

      | Trait        | Effect                                                         |
      | ------------ | -------------------------------------------------------------- |
      | Lamp-loyal   | On duty, its glow counts ×1.5                                  |
      | Night-flier  | On duty, offline rate +5 points (90% cap stands)               |
      | Chain-tender | Its lighthouse-post bonus is doubled                           |
      | Seeker       | On duty, bottle relic chance +5 points                         |
      | Fertile      | Its cocoons take 25% less time                                 |
      | Tidewise     | On duty in High Tide or a Stormfront, its bonus lifts the beam again (final rate only, never chain demand) |

- [x] **Lighthouse posts.** One moth per lit lighthouse (First Light
      included) adds +(glow × 0.2)% to that board's support, ×2 for a
      Chain-tender. A posted moth leaves duty and can't breed; releasing
      it clears the post; the Next Keeping sends moths at darkened lights
      home. Managed from the Shore's new Lighthouse posts card.
- [x] **Saves → v8**: traits on moths, `mothPosts`; a loaded save keeps
      one post per moth, at lit lighthouses only, and never a posted moth
      on duty.

The duty ceiling rises from +60% to +90% with three glow-100 Lamp-loyal
moths. The Wing Almanac, Tidelit, moths on expeditions, Hollow moths and
the story beats follow in later PRs.

## ✅ Post-launch — the Wing Almanac, Tidelit and moths at sea

The third moth PR: a collection to fill, and moths that touch the tide
and the bottles.

- [x] **The Wing Almanac** (`src/game/almanac.ts`): a page for each of 7
      patterns × 7 trait columns (no trait counts), 49 in all. A page
      fills the first time the keeper holds such a moth and never
      empties. Rewards: 6 pages, the lure bank holds 4; 12, a fourth duty
      slot; 24, cocoons 15% faster; 36, a lure every 15 minutes; all 49,
      a halo round the lamp in the brightest moth's wing colour.
- [x] **Wing Scales**: a release leaves tier + 1 scales (+1 for a
      trait). 8 scales buy a **scented lure**: no lure needed, and the
      moth always carries a trait. (The plan's "buy a hint" use was
      dropped: the Almanac grid already shows what is missing, so scales
      buy a way to fill it instead.)
- [x] **Tidelit**: a tier-5 sidegrade, ceiling 100, never wild. A
      Starlit or Prismatic cocoon that opens in a Stormfront is Tidelit 5%
      of the time. On duty its bonus counts double in a Stormfront and
      half in Glass Calm, applied to the final rate only (never chain
      demand). It breeds as tier 5 (its children are Prismatic/Starlit).
- [x] **Moths ride bottles**: relic chance + glow ÷ 10 points (+10 more
      for a Seeker). The rider leaves duty and its post, can't breed or
      be released at sea. On the Deep Glass Crossing, a traitless rider
      comes home with a trait 1 time in 10.
- [x] **Saves → v9**: `almanac` (every moth already held fills its page
      on load), `wingScales`, `expedition.riderId`.

Pacing, same method as the rebalance (the bot breeds the two best and
spends every lure, but ignores Fertile and scented lures): first
Prismatic 12.6h, three Prismatics at glow 100 91h (was 100h).

## ✅ Post-launch — late-game performance

At ~3B Lumen/s the game fell to ~6 fps on every tab. A CPU profile put
99% of the time in the Rekindle recovery estimate: a bot sim of a whole
new run (~350 ms at that scale), cached on a key that included the exact
Ember gain, which late in the game changes almost every frame, so it
re-ran on every UI refresh whichever tab was open.

- [x] The estimate runs only while the Rekindle tab is open and restarts
      only when the gain moves ~5% (or Embers, perks, lights or the
      challenge change).
- [x] It runs in a lazily loaded Web Worker (`estimateWorker.ts`); where
      a worker can't load (the single-file build) it is stepped a few
      milliseconds per refresh (`createRecoveryEstimator`).
- [x] Map lookups for lighthouse, generator, upgrade and pattern ids; a
      per-generator upgrade list; memoised `boardNodeSupport`.

At 2.94B/s: 60 fps on every tab (was ~6); with a 4× slower CPU the
Rekindle tab's worst frame is 33 ms. The scene's own cost doesn't grow
with production.

## ✅ Post-launch — Hollow moths and the moth story

The last moth PR.

- [x] **Hollow moths.** Only after the ending: two glow-100 Prismatics
      bred together have a 2% chance of a Hollow child (tier 6, glow
      100–120, never wild, never bred true). It carries one trait from
      each parent: two traits, both working, both filling Almanac pages.
- [x] **The Almanac** gains a Hollow row (56 pages). The halo stays at 49
      pages ("Every Living Wing"); all 56 earn a fifth duty slot.
- [x] **Story:** "A Moth With Habits" (a first trait), "A Moth on Watch"
      (a first post), "The Shape the Light Leaves" (a first Hollow moth):
      24 beats, acts 6 / 10 / 8.
- [x] **Saves → v10:** `trait2`; glow kept up to 120.

## ✅ Post-launch — the tutorial and the bottle splash

- [x] **How to keep the light** (`src/ui/tutorial.ts`): an eight-page
      guide (welcome and the goal; making light and helpers; upgrades; the
      supply chain; relighting; Rekindle and Embers; moths and bottles;
      tides, time away and saving). Its numbers come from the game's own
      constants. It opens by itself for a brand-new keeper (no save in the
      browser) and again from the new **?** button in the header or the
      Keeper's Desk.
- [x] **The bottle splash**: claiming a bottle opens a card with the
      route, the Lumen salvage (and the all-relics bonus), the relic with
      its icon and effect (or the relic chance it missed), a riding moth's
      homecoming or new trait, and the story fragment.
- [x] Both use one splash dialog (`src/ui/splash.ts`): paged with Back /
      Next, the dots or the arrow keys; Escape, × or the backdrop close it;
      Tab stays inside; focus returns where it was; the buttons stay in
      reach on a phone; reduced motion turns the animation off.

## ✅ Post-launch — the Moth Garden on one screen

The Shore had grown to 4,584 px at 1280×800, the moth garden alone
~2,700: a full card per moth with two buttons each, a dropdown row per
lighthouse post, and the whole Almanac table always open.

- [x] **Two panes on the Shore:** Moth Garden, and Bottles & Relics. A
      dot on a pane's button says a cocoon or bottle is ready there.
- [x] **A one-line roost bar:** counts, then Attract / Rush / Scented /
      Expand and the Almanac button.
- [x] **The roster:** compact tiles two to a row (pattern, name, a glow
      meter, traits, duty / posted / at sea / cocoon). Select one to see
      its details and act on it in one strip below; the roster scrolls on
      its own so the strip always fits.
- [x] **The side column:** the meadow, the cocoon (with a progress bar)
      or breeding, and one compact row per lighthouse post that posts the
      selected moth. Rules moved behind ⓘ buttons, and the full Almanac
      opens in a dialog.
- [x] Fits one screen at 1280×800, 1366×768, 1440×900 and 1920×1080, even
      with all seven lighthouses lit and 12 moths (on screens 800 px tall
      or less the meadow becomes a thin strip). Phones stack it in one
      column.
- [x] **Fix:** the buy-amount code listened to every pill toggle, so the
      Keeper's Desk notation buttons set the buy amount to NaN until a
      reload. It now listens only to the ×1/×10/×100/Max buttons.

## ✅ Post-launch — Memory Ships: no more wall after the whales

The Bellwether (lighthouse 5) brought no helper, so after Beacon Whales
(Widow's Walk, ~12h) nothing new could be hired until The Seventh Light
(Siren's Rest, ~37h): a quarter of the game on the same ladder.

- [x] **Memory Ship**, tier 6 of 9, answers The Bellwether's light:
      120M base cost, 47,000 Lumen/s each, growth 1.13 — the geometric
      mean of the tiers either side. Two upgrades (Lanterns at Every Rail,
      The Homeward Chart), an icon, pale ships rocking on the Light
      scene's horizon, and The Bellwether's text says the ships turn home.
- [x] **Re-paced the last two lights** so the ending stays put: Siren's
      Rest 8.5e21 → 2.5e22, The Hollow Light 3.2e24 → 6.5e24. Without
      that the ships pulled the ending from 63.9h to 51.0h.

| Bot (`npm run sim`)           | Before | After |
| ----------------------------- | ------ | ----- |
| The Bellwether                | 21.0h  | 21.0h (Memory Ships for hire) |
| Siren's Rest                  | 36.8h  | 33.3h |
| The Hollow Light (the ending) | 63.9h  | 62.0h |
| Highest generator tier hired  | 8 of 8 | 9 of 9 |
| Endgame chain efficiency      | 91%    | 91%   |

## ✅ Post-launch — no accidental zoom on phones

- [x] **Double-tap zoom:** rapid taps on Flash the Beam (or any button)
      zoomed the page in and out. `touch-action: manipulation` on the root
      and on every tappable element turns double-tap zoom off while keeping
      scrolling and pinch-zoom (which people who need larger text rely on,
      so the viewport stays zoomable).
- [x] **Focus zoom:** iOS zooms into any form field under 16px when it
      gets focus; the Moth Garden's selects were 12.8px and others 15.5px.
      On touch screens, selects, inputs and the save box are now 16px.
- [x] The beam no longer selects text, flashes a tap highlight or opens
      the long-press menu when hammered.
- [x] **The real cause: a header wider than the phone.** On a phone the
      top bar (brand, ?, sound, three stats) grew with the numbers; late in
      a game it was 15px wider than the screen (405px on a 390px iPhone 13),
      so the browser shrank the page to fit, and as the Lumen figures changed
      width on every tap it shrank and grew back. The ? button added with
      the tutorial made it worse (it was being squeezed to 9px). On screens
      560px wide or less the stats now get a row of their own, the round
      buttons never shrink, and `overflow-x: clip` on the page stops
      anything ever widening it again. Checked on iPhone SE, iPhone 13 and
      Pixel 5 with saves up to 8.88e44 Lumen and ~1T Embers, in both
      notations: the page is exactly the screen's width on every tap.

## ✅ Post-launch — the chain on the main screen, and tips

Feeding the supply chain was the most frequent late-game decision, and it
lived on another tab, board by board: find the weakest of Wick, Oil and
Lens, then work out which lit board gives the most support per Lumen. The
second half is arithmetic the sim's bot already did (`bestBoardFor`).

- [x] **The supply strip** (Light view, `src/game/supply.ts`): Wick, Oil
      and Lens gauges (support ÷ demand; the bottleneck glows), the Beam
      bonus, **Feed** on each (the best-value level on any lit board; its
      tip names the board, the support and the efficiency it reaches) and
      **Fill the chain** (feed the bottleneck until the beam is full or the
      Lumen runs out, one log line). Replaces the bottleneck banner and the
      efficiency line. **Boards** jumps to the Lighthouses tab.
- [x] **The Chain Steward**, unlocked by Widow's Walk ("whoever waited
      here kept meticulous stores"): on by default; sets aside 10 / 25 /
      50% of income and feeds the bottleneck until the beam reaches 80 / 90
      / 100%. Its purse holds at most 10 minutes of production; it buys
      quietly (no log line per level); it works while you're away too.
- [x] **Helper rows** warn when an affordable purchase would starve the
      beam: "⚠ beam 100% → 84% · feed Oil".
- [x] **Tips** (`src/ui/tips.ts`): `data-tip` on anything shows a bubble on
      hover (mouse), focus (keyboard) or press-and-hold (touch; the tap
      that ends a hold doesn't act, so holding Buy explains without
      buying). ⓘ marks open on a tap. Screen readers get the same words
      (aria-description).
- [x] **Decluttered with tips:** helper flavour lines (on the name), the
      milestone line (on the ring), the price line (now on the Buy button),
      the tide's effect, the beam hint, the long intros on the Upgrades,
      Lighthouses, Shore and Rekindle tabs (ⓘ), the next lighthouse's
      description and the chain nodes' flavour. Page heights at 1280×900:
      Light 1618 → 1639 with the new strip and warnings showing (1536
      without), Lighthouses 2132 → 1896, Rekindle 2838 → 2655, Upgrades
      2078 → 2054.
- [x] **Saves → v11:** `stewardOn`, `stewardShare`, `stewardTarget`,
      `stewardPurse` (a corrupt purse loads as 0, never bricks a save).

## ✅ Post-launch — flashes count, no stray caret

- [x] **Flashes in the per-second figure** (`src/game/clickRate.ts`): the
      header's "per second" adds what your flashes bring in, averaged over
      the last 3 seconds (never less than a second, so one flash doesn't
      read as a spike), and fades to the helpers' rate within 3 s of your
      last flash. It glows while flashes are in it; its tip gives the split
      ("X/s from your helpers + Y/s from your flashes"). Display only:
      offline earnings, Rekindle estimates and chain demand still count
      helpers alone.
- [x] **No blinking caret on desktop:** clicking text left a caret in some
      browsers (caret browsing, for one). The page sets
      `caret-color: transparent` and the game UI `user-select: none`, so
      fast clicking doesn't paint selections either. The save box, the log,
      the story and the splash text still select and edit as text.

## ✅ Post-launch — Welcome back

- [x] **A welcome-back card** (`src/game/away.ts` gathers the numbers,
      `showAwayCard` in `src/main.ts` draws it as a splash) when you return
      after 5+ minutes and something happened. It shows on a fresh visit
      and when a sleeping laptop wakes (the game loop's offline path).
      - The headline: "You were away 9h 00m" and the Lumen your keepers
        earned.
      - Rows: time paid ("8h 00m of 9h 00m" when the cap cut it short), the
        keepers' rate (share of production and Lumen/s, with a tip on what
        raises it), Lumen now, and how many times the tide turned.
      - News: the cap note, Chain Steward levels, a cocoon or bottle that
        finished while you were gone (and a **Go to the Shore** button),
        lures regrown, and story pages earned.
      - It never covers the tutorial, another splash or a full-screen
        moment; the log still records the same news.
- [x] **The Chain Steward now works on a fresh visit too:** time away
      settled at load gives it its share, as the live loop already did.
- [x] Tests: `tests/away.test.ts` (8).

## ✅ Post-launch — Upgrades that last the whole game

The numbers (balance sim on main before this change): upgrades were worth
×5 against ×10^9.7 from held Embers, all 24 unlocked by the 30th copy of a
helper, and a late run spent its last 110 of 171 minutes with nothing new
to learn. Plan and analysis: the "Upgrades & Embers: the numbers" doc.

- [x] **48 new upgrades (72 in all)** in `src/game/upgrades.ts`:
      - **Helper tiers III–V:** ×2 / ×3 / ×5 at 75 / 150 / 250 copies, each
        priced at 10× the price of that copy (27).
      - **Synergies:** a higher helper +1% per copy of a lower one, at 50 of
        each, priced at 10× the target's 50th copy (6).
      - **Lighthouse lessons:** two per lighthouse, surfacing when it is lit,
        priced at 10% and 100% of its relight cost (12). Gull Rock: Wick ×2,
        the first three helpers ×3. Cormorant Roost: Oil ×2, Oil Keepers and
        Lens Polishers ×3. Widow's Walk: Lens ×2, Storm Lanterns and Beacon
        Whales ×3. The Bellwether: Beam levels +7.5%, Memory Ships ×3.
        Siren's Rest: all production ×2, The Seventh Light ×3. The Hollow
        Light: all production ×3, Ember gain ×1.25.
      - **Flash Echo:** each flash also pays 5% / 10% / 20% of a second's
        production, unlocking at 1e8 / 1e12 / 1e16 Lumen in a run (3).
- [x] **Learn all affordable** on the Upgrades tab, cheapest first; the
      button counts how many fit.
- [x] **Retune to keep the 62h ending:** Siren's Rest 2.5e22 → 5e25,
      The Hollow Light 6.5e24 → 1e31 (their lessons follow, being priced off
      the relight cost). Sim: lit at 3.4 / 6.1 / 11.8 / 20.2 / 34.2 / 62.0h,
      first Rekindle still 85 min, no stalls.
- [x] **The sim reports runs by stage:** average length, when the last
      upgrade was bought, and upgrades owned. With all six lit: runs of 96
      min, last upgrade at 76 min, 63 upgrades (was 171 / 62 min, 20).
      `scripts/tune.ts` scales lesson prices with any relight override.
- [x] Tests: `tests/lateUpgrades.test.ts` (11) for tiers, synergies,
      lessons and Flash Echo.

## ✅ Post-launch — An Ember shop that grows with you

Before this, the eight perks cost 150 Embers in all and were affordable by
hour 4.5 of a 62-hour game. Plan: the "Upgrades & Embers: the numbers" doc.

- [x] **Three shelves** in the Ember Shop (`src/game/emberShop.ts`):
      - **Keeper's perks:** the original eight, unchanged.
      - **Kindlings,** repeatable, each level ×10 the last:
        - Ember Glow: +5% production a level, 10 levels.
        - Long Watch: +1h offline cap, 8 levels.
        - Quick Lures, Spinning Silk and Tailwind: lures, cocoons and bottles
          5% sooner a level, 20 levels each.
      - **Late perks,** 500 to 5 billion Embers, ×10 apart: Quartermaster,
        Lamp Crew, Warm Hearth, The Steward's Ledger, Storm Charts, Moth
        Lantern, Ember Memory, Glass Charts.
- [x] **Automation** (`src/game/automation.ts`), live game loop only, once
      a second, each with an on/off switch on its card:
      - The Quartermaster learns any upgrade costing up to a quarter of the
        Lumen in hand, cheapest first, with one log line per round.
      - The Lamp Crew hires the best-value helper with up to a tenth of the
        Lumen in hand, never dropping the beam below 90% (or below where it
        already is).
- [x] **Why a comfort shop:** every production boost compounds (more
      production, bigger Rekindles, more Embers, more production). In the sim:
      - Strong perks and uncapped Kindlings (Ember Glow ×1.5 a level, Deep
        Draw for Ember gain, Long Wick for support) ended the game at 16h.
      - Toned down, the same shop still ended it at 23h.
      - Keeping a tenth of the chain's levels through a Rekindle alone cut
        13 hours.
      - A softer held-Ember curve didn't fix it: the mid-game jump stayed,
        and a 30-hour plateau followed.

      The shop now buys automation, time away and a faster Shore, plus one
      small capped production Kindling. `EMBER_CURVE` (config.ts) stays a
      straight line but can be tuned.
- [x] **Feeding takes the cheapest level** (`supply.ts cheapestBoardFor`).
      This covers Feed, Fill the chain and the Chain Steward. Cheapest-first
      costs only 1–4% more Lumen than best-value to fill a starved chain.
- [x] **Sim:** `botShop` (bot.ts) buys perks after each Rekindle. A
      production buy has to beat the held bonus it gives up; anything else
      may cost up to a tenth of held Embers. `npm run sim` keeps its 62.0h
      gate without the shop, then reports a keeper who buys everything:
      lit at 3.4 / 7.0 / 12.1 / 20.3 / 31.8 / 45.6h. That matches about 45h
      with the original perks only.
      `scripts/tune.ts` gains `kin`, `perk`, `noPerk` and `pow` overrides,
      and `SHOP=1`.
- [x] **Save v12:** `kindlings` (known ids only, levels within each cap),
      plus `autoLearn` and `autoHire` (on unless switched off). The Moth
      Lantern raises the lure-bank clamp to 5. A challenge's rules are now
      set before its reset, so Warm Hearth obeys them.
- [x] Tests: `tests/emberShelves.test.ts` (21), plus updated supply and
      version tests.

## ✅ Post-launch — Automation switches where they work

- [x] The Quartermaster's on/off switch now sits on the Upgrades tab, beside
      Learn all affordable, and the Lamp Crew's beside the buy amounts on the
      Light tab. Each appears once its perk is owned, and its tip says what it
      does. The switches on the Ember Shop cards still work: one shared click
      handler serves all four buttons.

## ✅ Post-launch — The Chain Steward raises the Beam

- [x] Once the beam is at the Steward's target, `tendChain` (supply.ts)
      spends what the purse holds beyond half its cap on the cheapest Beam
      level, +5% production each. The other half is kept for the next time
      demand climbs. Feeding still comes first every tick.
- [x] A "Then raise the Beam" On/Off row in the Steward panel. The setting
      is saved as `stewardBeam`, on unless switched off; older v12 saves
      load with it on. The status line, the log and the welcome-back card
      count Beam levels with supply levels.
- [x] Tests: two in `tests/supply.test.ts`. The Steward raises the Beam
      only above its reserve; it doesn't when switched off or while the
      chain is short.
- [x] **Paced with the supplies instead** (follow-up): the half-purse
      reserve kept the Steward off the Beam early in a run, when production
      climbs fastest and each +5% matters most. The Beam is now its fourth
      node. Below the target it buys the cheaper of the bottleneck's next
      level and the next Beam level; at the target, only the Beam. In a test
      run (three lighthouses past First Light, 20,000 Embers, a player
      hiring with half their Lumen), Beam on gave 230 Beam levels and
      5.0e10/s at 5 minutes; Beam off gave 4.1e8/s and a 3% beam. The panel
      row reads "Raise the Beam too".

## ✅ Post-launch — Fill the chain raises the Beam too

- [x] `fillChain` takes `{ beamShare }`. While the chain is short it buys the
      cheaper of the bottleneck's next level and the next Beam level. Once the
      chain is full it keeps raising the Beam with levels costing up to a
      tenth of the Lumen in hand (`FILL_BEAM_SHARE`), so one tap never empties
      the purse. The Light view's Fill button uses it, and is enabled while
      a cheap Beam level waits even with the chain full; its tip says which.
      One log line counts both: "33 levels of supplies and 9 Beam levels, the
      beam at 100%" (an early save with 2M Lumen, which kept 1.34M).
- [x] This keeps the Beam in step before Widow's Walk brings the Chain
      Steward. Tests: two in `tests/supply.test.ts`.

## ✅ Post-launch — The roost grows with you

- [x] Roost expansions cost the larger of 10,000 × 6ⁿ (the early floor) and
      **3 minutes of production × 1.5ⁿ**, about an hour at the 8th and three
      hours at the 11th. The old price was 3% of ALL-TIME Lumen × 3ⁿ, but
      you can only pay with the Lumen held in this run. From the 4th
      expansion on it asked for more than one run could ever hold, so the
      roost stalled at 10–12 moths. The production price follows the keeper
      wherever they are in a run. The Expand button's tip shows the
      minutes.
- [x] Example save (6th expansion, 119M/s, a lifetime of 1e30 Lumen): it now
      costs 142B, about 23 minutes. The old price was 7.29e30.

## ✅ Post-launch — A steady screen, and a price ceiling

- [x] **No more jumping.** A browser audit sampled every button, card and
      heading on each tab for 5 s of idle play at 1280 and 390 px. Things
      moved by up to 104px before the fix; now nothing moves at either width.
      - **Lighthouses tab:** it rebuilt itself whenever any chain level
        changed, and with the Chain Steward and Fill the chain buying levels
        constantly, it redrew every few seconds. Levels are no longer in its
        structure key; the node cards update in place.
      - **Helper rows:** the "⚠ beam …" warning added a line when it
        appeared. It now takes the note's line, which is always there and
        one line high, and the Buy column has a fixed width.
      - **The roost:** Rush lure appeared and disappeared beside Attract, and
        Scented lure appeared at 8 scales. Attract and Rush share one button
        now, and Scented lure is always shown, greyed until "8/8".
      - **Chain nodes:** the bottleneck's dashed border was 1px thicker,
        resizing whichever card had it; it is now an outline. The flag and
        the notes keep room for two lines.
      - **Digits:** every digit is the same width
        (`font-variant-numeric: tabular-nums` on the body).
- [x] **Price ceiling** (`config.ts priceCeiling`): no single purchase costs
      more than The Hollow Light's relight, 10.0No. Upgrades were already
      under it (The Last Lesson is exactly 10.0No). Roost expansions and
      rush lures, which follow production and all-time Lumen, are now capped
      at it. Helper copies and chain levels keep climbing by design. The
      Shore Kindlings now grow ×3 a level, not ×10, so their 20th level
      costs 2.3 trillion Embers instead of 20 sextillion.
      Tests: `tests/priceCeiling.test.ts`.

## ✅ Post-launch — Design review: an easier opening, crews from the coast

From a Design Council playtest (a live session, the sim, and bot saves at
2.6 / 4 / 12.5 / 21 / 40 hours toured in the browser).

- [x] **The opening chain is warmed.** At ten helpers the chain woke
      already short (Lens carried 10/s against ~20/s of demand). The sim's
      bot spent minute 20 at 6% efficiency and 48 Lumen/s, and a greedy live
      session sat at 18% at minute 12. A new keeper's First Light starting
      levels now support ×6 (`FIRST_LIGHT_WARMTH`, config.ts). The grace is
      **added** to the lasting bonuses (`chain.ts startingWarmth`), not
      multiplied: multiplied, it warmed all ~60 runs and cut the ending from
      62.0h to 52.6h. Added, it fades as Embers grow.
      - Early sim, warmth ×1 / ×3 / ×6 / ×10: the beam first drops below
        50% at 4.9 / 7.7 / 9.8 / 11.5 minutes, minute 20 runs at 48 / 101 /
        189 / 324 Lumen/s, and the first Rekindle comes at 85 / 76 / 70 /
        65 minutes. ×6 puts the first starving near minute ten.
      - `npm run sim`, before → after: first Rekindle 84.9 → 69.9 min,
        second +57.9 → +50.9; lit at 3.4 / 6.1 / 11.8 / 20.2 / 34.2 / 62.0h
        → 2.9 / 5.4 / 11.1 / 19.5 / 33.4 / 59.8h. The keeper who buys
        everything: ending 50.3h → 47.8h.
- [x] **A line that says where the chain stands.** The README promised a
      starving banner, but only an orphaned comment remained. The supply
      strip now ends with a status line, always present so nothing below it
      moves (two lines reserved, three on phones):
      - below 50%, a warning: "⚠ The beam is starving: Lens carries 317/s
        of 6.32K/s. Helpers work at 29%. Feed Lens before hiring more.";
      - when short, "Lens holds the beam back, short by …/s";
      - when full, a calm "The beam is full".
- [x] **The Quartermaster comes with Gull Rock, the Lamp Crew with
      Cormorant Roost** (automation.ts), the way the Chain Steward comes
      with Widow's Walk. As Ember perks (500 and 5,000) they arrived around
      hour nine, so the first ten or so Rekindles meant relearning the same
      lessons and re-hiring by hand. The late-perk shelf now starts at Warm
      Hearth (50,000). A save that bought either gets its Embers back once,
      with a log line (`RETIRED_PERKS`, state.ts). The lighthouse cards,
      relight moments, hints and tutorial name the new crews. Like the
      Steward, they follow the lit lighthouses, so a Next Keeping relights
      them.
- [x] **Fixes:**
      - The Rekindle tab said "+3% each for the first 100, then less", and
        the tutorial said Embers past 100 add less. The curve is a straight
        line (`EMBER_CURVE.power` 1), so both now say so only when it isn't.
      - Time-to-afford past a day reads "more than a day away at this rate"
        instead of "affordable in 16807078d 15h" (`format.ts affordableIn`).
      - "Hire an Oil Keeper", not "a Oil Keeper" (`withArticle`).
      - "You Become the Wick" (hire The Seventh Light, which Siren's Rest
        brings) now follows Siren's Rest in the story.
      - README: the Kindlings grow ×10, ×4 and ×3 a level, not all ×10.
- [x] Tests: `tests/openingChain.test.ts` (new), automation, refund and
      shelf tests in `tests/emberShelves.test.ts`, and format helpers.
      Eight files that check chain math against the plain 20 / 15 / 10
      starting support pin the warmth at ×1 (`tests/baseWarmth.ts`).

## ✅ Post-launch — Re-paced lighthouse gaps

From the same design review. The gaps between relights roughly doubled
each time, so the last one (Siren's Rest → The Hollow Light) took 26 of
the bot's 60 hours: 45% of the game, with no new helper, lighthouse or
story beat in it, just 17 Rekindles of about 84 minutes.

- [x] **Gaps about 1.4× apart, ending at ~48h.** Gull Rock stays at 5M
      (2.9h). The other relight costs come from a search that runs the sim
      and moves each lighthouse's lessons (priced off its relight) with it.
      Each lighthouse was searched in order, with three trials at a time.

      | Lighthouse | Cost before → after | Bot lights it, before → after |
      |---|---|---|
      | Gull Rock | 5M (unchanged) | 2.9h → 2.9h |
      | Cormorant Roost | 8.4e8 → 4.8e9 | 5.4h → 6.7h |
      | Widow's Walk | 3.4e12 → 2.1e13 | 11.1h → 12.7h |
      | The Bellwether | 7.6e18 → 8e18 | 19.5h → 20.3h |
      | Siren's Rest | 5e25 → 4.2e24 | 33.4h → 32.0h |
      | The Hollow Light | 1e31 → 6.4e29 | 59.8h → 47.5h |

      - Gaps: 2.9 / 3.8 / 6.0 / 7.6 / 11.7 / 15.5h. The last is a third of
        the game.
      - The keeper who buys everything: 47.8h → 40.8h.
      - 52 Rekindles (was 58). The bot ends holding 1.8e13 Embers (was
        2.1e14), still above the dearest Ember Shop item.
      - Mean endgame efficiency 86%, no stalled saves.
- [x] The price ceiling (The Hollow Light's relight) is now 640.00Oc;
      The Last Lesson and the capped helper upgrades follow it.
- [x] Tests: the ceiling and Cormorant Roost cost assertions.

## ✅ Post-launch — The lamp's companions light the beam

Item 5 of the design review: make moths, relics, tides and challenges
matter. The review guessed that held Embers drowned them. Measuring them
in hours showed the supply chain was the problem. `scripts/worth.ts`
(new) runs the plain bot with one thing granted and reports when each
light comes on. Before this change:

| Bot starts with… | Ending (plain 47.5h) |
|---|---|
| Brass Compass (+10% production) | 47.3h |
| Amber Heart (+10% Ember gain) | 48.2h (no help) |
| three glow-100 moths on duty (+60% production) | 45.0h |
| all three challenge rewards | 45.3h |
| Tide Chart (+15% chain support) | 41.8h |
| all eight relics | 32.9h |

A production bonus on the helpers raised the chain's demand as much as
the Lumen it gave, so efficiency fell and the chain took most of it
back. Bonuses on the chain itself (support, cheaper nodes) were worth
hours.

- [x] **The lamp's companions brighten the thrown beam, after the chain**
      (`engine.lampMultiplier`). This is where Beam levels and the tide
      already were. It covers moths on duty, the Brass Compass, and the
      challenge lamps: Fog Lamps, Patient Keeper, and Fogbound's fog
      while it lies. They no longer add to what the chain must carry, and
      they leave `lastingProductionMultiplier` (the warm start).
      - Saved hours now follow ~38 × ln(bonus). Three perfect moths from
        the first second save 17.8h at the old +60%.
      - At the old rates that was too much. An engaged keeper (scenario
        `engaged`: moth glow climbing from 20 to 100 over 40 hours, a
        relic every 2.5 hours, challenges at 3 / 8 / 14 hours) finished at
        18.6h.
      - Rates halved: duty **glow × 0.1%** (glow 100 → +10%), Compass +5%,
        Fog Lamps +12.5%, Patient Keeper +10%. Variants tried: 0.1% /
        0.15% duty, the others full or halved → 24.2 / 22.7 / 19.6h.
- [x] **Results** (`npm run sim`, `scripts/worth.ts`):
      - The plain bot is unchanged (47.5h). So is the keeper who buys
        everything in the shop (40.8h).
      - The engaged keeper went from 33.9h to **24.2h**, about half the
        bot. That's what DESIGN.md expects of a real playthrough.
      - Moths, relics and challenges together are now worth ~23 of 47.5
        hours, up from ~14.
- [x] **Embers rest through a challenge run** (`engine.emberMultiplier`).
      Goals grow with the other lasting bonuses (Ember perks, lit
      lighthouses, the legacy: `challenges.challengeGoal`), never with
      Embers.
      - Holding a million Embers, a keeper used to clear every challenge
        in its first second.
      - The bot now takes about the same at any point. From saves at 2.6
        / 4 / 7 / 12.5 / 21 / 40 hours: Fogbound 87 → 52 minutes, Still
        Hands 29 → 18, First Light Only 21 → 13.
      - The cards show each keeper's goal, with a tip for how it grows.
        The Rekindle tab's bonus reads "resting", and the banner and Start
        button say the Embers rest.
- [x] **Fix: Still Hands could never be finished** without Head Start or
      Warm Hearth. The run opens with 0 Lumen and clicking yields nothing,
      so the first Candle Crab was out of reach. A keeper with no purse and
      no crew now starts it with one Candle Crab (`prestige.resetRun`).
- [x] **Fix:** the roost line computed its duty bonus with a hard-coded
      0.2 instead of `DUTY_GLOW_BONUS`.
- [x] **Tides needed nothing.** Their production effects were already on
      the thrown beam, and their chain-support effects already act on the
      chain.
- [x] **Sim tooling:** `runSim` takes `setup` (change the fresh state)
      and `during` (grant things on a schedule).
- [x] Tests: `tests/lamp.test.ts` (new), plus moth, relic, challenge and
      trait tests moved to the new placement and rates.

## ✅ Post-launch — The Crossing: three waymarks before The Hollow Light

The re-pace left the final stretch (Siren's Rest → The Hollow Light) at
15.5 of 47.5 bot hours with nothing new in it: no helper, no lighthouse,
no story beat, just one long save. It is now a crossing of the deep
glass.

- [x] **Three waymarks** (`config.ts WAYMARKS`), lit in order before the
      tower. They are steps of The Hollow Light's relight
      (`chain.relightLighthouse`; `lighthouseStatus.waymark` names the
      step). The bot, the Relight button, the gates (Siren's Rest lit,
      chain awake, 80% beam efficiency, the cost) and the sim's saving
      logic all carry over unchanged. Waymarks are permanent like
      lighthouses and carry no chain board; a Next Keeping darkens them.

      | Waymark | Gift | Where it acts |
      |---|---|---|
      | The Drowned Bell | chain support +25% | `chain.lighthouseSupportMultiplier` |
      | The Glass Stair | the thrown beam +25% | `engine.lampMultiplier` |
      | The Last Lantern | one more moth on duty | `almanac.dutySlots` |

- [x] **Story:** three new Act III beats, one per waymark: "The Drowned
      Bell", "The Glass Stair", "The Last Lantern". That makes 27 beats.
- [x] **Coast panorama:** three lanterns on the path from Siren's Rest to
      The Hollow Light. Lit ones burn; the next pulses inside a readiness
      ring, and The Hollow Light's own ring waits until the Crossing is
      done; the rest are silhouettes.
- [x] **Moment:** a new `waymark` kind. The light path runs to a lantern on
      a post, which catches and spreads rings across the glass. The
      eyebrow reads "The Crossing · waymark n of 3".
- [x] **The Hollow Light's card** lists the Crossing (◆ lit, ◇ dark, the
      next in lamp colour, each with its gift and a tip). Its button
      reads "Light The Drowned Bell — 530.00Sp Lumen" until the tower's
      turn.
- [x] **Tutorial** page 5 mentions the Crossing.
- [x] **Pacing** (`npm run sim`). Costs come from a sim search in order,
      each holding the earlier ones fixed:

      | Step | Cost | Bot reaches it |
      |---|---|---|
      | The Drowned Bell | 5.3e26 | 35.8h |
      | The Glass Stair | 5.8e28 | 39.3h |
      | The Last Lantern | 7.1e29 | 42.8h |
      | The Hollow Light | 6.4e29 → 4e30 | 47.2h (was 47.5h) |

      - The final stretch is now steps of 3.8 / 3.5 / 3.5 / 4.4 hours.
      - The Hollow Light costs more because the gifts speed the stretch up.
        The price ceiling follows it to 4.00No.
      - Engaged keeper (`scripts/worth.ts`): 24.4h. Keeper who buys
        everything: 42.1h (was 40.8h).
- [x] **Save v13:** `crossing` (0–3). Older saves load at 0, or at 3 if
      they already lit The Hollow Light. Junk is clamped.
- [x] **Sim:** a bot hook `onWaymarkLit`; `runSim` reports
      `waymarkAtHours` and takes a `stopWhen`; `npm run sim` prints the
      waymarks.
- [x] Tests: `tests/crossing.test.ts` (new). The lighthouse, story-count
      and save-version tests are updated.

## ✅ Post-launch — Tides dealt like weather

From the design review. Each 30-minute tide was an independent weighted
draw, so 26% of turns repeated the tide before them. The strip read
"Glass Calm · next: Glass Calm" often enough to look like a bug, and a
run of the same tide said nothing about the weather.

- [x] **A shuffled bag** (`tides.ts tideCycle`). Every 20 buckets (10
      hours) hold exactly each tide's weighted share: 6 Low, 6 High, 5
      Glass Calm, 3 Stormfront (`tideCycleCounts`, from the existing
      weights). The order is laid out from a seed of the cycle index, so
      it is the same sea for every keeper and the forecast stays exact.
- [x] **Never twice in a row.** Inside a cycle, each tide is drawn by
      remaining count among those that differ from the one before (a
      small backtracking search). At the seams, every cycle opens on Low
      or High Tide and closes on Glass Calm or a Stormfront. That rule
      keeps any cycle from needing the one before it, so any time can be
      computed directly.
- [x] **Cheap:** laying out a cycle takes ~5 µs, and a cached `tideAt`
      ~31 ns. The last 8 cycles are kept.
- [x] **Copy:** README, DESIGN and the tutorial's tide line.
- [x] **No balance change:** the sim and offline earnings are
      tide-neutral, and the long-run shares are the same as before.
- [x] Tests: three in `tests/sprint4.test.ts`:
      - no repeats across 5,000 buckets, seams included;
      - exact counts, openers and closers over 50 cycles;
      - cycles independent of the cache.

      The chain-flow scene test now picks a time whose tide leaves support
      alone, instead of assuming one.

## ✅ Post-launch — Interface notes from the design review

- [x] **Two columns on wide screens** (≥1024px). At 900px the helper list
      began below the fold on a laptop, under the scene and the supply
      strip, so the main thing a keeper does was out of sight. The Light
      view now puts the lamp (scene + supply strip, `.light-main`) beside
      the helpers (buy amounts + rows, `.light-side`). The first helper
      sits at y≈197 at 1024, 1100 and 1280px; it was at 897 at 1100px.
      - The app widens to 1240px for every view, so the header and tabs
        never jump between tabs. The other views stay a centred 900px
        reading column.
      - The supply nodes go 2×2 below 1280px, so no Feed button truncates
        with late-game prices.
      - Nothing moves in 5 seconds of idle play at 1024, 1100 or 1280px,
        or on a phone.
- [x] **Phones:** once the chain wakes and the supply strip joins the
      scene, the scene shortens from 360px to 270px (`.chain-awake`).
- [x] **Numbers past 1e15 turn scientific.** Standard notation keeps
      K / M / B / T, then reads 1.23e15. Qa, Qi, Sx, Sp, Oc and No were
      glyph soup: nobody could tell whether 7.60Qi was more than
      50.00Sp. The Keeper's Desk label says so. The price ceiling reads
      4.00e30.
- [x] **SVG glyphs instead of system emoji** (`icons.ts GLYPHS`,
      `TIDE_GLYPHS`, `wingDot`). The emoji were 🦋 🍾 📖 🌀 🔒 🗼 🌅 🌫 ⏳
      ⚙ 🐛 📜 ⚔ and the tides' 🌊 🌕 🪞 ⛈️; each platform drew them in its
      own colours, which broke the nocturne palette.
      - The glyphs are 1em, currentColor, with lamp accents, like the rest
        of the set.
      - A moth's pattern is now a dot of its own CSS wing swatch.
      - Tides and moth patterns no longer carry emoji fields; the UI maps
        ids to glyphs.
      - ⚠ and ♾ stay, pinned to text presentation (U+FE0E) so phones
        don't draw them as colour emoji.
      - Old log lines keep their 📖 mark in the save and are drawn with the
        book glyph.
- [x] **The Beam says Raise.** Wick, Oil and Lens are fed; the Beam
      carries nothing and adds light, so its button reads
      "Raise · 87.97M".
- [x] Tests: the formatter's scientific switch at 1e15.

## ✅ Post-launch — Second design review: four small fixes

From the second Design Council pass (live play, plus the bot's saves from
2.6h to the ending, toured at 1280px and on a phone).

- [x] **Row warnings only for real drops.** A helper row warns ("⚠ beam
      63% → 32% · feed Lens") only when buying would drop the beam by 10
      points or more (`ROW_WARN_DROP`). Three or four rows used to warn at
      almost every save, even at 99% efficiency; the supply strip's status
      line already says where the chain stands.
      - Before → after: 4 → 0 warnings at 2.6h, 3 → 1 at 37.5h, 0 at the
        ending.
- [x] **One badge that matters.** Only the bottleneck reads "● BOTTLENECK"
      (amber when strained, coral below 70%). The other nodes read "●
      FLOWING" or their own share ("● 66%"). The flag below gives the
      shortfall: "⚠ Short by 2.55e15/s: feed it first". All three nodes
      used to read STARVED or STRAINED at once.
- [x] **Fix: stale warm-start copy.** Two lines were wrong since earlier
      changes: the Lighthouses board summary and the Rekindle tab's Kept
      list.
      - They credited "moths, relics", which left the warm start when they
        moved to the lamp.
      - They left out the new keeper's +5 grace.
      - Both now read `chain.startingWarmth`: "your lasting bonuses
        (Embers, perks, lit lighthouses) plus a new keeper's grace of +5".
- [x] **Story pages are one line in the Keeper's Log.** "📖 The Sea
      Remembers — a new page in The Story So Far". The Story section at
      the top of the Log holds the text. Old saves' full-paragraph entries
      are drawn the same way.
- [x] Tests: `tests/storyLog.test.ts`. The row and badge rules live in the
      UI and were checked in the browser on the bot's saves.

## ✅ Post-launch — Second design review: the late-game chores

- [x] **Lighter Rekindles.** A keeper Rekindles some fifty times on the
      way to the ending, and each one was two clicks plus a 7-second
      full-screen moment.
      - The full moment now plays for the first Rekindle and every tenth
        (`REKINDLE_MOMENT_EVERY`); its eyebrow reads "Rekindle 10".
      - The others flare the hearth in place (`.rekindled`, 1.4s; still
        under reduced motion) and leave a line under the button: "Rekindle
        5: +3.00K Embers banked; your production bonus is now ×3.06M".
      - The moment's old "+X% brighter" line ran into hundreds of millions
        of percent. It now uses the same ×/+ form as the hearth.
      - The two-step confirm stays: a Rekindle still resets a run.
- [x] **Kindle all under 1%** (`emberShop.kindleAll`). By hour 21 every
      keeper perk "spends <0.01% of your Embers", so the shop was a list
      of clicks, not a trade.
      - One button buys every perk and Kindling level that costs no more
        than 1% of the Embers held at that moment, cheapest first.
      - It logs one line for the lot. Its label counts the purchases
        (`kindleAllPreview`, a dry run) and its tip gives the total.
      - On the 21h save: 36 purchases for about 3% of 101.9M Embers.
- [x] **The phone supply strip folds.** At ≤560px the strip shrinks to
      one line (title, efficiency, Fill, Show) while the beam is at 90% or
      more.
      - It opens by itself below 80%; the gap between the two keeps it
        from flickering at one threshold.
      - Show / Hide overrides until the chain next dips below 80%.
      - On a fed 6h save the first helper moved up to y=513 on an iPhone
        13 (the screen is 844 tall).
- [x] **The Lamp Crew says why it's idle**
      (`automation.lampCrewIdleReason`). A switched-on crew that can't
      hire reads "waiting on the chain" when every affordable hire would
      drop the beam below its floor, or "saving up" when nothing costs a
      tenth of the Lumen yet. A tip explains each.
- [x] `buyPerk` / `buyKindling` take a `log` flag, so Kindle all logs once.
- [x] Tests: `tests/shopAndCrew.test.ts` (6). Rekindle moments and the
      phone strip were checked in the browser.

## ✅ Post-launch — The guide, a page at a time

Item 10 of the second design review. A new keeper read all eight pages
of "How to keep the light" before the first click: the supply chain,
Embers, moths and tides explained to someone who hadn't hired a crab.

- [x] **A new keeper reads two pages**, the shore and making light
      (`GUIDE_OPENING`). They come without "n of 8", and the second says
      the rest will follow.
- [x] **Each of the others opens by itself**, as a single "New in the
      guide" page, the first time its part of the game matters
      (`game/guide.ts dueGuidePage`):

      | Page | Opens when |
      |---|---|
      | Upgrades | a lesson is first learnable (about ten Candle Crabs) |
      | Supply chain | the chain wakes |
      | Lighthouses | the keeper holds a tenth of Gull Rock's price, or has lit it |
      | Rekindle | a Rekindle would bank 10 Embers |
      | The Shore | the first Lantern Moth |
      | Tides & time away | 30 minutes of play |

      - Only one page opens at a time, never over another card or a
        moment, and at most one every 90 seconds. Lessons and the chain
        wake together, and their pages shouldn't arrive back to back.
- [x] **The ? button and the Keeper's Desk** still open all eight pages,
      and opening the whole guide counts every page as read.
- [x] **Save v14:** `guideSeen`. Older saves count every page as read
      (they read the whole guide up front); unknown ids are dropped.
- [x] Checked in the browser: a fresh keeper sees two pages, then at ten
      Candle Crabs "New in the guide · The Upgrades tab" opens on its own.
- [x] Tests: `tests/guide.test.ts` (5); the save-version tests are
      updated.

## ✅ Post-launch — A real playthrough, against the bots

The first full playthrough on a phone reached the ending in **3.6 hours
of play** (plus time away the save doesn't count), where the bots said
47 (plain) and 24 (engaged). Re-running the bots with that keeper's
habits found why, and three fixes.

- [x] **The bot Rekindles like a keeper** (`scripts/simCore.ts`). It
      Rekindled whenever the gain reached half the Embers held: 64
      times to the ending. The keeper Rekindled 8 times and ended with
      the same Embers. Now the bot Rekindles when the run's Ember growth,
      ln(1 + gain ÷ held) per hour of run plus 15 minutes to rebuild, is
      past its peak (`REKINDLE_PAST_PEAK`, `REKINDLE_REBUILD_SECONDS`).
      Without the rebuild time it Rekindled thousands of times, because
      the √ makes a run's first minute look best. The old rule stays as
      `rekindleGrowth`, for comparison.
- [x] **Bottles come home sooner, not richer** (`expeditionCache`). The
      cache paid half the light for the route's full length, while
      Tailwind and Glass Charts brought the bottle home in 30% of it:
      +168% income for a bottle always out, and one Coastal Run paid more
      than The Hollow Light costs. It now pays for the voyage as sailed:
      +50% at any speed.
- [x] **The echo is quieter and has a ceiling** (`FLASH_ECHO_SHARES`,
      `engine.ECHO_FLASHES_PER_SECOND`). 5 / 10 / 20% of a second's
      production on every flash, with no limit, gave 2.4 taps a second
      +84% income. Now 2 / 4 / 6%, on at most three flashes a second
      (faster ones pay the plain flash): +36% at most. The sim and the
      estimates, which flash without a clock, are not rate-limited.
      `clickBeam` returns what the flash paid, so the floating number is
      always true.

| Bot (ending, hours) | Before | After |
|---|---|---|
| Plain (`npm run sim`) | 47.2 | 21.0 |
| Buys everything in the Ember shop | 42.1 | 15.2 |
| Engaged (`SCEN=engaged scripts/worth.ts`) | 24.4 | 15.0 |
| The phone keeper's kit and habits | 5.2 | 7.3 |

Plain bot, after: lights at 2.9 / 3.9 / 6.1 / 7.5 / 10.1h, waymarks at
12.1 / 15.2 / 17.2h, the ending at 21.0h, 12 Rekindles.

- [x] **The re-pace** is the next entry: a 30-hour story on this bot.
- [x] Tests: the echo ceiling and the unclocked flash
      (`tests/lateUpgrades.test.ts`), the cache following a faster
      voyage (`tests/sprint4.test.ts`).

## ✅ Post-launch — A 30-hour story

The designer's call after the re-baselined bot: "shoot in the middle,
like 30 hours." Every price had been tuned on the old Rekindle rule, so
the new bot reached the ending at 21 hours with lopsided gaps (an hour
from Gull Rock to Cormorant Roost, eleven from Siren's Rest to the end).

- [x] **Re-priced the coast** for the plain bot, one light at a time,
      each searched (on a log scale) to its target hour with the earlier
      ones fixed. Gull Rock is unchanged; it comes before the Rekindle
      rule matters.

      | Light | Cost before | Cost now | Lit (plain bot) |
      |---|---|---|---|
      | Gull Rock | 5e6 | 5e6 | 2.9h |
      | Cormorant Roost | 4.8e9 | 1.2e11 | 4.7h |
      | Widow's Walk | 2.1e13 | 2.4e17 | 7.4h |
      | The Bellwether | 8e18 | 9.5e23 | 11.8h |
      | Siren's Rest | 4.2e24 | 1.5e27 | 16.7h |
      | ◆ The Drowned Bell | 5.3e26 | 2.1e29 | 21.6h |
      | ◆ The Glass Stair | 5.8e28 | 1.4e30 | 25.8h |
      | ◆ The Last Lantern | 7.1e29 | 4.3e30 | 28.4h |
      | The Hollow Light | 4e30 | 8.2e30 | **30.9h** |

      - Gaps of 1.8 / 2.7 / 4.4 / 4.9 / 4.9 / 4.2 / 2.6 / 2.5 hours,
        16 Rekindles. With the Ember shop, 19.8h; engaged, 19.0h; the
        phone keeper's kit and habits, 9.0h.
      - The price ceiling (The Hollow Light's cost) rises to 8.2e30, so
        roost expansions and rush lures cap there.
- [x] Tests: the Cormorant Roost and price-ceiling values; two exact
      comparisons became ratio checks (8.2e30 isn't exact in a Decimal).

## ✅ Post-launch — Design review, round three

The council re-ran on the 30-hour build. Findings 1, 2, 4 and 5 are done.

- [x] **1. The Rekindle moment** (`game/rekindleMoment.ts`). When to
      Rekindle moved the bot's ending from 42 hours to 15, and the game
      taught the old answer: "Recommended first Rekindle: 40 — reached ✓"
      stayed up forever, and the hearth filled at a ×2 gain. Now:
      - The game and the bot share one rule. A run is worth
        ln(1 + gain ÷ held) per second of run, plus 15 minutes to rebuild;
        once that rate is 2% under its best, the run has done its best work.
      - The hearth fills with the run's Ember growth and flares then; a dot
        lights on the Rekindle tab. If a light costs no more than half an
        hour of production, it says to relight first (the bot's saving rule).
      - Save v15: `runSeconds` (live and credited time away) and
        `runBestGrowth`. An older save's run is estimated from its lifetime
        at today's rate, capped at the time played.
      - "First" means fewer than 40 Embers *earned*: a shop bot that spent
        below 40 held never left it and stalled.
- [x] **2. The last step is the longest for every bot.** Tuned on the plain
      bot alone, the shop bot lit The Hollow Light 30 minutes after the
      Last Lantern. The waymarks now come closer and the tower costs more:

      | | Before | Now |
      |---|---|---|
      | The Drowned Bell | 2.1e29 | 5e28 |
      | The Glass Stair | 1.4e30 | 3.1e29 |
      | The Last Lantern | 4.3e30 | 1.1e30 |
      | The Hollow Light | 8.2e30 | 8.8e30 |

      | Bot | Siren's Rest → waymarks → tower (hours) | Ending |
      |---|---|---|
      | Plain | 16.7 → 19.4 / 21.8 / 23.5 → 29.9 (last step 6.4) | 29.9h |
      | Ember shop | 12.3 → 14.0 / 15.3 / 16.6 → 18.6 (last step 2.0) | 18.6h |
      | The phone keeper's kit and habits | 5.8 → 6.5 / 7.2 / 7.5 → 8.5 (last step 1.0) | 8.5h |
      | Engaged | | 18.9h |

      Each light was searched on the plain bot to a target (19.5 / 22 /
      24.5 / 30.5), then checked on the others. At 9.2e30 the plain bot's
      ending jumps to 31.5h (an 8-hour last step), so the tower stays at
      8.8e30.
- [x] **4. The Crossing asks for the Shore** (`game/offerings.ts`). Each
      waymark costs half with its offering, never a gate:
      - The Drowned Bell: a moth posted at Siren's Rest.
      - The Glass Stair: a bottle home from the Deep Glass Crossing once
        Siren's Rest burns (remembered in the save, `deepGlassBottle`; a
        log line says the stair is charted; a Next Keeping clears it).
      - The Last Lantern: a moth glowing 80 or brighter on duty.
      - The Crossing card names each offering under its waymark, and the
        Shore says what the next one asks while The Hollow Light is next.
- [x] **5. Helper rows tell the truth.** They showed each helper's own
      output, before the lighthouses, the chain, the Beam and the lamp: at
      the Last Lantern the rows summed to ~1/350 of the header. Now each
      row is its share of the header's Lumen/s (`engine.thrownFactor`) and
      "+X Lumen/s" is the real change from the next hire, the chain's
      answer included (`engine.thrownGain`). The Beam reads "×109", not
      "+10845%".
- [x] Tests: `tests/rekindleMoment.test.ts` (8), `tests/offeringsAndRows.test.ts`
      (8); the save-version and price-ceiling tests are updated. Checked in
      the browser on desktop and phone: the hearth's three phases and the
      tab dot, the Crossing card's offerings, the Shore's line, the rows
      and the Beam.
