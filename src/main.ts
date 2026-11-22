import "@fontsource/im-fell-english/latin-400.css";
import "@fontsource/im-fell-english/latin-400-italic.css";
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-600.css";
import "@fontsource/figtree/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./style.css";
import Decimal from "break_infinity.js";
import {
  CHAIN_LIGHTHOUSES,
  CHAIN_NODES,
  CHAIN_NODE_IDS,
  CHAIN_UNLOCK_GENERATORS,
  EMBER_CURVE,
  FIRST_LIGHT_ID,
  FIRST_LIGHT_WARMTH,
  GENERATORS,
  HOLLOW_LIGHT_ID,
  MILESTONE_THRESHOLDS,
  PRESTIGE_RECOMMENDED_EMBERS,
  WAYMARKS,
  chainLighthouseById,
  effectiveEmbers,
  milestoneMultiplier,
  type ChainNodeId,
  type GeneratorDef,
} from "./game/config";
import {
  abandonChallenge,
  activeChallenge,
  canBuyGenerator,
  challengeById,
  challengeGoal,
  challengeProgress,
  generatorLockedBy,
  startChallenge,
  CHALLENGES,
} from "./game/challenges";
import {
  buyNodeUpgrade,
  chainStatus,
  isLit,
  lighthouseMultiplier,
  lighthouseStatus,
  startingWarmth,
  nextLighthouseId,
  nextWaymark,
  nextLevelSupportGain,
  nextNodeCost,
  relightLighthouse,
  totalSupport,
} from "./game/chain";
import {
  EMBER_PERKS,
  KINDLINGS,
  KINDLE_ALL_SHARE,
  buyKindling,
  buyPerk,
  hasPerk,
  kindleAll,
  kindleAllPreview,
  kindlingCost,
  kindlingLevel,
  perkOpen,
  tailwindRelicBonus,
  type EmberPerkDef,
  type KindlingDef,
} from "./game/emberShop";
import { LAMP_CREW_LIGHTHOUSE, QUARTERMASTER_LIGHTHOUSE, autoHire, autoLearn, lampCrewIdleReason, lampCrewUnlocked, quartermasterUnlocked } from "./game/automation";
import {
  advanceToNow,
  LIVE_GAP_LIMIT_SECONDS,
  applyOfflineEarnings,
  lastingProductionMultiplier,
  buyQuote,
  buyWithAmount,
  ECHO_FLASHES_PER_SECOND,
  clickBeam,
  echoCharges,
  clickValue,
  generatorProduction,
  productionForOwned,
  thrownFactor,
  thrownGain,
  productionPerSecond,
  timeToAffordCost,
} from "./game/engine";
import { FlashRate } from "./game/clickRate";
import { awayReport, shouldShowAway, snapshotAway, type AwayReport } from "./game/away";
import { createRecoveryEstimator, type RecoveryEstimator } from "./game/estimate";
import {
  EXPEDITION_ROUTES,
  RELICS,
  claimExpedition,
  expeditionReady,
  routeById,
  sendExpedition,
  relicChanceFor,
  tendBottles,
  voyageMs,
  type ExpeditionClaim,
} from "./game/expeditions";
import { Splash, type SplashPage } from "./ui/splash";
import { guidePageAlone, guidePageUnnumbered, tutorialPages } from "./ui/tutorial";
import { infoTip, initTips, setTip, tipAttr } from "./ui/tips";
import { FILL_BEAM_SHARE, bottleneckAtDemand, efficiencyAtDemand, feedNode, feedQuote, fillChain, stewardActive, stewardPurseCapSeconds, stewardUnlocked, tendChain } from "./game/supply";
import { affordableIn, formatDuration, formatNumber, withArticle } from "./game/format";
import {
  attractMoth,
  BASE_NESTS,
  EXPANSIONS_PER_NEST,
  MAX_NESTS,
  cocoonReady,
  expansionsToNextNest,
  nestCount,
  readyCocoonCount,
  dutyGlowTotal,
  dutyMoths,
  expandRoost,
  hatchCocoon,
  isCocoonParent,
  mothById,
  mothCapacity,
  mothsUnlocked,
  patternById,
  releaseMoth,
  roostExpansionCost,
  roostExpansionMinutes,
  rushAttractMoth,
  rushLureCost,
  lureStatus,
  SCENTED_LURE_SCALES,
  scentedAttractMoth,
  releaseScales,
  isOldLight,
  cocoonDurationMs,
  startBreeding,
  toggleDuty,
  postMoth,
  recallMoth,
} from "./game/moths";
import { DUTY_GLOW_BONUS, MOTH_TRAITS, dutyBonusOf, isAtSea, postBonusOf, postOf, postedMoth, riderOf, traitsOf } from "./game/mothTraits";
import { ALMANAC_PATTERNS, ALMANAC_REWARDS, ALMANAC_SIZE, almanacHas, dutySlots, lureBankSize } from "./game/almanac";
import { legacyMultiplier, startNgPlus } from "./game/ngplus";
import { offeringMet } from "./game/offerings";
import { canRekindle, rekindle, rekindleGain } from "./game/prestige";
import { type RekindleMoment, rekindleMoment, trackRekindleGrowth } from "./game/rekindleMoment";
import { STORY_ACTS, STORY_BEATS, checkStory } from "./game/story";
import { GUIDE_OPENING, GUIDE_PAGE_IDS, dueGuidePage, markGuideSeen } from "./game/guide";
import { tideForecast } from "./game/tides";
import {
  addLog,
  createInitialState,
  deserializeState,
  loadState,
  saveState,
  serializeState,
  startBoard,
} from "./game/state";
import type { BuyAmount, GameState, Moth } from "./game/types";
import { Sound } from "./audio/sound";
import { ChainFlowRenderer } from "./scene/chainFlow";
import { COAST_LAYOUT, CoastRenderer } from "./scene/coast";
import { MeadowRenderer } from "./scene/meadow";
import { MomentRenderer, type MomentKind } from "./scene/moments";
import { buildChainFlowModel, buildCoastModel, buildMeadowModel, buildSceneModel } from "./scene/model";
import { SceneRenderer } from "./scene/renderer";
import {
  BRAND_MARK,
  CHALLENGE_ICONS,
  CLICK_ICON,
  EMBER_GLYPH,
  GENERATOR_ICONS,
  GLOBAL_UPGRADE_ICONS,
  GLYPHS,
  KINDLING_ICONS,
  PERK_ICONS,
  HEARTH_ART,
  RELIC_ICONS,
  BOTTLE_ART,
  SOUND_OFF_ICON,
  SOUND_ON_ICON,
  TAB_ICONS,
  TIDE_GLYPHS,
  UNKNOWN_ICON,
  wingDot,
} from "./ui/icons";
import {
  UPGRADES,
  buyUpgrade,
  emberBonusPerEmber,
  flashEchoShare,
  isPermanentUpgrade,
  isUnlocked,
  totalGeneratorsOwned,
  generatorUpgradeTier,
  unlockProgress,
  unlockText,
  upgradeById,
  type UpgradeDef,
} from "./game/upgrades";

// ── Boot: load (or start) a game, then settle offline earnings ──────────────
const loadedSave = loadState();
/** No save in this browser: a brand-new keeper, who gets the tutorial. */
const isNewKeeper = loadedSave === null;
const state: GameState = loadedSave ?? createInitialState();

/** All displayed numbers honour the Keeper's Desk notation setting. */
const fmt = (value: Decimal | number | string): string => formatNumber(value, state.notation);

/** Synthesised sound (WebAudio); it starts on the first click or key press. */
const sound = new Sound();
window.addEventListener("pointerdown", () => sound.unlock(), { capture: true });
window.addEventListener("keydown", () => sound.unlock(), { capture: true });

/**
 * A production bonus given in percent: "+120%" while it reads naturally,
 * a multiplier ("×65.0") once it passes +1,000% — "+6.40K%" says nothing.
 */
function bonusText(percent: number): string {
  if (percent < 1000) return `+${fmt(percent)}%`;
  return `×${fmt(1 + percent / 100)}`;
}

/** The beat title from a 📖 log line: "📖 Title — …" (old saves) or "📖 Title — a new page…". */
function storyLogTitle(message: string): string {
  const rest = message.slice("📖".length).trim();
  const dash = rest.indexOf(" — ");
  return dash >= 0 ? rest.slice(0, dash) : rest;
}

/** "More than a day away…" from "more than a day away…". */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Format a 0–1 fraction as a percentage that never reads "0%" while above zero. */
function pct(fraction: number): string {
  const p = fraction * 100;
  if (p <= 0) return "0%";
  if (p < 0.01) return "<0.01%";
  if (p < 1) return `${p < 0.1 ? p.toFixed(2) : p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

/**
 * Two-step confirm for destructive buttons: the first click arms the button
 * and swaps its label; a second click within 5 seconds confirms. Left alone,
 * it disarms and restores its label, so a stale "Are you sure?" never waits
 * for an accidental click later.
 */
const CONFIRM_WINDOW_MS = 5_000;
function armTwoStep(btn: HTMLButtonElement, confirmText: string | (() => string), onConfirm: () => void): void {
  let timer: number | undefined;
  let original = "";
  btn.addEventListener("click", () => {
    if (timer === undefined) {
      original = btn.textContent ?? "";
      btn.textContent = typeof confirmText === "function" ? confirmText() : confirmText;
      btn.classList.add("armed");
      timer = window.setTimeout(() => {
        timer = undefined;
        btn.textContent = original;
        btn.classList.remove("armed");
      }, CONFIRM_WINDOW_MS);
      return;
    }
    window.clearTimeout(timer);
    timer = undefined;
    btn.classList.remove("armed");
    btn.textContent = original;
    onConfirm();
  });
}

/** Log what time away paid, and any news from the Shore. */
function welcomeBack(gain: Decimal, creditedSeconds: number, awaySeconds: number): void {
  if (gain.gt(0)) {
    addLog(state, `While you were away (${formatDuration(creditedSeconds)} credited): +${fmt(gain)} Lumen.`);
  }
  // Welcome back, in full: the Shore keeps its own time while you're gone.
  if (awaySeconds > 60) {
    const shoreNotes: string[] = [];
    const ready = readyCocoonCount(state);
    if (ready > 0) shoreNotes.push(ready === 1 ? "a cocoon is ready to hatch" : `${ready} cocoons are ready to hatch`);
    if (state.expedition && expeditionReady(state)) shoreNotes.push("a bottle has washed back onto the glass");
    if (shoreNotes.length > 0) {
      addLog(state, `While you were away: ${shoreNotes.join(", and ")} — see the Shore.`);
    }
  }
}

const awayBefore = snapshotAway(state);
const offline = applyOfflineEarnings(state);
const bootNow = state.lastSeen;
welcomeBack(offline.gain, offline.creditedSeconds, offline.awaySeconds);
// The Chain Steward takes its share of the time away, as it does live.
const bootStewardLevels = tendChain(state, offline.gain, bootNow);
// Glass Charts: the bottles that came home while you were away set out again.
tendBottles(state, Math.random, bootNow);
if (bootStewardLevels > 0) {
  addLog(state, `While you were away, your Chain Steward saw to the supply line and the Beam: ${bootStewardLevels} level${bootStewardLevels === 1 ? "" : "s"}.`);
}
// Story beats can be earned offline too (a lighthouse of Lumen, a record
// crossed in the dark) — deliver whatever is due before the first frame.
const bootBeats = checkStory(state);
saveState(state);
/** The welcome-back card for this visit (opened once the page is built). */
const bootAway: AwayReport | null = loadedSave
  ? awayReport(state, offline, awayBefore, bootNow, { stewardLevels: bootStewardLevels, storyTitles: bootBeats.map((b) => b.title) })
  : null;

// ── Static shell: persistent header + tab menu (separate views, no long page)
initTips();
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.innerHTML = `
  <header class="hud">
    <div class="brand"><span class="brand-mark">${BRAND_MARK}</span><span class="brand-name">Tidelight</span></div>
    <button id="help-toggle" class="sound-toggle help-toggle" aria-label="How to play" title="How to play">?</button>
    <button id="sound-toggle" class="sound-toggle" aria-pressed="true" aria-label="Sound"></button>
    <div class="hud-stats">
      <div class="stat"><span class="stat-label">Lumen</span><strong id="hud-lumen">0</strong></div>
      <div class="stat" id="hud-rate-stat"><span class="stat-label">per second</span><strong id="hud-rate">0</strong></div>
      <div class="stat"><span class="stat-label">Embers</span><strong id="hud-embers">0</strong></div>
    </div>
  </header>

  <nav class="tabs" role="tablist">
${[
    ["light", "Light"],
    ["upgrades", "Upgrades"],
    ["lighthouses", "Lighthouses"],
    ["shore", "Shore"],
    ["rekindle", "Rekindle"],
    ["log", "Log"],
  ]
    .map(
      ([id, label], i) =>
        `<button class="tab${i === 0 ? " active" : ""}" data-tab="${id}" role="tab"><span class="tab-icon">${TAB_ICONS[id]}</span><span class="tab-label">${label}</span></button>`,
    )
    .join("")}
  </nav>

  <main>
    <section id="view-light" class="view active">
      <div id="challenge-banner" class="challenge-banner hidden" role="button" tabindex="0"></div>
      <div class="light-main">
      <div class="scene">
        <canvas id="scene-canvas" aria-hidden="true"></canvas>
        <div id="tide-strip" class="tide-strip"></div>
        <div class="scene-foot">
          <button id="flash" class="beam">Flash the Beam<span class="echo-pips hidden" id="echo-pips" aria-hidden="true"><i></i><i></i><i></i></span></button>
        </div>
      </div>
      <section id="supply-strip" class="card supply-strip hidden" aria-label="Supply chain">
        <div class="supply-head">
          <span class="supply-title">Supply chain <strong id="supply-eff"></strong><span id="supply-eff-tip"></span></span>
          <span class="supply-actions">
            <button class="buy supply-fill" id="supply-fill">Fill the chain</button>
            <button class="toggle-btn supply-steward" id="steward-btn" aria-expanded="false">Steward</button>
            <button class="toggle-btn" id="supply-boards">Boards</button>
            <button class="toggle-btn supply-more" id="supply-more" aria-expanded="true">Hide</button>
          </span>
        </div>
        <div class="supply-nodes">
          ${(["wick", "oil", "lens", "beam"] as const)
            .map(
              (id) => `
          <div class="supply-node" data-node="${id}">
            <div class="sn-top"><span class="sn-name">${CHAIN_NODES[id].name}</span><span class="sn-pct"></span></div>
            <div class="sn-gauge"><span></span></div>
            <button class="buy sn-feed">${id === "beam" ? "Raise" : "Feed"}</button>
          </div>`,
            )
            .join("")}
        </div>
        <p id="supply-say" class="supply-say" role="status"></p>
        <div id="steward-panel" class="steward-panel hidden">
          <div class="steward-row"><span>Steward</span>
            <span class="buy-toggle steward-toggle"><button class="toggle-btn" data-steward-on="1">On</button><button class="toggle-btn" data-steward-on="0">Off</button></span>
          </div>
          <div class="steward-row"><span>Share of income</span>
            <span class="buy-toggle steward-toggle">${[0.1, 0.25, 0.5].map((v) => `<button class="toggle-btn" data-steward-share="${v}">${Math.round(v * 100)}%</button>`).join("")}</span>
          </div>
          <div class="steward-row"><span>Keep the beam at</span>
            <span class="buy-toggle steward-toggle">${[0.8, 0.9, 1].map((v) => `<button class="toggle-btn" data-steward-target="${v}">${Math.round(v * 100)}%</button>`).join("")}</span>
          </div>
          <div class="steward-row"><span>Raise the Beam too</span>
            <span class="buy-toggle steward-toggle"><button class="toggle-btn" data-steward-beam="1">On</button><button class="toggle-btn" data-steward-beam="0">Off</button></span>
          </div>
          <p class="muted steward-status" id="steward-status"></p>
        </div>
      </section>
      </div>
      <div class="light-side">
      <div class="buy-toggle" role="group" aria-label="Buy amount">
        <span class="buy-toggle-label">Buy</span>
        <button class="toggle-btn" data-amount="1">×1</button>
        <button class="toggle-btn" data-amount="10">×10</button>
        <button class="toggle-btn" data-amount="100">×100</button>
        <button class="toggle-btn" data-amount="max">Max</button>
        <span class="auto-switch hidden" id="crew-switch">
          <span class="buy-toggle-label">Lamp Crew</span>
          <button class="toggle-btn" data-auto="autoHire" aria-pressed="true">On</button>
          <span class="crew-note" id="crew-note"></span>
        </span>
      </div>
      <div id="generators" class="gen-list"></div>
      </div>
    </section>

    <section id="view-upgrades" class="view">
      <h2>Upgrades ${infoTip("One-time lessons for the light. Most are forgotten when you Rekindle; the ones marked ♾\uFE0E are keeper knowledge and are kept.", "About upgrades")}</h2>
      <p class="muted"><span id="upgrades-summary"></span></p>
      <div class="section-head">
        <h3 class="section-title">Ready to learn</h3>
        <div class="section-actions">
          <span class="auto-switch hidden" id="qm-switch">
            <span class="buy-toggle-label">Quartermaster</span>
            <button class="toggle-btn" data-auto="autoLearn" aria-pressed="true">On</button>
          </span>
          <button id="learn-all" class="buy" disabled>Learn all affordable</button>
        </div>
      </div>
      <div id="upgrades-available" class="lesson-grid"></div>
      <h3 class="section-title">Not yet discovered</h3>
      <div id="upgrades-locked" class="lesson-grid locked-grid"></div>
      <h3 class="section-title">Learned</h3>
      <div id="upgrades-purchased" class="lesson-shelf"></div>
    </section>

    <section id="view-lighthouses" class="view">
      <h2>The Seven Lighthouses ${infoTip("Lit lighthouses stay lit forever, even through a Rekindle. Their supply chains don't: every board is stripped back to its starting levels when the light gutters. They relight in order, and each demands a beam running at its efficiency. Feed the chain from the supply strip on the Light view; the boards below show it lighthouse by lighthouse.", "About the lighthouses")}</h2>
      <div class="coast">
        <canvas id="coast-canvas" aria-hidden="true"></canvas>
        <div id="coast-pins" class="coast-pins"></div>
      </div>
      <div id="ending-panel"></div>
      <div id="lighthouse-list" class="card-list"></div>
      <h3 class="section-title" id="chain-title">Supply Chain — Wick → Oil → Lens → Beam</h3>
      <div class="chain-flow"><canvas id="chain-flow-canvas" aria-hidden="true"></canvas></div>
      <div id="chain-area"></div>
    </section>

    <section id="view-shore" class="view">
      <div class="shore-head">
        <h2>The Shore ${infoTip("What the glass sea gives back. Moths, relics and story fragments are permanent: they roost through every Rekindle.", "About the Shore")}</h2>
        <div class="buy-toggle shore-panes" role="tablist" aria-label="The Shore">
          <button class="toggle-btn active" data-pane="garden" role="tab" aria-selected="true">${GLYPHS.moth} Moth Garden<span class="pane-dot hidden" id="garden-dot"></span></button>
          <button class="toggle-btn" data-pane="sea" role="tab" aria-selected="false">${GLYPHS.bottle} Bottles &amp; Relics<span class="pane-dot hidden" id="sea-dot"></span></button>
        </div>
      </div>
      <p id="shore-offering" class="shore-offering hidden"></p>
      <div class="shore-pane active" id="pane-garden">
        <div id="roost-bar"></div>
        <div class="garden-grid">
          <div id="moth-area" class="garden-main"></div>
          <aside class="garden-side">
            <div class="meadow"><canvas id="meadow-canvas" aria-hidden="true"></canvas></div>
            <div id="garden-side"></div>
          </aside>
        </div>
      </div>
      <div class="shore-pane" id="pane-sea">
        <h3 class="section-title">Bottle Expeditions</h3>
        <div id="expedition-area"></div>
        <h3 class="section-title">Relics of the Glass Sea</h3>
        <div id="relic-shelf" class="relic-cabinet"></div>
      </div>
    </section>

    <section id="view-rekindle" class="view">
      <h2>Rekindle ${infoTip("Let the light gutter out and light it again, stronger. Embers are banked from this run's lifetime Lumen: √(lifetime ÷ 5,000). Each Ember you hold adds +2% to all production.", "About Rekindling")}</h2>
      <div class="card hearth" id="rk-hearth">
        <div class="hearth-top">
          <div class="hearth-art">${HEARTH_ART}<span class="hearth-spark"></span><span class="hearth-spark"></span><span class="hearth-spark"></span></div>
          <div class="hearth-numbers">
            <div class="hearth-gain"><span class="stat-label">Rekindle now and bank</span><strong id="rk-gain">0</strong><span class="hearth-unit">Embers</span></div>
            <div class="hearth-compare">
              <div><span class="stat-label">Production bonus now</span><strong id="rk-bonus">+0%</strong></div>
              <div class="hearth-arrow" aria-hidden="true">→</div>
              <div><span class="stat-label">After Rekindle</span><strong id="rk-after">+0%</strong></div>
            </div>
            <p class="hearth-relative" id="rk-relative"></p>
          </div>
        </div>
        <div class="row"><span id="rk-held-label">Embers held</span><strong id="rk-held">0</strong></div>
        <div class="row"><span>Embers earned all-time</span><strong id="rk-total">0</strong></div>
        <div class="row"><span>Time to recover your current Lumen/s</span><strong id="rk-recovery">—</strong></div>
        <div class="progress-wrap">
          <div class="progress-label" id="rk-progress-label"></div>
          <div class="progress"><div id="rk-progress-bar" class="progress-bar"></div></div>
        </div>
        <div class="kept-lost">
          <div><h3>Kept</h3><ul id="rk-kept"></ul></div>
          <div><h3>Lost</h3><ul id="rk-lost"></ul></div>
        </div>
        <button id="rk-button" class="danger">Rekindle the Light</button>
        <p class="muted rk-flare" id="rk-flare" aria-live="polite"></p>
      </div>

      <h3 class="section-title">Ember Shop ${infoTip("Spend held Embers on permanent perks. Every Ember spent lowers your held-Ember production bonus: that's the trade.", "About the Ember Shop")}</h3>
      <div class="shop-head">
        <p class="muted"><span id="shop-held"></span></p>
        <button class="buy" id="kindle-all" disabled>Kindle all under 1%</button>
      </div>
      <div id="ember-shop" class="ember-shop"></div>

      <h3 class="section-title">Challenges ${infoTip("Opt-in rule-changing runs. Starting one resets your run like a Rekindle, but grants no Embers, and your held Embers rest (no production bonus) until it ends. Reach the goal to bank a permanent reward; the run then continues. Abandoning resets the run with no reward.", "About challenges")}</h3>
      <div id="challenges" class="trial-list"></div>
    </section>

    <section id="view-log" class="view">
      <h2>The Story So Far</h2>
      <div id="story-area"></div>
      <h2>Keeper's Log</h2>
      <ul id="log-list" class="log-list"></ul>
      <h3 class="section-title">Keeper's Desk</h3>
      <div class="card desk">
        <div class="row"><span>New here, or need a refresher?</span><button class="buy" id="desk-tutorial">How to play</button></div>
        <div class="row"><span>Number notation</span>
          <span class="buy-toggle desk-toggle">
            <button class="toggle-btn" id="notation-standard">Standard (1.23M, then 1.23e15)</button>
            <button class="toggle-btn" id="notation-scientific">Scientific (1.23e6)</button>
          </span>
        </div>
        <p class="muted">Your save lives in this browser. Export it before clearing site data — or carry it to the Steam build one day (see docs/STEAM.md in the repo).</p>
        <textarea id="desk-save-text" class="desk-text" rows="6" spellcheck="false" placeholder="Exported save JSON appears here. To import, paste a save here and press Import."></textarea>
        <div class="shore-actions">
          <button class="buy" id="desk-export">Export save</button>
          <button class="buy" id="desk-copy">Copy</button>
          <button class="buy" id="desk-import">Import save</button>
        </div>
        <p class="muted" id="desk-status"></p>
        <button id="desk-reset" class="danger">Hard reset — erase everything and start over</button>
      </div>
    </section>
  </main>

  <div id="moment" class="moment hidden" role="dialog" aria-modal="true" aria-labelledby="moment-title">
    <canvas id="moment-canvas" aria-hidden="true"></canvas>
    <div class="moment-text">
      <div class="moment-eyebrow" id="moment-eyebrow"></div>
      <h2 id="moment-title"></h2>
      <p id="moment-body"></p>
      <button class="buy affordable" id="moment-continue">Continue</button>
    </div>
  </div>
`;

// ── Tab switching ────────────────────────────────────────────────────────────
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
let activeTab = "light";
function activateTab(name: string): void {
  activeTab = name;
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelector(`#view-${name}`)?.classList.add("active");
  // Opening the Rekindle view always gets a fresh recovery estimate.
  if (name === "rekindle") recoveryKey = "";
  renderDynamic();
  syncSceneRunning();
}
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    if (tab.dataset.tab) activateTab(tab.dataset.tab);
  });
}

// The challenge banner in the Light view jumps to the Rekindle view.
const challengeBanner = document.querySelector<HTMLDivElement>("#challenge-banner");
challengeBanner?.addEventListener("click", () => activateTab("rekindle"));
challengeBanner?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") activateTab("rekindle");
});

// ── Buy-amount toggle (persisted in the save) ────────────────────────────────
// Only the ×1/×10/×100/Max buttons: other pill toggles (notation, the
// Shore's panes) share the look but must never set the buy amount.
const toggleBtns = Array.from(document.querySelectorAll<HTMLButtonElement>(".toggle-btn[data-amount]"));
for (const btn of toggleBtns) {
  btn.addEventListener("click", () => {
    const raw = btn.dataset.amount;
    state.buyAmount = raw === "max" ? "max" : (Number(raw) as BuyAmount);
    saveState(state);
    renderDynamic();
  });
}

// ── Generator rows (built once, updated in place) ────────────────────────────
interface GenRow {
  def: GeneratorDef;
  row: HTMLElement;
  ring: SVGCircleElement;
  owned: HTMLElement;
  prod: HTMLElement;
  /** The icon with its milestone ring: its tip says how far the next ×2 is. */
  milestone: HTMLElement;
  /** "+X Lumen/s", "affordable in …", or "⚠ beam 100% → 84% · feed Oil" when buying would starve the chain. */
  note: HTMLElement;
  buy: HTMLButtonElement;
}

const genRows: GenRow[] = [];
const genList = document.querySelector<HTMLDivElement>("#generators");
if (genList) {
  for (const def of GENERATORS) {
    const row = document.createElement("div");
    row.className = "gen";
    row.innerHTML = `
      <div class="gen-icon">
        ${GENERATOR_ICONS[def.id] ?? UNKNOWN_ICON}
        <svg class="gen-ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="gen-ring-track" cx="24" cy="24" r="22"/><circle class="gen-ring-fill" cx="24" cy="24" r="22" pathLength="100"/></svg>
      </div>
      <div class="gen-main">
        <div class="gen-name"><span class="gen-title"${tipAttr(def.flavor)}>${def.name}</span> <span class="gen-owned"></span></div>
        <div class="gen-prod muted"></div>
      </div>
      <div class="gen-buy">
        <button class="buy">Buy</button>
        <div class="gen-note muted"></div>
      </div>`;
    const buy = row.querySelector<HTMLButtonElement>(".buy");
    if (!buy) continue;
    buy.addEventListener("click", () => {
      if (buyWithAmount(state, def.id, state.buyAmount)) {
        sound.buy();
        row.classList.remove("bought");
        void row.offsetWidth; // restart the purchase pulse
        row.classList.add("bought");
        saveState(state);
        renderDynamic();
      }
    });
    genList.appendChild(row);
    setTip(row.querySelector(".gen-prod") as HTMLElement, `What ${def.name}s add to your Lumen/s: their own light, carried through the lighthouses, the supply chain, the Beam and the lamp. The rows add up to the total at the top.`);
    genRows.push({
      def,
      row,
      ring: row.querySelector(".gen-ring-fill") as SVGCircleElement,
      owned: row.querySelector(".gen-owned") as HTMLElement,
      prod: row.querySelector(".gen-prod") as HTMLElement,
      milestone: row.querySelector(".gen-icon") as HTMLElement,
      note: row.querySelector(".gen-note") as HTMLElement,
      buy,
    });
  }
}

// Tiers reveal one at a time: every tier up to one past the highest you own,
// then a single silhouette hinting that the coast goes further.
const genTeaser = document.createElement("div");
genTeaser.className = "gen gen-teaser";
genTeaser.innerHTML = `<div class="gen-icon">${UNKNOWN_ICON}</div><div class="gen-main"><div class="gen-name">Something further out</div><div class="gen-flavor teaser-text"></div></div>`;
genList?.appendChild(genTeaser);
const genTeaserText = genTeaser.querySelector<HTMLElement>(".teaser-text");

/** Highest generator tier index owned this run (−1 for none). */
function highestTierOwned(): number {
  let highest = -1;
  GENERATORS.forEach((def, i) => {
    if ((state.generators[def.id] ?? 0) > 0) highest = i;
  });
  return highest;
}

/** 0–1 progress from the last milestone toward the next (1 once all are reached). */
function milestoneProgress(owned: number): number {
  const next = MILESTONE_THRESHOLDS.find((t) => owned < t);
  if (next === undefined) return 1;
  const prev = [...MILESTONE_THRESHOLDS].reverse().find((t) => t <= owned) ?? 0;
  return (owned - prev) / (next - prev);
}

function milestoneHint(owned: number): string {
  const next = MILESTONE_THRESHOLDS.find((t) => owned < t);
  if (next === undefined) return `All milestones reached — production ×${milestoneMultiplier(owned)}`;
  return `Next ×2 at ${next} — ${owned}/${next}`;
}

// ── Upgrades view: the keeper's lesson book ─────────────────────────────────
// Rebuilt when the unlocked/owned structure changes; affordability, time to
// afford and unlock progress refresh in place every frame.
interface UpgradeRow {
  def: UpgradeDef;
  buy: HTMLButtonElement;
  note: HTMLElement;
}
interface LockedUpgradeRow {
  def: UpgradeDef;
  bar: HTMLElement;
}

const upgradeContainers = {
  available: document.querySelector<HTMLDivElement>("#upgrades-available"),
  locked: document.querySelector<HTMLDivElement>("#upgrades-locked"),
  purchased: document.querySelector<HTMLDivElement>("#upgrades-purchased"),
};
const upgradesSummary = document.querySelector<HTMLElement>("#upgrades-summary");
let availableUpgradeRows: UpgradeRow[] = [];
let lockedUpgradeRows: LockedUpgradeRow[] = [];
let upgradeStructureKey: string | null = null;
/** How many undiscovered lessons to show as silhouettes (the nearest first). */
const LOCKED_LESSONS_SHOWN = 6;

function upgradesStructureKey(): string {
  return UPGRADES.map((u) =>
    state.upgrades.includes(u.id) ? "P" : isUnlocked(state, u) ? "A" : "L",
  ).join("");
}

/** The art for a lesson: its generator, the beam's lens, a lighthouse, or a keeper-wide mark. */
function lessonIcon(def: UpgradeDef): string {
  if ((def.kind === "generator" || def.kind === "synergy") && def.generatorId) return GENERATOR_ICONS[def.generatorId] ?? UNKNOWN_ICON;
  if (def.kind === "click" || def.kind === "echo") return CLICK_ICON;
  if (def.kind === "lighthouse") return TAB_ICONS.lighthouses;
  return GLOBAL_UPGRADE_ICONS[def.id] ?? UNKNOWN_ICON;
}

const LESSON_ROMAN = ["I", "II", "III", "IV", "V"];

/** Where a lesson belongs: "Candle Crab · lesson III", "Flash the Beam · echo 2", "Gull Rock Light · lesson". */
function lessonKind(def: UpgradeDef): string {
  const genName = (id?: string) => GENERATORS.find((g) => g.id === id)?.name ?? "Helper";
  if (def.kind === "generator") return `${genName(def.generatorId)} · lesson\u00a0${LESSON_ROMAN[generatorUpgradeTier(def) - 1]}`;
  if (def.kind === "click") return `Flash the Beam · tier\u00a0${def.id.replace("click-", "")}`;
  if (def.kind === "echo") return `Flash the Beam · echo\u00a0${def.id.replace("echo-", "")}`;
  if (def.kind === "synergy") return `${genName(def.generatorId)} · with ${genName(def.sourceId)}`;
  if (def.kind === "lighthouse" && def.unlock.kind === "lighthouse-lit") return `${chainLighthouseById(def.unlock.lighthouseId).name} · lesson`;
  return "Keeper-wide";
}

/** The seal on a lesson's art: what it's worth at a glance ("×3", "+1%/copy"), or none. */
function lessonSeal(def: UpgradeDef): string {
  if (def.kind === "click") return "×2";
  if (def.kind === "generator") return `×${def.multiplier ?? 2}`;
  if (def.kind === "echo") return `+${Math.round((def.echoShare ?? 0) * 100)}%`;
  if (def.kind === "synergy") return `+${Math.round((def.perCopy ?? 0) * 100)}%`;
  const m = def.multiplier ?? def.supportMultiplier ?? def.beamMultiplier ?? def.productionMultiplier ?? def.emberGainMultiplier;
  return def.kind === "lighthouse" && m ? `×${m}` : "";
}

function rebuildUpgrades(): void {
  availableUpgradeRows = [];
  lockedUpgradeRows = [];
  for (const container of Object.values(upgradeContainers)) {
    if (container) container.innerHTML = "";
  }
  const learned = UPGRADES.filter((u) => state.upgrades.includes(u.id));
  const available = UPGRADES.filter((u) => !state.upgrades.includes(u.id) && isUnlocked(state, u)).sort((a, b) => a.cost - b.cost);
  const locked = UPGRADES.filter((u) => !state.upgrades.includes(u.id) && !isUnlocked(state, u)).sort(
    (a, b) => unlockProgress(state, b) - unlockProgress(state, a),
  );

  if (upgradesSummary) {
    const kept = learned.filter((u) => u.permanent).length;
    upgradesSummary.textContent = `${learned.length} of ${UPGRADES.length} lessons learned${kept ? ` · ${kept} kept through every Rekindle` : ""}.`;
  }

  for (const def of available) {
    const card = document.createElement("article");
    card.className = `lesson${def.permanent ? " permanent" : ""}`;
    const sealText = lessonSeal(def);
    const seal = sealText ? `<span class="lesson-seal">${sealText}</span>` : "";
    card.innerHTML = `
      <div class="lesson-art">${lessonIcon(def)}${seal}</div>
      <div class="lesson-body">
        <div class="lesson-kind">${lessonKind(def)}</div>
        <h4 class="lesson-name">${def.name}</h4>
        <p class="lesson-effect">${def.effect}</p>
        ${def.permanent ? `<p class="lesson-perm">♾\uFE0E Keeper knowledge — kept through every Rekindle</p>` : ""}
      </div>
      <div class="lesson-foot">
        <span class="lesson-cost">${fmt(def.cost)} Lumen</span>
        <button class="buy">Learn</button>
      </div>
      <div class="lesson-note"></div>`;
    const buy = card.querySelector<HTMLButtonElement>(".buy");
    const note = card.querySelector<HTMLElement>(".lesson-note");
    if (!buy || !note) continue;
    buy.addEventListener("click", () => {
      if (buyUpgrade(state, def.id)) {
        sound.chime();
        saveState(state);
        renderDynamic();
      }
    });
    upgradeContainers.available?.appendChild(card);
    availableUpgradeRows.push({ def, buy, note });
  }
  if (upgradeContainers.available && available.length === 0) {
    upgradeContainers.available.innerHTML = `<p class="muted">Nothing to learn right now — grow the light and new lessons will surface.</p>`;
  }

  // Undiscovered lessons: the nearest few, each with a bar toward its unlock.
  for (const def of locked.slice(0, LOCKED_LESSONS_SHOWN)) {
    const card = document.createElement("article");
    card.className = "lesson locked";
    card.innerHTML = `
      <div class="lesson-art">${UNKNOWN_ICON}</div>
      <div class="lesson-body">
        <div class="lesson-kind">Undiscovered</div>
        <p class="lesson-effect">${unlockText(def)}</p>
        <div class="progress thin"><div class="progress-bar"></div></div>
      </div>`;
    const bar = card.querySelector<HTMLElement>(".progress-bar");
    if (bar) lockedUpgradeRows.push({ def, bar });
    upgradeContainers.locked?.appendChild(card);
  }
  if (upgradeContainers.locked) {
    if (locked.length === 0) {
      upgradeContainers.locked.innerHTML = `<p class="muted">Every lesson has surfaced.</p>`;
    } else if (locked.length > LOCKED_LESSONS_SHOWN) {
      const more = document.createElement("p");
      more.className = "muted lesson-more";
      more.textContent = `…and ${locked.length - LOCKED_LESSONS_SHOWN} more still out in the dark.`;
      upgradeContainers.locked.appendChild(more);
    }
  }

  // Learned: a compact shelf; the effect is in each chip's tooltip.
  for (const def of learned) {
    const chip = document.createElement("div");
    chip.className = `lesson-chip${def.permanent ? " permanent" : ""}`;
    chip.title = def.effect;
    chip.innerHTML = `<span class="lesson-chip-icon">${lessonIcon(def)}</span><span class="lesson-chip-name">${def.name}</span><span class="lesson-chip-mark">${def.permanent ? "♾\uFE0E" : "✓"}</span>`;
    upgradeContainers.purchased?.appendChild(chip);
  }
  if (upgradeContainers.purchased && learned.length === 0) {
    upgradeContainers.purchased.innerHTML = `<p class="muted">No lessons learned yet.</p>`;
  }
}

// ── Ember Shop: illustrated perk cards (rebuilt on ownership change) ─────────
// Every view's structure key starts as null ("never built"), not "": a
// keeper with no perks has an empty key, and an empty starting key once meant
// the shop never built at all until a perk was owned — which needed the shop.
interface ShopRow {
  /** Embers the next purchase costs (Infinity once there is nothing left to buy). */
  cost: () => number;
  buy: HTMLButtonElement;
  warning: HTMLElement;
}
const shopContainer = document.querySelector<HTMLDivElement>("#ember-shop");
let shopRows: ShopRow[] = [];
let shopStructureKey: string | null = null;

function emberShopKey(): string {
  return `${state.emberPerks.join(",")}|${KINDLINGS.map((k) => kindlingLevel(state, k.id)).join(",")}|${state.autoLearn}|${state.autoHire}|${state.litLighthouses.length}`;
}

/** The total effect a Kindling's levels give, in words ("×2.25 production"). */
function kindlingTotal(def: KindlingDef, level: number): string {
  if (level === 0) return "Not kindled yet";
  switch (def.id) {
    case "ember-glow":
      return `Now: all production +${Math.round((def.factor ** level - 1) * 100)}%`;
    case "quick-lures":
    case "spinning-silk":
      return `Now: ${Math.round((1 - def.factor ** level) * 100)}% less waiting`;
    case "tailwind":
      return `Now: relic chance +${Math.round(tailwindRelicBonus(state) * 100)} points`;
    case "long-watch":
      return `Now: offline cap +${level} hour${level === 1 ? "" : "s"}`;
    default:
      return `Level ${level}`;
  }
}

function rebuildEmberShop(): void {
  shopRows = [];
  if (!shopContainer) return;
  shopContainer.innerHTML = "";
  const shelf = (title: string, note: string): HTMLDivElement => {
    const head = document.createElement("h4");
    head.className = "shelf-title";
    head.innerHTML = `${title} ${infoTip(note, `About ${title}`)}`;
    const grid = document.createElement("div");
    grid.className = "perk-grid";
    shopContainer.append(head, grid);
    return grid;
  };
  const addRow = (card: HTMLElement, cost: () => number, onBuy: () => boolean) => {
    const buy = card.querySelector<HTMLButtonElement>(".buy");
    const warning = card.querySelector<HTMLElement>(".perk-warning");
    if (!buy || !warning) return;
    buy.addEventListener("click", () => {
      if (onBuy()) {
        sound.chime();
        saveState(state);
        renderDynamic();
      }
    });
    shopRows.push({ cost, buy, warning });
  };

  const perkCard = (def: EmberPerkDef): HTMLElement => {
    const owned = state.emberPerks.includes(def.id);
    const open = perkOpen(state, def);
    const card = document.createElement("article");
    card.className = `perk${owned ? " owned" : ""}${open ? "" : " shut"}`;
    const foot = owned
      ? `<span class="learned">Kindled ✓ · permanent</span>`
      : open
        ? `<span class="perk-cost">${EMBER_GLYPH}${fmt(def.costEmbers)}</span><button class="buy">Kindle</button>`
        : `<span class="perk-cost">${EMBER_GLYPH}${fmt(def.costEmbers)}</span><span class="muted">Opens when Siren's Rest burns</span>`;
    card.innerHTML = `
      <div class="perk-art">${PERK_ICONS[def.id] ?? UNKNOWN_ICON}</div>
      <div class="perk-body">
        <h4 class="perk-name">${def.name}</h4>
        <p class="perk-effect">${def.effect}</p>
        ${owned || !open ? "" : `<p class="perk-warning"></p>`}
      </div>
      <div class="perk-foot">${foot}</div>`;
    if (!owned && open) addRow(card, () => def.costEmbers, () => buyPerk(state, def.id));
    return card;
  };

  const keeper = shelf("Keeper's perks", "One-time perks, kept forever.");
  for (const def of EMBER_PERKS.filter((p) => p.shelf === "keeper")) keeper.appendChild(perkCard(def));

  const kindlings = shelf("Kindlings", "Repeatable perks: every level adds the same again, and the next costs more. There's always one more to kindle.");
  for (const def of KINDLINGS) {
    const level = kindlingLevel(state, def.id);
    const maxed = def.maxLevel !== undefined && level >= def.maxLevel;
    const card = document.createElement("article");
    card.className = `perk kindling${level > 0 ? " owned" : ""}`;
    card.innerHTML = `
      <div class="perk-art">${KINDLING_ICONS[def.id] ?? UNKNOWN_ICON}</div>
      <div class="perk-body">
        <h4 class="perk-name">${def.name} <span class="kindling-level">${level > 0 ? `Level ${level}${def.maxLevel !== undefined ? ` of ${def.maxLevel}` : ""}` : ""}</span></h4>
        <p class="perk-effect">${def.perLevel} per level.</p>
        <p class="kindling-total">${kindlingTotal(def, level)}</p>
        ${maxed ? "" : `<p class="perk-warning"></p>`}
      </div>
      <div class="perk-foot">${
        maxed
          ? `<span class="learned">Fully kindled ✓</span>`
          : `<span class="perk-cost">${EMBER_GLYPH}${fmt(kindlingCost(state, def.id))}</span><button class="buy">${level > 0 ? "Kindle again" : "Kindle"}</button>`
      }</div>`;
    if (!maxed) addRow(card, () => kindlingCost(state, def.id), () => buyKindling(state, def.id));
    kindlings.appendChild(card);
  }

  const late = shelf("Late perks", "One-time perks for a keeper deep in the game, priced ten times apart.");
  for (const def of EMBER_PERKS.filter((p) => p.shelf === "late")) late.appendChild(perkCard(def));

  const far = shelf("The far shelf", "Opens when Siren's Rest burns, for the long crossing to The Hollow Light: a quicker start to every run, and more from the moths on duty.");
  for (const def of EMBER_PERKS.filter((p) => p.shelf === "far")) far.appendChild(perkCard(def));
}
// The automation switches: beside Learn all affordable (the Quartermaster,
// with Gull Rock) and beside the buy amounts (the Lamp Crew, with
// Cormorant Roost).
document.addEventListener("click", (e) => {
  const btn = (e.target as Element | null)?.closest<HTMLButtonElement>("[data-auto]");
  if (!btn) return;
  const key = btn.dataset.auto === "autoLearn" ? "autoLearn" : "autoHire";
  state[key] = !state[key];
  saveState(state);
  renderDynamic();
});

// ── Challenges: illustrated trial cards (rebuilt on active/completed change)
const challengeContainer = document.querySelector<HTMLDivElement>("#challenges");
let challengeStructureKey: string | null = null;
interface ActiveChallengeRefs {
  bar: HTMLElement;
  label: HTMLElement;
}
let activeChallengeRefs: ActiveChallengeRefs | null = null;

function challengesStructureKey(): string {
  return `${state.activeChallenge ?? "-"}|${state.completedChallenges.join(",")}`;
}

function rebuildChallenges(): void {
  activeChallengeRefs = null;
  if (!challengeContainer) return;
  challengeContainer.innerHTML = "";
  const active = activeChallenge(state);

  for (const def of CHALLENGES) {
    const completed = state.completedChallenges.includes(def.id);
    const isActive = active?.id === def.id;
    const card = document.createElement("article");
    card.className = `trial${completed ? " completed" : ""}${isActive ? " active" : ""}`;
    let html = `
      <div class="trial-art">${CHALLENGE_ICONS[def.id] ?? UNKNOWN_ICON}</div>
      <div class="trial-body">
        <div class="trial-head">
          <h4 class="trial-name">${def.name}</h4>
          ${completed ? `<span class="trial-badge done">Completed</span>` : isActive ? `<span class="trial-badge live">Under way</span>` : ""}
        </div>
        <p class="trial-rule">${def.ruleText}</p>
        <dl class="trial-terms">
          <div><dt>Goal</dt><dd><span class="trial-goal" data-challenge="${def.id}">${fmt(challengeGoal(state, def))}</span> lifetime Lumen in one run${infoTip(`${fmt(def.goalLifetime)} for a new keeper, times your lasting bonuses other than Embers (perks, lit lighthouses), so it stays a real climb however strong you grow. Your Embers rest through a challenge run.`, "About the goal")}</dd></div>
          <div><dt>Reward</dt><dd><strong>${def.rewardName}</strong> — ${def.rewardText}</dd></div>
        </dl>`;

    if (completed) {
      html += `<p class="learned">${def.rewardName} banked forever ✓</p></div>`;
      card.innerHTML = html;
    } else if (isActive) {
      html += `
        <div class="progress-wrap">
          <div class="progress-label challenge-progress-label"></div>
          <div class="progress"><div class="progress-bar challenge-progress-bar"></div></div>
        </div>
        <button class="danger challenge-abandon">Abandon challenge</button></div>`;
      card.innerHTML = html;
      const bar = card.querySelector<HTMLElement>(".challenge-progress-bar");
      const label = card.querySelector<HTMLElement>(".challenge-progress-label");
      if (bar && label) activeChallengeRefs = { bar, label };
      const abandon = card.querySelector<HTMLButtonElement>(".challenge-abandon");
      if (abandon) {
        armTwoStep(abandon, "Are you sure? Click again to abandon — the run resets, no reward", () => {
          if (abandonChallenge(state)) {
            saveState(state);
            renderDynamic();
          }
        });
      }
    } else {
      html += `<button class="buy challenge-start" ${active ? "disabled" : ""}>Start challenge — resets your run; your Embers rest</button>
        ${active ? `<div class="gen-note muted">Finish or abandon ${active.name} first.</div>` : ""}</div>`;
      card.innerHTML = html;
      const start = card.querySelector<HTMLButtonElement>(".challenge-start");
      if (start) {
        armTwoStep(start, "Are you sure? Click again — your run resets and no Embers are granted", () => {
          if (startChallenge(state, def.id)) {
            saveState(state);
            renderDynamic();
          }
        });
      }
    }
    challengeContainer.appendChild(card);
  }
}

// ── The Shore: moth garden, bottle expeditions, relic shelf (Sprint 4) ──────
// Cards are rebuilt when their structure changes (a moth arrives, a cocoon
// starts, a bottle goes out or comes home); costs, countdowns and button
// states refresh in place every frame.
const mothArea = document.querySelector<HTMLDivElement>("#moth-area");
const roostBar = document.querySelector<HTMLDivElement>("#roost-bar");
const gardenSide = document.querySelector<HTMLDivElement>("#garden-side");
/** The moth whose details and actions show under the roster ("" = none). */
let selectedMoth = "";

// The Shore's two panes: the moth garden, and bottles & relics.
const shorePaneButtons = [...document.querySelectorAll<HTMLButtonElement>(".shore-panes [data-pane]")];
for (const btn of shorePaneButtons) {
  btn.addEventListener("click", () => {
    for (const b of shorePaneButtons) {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
      document.querySelector(`#pane-${b.dataset.pane}`)?.classList.toggle("active", on);
    }
  });
}
const expeditionArea = document.querySelector<HTMLDivElement>("#expedition-area");
const relicShelf = document.querySelector<HTMLDivElement>("#relic-shelf");
let shoreStructureKey: string | null = null;
let breedParentA = "";
let breedParentB = "";
/** The moth chosen to ride the next bottle ("" = none). */
let bottleRider = "";

interface ShoreRefs {
  attractBtn: HTMLButtonElement | null;
  attractNote: HTMLElement | null;
  scentedBtn: HTMLButtonElement | null;
  roostBtn: HTMLButtonElement | null;
  roostNote: HTMLElement | null;
  /** One row per cocoon spinning, by its place in state.cocoons. */
  cocoonRows: { index: number; note: HTMLElement | null; bar: HTMLElement | null; btn: HTMLButtonElement | null }[];
  hatchAllBtn: HTMLButtonElement | null;
  expeditionNote: HTMLElement | null;
  claimBtn: HTMLButtonElement | null;
  sendBtns: { routeId: string; btn: HTMLButtonElement; note: HTMLElement | null }[];
}
let shoreRefs: ShoreRefs = {
  attractBtn: null, attractNote: null, scentedBtn: null, roostBtn: null, roostNote: null,
  cocoonRows: [], hatchAllBtn: null, expeditionNote: null, claimBtn: null, sendBtns: [],
};

/** ", Seeker" / ", Seeker, Fertile" for a moth's select option; "" with no trait. */
function traitList(moth: Moth): string {
  return traitsOf(moth).map((t) => `, ${t.name}`).join("");
}

function shoreKey(): string {
  return [
    mothsUnlocked(state) ? "U" : "L",
    state.moths.map((m) => m.id).join(","),
    state.mothDuty.join(","),
    Object.entries(state.mothPosts).map(([l, m]) => `${l}=${m}`).join(","),
    state.litLighthouses.join(","),
    state.roostExpansions,
    state.almanac.length,
    selectedMoth,
    state.moths.map((m) => `${m.trait ?? ""}+${m.trait2 ?? ""}`).join(","),
    state.cocoons.map((c) => `${c.parentIds.join("+")}@${c.readyAt}`).join(",") || "-",
    nestCount(state),
    state.expedition ? `${state.expedition.routeId}@${state.expedition.returnsAt}:${state.expedition.riderId ?? ""}` : "-",
    state.relics.join(","),
    state.bottleRoute ?? "-",
    state.emberPerks.includes("glass-charts") ? "G" : "-",
  ].join("|");
}

function rebuildShore(): void {
  shoreRefs = {
    attractBtn: null, attractNote: null, scentedBtn: null, roostBtn: null, roostNote: null,
    cocoonRows: [], hatchAllBtn: null, expeditionNote: null, claimBtn: null, sendBtns: [],
  };

  // ── Moth Garden ──
  // Desktop: a one-line roost bar; under it, the roster (compact tiles, one
  // detail strip for the selected moth) beside a side column (meadow,
  // cocoon or breeding, lighthouse posts). Rules live behind ⓘ buttons and
  // the full Almanac in a dialog, so the garden fits on one screen.
  if (mothArea && roostBar && gardenSide) {
    mothArea.innerHTML = "";
    gardenSide.innerHTML = "";
    roostBar.innerHTML = "";
    if (!mothsUnlocked(state)) {
      mothArea.innerHTML = `
        <div class="card">
          <div class="gen-name">${GLYPHS.lock} The roost is quiet</div>
          <p class="muted">Hire a Lantern Moth (the second helper, in the Light view) and the wild moths of the glass sea will start following your light home. Collect them, set the brightest on duty, and breed new wings.</p>
        </div>`;
    } else {
      if (!state.moths.some((m) => m.id === selectedMoth)) selectedMoth = "";
      buildRoostBar(roostBar);
      buildRoster(mothArea);
      buildBreeding(gardenSide);
      buildPosts(gardenSide);
    }
  }

  // ── Expeditions ──
  if (expeditionArea) {
    expeditionArea.innerHTML = "";
    if (state.expedition) {
      const route = routeById(state.expedition.routeId);
      const card = document.createElement("div");
      card.className = "card challenge active";
      const rider = riderOf(state);
      card.innerHTML = `
        <div class="gen-name">${GLYPHS.bottle} Out at sea — ${route?.name ?? "an unknown route"}</div>
        ${rider ? `<p class="muted">${rider.name} rides on the cork.</p>` : ""}
        ${hasPerk(state, "glass-charts") ? `<p class="muted">Glass Charts: when it washes home it's claimed and sets out again on ${routeById(state.bottleRoute ?? "")?.name ?? route?.name ?? "the same route"}. Choose another route below for the next voyage.</p>` : ""}
        <p class="muted expedition-note"></p>
        <button class="buy expedition-claim">Claim the bottle</button>`;
      shoreRefs.expeditionNote = card.querySelector<HTMLElement>(".expedition-note");
      shoreRefs.claimBtn = card.querySelector<HTMLButtonElement>(".expedition-claim");
      shoreRefs.claimBtn?.addEventListener("click", () => {
        const route = routeById(state.expedition?.routeId ?? "");
        const chance = route ? relicChanceFor(state, route) : 0;
        const claim = claimExpedition(state, Math.random);
        if (claim) {
          sound.chime();
          saveState(state);
          renderDynamic();
          if (route) openBottleSplash(claim, route.name, chance);
        }
      });
      expeditionArea.appendChild(card);
    }
    // A moth to ride the next bottle.
    const riders = state.moths.filter((m) => !isCocoonParent(state, m.id));
    if (!riders.some((m) => m.id === bottleRider)) bottleRider = "";
    const chosenRider = (): Moth | null => riders.find((m) => m.id === bottleRider) ?? null;
    const chanceSpans: { route: (typeof EXPEDITION_ROUTES)[number]; el: HTMLElement | null }[] = [];
    if (!state.expedition && riders.length > 0) {
      const pick = document.createElement("div");
      pick.className = "card";
      pick.innerHTML = `
        <div class="gen-name">${GLYPHS.moth} A rider for the bottle</div>
        <p class="muted">A moth can ride along: relic chance + glow ÷ 10 points (a Seeker adds 10 more). It leaves duty and its post for the trip. On the Deep Glass Crossing, a moth without a trait comes home with one 1 time in 10.</p>
        <select class="breed-select rider-select"><option value="">No rider</option>${riders
          .map((m) => `<option value="${m.id}">${m.name} (glow ${m.glow}${traitList(m)})</option>`)
          .join("")}</select>`;
      const select = pick.querySelector<HTMLSelectElement>(".rider-select");
      if (select) {
        select.value = bottleRider;
        select.addEventListener("change", () => {
          bottleRider = select.value;
          for (const { route, el } of chanceSpans) if (el) el.textContent = `${Math.round(relicChanceFor(state, route, chosenRider()) * 100)}%`;
        });
      }
      expeditionArea.appendChild(pick);
    }
    const routes = document.createElement("div");
    routes.className = "card-list";
    for (const route of EXPEDITION_ROUTES) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="gen-name">${route.name}</div>
        <p class="muted">${route.flavor}</p>
        <p class="muted">${formatDuration(voyageMs(state, route) / 1000)} · relic chance <span class="route-chance">${Math.round(relicChanceFor(state, route, state.expedition ? riderOf(state) : chosenRider()) * 100)}%</span> · cache at least ${fmt(route.minCache)} Lumen</p>
        <button class="buy route-send">Send a bottle — ${fmt(route.cost)} Lumen</button>
        <span class="gen-note muted route-note"></span>`;
      const btn = card.querySelector<HTMLButtonElement>(".route-send");
      const note = card.querySelector<HTMLElement>(".route-note");
      chanceSpans.push({ route, el: card.querySelector<HTMLElement>(".route-chance") });
      if (btn) {
        btn.addEventListener("click", () => {
          // With Glass Charts and a bottle at sea, the button sets the next voyage's route.
          if (state.expedition && hasPerk(state, "glass-charts")) {
            state.bottleRoute = route.id;
            sound.chime();
            saveState(state);
            renderDynamic();
            return;
          }
          if (sendExpedition(state, route.id, Date.now(), bottleRider || undefined)) {
            bottleRider = "";
            sound.buy();
            saveState(state);
            renderDynamic();
          }
        });
        shoreRefs.sendBtns.push({ routeId: route.id, btn, note });
      }
      routes.appendChild(card);
    }
    expeditionArea.appendChild(routes);
  }

  // ── Relic shelf ──
  if (relicShelf) {
    relicShelf.innerHTML = "";
    for (const relic of RELICS) {
      const owned = state.relics.includes(relic.id);
      const card = document.createElement("div");
      card.className = `relic${owned ? " owned" : ""}`;
      card.innerHTML = owned
        ? `<div class="relic-icon">${RELIC_ICONS[relic.id] ?? UNKNOWN_ICON}</div><div class="relic-name">${relic.name}</div><p class="relic-effect">${relic.effect}</p>`
        : `<div class="relic-icon">${UNKNOWN_ICON}</div><div class="relic-name">Still at sea</div><p class="relic-effect">Bottles bring relics home.</p>`;
      relicShelf.appendChild(card);
    }
  }
}

// ── Moth Garden builders ─────────────────────────────────────────────────────

/** Re-render the Shore and the HUD after a moth action. */
function mothChanged(chime = false): void {
  if (chime) sound.chime();
  saveState(state);
  renderDynamic();
}

function infoButton(label: string, pages: () => SplashPage[]): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "info-btn";
  btn.type = "button";
  btn.textContent = "ⓘ";
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.addEventListener("click", () => splash.open(pages(), { kind: "tutorial", finishLabel: "Got it" }));
  return btn;
}

function buildRoostBar(host: HTMLElement): void {
  const bar = document.createElement("div");
  bar.className = "card roost-bar";
  bar.innerHTML = `
    <div class="roost-stats">
      <span class="gen-name">${GLYPHS.moth} The Roost</span>
      <span class="muted moth-roost-line"></span>
    </div>
    <div class="roost-actions">
      <button class="buy moth-attract">Attract</button>
      <button class="buy moth-scented">Scented lure</button>
      <button class="buy moth-roost">Expand</button>
      <button class="buy almanac-open">${GLYPHS.book} Almanac ${state.almanac.length}/${ALMANAC_SIZE}</button>
    </div>
    <div class="gen-note muted moth-attract-note"></div>
    <span class="moth-roost-note hidden"></span>`;
  shoreRefs.attractBtn = bar.querySelector(".moth-attract");
  shoreRefs.attractNote = bar.querySelector(".moth-attract-note");
  shoreRefs.scentedBtn = bar.querySelector(".moth-scented");
  shoreRefs.roostBtn = bar.querySelector(".moth-roost");
  shoreRefs.roostNote = bar.querySelector(".moth-roost-note");
  // One button for both: a lure when one is ready, a rush lure (Lumen) when not.
  shoreRefs.attractBtn?.addEventListener("click", () => {
    const moth = lureStatus(state).held > 0 ? attractMoth(state, Math.random) : rushAttractMoth(state, Math.random);
    if (moth) {
      selectedMoth = moth.id;
      mothChanged(true);
    }
  });
  shoreRefs.scentedBtn?.addEventListener("click", () => {
    const moth = scentedAttractMoth(state, Math.random);
    if (moth) {
      selectedMoth = moth.id;
      mothChanged(true);
    }
  });
  shoreRefs.roostBtn?.addEventListener("click", () => {
    if (expandRoost(state)) mothChanged();
  });
  bar.querySelector(".almanac-open")?.addEventListener("click", openAlmanac);
  host.appendChild(bar);
}

function buildRoster(host: HTMLElement): void {
  const onDuty = new Set(dutyMoths(state).map((m) => m.id));
  const roster = document.createElement("div");
  roster.className = "roster";
  if (state.moths.length === 0) {
    roster.innerHTML = `<p class="muted">No moths yet. Attract one — the first always remembers the way.</p>`;
  }
  for (const moth of state.moths) {
    const pattern = patternById(moth.pattern);
    const post = postOf(state, moth.id);
    const status = onDuty.has(moth.id)
      ? `<span class="tile-status duty" title="On duty">on duty</span>`
      : post
        ? `<span class="tile-status post" title="At ${chainLighthouseById(post).name}">posted</span>`
        : isAtSea(state, moth.id)
          ? `<span class="tile-status sea" title="Riding a bottle">at sea</span>`
          : "";
    const cocoon = isCocoonParent(state, moth.id) ? `<span class="tile-status cocoon" title="In the cocoon">${GLYPHS.cocoon}</span>` : "";
    const fill = Math.min(100, (moth.glow / pattern.glowCeiling) * 100);
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `moth-tile${moth.id === selectedMoth ? " selected" : ""}${onDuty.has(moth.id) || post ? " working" : ""}`;
    tile.setAttribute("aria-pressed", String(moth.id === selectedMoth));
    tile.innerHTML = `
      <span class="moth-swatch" style="background:${pattern.swatch}"></span>
      <span class="tile-main">
        <span class="tile-name">${wingDot(pattern.swatch, pattern.name)} ${moth.name}</span>
        <span class="tile-line">
          <span class="glow-meter" title="Glow ${moth.glow} of ${pattern.glowCeiling}"><span style="width:${fill.toFixed(0)}%"></span></span>
          <span class="glow-num">${moth.glow}</span>
          ${traitsOf(moth).map((t) => `<span class="moth-trait" title="${t.effect}">${t.name}</span>`).join("")}
        </span>
      </span>
      <span class="tile-flags">${status}${cocoon}</span>`;
    tile.addEventListener("click", () => {
      selectedMoth = selectedMoth === moth.id ? "" : moth.id;
      renderDynamic();
    });
    roster.appendChild(tile);
  }
  host.appendChild(roster);
  host.appendChild(mothDetail(onDuty));
}

/** The selected moth's details and actions (or a hint). */
function mothDetail(onDuty: Set<string>): HTMLElement {
  const card = document.createElement("div");
  card.className = "card moth-detail";
  const moth = mothById(state, selectedMoth);
  if (!moth) {
    card.innerHTML = `<p class="muted">Select a moth to see its details, put it on duty, post it at a lighthouse or release it. The brightest moths on duty light the lamp hardest.</p>`;
    return card;
  }
  const pattern = patternById(moth.pattern);
  const isDuty = onDuty.has(moth.id);
  const post = postOf(state, moth.id);
  const atSea = isAtSea(state, moth.id);
  const inCocoon = isCocoonParent(state, moth.id);
  const where = isDuty
    ? `on duty: +${(dutyBonusOf(moth) * 100).toFixed(1)}% to the beam`
    : post
      ? `keeping watch at ${chainLighthouseById(post).name}: +${(postBonusOf(moth) * 100).toFixed(1)}% support there`
      : atSea
        ? "riding a bottle"
        : `at home in the roost (would give +${(dutyBonusOf(moth) * 100).toFixed(1)}% on duty)`;
  const scales = releaseScales(moth);
  card.innerHTML = `
    <div class="detail-head">
      <span class="moth-swatch big" style="background:${pattern.swatch}"></span>
      <div>
        <div class="gen-name">${wingDot(pattern.swatch, pattern.name)} ${moth.name}${inCocoon ? ` <span class="perm">in the cocoon</span>` : ""}</div>
        <div class="gen-flavor">${pattern.name} wings · glow ${moth.glow}${isOldLight(moth) ? ` <span class="perm" title="From before the moth rebalance: it keeps its glow above the ${pattern.name} ceiling.">old light</span>` : ` of ${pattern.glowCeiling}`} · generation ${moth.generation} · ${where}</div>
        ${traitsOf(moth).map((t) => `<div class="gen-flavor moth-trait-line">${t.name}: ${t.effect}</div>`).join("")}
      </div>
    </div>
    <div class="detail-actions">
      <button class="buy moth-duty"${post ? ` disabled title="Recall it from its post first"` : atSea ? ` disabled title="It is out at sea"` : ""}>${isDuty ? "Stand down" : "Put on duty"}</button>
      <button class="buy moth-release"${atSea || inCocoon ? " disabled" : ""}>Release (+${scales} Wing Scale${scales === 1 ? "" : "s"})</button>
      <span class="muted detail-hint">${post || atSea || inCocoon ? "" : "Post it from the Lighthouse posts panel."}</span>
    </div>`;
  card.querySelector(".moth-duty")?.addEventListener("click", () => {
    if (toggleDuty(state, moth.id)) mothChanged();
  });
  const releaseBtn = card.querySelector<HTMLButtonElement>(".moth-release");
  if (releaseBtn && !atSea && !inCocoon) {
    armTwoStep(releaseBtn, `Are you sure? ${moth.name} won't come back`, () => {
      if (releaseMoth(state, moth.id) !== null) {
        selectedMoth = "";
        mothChanged();
      }
    });
  }
  return card;
}

function buildBreeding(host: HTMLElement): void {
  const breed = document.createElement("div");
  breed.className = "card side-card";
  // Moths free to breed: at home, not on watch, not already in a cocoon.
  const home = state.moths.filter((m) => postOf(state, m.id) === null && !isAtSea(state, m.id) && !isCocoonParent(state, m.id));
  const nests = nestCount(state);
  const next = expansionsToNextNest(state);
  const nestNote = next === null ? "" : ` A bigger roost makes room for another: ${next} more expansion${next === 1 ? "" : "s"}.`;
  let html = `
    <div class="side-title"><span class="gen-name">${GLYPHS.cocoon} Breeding</span></div>
    <p class="muted side-line nest-line">${state.cocoons.length} of ${nests} nests spinning.${nestNote}</p>`;
  state.cocoons.forEach((c, i) => {
    const a = mothById(state, c.parentIds[0]);
    const b = mothById(state, c.parentIds[1]);
    html += `
      <div class="nest" data-nest="${i}">
        <p class="muted side-line">${a?.name ?? "?"} × ${b?.name ?? "?"}</p>
        <div class="progress"><div class="progress-bar cocoon-bar"></div></div>
        <div class="side-row"><span class="muted cocoon-note"></span><button class="buy cocoon-hatch">Hatch</button></div>
      </div>`;
  });
  if (state.cocoons.length > 1) html += `<div class="side-row nest-all"><span></span><button class="buy hatch-all hidden">Hatch all</button></div>`;
  const free = state.cocoons.length < nests;
  if (free && home.length >= 2) {
    if (!home.some((m) => m.id === breedParentA)) breedParentA = home[0].id;
    if (!home.some((m) => m.id === breedParentB) || breedParentB === breedParentA) {
      breedParentB = home.find((m) => m.id !== breedParentA)?.id ?? "";
    }
    const options = home.map((m) => `<option value="${m.id}">${m.name} (${patternById(m.pattern).name}, ${m.glow}${traitList(m)})</option>`).join("");
    html += `
      <div class="nest nest-new">
        <select class="breed-select breed-a" aria-label="First parent">${options}</select>
        <select class="breed-select breed-b" aria-label="Second parent">${options}</select>
        <div class="side-row"><span class="muted breed-time"></span><button class="buy breed-start">Spin a cocoon</button></div>
      </div>`;
  } else if (free) {
    html += `<p class="muted side-line">${state.cocoons.length > 0 ? "Another cocoon needs two more moths at home." : "Breeding needs two moths at home in the roost."}</p>`;
  }
  breed.innerHTML = html;
  breed.querySelectorAll<HTMLElement>(".nest[data-nest]").forEach((el) => {
    const index = Number(el.dataset.nest);
    const btn = el.querySelector<HTMLButtonElement>(".cocoon-hatch");
    shoreRefs.cocoonRows.push({ index, note: el.querySelector(".cocoon-note"), bar: el.querySelector(".cocoon-bar"), btn });
    btn?.addEventListener("click", () => {
      const child = hatchCocoon(state, Math.random, Date.now(), index);
      if (child) {
        selectedMoth = child.id;
        mothChanged(true);
      }
    });
  });
  shoreRefs.hatchAllBtn = breed.querySelector<HTMLButtonElement>(".hatch-all");
  shoreRefs.hatchAllBtn?.addEventListener("click", () => {
    let last: Moth | null = null;
    for (let guard = 0; guard < MAX_NESTS; guard++) {
      const child = hatchCocoon(state, Math.random);
      if (!child) break;
      last = child;
    }
    if (last) {
      selectedMoth = last.id;
      mothChanged(true);
    }
  });
  const selA = breed.querySelector<HTMLSelectElement>(".breed-a");
  const selB = breed.querySelector<HTMLSelectElement>(".breed-b");
  const timeNote = breed.querySelector<HTMLElement>(".breed-time");
  const showTime = () => {
    const a = mothById(state, breedParentA);
    const b = mothById(state, breedParentB);
    if (timeNote) timeNote.textContent = a && b && a !== b ? formatDuration(cocoonDurationMs(a, b, state) / 1000) : "pick two moths";
  };
  if (selA) {
    selA.value = breedParentA;
    selA.addEventListener("change", () => { breedParentA = selA.value; showTime(); });
  }
  if (selB) {
    selB.value = breedParentB;
    selB.addEventListener("change", () => { breedParentB = selB.value; showTime(); });
  }
  if (timeNote) showTime();
  breed.querySelector(".breed-start")?.addEventListener("click", () => {
    if (startBreeding(state, breedParentA, breedParentB)) {
      sound.buy();
      mothChanged();
    }
  });
  breed.querySelector(".side-title")?.appendChild(infoButton("How breeding works", breedingPages));
  host.appendChild(breed);
}

function buildPosts(host: HTMLElement): void {
  const card = document.createElement("div");
  card.className = "card side-card";
  const picked = mothById(state, selectedMoth);
  const canPost = picked !== undefined && !isCocoonParent(state, picked.id) && !isAtSea(state, picked.id);
  const rows = CHAIN_LIGHTHOUSES.filter((l) => state.litLighthouses.includes(l.id)).map((l) => {
    const here = postedMoth(state, l.id);
    const offer = canPost && picked && here?.id !== picked.id
      ? `<button class="buy post-send" title="Post ${picked.name} here: +${(postBonusOf(picked) * 100).toFixed(1)}% support on this board">${here ? "Swap" : "Post"}</button>`
      : "";
    const recall = here ? `<button class="buy post-recall" title="Bring ${here.name} home">Recall</button>` : "";
    return `
      <div class="post-row" data-lighthouse="${l.id}">
        <span class="post-name" title="${l.name}">${l.name}</span>
        <span class="post-who ${here ? "" : "muted"}" title="${here ? `${here.name}: +${(postBonusOf(here) * 100).toFixed(1)}% support on this board` : "No moth on watch"}">${here ? `${here.name} <span class="perm">+${(postBonusOf(here) * 100).toFixed(1)}%</span>` : "empty"}</span>
        <span class="post-buttons">${offer}${recall}</span>
      </div>`;
  });
  card.innerHTML = `
    <div class="side-title"><span class="gen-name">${GLYPHS.tower} Lighthouse posts</span></div>
    ${rows.join("")}
    ${picked ? (canPost ? "" : `<p class="muted side-line">${picked.name} can't take a post right now.</p>`) : `<p class="muted side-line">Select a moth to post it.</p>`}`;
  card.querySelector(".side-title")?.appendChild(infoButton("How lighthouse posts work", postPages));
  card.querySelectorAll<HTMLElement>(".post-row").forEach((row) => {
    const lighthouseId = row.dataset.lighthouse ?? "";
    row.querySelector(".post-send")?.addEventListener("click", () => {
      if (picked && postMoth(state, picked.id, lighthouseId)) {
        sound.buy();
        mothChanged();
      }
    });
    row.querySelector(".post-recall")?.addEventListener("click", () => {
      if (recallMoth(state, lighthouseId)) mothChanged();
    });
  });
  host.appendChild(card);
}

function breedingPages(): SplashPage[] {
  return [{
    art: TAB_ICONS.shore,
    eyebrow: "The Moth Garden",
    title: "How breeding works",
    html: `
      <ul>
        <li>Two moths at home spin a <strong>cocoon</strong>; both parents stay. It takes 30 minutes for Plain parents up to 75 for Prismatic (84 for Hollow), less with a <strong>Fertile</strong> parent, and keeps going while you're away.</li>
        <li>The roost has <strong>${BASE_NESTS} nests</strong>, so ${BASE_NESTS} cocoons can spin at once, each from its own pair. A bigger roost makes room for more: one more nest every ${EXPANSIONS_PER_NEST} roost expansions, up to ${MAX_NESTS}.</li>
        <li>The child usually takes the <strong>rarer</strong> parent's wings, sometimes shifting a tier. Prismatic is unstable: two Prismatics give a Prismatic 3 times in 5.</li>
        <li>Its <strong>glow</strong> is about the parents' average (now and then a bright jump), never above its own pattern's ceiling.</li>
        <li>It may inherit a parent's <strong>trait</strong> (half the time) or, rarely, a new one.</li>
        <li>A Starlit or Prismatic cocoon that opens in a <strong>Stormfront</strong> is sometimes Tidelit. After the ending, two glow-100 Prismatics may hatch a <strong>Hollow</strong> moth.</li>
      </ul>`,
  }];
}

function postPages(): SplashPage[] {
  return [{
    art: TAB_ICONS.lighthouses,
    eyebrow: "The Moth Garden",
    title: "Lighthouse posts",
    html: `
      <p>Every lit lighthouse has room for one moth. A posted moth strengthens that lighthouse's supply board by <strong>glow × 0.2%</strong> support, doubled for a <strong>Chain-tender</strong>.</p>
      <p>A posted moth leaves duty and can't breed until it comes home. Select a moth in the roster, then press <strong>Post</strong> beside a lighthouse; <strong>Recall</strong> brings it back.</p>`,
  }];
}

function openAlmanac(): void {
  const columns = [null, ...MOTH_TRAITS];
  const head = columns.map((t) => `<th title="${t ? t.effect : "Moths without a trait"}">${t ? t.name : "No trait"}</th>`).join("");
  const body = ALMANAC_PATTERNS.map((pid) => {
    const p = patternById(pid);
    const cells = columns
      .map((t) => {
        const has = almanacHas(state, pid, t?.id);
        return `<td class="${has ? "almanac-has" : "almanac-missing"}" title="${p.name}, ${t ? t.name : "no trait"}${has ? "" : " — not yet"}">${has ? wingDot(p.swatch, p.name) : "·"}</td>`;
      })
      .join("");
    return `<tr><th scope="row">${p.name}</th>${cells}</tr>`;
  }).join("");
  const rewards = ALMANAC_REWARDS.map((r) => {
    const earned = state.almanac.length >= r.entries;
    return `<li class="${earned ? "learned" : "muted"}">${earned ? "✓" : `${r.entries}`} · <strong>${r.name}</strong>: ${r.effect}</li>`;
  }).join("");
  splash.open(
    [{
      eyebrow: "The Moth Garden",
      title: `The Wing Almanac · ${state.almanac.length}/${ALMANAC_SIZE}`,
      html: `
        <p>A page for every wing and trait. A page fills the first time you hold such a moth, and stays filled. Release moths for Wing Scales: ${SCENTED_LURE_SCALES} buy a scented lure, which always brings a moth with a trait.</p>
        <div class="almanac-scroll"><table class="almanac"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
        <ul class="almanac-rewards">${rewards}</ul>`,
    }],
    { kind: "almanac", finishLabel: "Close" },
  );
}

/** In-place refresh of the Shore's moving parts: costs, countdowns, gates. */
function updateShoreView(now: number): void {
  const roostLine = roostBar?.querySelector<HTMLElement>(".moth-roost-line");
  if (roostLine) {
    const duty = dutyMoths(state);
    roostLine.textContent = `${state.moths.length}/${mothCapacity(state)} moths · ${duty.length}/${dutySlots(state)} on duty (+${(dutyGlowTotal(state) * DUTY_GLOW_BONUS * 100).toFixed(1)}% to the beam) · ${state.wingScales} scale${state.wingScales === 1 ? "" : "s"}`;
  }
  // The Crossing's next offering, while The Hollow Light is the next light.
  const offeringLine = document.querySelector<HTMLElement>("#shore-offering");
  if (offeringLine) {
    const waymark = nextLighthouseId(state) === HOLLOW_LIGHT_ID ? nextWaymark(state) : null;
    const text = waymark
      ? offeringMet(state, waymark.id)
        ? `${GLYPHS.tower} The Crossing: ${waymark.name}'s offering is brought (${waymark.offering}). It costs half.`
        : `${GLYPHS.tower} The Crossing asks for ${waymark.offering}. Bring it and ${waymark.name} costs half.`
      : "";
    if (offeringLine.innerHTML !== text) offeringLine.innerHTML = text;
    offeringLine.classList.toggle("hidden", !waymark);
  }
  // Dots on the Shore's pane buttons: something is waiting there.
  document.querySelector("#garden-dot")?.classList.toggle("hidden", !cocoonReady(state, now));
  document.querySelector("#sea-dot")?.classList.toggle("hidden", !(state.expedition && expeditionReady(state, now)));
  if (shoreRefs.attractBtn && shoreRefs.attractNote) {
    const lures = lureStatus(state, now);
    const full = state.moths.length >= mothCapacity(state);
    const ready = lures.held > 0;
    // Attract and Rush share one button, so the row never gains or loses one.
    if (ready) {
      shoreRefs.attractBtn.disabled = full;
      shoreRefs.attractBtn.classList.toggle("affordable", !full);
      shoreRefs.attractBtn.textContent = `Attract · ${lures.held}/${lureBankSize(state)} lures`;
      setTip(shoreRefs.attractBtn, "Spend a lure: a wild moth follows the light home.");
    } else {
      const cost = rushLureCost(state, now);
      const affordable = state.lumen.gte(cost);
      shoreRefs.attractBtn.disabled = full || !affordable;
      shoreRefs.attractBtn.classList.toggle("affordable", !full && affordable);
      shoreRefs.attractBtn.textContent = `Rush lure · ${fmt(cost)}`;
      setTip(shoreRefs.attractBtn, "No lure ready: pay Lumen to attract a moth now. Each rush triples the next until a lure regrows.");
    }
    if (shoreRefs.scentedBtn) {
      // Always shown (greyed until you hold enough scales), so the row keeps its shape.
      const can = !full && state.wingScales >= SCENTED_LURE_SCALES;
      shoreRefs.scentedBtn.disabled = !can;
      shoreRefs.scentedBtn.classList.toggle("affordable", can);
      shoreRefs.scentedBtn.textContent = `Scented lure · ${Math.min(state.wingScales, SCENTED_LURE_SCALES)}/${SCENTED_LURE_SCALES}`;
      setTip(shoreRefs.scentedBtn, `${SCENTED_LURE_SCALES} Wing Scales: a moth that always carries a trait. Release moths for scales (you hold ${state.wingScales}).`);
    }
    const next = lures.nextInMs === null ? "the lure bank is full" : `next lure in ${formatDuration(lures.nextInMs / 1000)}`;
    if (full) {
      shoreRefs.attractNote.textContent = `the roost is full — expand it or release a moth · ${next}`;
    } else if (!ready) {
      shoreRefs.attractNote.textContent = `${next}, even while you're away${lures.rushes > 0 ? " · each rush triples the next until a lure regrows" : ""}`;
    } else {
      shoreRefs.attractNote.textContent = `a new moth follows the light home · ${next}`;
    }
  }
  if (shoreRefs.roostBtn && shoreRefs.roostNote) {
    const cost = roostExpansionCost(state);
    const affordable = state.lumen.gte(cost);
    shoreRefs.roostBtn.disabled = !affordable;
    shoreRefs.roostBtn.classList.toggle("affordable", affordable);
    shoreRefs.roostBtn.textContent = `Expand +2 · ${fmt(cost)}`;
    shoreRefs.roostBtn.title = "";
    setTip(
      shoreRefs.roostBtn,
      `Room for ${mothCapacity(state) + 2} moths. Costs about ${formatDuration(roostExpansionMinutes(state) * 60)} of your production (×1.5 for each expansion), or the starting price if that's more.`,
    );
    shoreRefs.roostNote.textContent = affordable ? `room for ${mothCapacity(state) + 2}` : "";
  }
  const full = state.moths.length >= mothCapacity(state);
  for (const row of shoreRefs.cocoonRows) {
    const cocoon = state.cocoons[row.index];
    if (!cocoon) continue;
    const ready = now >= cocoon.readyAt;
    if (row.note) {
      row.note.textContent = ready
        ? full
          ? "Ready, but the roost is full"
          : "Ready to hatch"
        : `Hatches in ${formatDuration((cocoon.readyAt - now) / 1000)}`;
    }
    if (row.bar) {
      const a = mothById(state, cocoon.parentIds[0]);
      const b = mothById(state, cocoon.parentIds[1]);
      const span = a && b ? cocoonDurationMs(a, b, state) : 1;
      row.bar.style.width = `${Math.max(0, Math.min(100, (1 - (cocoon.readyAt - now) / span) * 100)).toFixed(1)}%`;
    }
    if (row.btn) {
      row.btn.disabled = !ready || full;
      row.btn.classList.toggle("affordable", ready && !full);
    }
  }
  if (shoreRefs.hatchAllBtn) {
    const n = readyCocoonCount(state, now);
    shoreRefs.hatchAllBtn.classList.toggle("hidden", n < 2);
    shoreRefs.hatchAllBtn.disabled = full;
    const label = `Hatch all ${n}`;
    if (shoreRefs.hatchAllBtn.textContent !== label) shoreRefs.hatchAllBtn.textContent = label;
  }
  if (state.expedition && shoreRefs.expeditionNote) {
    const ready = expeditionReady(state, now);
    shoreRefs.expeditionNote.textContent = ready
      ? "The bottle has washed back onto the glass. Whatever it carries, it's yours."
      : `Still out there. Washes back in ${formatDuration((state.expedition.returnsAt - now) / 1000)}.`;
    if (shoreRefs.claimBtn) {
      shoreRefs.claimBtn.disabled = !ready;
      shoreRefs.claimBtn.classList.toggle("affordable", ready);
    }
  }
  for (const { routeId, btn, note } of shoreRefs.sendBtns) {
    const route = EXPEDITION_ROUTES.find((r) => r.id === routeId);
    if (!route) continue;
    const busy = state.expedition !== null;
    const affordable = state.lumen.gte(route.cost);
    if (busy && hasPerk(state, "glass-charts")) {
      // Glass Charts: while a bottle is out, each route can be the next voyage's.
      const standing = state.bottleRoute === route.id;
      btn.disabled = standing;
      btn.classList.toggle("affordable", !standing);
      const label = standing ? "The next voyage ✓" : "Sail here next";
      if (btn.textContent !== label) btn.textContent = label;
      if (note) note.textContent = "";
      continue;
    }
    const sendLabel = `Send a bottle — ${fmt(route.cost)} Lumen`;
    if (btn.textContent !== sendLabel) btn.textContent = sendLabel;
    btn.disabled = busy || !affordable;
    btn.classList.toggle("affordable", !busy && affordable);
    if (note) {
      if (busy) note.textContent = "one bottle at a time — the sea is only so wide";
      else if (!affordable) {
        const tta = timeToAffordCost(state, new Decimal(route.cost));
        note.textContent = Number.isFinite(tta) ? affordableIn(tta) : "";
      } else note.textContent = "";
    }
  }
}

// ── Recovery estimate ────────────────────────────────────────────────────────
// It runs a bounded bot sim of a whole new run (≈350 ms late in the game),
// so it is only computed while the Rekindle tab is open, and restarted only
// when the Ember gain moves by about 5% (or the Embers, perks, lights or
// challenge change). It runs in a Web Worker; where a worker can't start,
// it is stepped a few milliseconds per refresh instead. Either way no frame
// waits on it, and the last finished answer shows meanwhile.
let recoveryKey = "";
let recoveryJob: RecoveryEstimator | null = null;
/** The last finished estimate; undefined until the first one completes. */
let recoveryValue: number | null | undefined;
const RECOVERY_STEP_MS = 6;
let recoveryWorker: Worker | null = null;
/** "unstarted" until the Rekindle tab first needs an estimate; "failed" falls back to slicing. */
let recoveryWorkerState: "unstarted" | "running" | "failed" = "unstarted";
let recoveryRequest = 0;

/** Start the estimate worker on first use (its script is a separate, lazily loaded file). */
function estimateWorker(): Worker | null {
  if (recoveryWorkerState === "unstarted") {
    try {
      recoveryWorker = new Worker(new URL("./game/estimateWorker.ts", import.meta.url), { type: "module" });
      recoveryWorker.onmessage = (event: MessageEvent<{ id: number; minutes: number | null }>) => {
        if (event.data.id === recoveryRequest) recoveryValue = event.data.minutes;
      };
      recoveryWorker.onerror = () => {
        // A worker the page can't load (e.g. the single-file build): slice instead.
        recoveryWorker?.terminate();
        recoveryWorker = null;
        recoveryWorkerState = "failed";
        recoveryKey = "";
      };
      recoveryWorkerState = "running";
    } catch {
      recoveryWorkerState = "failed";
    }
  }
  return recoveryWorker;
}

function recoveryEstimate(): number | null | undefined {
  const gain = rekindleGain(state);
  const key = [
    Math.round(Math.log(Math.max(1, gain)) / Math.log(1.05)),
    state.embers,
    state.totalRekindles,
    state.emberPerks.join(","),
    state.litLighthouses.join(","),
    state.activeChallenge ?? "",
  ].join("|");
  if (key !== recoveryKey) {
    recoveryKey = key;
    const worker = estimateWorker();
    if (worker) {
      recoveryJob = null;
      worker.postMessage({ id: ++recoveryRequest, save: serializeState(state) });
      return recoveryValue;
    }
    recoveryJob = createRecoveryEstimator(state);
  }
  if (recoveryJob && recoveryJob.step(RECOVERY_STEP_MS)) {
    recoveryValue = recoveryJob.result;
    recoveryJob = null;
  }
  return recoveryValue;
}

function formatRecovery(minutes: number | null | undefined): string {
  if (minutes === undefined) return "estimating…";
  if (minutes === null) return "over 10 hours";
  if (minutes < 90) return `~${Math.max(1, Math.round(minutes))} min`;
  return `~${(minutes / 60).toFixed(1)} h`;
}

// ── Lighthouses & the supply chain ───────────────────────────────────────────
// Cards and the flow board are rebuilt when their structure changes (a
// lighthouse lights, a node level changes, the selected board switches);
// numbers, statuses and affordability refresh in place every frame.
const lhList = document.querySelector<HTMLDivElement>("#lighthouse-list");
const chainArea = document.querySelector<HTMLDivElement>("#chain-area");
const endingPanel = document.querySelector<HTMLDivElement>("#ending-panel");
let selectedBoardId: string = FIRST_LIGHT_ID;
let lhStructureKey: string | null = null;
let relightBtn: HTMLButtonElement | null = null;
let relightNote: HTMLElement | null = null;
let relightTargetId: string | null = null;
let lockedChainNote: HTMLElement | null = null;
let chainSummary: HTMLElement | null = null;
let endingStats: HTMLElement | null = null;

/** Plain-words summary of what a lit lighthouse grants, from its def. */
function lighthouseBonusText(def: (typeof CHAIN_LIGHTHOUSES)[number]): string {
  const parts: string[] = [];
  const brings = GENERATORS.find((g) => g.unlockedBy === def.id);
  if (brings) parts.push(brings.name.startsWith("The ") ? `${brings.name} answers its light` : `${brings.name}s answer its light`);
  if (def.productionBonus > 0) parts.push(`+${Math.round(def.productionBonus * 100)}% production`);
  if (def.supportBonus > 0) parts.push(`chain support +${Math.round(def.supportBonus * 100)}%`);
  if (def.id === QUARTERMASTER_LIGHTHOUSE) parts.push("a Quartermaster learns your lessons");
  if (def.id === LAMP_CREW_LIGHTHOUSE) parts.push("a Lamp Crew hires your helpers");
  if (def.id === "widows-walk") parts.push("a Chain Steward feeds your chain");
  if (def.emberGainBonus > 0) parts.push(`Ember gain +${Math.round(def.emberGainBonus * 100)}%`);
  if (def.offlineRateBonus > 0) parts.push(`offline rate +${Math.round(def.offlineRateBonus * 100)} pts`);
  if (def.offlineCapBonusSeconds > 0) parts.push(`offline cap +${def.offlineCapBonusSeconds / 3600}h`);
  if (def.triggersEnding) parts.push("the ending");
  return parts.join(" · ");
}

/** The ending banner + NG+ action, shown while The Hollow Light burns. */
function rebuildEndingPanel(): void {
  endingStats = null;
  if (!endingPanel) return;
  endingPanel.innerHTML = "";
  if (!isLit(state, HOLLOW_LIGHT_ID)) return;
  const panel = document.createElement("div");
  panel.className = "card ending";
  panel.innerHTML = `
    <div class="gen-name">${GLYPHS.dawn} The Sea Remembers</div>
    <p>Seven lights stand in a row across the glass, and the glass has remembered it was water. The ships that are mostly memory are coming home. Whatever comes next is yours to choose, Keeper.</p>
    <p class="muted ending-stats"></p>
    <div class="kept-lost">
      <div><h3>Kept in the Next Keeping</h3><ul>
        <li>Lantern moths, duty roster, roost &amp; cocoon</li>
        <li>Relics &amp; story — every beat you've heard</li>
        <li>Ember perks &amp; challenge rewards</li>
        <li>Keeper knowledge (Longer Wicks, Ember Resonance)</li>
        <li>Your settings, stats &amp; all-time Lumen</li>
      </ul></div>
      <div><h3>Reset</h3><ul>
        <li>Lumen, generators &amp; non-permanent upgrades</li>
        <li>All seven lighthouses go dark (First Light remains)</li>
        <li>Chain boards, and the Ember ledger — held AND total earned</li>
      </ul></div>
    </div>
    <p class="muted">In exchange: a legacy — production ×${legacyMultiplier(state).toFixed(2)} now, ×${(legacyMultiplier(state) + 0.25).toFixed(2)} in the Next Keeping — and ${5 * (state.ngPlusCount + 1)} inherited Embers in hand at the start.</p>
    <button class="danger ngplus-button">Begin the Next Keeping (NG+)</button>`;
  endingStats = panel.querySelector<HTMLElement>(".ending-stats");
  const btn = panel.querySelector<HTMLButtonElement>(".ngplus-button");
  if (btn) armTwoStep(btn, "Are you sure? The shore goes dark — click again to begin the Next Keeping", () => {
    if (startNgPlus(state)) {
      selectedBoardId = FIRST_LIGHT_ID;
      checkStory(state);
      saveState(state);
      renderDynamic();
      sound.rekindle();
      playMoment(
        "rekindle",
        "The Next Keeping",
        "A new keeper takes the lamp",
        `Keeping № ${state.ngPlusCount + 1} begins at a cold lamp, with ${fmt(state.embers)} inherited Embers and a legacy of ×${legacyMultiplier(state).toFixed(2)} production. The moths remember you.`,
      );
    }
  });
  endingPanel.appendChild(panel);
}

interface NodeRowRefs {
  box: HTMLDivElement;
  status: HTMLElement;
  level: HTMLElement;
  detail: HTMLElement;
  flag: HTMLElement;
  cost: HTMLElement;
  note: HTMLElement;
  buy: HTMLButtonElement;
}
let nodeRows = new Map<ChainNodeId, NodeRowRefs>();

// Levels are NOT part of the key: the node cards update them in place, and
// with the Chain Steward and Fill the chain buying levels all the time, a
// rebuild per level redrew the whole tab every few seconds.
function lighthouseStructureKey(): string {
  const unlocked = totalGeneratorsOwned(state) >= CHAIN_UNLOCK_GENERATORS;
  const offerings = WAYMARKS.map((w) => (offeringMet(state, w.id) ? 1 : 0)).join("");
  return `${state.litLighthouses.join(",")}|${state.crossing}|${offerings}|${selectedBoardId}|${unlocked}`;
}

/**
 * The Crossing, on The Hollow Light's card while it is the next light: the
 * three waymarks in order, lit, next or dark, with what each grants.
 */
function crossingHtml(): string {
  const rows = WAYMARKS.map((w, i) => {
    const lit = i < state.crossing;
    const next = i === state.crossing;
    const met = offeringMet(state, w.id);
    // An unlit waymark names its offering from the Shore (offerings.ts).
    const offering = lit
      ? ""
      : `<span class="wm-offering${met ? " met" : ""}">${met ? `Offering brought ✓ — ${w.offering}: half price` : `Bring ${w.offering} and it costs half`}</span>`;
    return `<li class="waymark${lit ? " lit" : next ? " next" : ""}"><span class="wm-mark" aria-hidden="true">${lit ? "◆" : "◇"}</span><span class="wm-name"${tipAttr(w.hint)}>${w.name}</span><span class="wm-reward">${lit ? `Lit ✓ — ${w.reward}` : w.reward}</span>${offering}</li>`;
  }).join("");
  const left = WAYMARKS.length - state.crossing;
  const lead =
    left > 0
      ? left === 1
        ? "One waymark left on the deep glass, and then the tower itself."
        : `The way out runs across the deep glass. Light ${left === WAYMARKS.length ? "its three waymarks" : `the ${left} waymarks left`}, in order, before the tower itself.`
      : "Every waymark burns. The tower is all that's left.";
  return `<div class="crossing"><p class="crossing-lead"><strong>The Crossing.</strong> ${lead}</p><ol class="waymarks">${rows}</ol></div>`;
}

function rebuildLighthouses(): void {
  relightBtn = null;
  relightNote = null;
  relightTargetId = nextLighthouseId(state);
  lockedChainNote = null;
  chainSummary = null;
  nodeRows = new Map();
  if (!isLit(state, selectedBoardId)) selectedBoardId = state.litLighthouses[0] ?? FIRST_LIGHT_ID;
  rebuildEndingPanel();

  // ── Cards: all seven lighthouses, in relight order ──
  if (lhList) {
    lhList.innerHTML = "";
    CHAIN_LIGHTHOUSES.forEach((def, i) => {
      const lit = isLit(state, def.id);
      const card = document.createElement("div");
      const isNextCard = !lit && def.id === relightTargetId;
      card.id = `lh-card-${def.id}`;
      card.className = `card lighthouse${lit ? " lit compact" : isNextCard ? " next" : " locked compact"}`;
      const bonus = lighthouseBonusText(def);
      // Lit and far-off lighthouses are one-liners; the next one gets its
      // full description and the Relight button. The coast above shows all.
      card.innerHTML = `
        <div class="gen-name"><span class="lh-num">${i + 1}</span> <span class="lh-name"${tipAttr(def.hint)}>${def.name}</span></div>
        ${isNextCard && bonus ? `<p class="lh-grants">Relighting it grants: ${bonus}</p>` : ""}
        ${isNextCard && def.id === HOLLOW_LIGHT_ID ? crossingHtml() : ""}
        ${lit ? `<p class="learned">Lit ✓${bonus ? ` — ${bonus}` : ""}</p>` : ""}`;
      if (!lit && def.id === relightTargetId) {
        const buyWrap = document.createElement("div");
        buyWrap.className = "relight-row";
        buyWrap.innerHTML = `<button class="buy">Relight — ${fmt(def.relightCost ?? 0)} Lumen</button><div class="gen-note muted"></div>`;
        relightBtn = buyWrap.querySelector<HTMLButtonElement>(".buy");
        relightNote = buyWrap.querySelector<HTMLElement>(".gen-note");
        relightBtn?.addEventListener("click", () => {
          const crossing = state.crossing;
          if (relightLighthouse(state, def.id, Date.now())) {
            checkStory(state);
            saveState(state);
            if (state.crossing > crossing) {
              // A waymark of the Crossing, not the tower itself.
              renderDynamic();
              const w = WAYMARKS[crossing];
              sound.bell();
              playMoment("waymark", `The Crossing · waymark ${crossing + 1} of ${WAYMARKS.length}`, `${w.name} burns`, `Permanently: ${w.reward}.`);
              return;
            }
            selectedBoardId = def.id;
            renderDynamic();
            if (def.triggersEnding) {
              sound.bell(true);
              playMoment(
                "ending",
                "The Hollow Light",
                "The Sea Remembers",
                "Seven lights stand in a row across the glass, and the glass has remembered it was water. The ships that are mostly memory are coming home.",
                null,
              );
            } else {
              sound.bell();
              const bonus = lighthouseBonusText(def);
              playMoment("relight", `Lighthouse ${i + 1} of 7`, `${def.name} burns again`, bonus ? `Permanently: ${bonus}.` : "");
            }
          }
        });
        card.appendChild(buyWrap);
      } else if (!lit && def.relightCost !== null) {
        const prev = CHAIN_LIGHTHOUSES[i - 1];
        const gate =
          def.efficiencyRequirement > 0
            ? ` · needs beam efficiency ≥ ${def.efficiencyRequirement < 0.01 ? `${(def.efficiencyRequirement * 100).toFixed(1)}%` : `${Math.round(def.efficiencyRequirement * 100)}%`}`
            : "";
        const crossing = def.id === HOLLOW_LIGHT_ID ? ` · reached by the Crossing: ${WAYMARKS.length} waymarks on the deep glass first` : "";
        card.innerHTML += `<p class="muted">Dark — after ${prev?.name ?? "the previous light"}${crossing} · ${fmt(def.relightCost)} Lumen${gate}${bonus ? ` · grants ${bonus}` : ""}</p>`;
      }
      lhList.appendChild(card);
    });
  }

  // ── Chain area: locked teaser, or switcher + flow board ──
  if (!chainArea) return;
  chainArea.innerHTML = "";
  const status = chainStatus(state, Date.now());
  if (!status.unlocked) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="gen-name">${GLYPHS.lock} The supply chain is asleep</div>
      <p class="muted locked-chain-note"></p>`;
    lockedChainNote = card.querySelector<HTMLElement>(".locked-chain-note");
    chainArea.appendChild(card);
    return;
  }

  if (state.litLighthouses.length > 1) {
    const switcher = document.createElement("div");
    switcher.className = "buy-toggle";
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Lighthouse board");
    switcher.innerHTML = `<span class="buy-toggle-label">Board</span>`;
    for (const id of state.litLighthouses) {
      const btn = document.createElement("button");
      btn.className = `toggle-btn${id === selectedBoardId ? " active" : ""}`;
      btn.textContent = chainLighthouseById(id).name;
      btn.addEventListener("click", () => {
        selectedBoardId = id;
        renderDynamic();
      });
      switcher.appendChild(btn);
    }
    chainArea.appendChild(switcher);
  }

  const board = document.createElement("div");
  board.className = "flow-board";
  CHAIN_NODE_IDS.forEach((nodeId, idx) => {
    if (idx > 0) {
      const arrow = document.createElement("div");
      arrow.className = "flow-arrow";
      arrow.textContent = "→";
      board.appendChild(arrow);
    }
    const def = CHAIN_NODES[nodeId];
    const box = document.createElement("div");
    box.className = "node";
    box.innerHTML = `
      <div class="node-head"><span class="node-name"${tipAttr(def.flavor)}>${def.name}</span><span class="node-status"></span></div>
      <div class="node-level"></div>
      <div class="node-detail muted"></div>
      <div class="node-flag"></div>
      <div class="gen-buy node-buy">
        <button class="buy">Upgrade</button>
        <div class="gen-cost"></div>
        <div class="gen-note muted"></div>
      </div>`;
    const buy = box.querySelector<HTMLButtonElement>(".buy");
    if (!buy) return;
    buy.addEventListener("click", () => {
      if (buyNodeUpgrade(state, selectedBoardId, nodeId)) {
        sound.buy();
        saveState(state);
        renderDynamic();
      }
    });
    board.appendChild(box);
    nodeRows.set(nodeId, {
      box,
      status: box.querySelector(".node-status") as HTMLElement,
      level: box.querySelector(".node-level") as HTMLElement,
      detail: box.querySelector(".node-detail") as HTMLElement,
      flag: box.querySelector(".node-flag") as HTMLElement,
      cost: box.querySelector(".gen-cost") as HTMLElement,
      note: box.querySelector(".gen-note") as HTMLElement,
      buy,
    });
  });
  chainArea.appendChild(board);

  const summary = document.createElement("p");
  summary.className = "muted chain-summary";
  chainArea.appendChild(summary);
  chainSummary = summary;
}

/** A helper row warns only when buying would drop the beam this much or more (10 points). */
const ROW_WARN_DROP = 0.1;

/**
 * A supply node's badge on the boards. Only the bottleneck gets a word (in
 * amber when strained, coral when starved); the rest say FLOWING, or the
 * share they carry. All three used to read STARVED or STRAINED at once,
 * which never said which one mattered (design review).
 */
function statusWord(efficiency: number, isBottleneck: boolean): { word: string; cls: string } {
  if (efficiency >= 1) return { word: "● FLOWING", cls: "status-flowing" };
  if (!isBottleneck) return { word: `● ${pct(efficiency)}`, cls: "status-carrying" };
  return { word: "● BOTTLENECK", cls: efficiency >= 0.7 ? "status-strained" : "status-starved" };
}

/** In-place refresh of everything in the Lighthouses view that moves. */
function updateChainView(): void {
  const status = chainStatus(state, Date.now());

  if (lockedChainNote) {
    lockedChainNote.textContent = `Own ${CHAIN_UNLOCK_GENERATORS} generators to wake it (you own ${totalGeneratorsOwned(state)}). Until then the beam burns at full strength — after that, wick, oil and lens must keep up with what your generators produce.`;
  }

  // Relight button (for the next dark lighthouse): enabled only when
  // every gate passes; the note says why not, in order.
  if (relightBtn && relightNote && relightTargetId) {
    const ls = lighthouseStatus(state, relightTargetId, Date.now());
    const def = chainLighthouseById(relightTargetId);
    relightBtn.disabled = !ls.canRelight;
    relightBtn.classList.toggle("affordable", ls.canRelight);
    const label = ls.waymark ? `Light ${ls.waymark.name} — ${fmt(ls.cost)} Lumen` : `Relight — ${fmt(ls.cost)} Lumen`;
    if (relightBtn.textContent !== label) relightBtn.textContent = label;
    const reasons: string[] = [];
    if (!ls.previousLit && ls.previousId) {
      reasons.push(`relight ${chainLighthouseById(ls.previousId).name} first`);
    }
    if (!ls.chainUnlocked) reasons.push(`wake the supply chain first (own ${CHAIN_UNLOCK_GENERATORS} generators)`);
    if (ls.chainUnlocked && !ls.efficiencyOk) {
      const req =
        ls.efficiencyRequired < 0.01
          ? `${(ls.efficiencyRequired * 100).toFixed(1)}%`
          : `${Math.round(ls.efficiencyRequired * 100)}%`;
      const yours =
        ls.efficiency < 0.01 ? `${(ls.efficiency * 100).toFixed(1)}%` : `${Math.round(ls.efficiency * 100)}%`;
      reasons.push(`needs beam efficiency ≥ ${req} — yours is ${yours} (feed the chain)`);
    }
    if (!ls.affordable) {
      const tta = timeToAffordCost(state, ls.cost);
      reasons.push(
        Number.isFinite(tta) ? affordableIn(tta) : `costs ${fmt(ls.cost)} Lumen`,
      );
    }
    relightNote.textContent = ls.canRelight
      ? `${ls.waymark?.name ?? def.name} is within reach of your beam.`
      : reasons.join(" · ");
  }

  const board = state.chainBoards[selectedBoardId];
  if (!board) return;
  for (const [nodeId, refs] of nodeRows) {
    const level = board[nodeId];
    refs.level.textContent = `Level ${level}`;
    const cost = nextNodeCost(state, selectedBoardId, nodeId);
    refs.cost.textContent = `${fmt(cost)} Lumen`;
    const affordable = state.lumen.gte(cost);
    refs.buy.disabled = !affordable;
    refs.buy.classList.toggle("affordable", affordable);
    if (affordable) {
      refs.note.textContent =
        nodeId === "beam"
          ? `→ Level ${level + 1}`
          : `→ Level ${level + 1} · +${fmt(nextLevelSupportGain(state, selectedBoardId, nodeId, Date.now()))}/s support`;
    } else {
      const tta = timeToAffordCost(state, cost);
      refs.note.textContent = Number.isFinite(tta) ? affordableIn(tta) : "earn Lumen first";
    }

    if (nodeId === "beam") {
      const total = status.beamLevels;
      refs.status.textContent = `${beamText(status.beamMultiplier.toNumber())} output`;
      refs.status.className = "node-status status-flowing";
      refs.detail.textContent = `${total} Beam level${total === 1 ? "" : "s"} across all boards · +5% production each`;
      refs.box.classList.remove("bottleneck");
      refs.flag.textContent = "";
    } else {
      const nodeStatus = status.nodes.find((n) => n.nodeId === nodeId);
      if (!nodeStatus) continue;
      const isBottleneck = status.bottleneck === nodeId;
      const { word, cls } = statusWord(nodeStatus.efficiency, isBottleneck);
      refs.status.textContent = word;
      refs.status.className = `node-status ${cls}`;
      refs.detail.textContent = `Supports ${fmt(totalSupport(state, nodeId, Date.now()))}/s of ${fmt(status.demand)}/s produced · ${pct(nodeStatus.efficiency)}`;
      refs.box.classList.toggle("bottleneck", isBottleneck);
      refs.flag.textContent = isBottleneck ? `⚠\uFE0E Short by ${fmt(status.shortfall)}/s: feed it first` : "";
    }
  }

  if (chainSummary) {
    const beamMult = status.beamMultiplier.toNumber();
    const boardDef = chainLighthouseById(selectedBoardId);
    chainSummary.textContent =
      `${boardDef.name} board · Beam efficiency ${pct(status.efficiency)} ` +
      `(chain factor ×${status.chainFactor.toFixed(2)}${beamMult > 1 ? `, Beam ${beamText(beamMult)}` : ""}). ` +
      `Support sums across every lit lighthouse. This board works at ×${boardDef.boardScale} scale: its levels cost and support ×${boardDef.boardScale}.`;
    const warm = startingWarmth(state).toNumber();
    chainSummary.textContent +=
      ` First Light's starting Wick, Oil and Lens are warmed ×${fmt(warm)}: your lasting bonuses (Embers, perks, lit lighthouses) plus a new keeper's grace of +${FIRST_LIGHT_WARMTH.factor - 1}, so every run starts fed.`;
  }
}

// ── The Story section + Keeper's Desk (Log view, Sprint 5) ──────────────────
const storyArea = document.querySelector<HTMLDivElement>("#story-area");
let storyStructureKey: string | null = null;

function rebuildStory(): void {
  if (!storyArea) return;
  storyArea.innerHTML = "";
  if (state.ngPlusCount > 0) {
    const keeping = document.createElement("p");
    keeping.className = "muted";
    keeping.textContent = `Keeping № ${state.ngPlusCount + 1} — legacy production ×${legacyMultiplier(state).toFixed(2)}. The story below is yours from every Keeping; it is never taken away.`;
    storyArea.appendChild(keeping);
  }
  for (const act of STORY_ACTS) {
    const title = document.createElement("h3");
    title.className = "section-title";
    title.textContent = `Act ${["I", "II", "III"][act.act - 1]} — ${act.name}`;
    storyArea.appendChild(title);
    const list = document.createElement("div");
    list.className = "card-list";
    for (const beat of STORY_BEATS.filter((b) => b.act === act.act)) {
      const seen = state.storySeen.includes(beat.id);
      const card = document.createElement("div");
      card.className = `card${seen ? " story-beat" : " lighthouse locked"}`;
      card.innerHTML = seen
        ? `<div class="gen-name">${GLYPHS.book} ${beat.title}</div><p>${beat.text}</p>`
        : `<div class="gen-name">${GLYPHS.fog} A story not yet heard</div><p class="muted">${beat.hint}</p>`;
      list.appendChild(card);
    }
    storyArea.appendChild(list);
  }
}

// Keeper's Desk wiring: notation toggle, save export/import, hard reset.
const deskText = document.querySelector<HTMLTextAreaElement>("#desk-save-text");
const deskStatus = document.querySelector<HTMLElement>("#desk-status");
const notationBtns = {
  standard: document.querySelector<HTMLButtonElement>("#notation-standard"),
  scientific: document.querySelector<HTMLButtonElement>("#notation-scientific"),
};
function deskSay(message: string): void {
  if (deskStatus) deskStatus.textContent = message;
}
notationBtns.standard?.addEventListener("click", () => {
  state.notation = "standard";
  saveState(state);
  renderDynamic();
});
notationBtns.scientific?.addEventListener("click", () => {
  state.notation = "scientific";
  saveState(state);
  renderDynamic();
});
document.querySelector<HTMLButtonElement>("#desk-export")?.addEventListener("click", () => {
  if (deskText) deskText.value = JSON.stringify(serializeState(state), null, 2);
  deskSay("Save exported — copy it somewhere safe.");
});
document.querySelector<HTMLButtonElement>("#desk-copy")?.addEventListener("click", () => {
  if (!deskText) return;
  deskText.select();
  const done = () => deskSay("Copied to the clipboard.");
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(deskText.value).then(done, () => {
      document.execCommand("copy");
      done();
    });
  } else {
    document.execCommand("copy");
    done();
  }
});
document.querySelector<HTMLButtonElement>("#desk-import")?.addEventListener("click", () => {
  if (!deskText) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(deskText.value);
  } catch {
    deskSay("That isn't valid JSON — nothing was changed.");
    return;
  }
  const imported = deserializeState(parsed);
  if (!imported) {
    deskSay("That JSON isn't a Tidelight save — nothing was changed.");
    return;
  }
  // Replace the live state wholesale, then behave like a fresh boot —
  // except no offline windfall: the imported keeper starts from now.
  Object.assign(state, imported);
  state.lastSeen = Date.now();
  checkStory(state);
  saveState(state);
  deskSay("Save imported. Welcome back, Keeper.");
  renderDynamic();
});
const deskReset = document.querySelector<HTMLButtonElement>("#desk-reset");
if (deskReset) armTwoStep(deskReset, "Are you sure? EVERYTHING goes — moths, relics, story, Keepings. Click again to erase it all", () => {
  Object.assign(state, createInitialState());
  selectedBoardId = FIRST_LIGHT_ID;
  saveState(state);
  deskSay("A new keeper arrives at Candlewick Point. The lamp is cold. The sea is glass.");
  renderDynamic();
});

// ── The scene + Flash the Beam ───────────────────────────────────────────────
// The scene draws only while the Light view is showing; its model is rebuilt
// from game state with the rest of the UI (10×/s), never per animation frame.
const sceneCanvas = document.querySelector<HTMLCanvasElement>("#scene-canvas");

/** Build a canvas scene; if Canvas 2D is unavailable the game runs without it. */
function makeScene<T>(canvasId: string, make: (canvas: HTMLCanvasElement) => T): T | null {
  const canvas = document.querySelector<HTMLCanvasElement>(canvasId);
  if (!canvas) return null;
  try {
    return make(canvas);
  } catch (err) {
    console.error(`Tidelight scene ${canvasId} unavailable (the game runs without it):`, err);
    return null;
  }
}
const scene = makeScene("#scene-canvas", (c) => new SceneRenderer(c));
const coastScene = makeScene("#coast-canvas", (c) => new CoastRenderer(c));
const chainFlowScene = makeScene("#chain-flow-canvas", (c) => new ChainFlowRenderer(c));
const meadowScene = makeScene("#meadow-canvas", (c) => new MeadowRenderer(c));

/**
 * Every scene, the view it lives in, and how to refresh its model. Only the
 * scenes of the visible view animate or rebuild their models.
 */
interface SceneEntry {
  tab: string;
  renderer: { start(): void; stop(): void } | null;
  refresh: (now: number) => void;
}
const SCENES: SceneEntry[] = [
  { tab: "light", renderer: scene, refresh: (now) => scene?.setModel(buildSceneModel(state, now)) },
  { tab: "lighthouses", renderer: coastScene, refresh: (now) => coastScene?.setModel(buildCoastModel(state, now), selectedBoardId) },
  { tab: "lighthouses", renderer: chainFlowScene, refresh: (now) => chainFlowScene?.setModel(buildChainFlowModel(state, now)) },
  { tab: "shore", renderer: meadowScene, refresh: (now) => meadowScene?.setModel(buildMeadowModel(state, now)) },
];

function refreshScene(): void {
  const now = Date.now();
  for (const entry of SCENES) if (entry.renderer && entry.tab === activeTab) entry.refresh(now);
}
function syncSceneRunning(): void {
  const now = Date.now();
  for (const entry of SCENES) {
    if (!entry.renderer) continue;
    if (entry.tab === activeTab && !document.hidden) {
      entry.refresh(now);
      entry.renderer.start();
    } else {
      entry.renderer.stop();
    }
  }
}

// The coast's towers are buttons too: a lit one shows its chain board, a dark
// one scrolls to its card.
const coastPins = document.querySelector<HTMLDivElement>("#coast-pins");
const coastPinButtons: HTMLButtonElement[] = [];
CHAIN_LIGHTHOUSES.forEach((def, i) => {
  const slot = COAST_LAYOUT[i];
  const pin = document.createElement("button");
  pin.className = "coast-pin";
  pin.style.left = `${slot.x * 100}%`;
  pin.style.top = `${(slot.base - slot.height - 0.08) * 100}%`;
  pin.style.height = `${(slot.height + 0.08) * 100}%`;
  pin.innerHTML = `<span class="coast-pin-label"><span class="coast-pin-num">${i + 1}</span><span class="coast-pin-name">${def.name}</span></span>`;
  pin.addEventListener("click", () => {
    if (isLit(state, def.id)) {
      selectedBoardId = def.id;
      renderDynamic();
      refreshScene();
      document.querySelector("#chain-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      document.querySelector(`#lh-card-${def.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  coastPins?.appendChild(pin);
  coastPinButtons.push(pin);
});
function updateCoastPins(): void {
  const next = nextLighthouseId(state);
  CHAIN_LIGHTHOUSES.forEach((def, i) => {
    const pin = coastPinButtons[i];
    if (!pin) return;
    const lit = isLit(state, def.id);
    pin.classList.toggle("lit", lit);
    pin.classList.toggle("next", def.id === next);
    pin.classList.toggle("selected", lit && def.id === selectedBoardId);
    pin.setAttribute(
      "aria-label",
      lit ? `${def.name}, lit — show its chain board` : def.id === next ? `${def.name}, next to relight` : `${def.name}, dark`,
    );
  });
}

/**
 * The Beam's bonus in words a keeper can read: "+45%" while it is small,
 * "×109" once it more than doubles the light ("+10845%" was a number to
 * decode, not read; design review).
 */
function beamText(mult: number): string {
  if (mult < 2) return `+${Math.round((mult - 1) * 100)}%`;
  return `×${mult < 100 ? mult.toFixed(1).replace(/\.0$/, "") : fmt(Math.round(mult))}`;
}

/** What the hearth says about the Rekindle moment (game/rekindleMoment.ts). */
function rekindleAdvice(moment: RekindleMoment, gain: number): string {
  // "×3.2" once a Rekindle would more than double the Embers held; before that, a share.
  const m = moment.multiplier;
  const times = m >= 2 ? `×${fmt(m)}` : m - 1 >= 0.01 ? `by ${Math.round((m - 1) * 100)}%` : "by less than 1%";
  switch (moment.phase) {
    case "first":
      return gain >= PRESTIGE_RECOMMENDED_EMBERS
        ? `Recommended first Rekindle: ${PRESTIGE_RECOMMENDED_EMBERS} Embers — reached ✓`
        : `Recommended first Rekindle: ${PRESTIGE_RECOMMENDED_EMBERS} Embers (${fmt(gain)} so far — early Rekindles pay very little)`;
    case "challenge":
      return "A challenge is under way: the hearth waits until it's done.";
    case "building":
      return gain < PRESTIGE_RECOMMENDED_EMBERS
        ? "A new run: the hearth is catching."
        : `This run is still building: a Rekindle now would grow your Embers ${times}. The hearth flares when the run has done its best work.`;
    case "relight-first":
      return `This run has done its best work, but ${moment.relightName} is within reach: relight it first, then Rekindle (your Embers grow ${times}).`;
    case "best":
      return `This run has done its best work: Rekindle when you're ready (your Embers grow ${times}). Waiting longer still adds Embers, just more slowly.`;
  }
}

/** Recent flashes, so the header's "per second" counts your own hands too. */
const flashRate = new FlashRate();

function flashBeam(): void {
  const now = Date.now();
  // The Flash Echo rings on up to three flashes a second (engine.ECHO_FLASHES_PER_SECOND);
  // a quicker flash says so, rather than paying a tiny number without a word.
  const echoing = flashEchoShare(state) > 0 && echoCharges(state, now) > 0;
  const value = clickBeam(state, now);
  flashRate.add(now, value);
  sound.flash();
  if (value.gt(0)) scene?.flash(flashEchoShare(state) > 0 && !echoing ? `+${fmt(value)} · echo resting` : `+${fmt(value)}`);
  updateEchoPips(now);
  // The header only: the rest follows within a quarter second (a tap used
  // to cost a full refresh, ~9 ms on a phone).
  renderDynamic(false);
}

/** The three marks on Flash the Beam: echoes left this second (shown once a Flash Echo is learned). */
const echoPips = document.querySelector<HTMLElement>("#echo-pips");
function updateEchoPips(now: number): void {
  const learned = flashEchoShare(state) > 0;
  const flash = document.querySelector<HTMLElement>("#flash");
  if (flash) {
    setTip(
      flash,
      learned
        ? `+${fmt(clickValue(state, now))} Lumen per flash (tapping the sea works too). The echo rings on up to ${ECHO_FLASHES_PER_SECOND} flashes a second: the marks show how many are left, and quicker flashes pay the plain flash.`
        : `+${fmt(clickValue(state, now))} Lumen per flash (tapping the sea works too). Hire help below and the light keeps itself.`,
    );
  }
  if (!echoPips) return;
  echoPips.classList.toggle("hidden", !learned);
  if (!learned) return;
  const left = echoCharges(state, now);
  echoPips.querySelectorAll("i").forEach((pip, i) => pip.classList.toggle("spent", i >= left));
}
document.querySelector<HTMLButtonElement>("#flash")?.addEventListener("click", flashBeam);
// Tapping anywhere on the scene flashes too (the button stays for keyboards).
sceneCanvas?.addEventListener("pointerdown", (e) => {
  if (e.button === 0) flashBeam();
});

// ── Moments: full-screen set pieces for a Rekindle, a relight, the ending ───
const momentEl = document.querySelector<HTMLDivElement>("#moment");
const momentText = {
  eyebrow: document.querySelector<HTMLElement>("#moment-eyebrow"),
  title: document.querySelector<HTMLElement>("#moment-title"),
  body: document.querySelector<HTMLElement>("#moment-body"),
  button: document.querySelector<HTMLButtonElement>("#moment-continue"),
};
const momentScene = makeScene("#moment-canvas", (c) => new MomentRenderer(c));
let momentTimer: number | undefined;
let momentReturnFocus: Element | null = null;

/** When each moment's words appear (s), after the picture has had its say. */
const MOMENT_TEXT_DELAY: Record<MomentKind, number> = { rekindle: 2.2, relight: 1.2, waymark: 1.2, ending: 4.6 };

/**
 * Play a moment over the whole screen. It closes on Continue, a click, or
 * Escape — and on its own after `autoCloseMs` (null: stays until closed).
 */
function playMoment(kind: MomentKind, eyebrow: string, title: string, body: string, autoCloseMs: number | null = 7000): void {
  if (!momentEl) return;
  if (momentText.eyebrow) momentText.eyebrow.textContent = eyebrow;
  if (momentText.title) momentText.title.textContent = title;
  if (momentText.body) momentText.body.textContent = body;
  momentEl.style.setProperty("--text-delay", `${MOMENT_TEXT_DELAY[kind]}s`);
  momentEl.dataset.kind = kind;
  momentReturnFocus = document.activeElement;
  momentEl.classList.remove("hidden");
  momentScene?.begin(kind);
  momentScene?.start();
  momentText.button?.focus({ preventScroll: true });
  window.clearTimeout(momentTimer);
  momentTimer = autoCloseMs === null ? undefined : window.setTimeout(closeMoment, autoCloseMs);
}
function closeMoment(): void {
  if (!momentEl || momentEl.classList.contains("hidden")) return;
  window.clearTimeout(momentTimer);
  momentEl.classList.add("hidden");
  momentScene?.stop();
  if (momentReturnFocus instanceof HTMLElement) momentReturnFocus.focus({ preventScroll: true });
}
momentEl?.addEventListener("click", closeMoment);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMoment();
});

// ── Splash dialogs: the tutorial and what a bottle brought home ─────────────
const splash = new Splash(app);

function openTutorial(): void {
  // The whole guide: every page counts as read.
  markGuideSeen(state, GUIDE_PAGE_IDS);
  saveState(state);
  splash.open(tutorialPages(), { kind: "tutorial", finishLabel: "Start keeping" });
}
document.querySelector("#help-toggle")?.addEventListener("click", openTutorial);

// ── Welcome back: the card for time away ────────────────────────────────────
// Opens on a return (a new visit, or a laptop waking) when the time away was
// long enough and brought something. It never covers a splash or a moment
// already showing: the log has the same news.
function showAwayCard(r: AwayReport): void {
  if (!shouldShowAway(r)) return;
  if (splash.isOpen || (momentEl && !momentEl.classList.contains("hidden"))) return;
  const away = formatDuration(r.awaySeconds);
  const rows = [
    ["Time paid", r.capped ? `${formatDuration(r.creditedSeconds)} of ${away}` : away],
    ["Keepers' rate", `<span class="tip-text"${tipAttr(`While you're away your keepers earn ${Math.round(r.offlineRate * 100)}% of your production (tides averaged out). Ember perks, relics, lighthouses and Night-flier moths raise it.`)}>${Math.round(r.offlineRate * 100)}% · ${fmt(r.perSecond)}/s</span>`],
    ["Lumen now", fmt(r.lumenNow)],
  ];
  if (r.tidesTurned > 0) rows.push(["The tide turned", `${r.tidesTurned} time${r.tidesTurned === 1 ? "" : "s"}`]);
  const news: string[] = [];
  if (r.capped) {
    news.push(
      `<li class="away-cap">${GLYPHS.hourglass} Your keepers rest after ${formatDuration(r.capSeconds)}, so ${formatDuration(r.awaySeconds - r.creditedSeconds)} went unpaid. Ember perks and lighthouses keep them out longer.</li>`,
    );
  }
  if (r.stewardLevels > 0) news.push(`<li>${GLYPHS.gear} Your Chain Steward tended the chain: ${r.stewardLevels} level${r.stewardLevels === 1 ? "" : "s"} of supplies and Beam.</li>`);
  const shoreNews: string[] = [];
  if (r.cocoonNew) shoreNews.push(`<li>${GLYPHS.cocoon} ${state.cocoons.length > 1 ? "Cocoons are" : "A cocoon is"} ready to hatch.</li>`);
  if (r.bottleNew) shoreNews.push(`<li>${GLYPHS.bottle} A bottle has washed back onto the glass.</li>`);
  if ((r.luresGained ?? 0) > 0) {
    const full = r.luresHeld >= r.lureBank ? "your lure bank is full" : `${r.luresHeld} of ${r.lureBank} held`;
    shoreNews.push(`<li>${GLYPHS.moth} ${r.luresGained} lure${r.luresGained === 1 ? "" : "s"} regrew: ${full}.</li>`);
  }
  news.push(...shoreNews);
  for (const title of r.storyTitles) news.push(`<li>${GLYPHS.scroll} A new page of the story: <strong>${title}</strong>.</li>`);
  const toShore = r.cocoonNew || r.bottleNew;
  splash.open(
    [
      {
        art: BRAND_MARK,
        eyebrow: "Welcome back, keeper",
        title: `You were away ${away}`,
        html: `
          <div class="away-gain">
            <span class="stat-label">Your keepers kept the light</span>
            <strong>${r.gain.gt(0) ? `+${fmt(r.gain)}` : "0"}</strong>
            <span class="away-unit">Lumen</span>
          </div>
          <div class="bottle-haul away-rows">${rows.map(([k, v]) => `<div class="bottle-row"><span>${k}</span><strong>${v}</strong></div>`).join("")}</div>
          ${news.length > 0 ? `<div class="bottle-label">While you were gone</div><ul class="away-news">${news.join("")}</ul>` : ""}
          ${toShore ? `<button class="buy away-shore" data-away-go="shore">Go to the Shore</button>` : ""}`,
      },
    ],
    { kind: "away", finishLabel: "Back to the light" },
  );
}
// The card's "Go to the Shore" closes it and opens the Shore tab.
document.addEventListener("click", (e) => {
  const go = (e.target as Element | null)?.closest<HTMLElement>("[data-away-go]");
  if (!go?.dataset.awayGo) return;
  splash.close();
  activateTab(go.dataset.awayGo);
});
document.querySelector("#desk-tutorial")?.addEventListener("click", openTutorial);

function openBottleSplash(claim: ExpeditionClaim, routeName: string, relicChance: number): void {
  const rows: string[] = [];
  rows.push(`<div class="bottle-row"><span class="bottle-label">Salvage</span><strong>+${fmt(claim.cache)} Lumen</strong></div>`);
  if (claim.bonusLumen.gt(0)) {
    rows.push(`<div class="bottle-row"><span class="bottle-label">Every relic is home</span><strong>+${fmt(claim.bonusLumen)} Lumen</strong></div>`);
  }
  const relic = claim.relic
    ? `<div class="bottle-relic"><div class="relic-icon">${RELIC_ICONS[claim.relic.id] ?? UNKNOWN_ICON}</div><div><div class="bottle-label">A relic, nestled in the neck</div><div class="relic-name">${claim.relic.name}</div><p class="relic-effect">${claim.relic.effect}</p></div></div>`
    : claim.bonusLumen.gt(0)
      ? ""
      : `<p class="muted bottle-norelic">No relic this time (the chance was ${Math.round(relicChance * 100)}%).</p>`;
  let rider = "";
  if (claim.rider) {
    const trait = MOTH_TRAITS.find((t) => t.id === claim.riderTrait);
    rider = trait
      ? `<p class="bottle-rider">${GLYPHS.moth} <strong>${claim.rider.name}</strong> comes home from the deep glass changed: <strong>${trait.name}</strong>. ${trait.effect}</p>`
      : `<p class="bottle-rider">${GLYPHS.moth} <strong>${claim.rider.name}</strong> hops off the cork and back into the roost.</p>`;
  }
  splash.open(
    [
      {
        art: BOTTLE_ART,
        eyebrow: `The bottle washes back · ${routeName}`,
        title: claim.relic ? `A relic: ${claim.relic.name}` : "The bottle is home",
        html: `
          <div class="bottle-haul">${rows.join("")}</div>
          ${relic}
          ${rider}
          <div class="bottle-label">From the bottle</div>
          <blockquote class="bottle-fragment">${claim.fragment}</blockquote>`,
      },
    ],
    { kind: "bottle", finishLabel: "Back to the shore" },
  );
}

// ── Sound toggle (a per-device preference, not part of the save) ───────────
const soundToggle = document.querySelector<HTMLButtonElement>("#sound-toggle");
function showSoundState(): void {
  if (!soundToggle) return;
  soundToggle.innerHTML = sound.isEnabled ? SOUND_ON_ICON : SOUND_OFF_ICON;
  soundToggle.setAttribute("aria-pressed", String(sound.isEnabled));
  soundToggle.title = sound.isEnabled ? "Sound on — click to mute" : "Sound off — click to unmute";
}
soundToggle?.addEventListener("click", () => {
  sound.setEnabled(!sound.isEnabled);
  if (sound.isEnabled) sound.chime();
  showSoundState();
});
showSoundState();

// ── Rekindle (two-step confirm so nobody resets by accident) ────────────────
const rkButton = document.querySelector<HTMLButtonElement>("#rk-button");
const rkHearth = document.querySelector<HTMLElement>("#rk-hearth");
const rkFlare = document.querySelector<HTMLElement>("#rk-flare");
/** The full Rekindle moment plays on the first Rekindle and every this-many after. */
const REKINDLE_MOMENT_EVERY = 10;
if (rkButton) {
  armTwoStep(rkButton, () => `Are you sure? Click again to Rekindle for +${fmt(rekindleGain(state))} Embers`, () => {
    if (!canRekindle(state)) return;
    const gained = rekindle(state);
    saveState(state);
    renderDynamic();
    sound.rekindle();
    const n = state.totalRekindles;
    const bonus = bonusText(effectiveEmbers(state.embers) * Math.round(emberBonusPerEmber(state) * 100));
    // A keeper Rekindles some fifty times on the way to the ending. The full
    // moment plays for the first and every tenth; the rest flare the hearth
    // in place and leave a line under the button (design review).
    if (n === 1 || n % REKINDLE_MOMENT_EVERY === 0) {
      playMoment(
        "rekindle",
        n === 1 ? "Rekindle" : `Rekindle ${n}`,
        "The light catches again",
        `+${fmt(gained)} Embers banked. You hold ${fmt(state.embers)}: your production bonus is now ${bonus}.`,
      );
    } else {
      rkHearth?.classList.remove("rekindled");
      void rkHearth?.offsetWidth; // restart the flare animation
      rkHearth?.classList.add("rekindled");
    }
    if (rkFlare) rkFlare.textContent = `Rekindle ${n}: +${fmt(gained)} Embers banked; your production bonus is now ${bonus}.`;
  });
}

// ── Kindle everything small (Ember shop) ────────────────────────────────────
const kindleAllBtn = document.querySelector<HTMLButtonElement>("#kindle-all");
kindleAllBtn?.addEventListener("click", () => {
  if (kindleAll(state).length > 0) {
    sound.chime();
    saveState(state);
    renderDynamic();
  }
});

// ── Rendering ────────────────────────────────────────────────────────────────
const hud = {
  lumen: document.querySelector<HTMLElement>("#hud-lumen"),
  rate: document.querySelector<HTMLElement>("#hud-rate"),
  rateStat: document.querySelector<HTMLElement>("#hud-rate-stat"),
  embers: document.querySelector<HTMLElement>("#hud-embers"),
  rkGain: document.querySelector<HTMLElement>("#rk-gain"),
  rkHeld: document.querySelector<HTMLElement>("#rk-held"),
  rkHeldLabel: document.querySelector<HTMLElement>("#rk-held-label"),
  rkTotal: document.querySelector<HTMLElement>("#rk-total"),
  rkBonus: document.querySelector<HTMLElement>("#rk-bonus"),
  rkAfter: document.querySelector<HTMLElement>("#rk-after"),
  rkRelative: document.querySelector<HTMLElement>("#rk-relative"),
  rkHearth: document.querySelector<HTMLElement>("#rk-hearth"),
  rkTab: document.querySelector<HTMLElement>('.tab[data-tab="rekindle"]'),
  rkRecovery: document.querySelector<HTMLElement>("#rk-recovery"),
  shopHeld: document.querySelector<HTMLElement>("#shop-held"),
  rkLabel: document.querySelector<HTMLElement>("#rk-progress-label"),
  rkBar: document.querySelector<HTMLElement>("#rk-progress-bar"),
  rkKept: document.querySelector<HTMLUListElement>("#rk-kept"),
  rkLost: document.querySelector<HTMLUListElement>("#rk-lost"),
  logList: document.querySelector<HTMLUListElement>("#log-list"),
  tideStrip: document.querySelector<HTMLElement>("#tide-strip"),
};

let logStructureKey: string | null = null;

// ── The supply strip: the chain, fed from the Light view ────────────────────
// Wick, Oil and Lens as gauges of support against demand (the bottleneck
// glows), the Beam bonus, a Feed button on each supply and a Raise on the
// Beam (the cheapest level on
// any lit board: supply.ts), Fill the chain, and the Chain Steward's
// settings. The board-by-board view stays on the Lighthouses tab.
const supplyStrip = document.querySelector<HTMLElement>("#supply-strip");
/** Levels the Chain Steward has fed since the page opened. */
let stewardLevels = bootStewardLevels;
const supplyNodes = (["wick", "oil", "lens", "beam"] as const).map((nodeId) => {
  const el = supplyStrip?.querySelector<HTMLElement>(`.supply-node[data-node="${nodeId}"]`) ?? null;
  const feed = el?.querySelector<HTMLButtonElement>(".sn-feed") ?? null;
  feed?.addEventListener("click", () => {
    if (feedNode(state, nodeId)) {
      sound.buy();
      saveState(state);
      renderDynamic();
    }
  });
  return {
    nodeId,
    el,
    pct: el?.querySelector<HTMLElement>(".sn-pct") ?? null,
    gauge: el?.querySelector<HTMLElement>(".sn-gauge > span") ?? null,
    feed,
  };
});
const supplyFill = document.querySelector<HTMLButtonElement>("#supply-fill");
const supplyMore = document.querySelector<HTMLButtonElement>("#supply-more");
/** Phones fold the supply strip at this beam efficiency, and open it below the other. */
const SUPPLY_FOLD_AT = 0.9;
const SUPPLY_OPEN_BELOW = 0.8;
const phoneQuery = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 560px)") : null;
let supplyCompact = false;
/** "auto" follows the beam; Show / Hide sets "open" or "closed" until the chain next dips below 80%. */
let supplyPref: "auto" | "open" | "closed" = "auto";
supplyMore?.addEventListener("click", () => {
  supplyPref = supplyCompact ? "open" : "closed";
  renderDynamic();
});
const supplyEff = document.querySelector<HTMLElement>("#supply-eff");
const supplySay = document.querySelector<HTMLElement>("#supply-say");
const stewardBtn = document.querySelector<HTMLButtonElement>("#steward-btn");
const stewardPanel = document.querySelector<HTMLElement>("#steward-panel");
const stewardStatus = document.querySelector<HTMLElement>("#steward-status");
supplyFill?.addEventListener("click", () => {
  const filled = fillChain(state, 1, state.lumen, Date.now(), true, { beamShare: FILL_BEAM_SHARE });
  if (filled.levels > 0) {
    sound.buy();
    saveState(state);
    renderDynamic();
  }
});
document.querySelector("#supply-boards")?.addEventListener("click", () => activateTab("lighthouses"));
setTip(document.querySelector("#supply-boards")!, "The board-by-board view of every lighthouse's chain, on the Lighthouses tab.");
stewardBtn?.addEventListener("click", () => {
  if (!stewardUnlocked(state) || !stewardPanel) return;
  const open = stewardPanel.classList.toggle("hidden") === false;
  stewardBtn.setAttribute("aria-expanded", String(open));
});
stewardPanel?.querySelectorAll<HTMLButtonElement>("[data-steward-on]").forEach((b) =>
  b.addEventListener("click", () => {
    state.stewardOn = b.dataset.stewardOn === "1";
    saveState(state);
    renderDynamic();
  }),
);
stewardPanel?.querySelectorAll<HTMLButtonElement>("[data-steward-beam]").forEach((b) =>
  b.addEventListener("click", () => {
    state.stewardBeam = b.dataset.stewardBeam === "1";
    saveState(state);
    renderDynamic();
  }),
);
stewardPanel?.querySelectorAll<HTMLButtonElement>("[data-steward-share]").forEach((b) =>
  b.addEventListener("click", () => {
    state.stewardShare = Number(b.dataset.stewardShare);
    saveState(state);
    renderDynamic();
  }),
);
stewardPanel?.querySelectorAll<HTMLButtonElement>("[data-steward-target]").forEach((b) =>
  b.addEventListener("click", () => {
    state.stewardTarget = Number(b.dataset.stewardTarget);
    saveState(state);
    renderDynamic();
  }),
);

/** A soft glow on the strip when the Steward feeds the chain. */
function pulseSupply(): void {
  if (!supplyStrip) return;
  supplyStrip.classList.remove("tended");
  void supplyStrip.offsetWidth; // restart the animation
  supplyStrip.classList.add("tended");
}

/** Below this beam efficiency the supply strip warns that the beam is starving. */
const STARVING_EFFICIENCY = 0.5;

function updateSupplyStrip(now: number, chain = chainStatus(state, now)): void {
  if (!supplyStrip) return;
  supplyStrip.classList.toggle("hidden", !chain.unlocked);
  // Phones: the strip folds to one line (title, efficiency, Fill, Show)
  // while the beam is well fed, so the helpers sit nearer the fold. It
  // opens by itself below 80% (and folds again at 90%, so it doesn't
  // flicker at one line); Show / Hide overrides until the chain next dips.
  if (chain.efficiency < SUPPLY_OPEN_BELOW) supplyPref = "auto";
  const phone = phoneQuery?.matches ?? false;
  const compact =
    phone &&
    chain.efficiency >= SUPPLY_OPEN_BELOW &&
    (supplyPref === "auto" ? chain.efficiency >= SUPPLY_FOLD_AT || supplyCompact : supplyPref === "closed");
  supplyCompact = compact;
  supplyStrip.classList.toggle("compact", compact);
  if (supplyMore) {
    const label = compact ? "Show" : "Hide";
    if (supplyMore.textContent !== label) supplyMore.textContent = label;
    supplyMore.setAttribute("aria-expanded", String(!compact));
  }
  // On phones the scene gives up some height once the chain wakes, so the
  // helpers start nearer the fold (style.css, .chain-awake).
  document.querySelector("#view-light")?.classList.toggle("chain-awake", chain.unlocked);
  if (!chain.unlocked) return;
  if (supplyEff) {
    supplyEff.textContent = pct(chain.efficiency);
    supplyEff.classList.toggle("starved", chain.efficiency < STARVING_EFFICIENCY);
    setTip(
      supplyEff,
      `Beam efficiency: the weakest supply carries ${pct(chain.efficiency)} of the ${fmt(chain.demand)}/s your helpers produce, so the beam runs at ${Math.round(chain.chainFactor * 100)}% strength (25% + 75% × efficiency).`,
    );
  }
  // The chain's state in one line, always there (so nothing below it moves):
  // a warning when the beam is starving, a note when it's short, calm when full.
  if (supplySay) {
    const starving = chain.efficiency < STARVING_EFFICIENCY && chain.bottleneck !== null;
    const node = chain.bottleneck ? chain.nodes.find((n) => n.nodeId === chain.bottleneck) : undefined;
    const name = chain.bottleneck ? CHAIN_NODES[chain.bottleneck].name : "";
    const work = `Helpers work at ${Math.round(chain.chainFactor * 100)}%`;
    const say =
      starving && node
        ? `⚠\uFE0E The beam is starving: ${name} carries ${fmt(node.support)}/s of ${fmt(chain.demand)}/s. ${work}. Feed ${name} before hiring more.`
        : node
          ? `${name} holds the beam back, short by ${fmt(chain.shortfall)}/s. ${work}.`
          : "Every supply carries your helpers. The beam is full.";
    if (supplySay.textContent !== say) supplySay.textContent = say;
    supplySay.classList.toggle("starving", starving);
  }
  for (const ref of supplyNodes) {
    const quote = feedQuote(state, ref.nodeId, now);
    const boardName = quote.board ? chainLighthouseById(quote.board).name : "";
    if (ref.nodeId === "beam") {
      const bonus = beamText(chain.beamMultiplier.toNumber());
      if (ref.pct) ref.pct.textContent = bonus;
      if (ref.gauge) ref.gauge.style.width = "0%";
      if (ref.el) setTip(ref.el, `Beam: ${chain.beamLevels} level${chain.beamLevels === 1 ? "" : "s"} across all boards, +5% production each (${bonus} now). Beam doesn't carry supplies, so it never holds the chain back.`);
      if (ref.feed) setTip(ref.feed, quote.board ? `The cheapest Beam level, on ${boardName}: +5% production.` : "");
    } else {
      const node = chain.nodes.find((n) => n.nodeId === ref.nodeId)!;
      const isBottleneck = chain.bottleneck === ref.nodeId;
      if (ref.pct) ref.pct.textContent = pct(node.efficiency);
      if (ref.gauge) ref.gauge.style.width = `${Math.max(2, node.efficiency * 100).toFixed(1)}%`;
      ref.el?.classList.toggle("bottleneck", isBottleneck);
      if (ref.el) setTip(ref.el, `${CHAIN_NODES[ref.nodeId].name} carries ${fmt(node.support)}/s of the ${fmt(chain.demand)}/s your helpers produce${isBottleneck ? ". It's the bottleneck: feed it first." : "."}`);
      if (ref.feed && quote.board) {
        setTip(
          ref.feed,
          `Buys the cheapest ${CHAIN_NODES[ref.nodeId].name} level, on ${boardName}: +${fmt(quote.supportGain)}/s support` +
            (pct(quote.efficiencyAfter) !== pct(chain.efficiency)
              ? `, beam ${pct(chain.efficiency)} → ${pct(quote.efficiencyAfter)}.`
              : isBottleneck
                ? ". The beam needs more than one level here: Fill the chain feeds it until it's full."
                : ` (${CHAIN_NODES[chain.bottleneck ?? ref.nodeId].name} is the one holding the beam back).`),
        );
      }
    }
    if (ref.feed) {
      // The supplies are fed; the Beam is raised (it carries nothing, it adds light).
      const verb = ref.nodeId === "beam" ? "Raise" : "Feed";
      ref.feed.textContent = quote.cost ? `${verb} · ${fmt(quote.cost)}` : verb;
      ref.feed.disabled = !quote.affordable;
      ref.feed.classList.toggle("affordable", quote.affordable && (ref.nodeId === chain.bottleneck || (chain.bottleneck === null && ref.nodeId === "beam")));
    }
  }
  if (supplyFill) {
    const bottleneckQuote = chain.bottleneck ? feedQuote(state, chain.bottleneck, now) : null;
    const beamQuote = feedQuote(state, "beam", now);
    const beamCheap = beamQuote.cost !== null && beamQuote.cost.lte(state.lumen.mul(FILL_BEAM_SHARE));
    const can = chain.unlocked && ((chain.efficiency < 1 && bottleneckQuote !== null && bottleneckQuote.affordable) || beamCheap);
    supplyFill.disabled = !can;
    supplyFill.classList.toggle("affordable", can);
    setTip(
      supplyFill,
      chain.efficiency >= 1
        ? beamCheap
          ? "The beam is fully fed. Fill raises the Beam (+5% production a level) with levels costing up to a tenth of your Lumen."
          : "The beam is fully fed, and the next Beam level costs more than a tenth of your Lumen."
        : "Feeds the weakest supply until the beam is full, raising the Beam along the way whenever its next level is cheaper; then keeps raising the Beam with levels costing up to a tenth of your Lumen.",
    );
  }
  // The Chain Steward.
  const unlocked = stewardUnlocked(state);
  if (stewardBtn) {
    const stewardLabel = unlocked ? `Steward · ${state.stewardOn ? "on" : "off"}` : `Steward ${GLYPHS.lock}`;
    if (stewardBtn.innerHTML !== stewardLabel) stewardBtn.innerHTML = stewardLabel;
    stewardBtn.classList.toggle("active", unlocked && state.stewardOn);
    stewardBtn.setAttribute("aria-disabled", String(!unlocked));
    setTip(
      stewardBtn,
      unlocked
        ? `The Chain Steward sets aside ${Math.round(state.stewardShare * 100)}% of what you earn and feeds the weakest supply until the beam is at ${Math.round(state.stewardTarget * 100)}%. Tap to change.`
        : "Relight Widow's Walk and a Chain Steward feeds the chain for you.",
    );
  }
  if (stewardPanel && !stewardPanel.classList.contains("hidden")) {
    stewardPanel.querySelectorAll<HTMLButtonElement>("[data-steward-on]").forEach((b) => b.classList.toggle("active", (b.dataset.stewardOn === "1") === state.stewardOn));
    stewardPanel.querySelectorAll<HTMLButtonElement>("[data-steward-beam]").forEach((b) => b.classList.toggle("active", (b.dataset.stewardBeam === "1") === state.stewardBeam));
    stewardPanel.querySelectorAll<HTMLButtonElement>("[data-steward-share]").forEach((b) => b.classList.toggle("active", Number(b.dataset.stewardShare) === state.stewardShare));
    stewardPanel.querySelectorAll<HTMLButtonElement>("[data-steward-target]").forEach((b) => b.classList.toggle("active", Number(b.dataset.stewardTarget) === state.stewardTarget));
    if (stewardStatus) {
      stewardStatus.textContent = stewardActive(state)
        ? `Purse ${fmt(state.stewardPurse)} · ${stewardLevels} level${stewardLevels === 1 ? "" : "s"} bought since you opened the game. It never spends more than its purse, which holds at most ${stewardPurseCapSeconds(state) / 60} minutes of production${state.stewardBeam ? ". It raises the Beam alongside the supplies, whichever is cheaper first, and only the Beam once the chain is at your target" : ""}.`
        : "Off: the chain is yours to feed.";
    }
  }
}

/** The least time between two full refreshes from the clock (the header still counts 10 times a second). */
const FULL_RENDER_MS = 250;
let lastFullRenderAt = 0;

/**
 * Refresh what's on screen. `full` (the default, after anything the keeper
 * does) refreshes the open view too; the clock's ten-a-second ticks refresh
 * only the header and the echo marks between full refreshes, four a second
 * (second performance pass: the views' refresh was most of the game's cost
 * on a phone, and nothing in them needs to move faster).
 */
function renderDynamic(full = true): void {
  const nowMs = Date.now();
  // Read once a refresh and shared below: recounting the light is the costliest thing here.
  const rateNow = productionPerSecond(state, nowMs);
  if (hud.lumen) hud.lumen.textContent = fmt(state.lumen);
  if (hud.rate) {
    const helpers = rateNow;
    const flashes = flashRate.rate(nowMs);
    hud.rate.textContent = `${fmt(helpers.add(flashes))}/s`;
    hud.rate.classList.toggle("with-flashes", flashes.gt(0));
    if (hud.rateStat) {
      setTip(
        hud.rateStat,
        flashes.gt(0)
          ? `${fmt(helpers)}/s from your helpers + ${fmt(flashes)}/s from your flashes (the last few seconds).`
          : `${fmt(helpers)}/s from your helpers. Flashing the beam adds to this while you keep at it.`,
      );
    }
  }
  if (hud.embers) hud.embers.textContent = fmt(state.embers);
  updateEchoPips(nowMs);
  if (!full) return;
  lastFullRenderAt = nowMs;
  const chainNow = chainStatus(state, nowMs);

  // Tide strip (Sprint 4): current tide, its effect in words, the turn
  // countdown, and what's coming next.
  if (hud.tideStrip) {
    const [current, next] = tideForecast(nowMs);
    const stormRelic =
      current.def.id === "storm" && state.relics.includes("storm-in-a-bottle")
        ? " Your Storm in a Bottle hums: ×1.45 for you."
        : "";
    const nextHint = next.def.id === "storm" ? " — shore up your chain." : "";
    const tideHtml =
      `${TIDE_GLYPHS[current.def.id]} <strong>${current.def.name}</strong> ` +
      `<span class="tide-turn">· turns in ${formatDuration((current.endsAt - nowMs) / 1000)} · next: ${TIDE_GLYPHS[next.def.id]} ${next.def.name}</span>`;
    if (hud.tideStrip.innerHTML !== tideHtml) hud.tideStrip.innerHTML = tideHtml;
    setTip(hud.tideStrip, `${current.def.name}: ${current.def.effectText}${stormRelic}\nNext, ${next.def.name}: ${next.def.effectText}${nextHint}`);
  }

  // Challenge banner in the Light view while a challenge run is active.
  if (challengeBanner) {
    const progress = challengeProgress(state);
    if (progress) {
      const banner = `${GLYPHS.challenge} Challenge: ${progress.def.name} — ${fmt(progress.current)} / ${fmt(progress.goal)} lifetime Lumen. Your Embers rest until it ends. Tap for details.`;
      if (challengeBanner.innerHTML !== banner) challengeBanner.innerHTML = banner;
      challengeBanner.classList.remove("hidden");
    } else {
      challengeBanner.classList.add("hidden");
    }
  }

  // The supply strip under the scene.
  // Each view refreshes only while it is open; opening a tab refreshes it at once (activateTab).
  if (activeTab === "light") {
    updateSupplyStrip(nowMs, chainNow);
  }

  // Lighthouses view: rebuild on structure change, refresh in place after.
  // The Lighthouses view.
  if (activeTab === "lighthouses") {
    const key2 = lighthouseStructureKey();
    if (key2 !== lhStructureKey) {
      lhStructureKey = key2;
      rebuildLighthouses();
    }
    updateChainView();
    updateCoastPins();
  }

  // The helper rows (the Light view).
  if (activeTab === "light") {
    // Buy toggle: reflect the persisted setting.
    for (const btn of toggleBtns) {
      const raw = btn.dataset.amount;
      const value: BuyAmount = raw === "max" ? "max" : (Number(raw) as BuyAmount);
      btn.classList.toggle("active", state.buyAmount === value);
    }

    const revealUpTo = highestTierOwned() + 1;
    genRows.forEach((row, i) => row.row.classList.toggle("hidden", i > revealUpTo));
    const nextHidden = GENERATORS[revealUpTo + 1];
    genTeaser.classList.toggle("hidden", !nextHidden);
    if (nextHidden && genTeaserText) {
      const waiting = generatorLockedBy(state, GENERATORS[revealUpTo].id);
      genTeaserText.textContent = waiting
        ? `Relight ${chainLighthouseById(waiting).name} and new helpers will answer the light.`
        : `Hire ${withArticle(GENERATORS[revealUpTo].name)} and you'll see what else answers the light.`;
    }
    // Once a frame: what reaches the thrown beam per unit of helper output.
    const thrown = thrownFactor(state, nowMs, rateNow);
    for (const row of genRows) {
      const owned = state.generators[row.def.id] ?? 0;
      row.ring.style.strokeDashoffset = String(100 - milestoneProgress(owned) * 100);
      row.row.classList.toggle("owned", owned > 0);
      const quote = buyQuote(state, row.def, state.buyAmount);
      row.owned.textContent = owned > 0 ? `× ${owned}` : "";
      // What reaches the thrown beam (engine.thrownProduction): the rows sum to the header.
      row.prod.textContent =
        owned > 0
          ? `${fmt(generatorProduction(state, row.def).mul(thrown))} Lumen/s`
          : `${fmt(productionForOwned(state, row.def, 1).mul(thrown))} Lumen/s each`;
      // The real gain is a full recount of the light, so only for a hire that can happen now
      // (performance pass: nine of these every refresh were a third of its cost).
      const gain = quote.affordable && quote.count > 0 ? thrownGain(state, row.def, quote.count, nowMs, rateNow) : new Decimal(0);
      setTip(row.milestone, milestoneHint(owned));
      // First Light Only challenge: tiers 4+ are blocked outright.
      const blockedByChallenge = !canBuyGenerator(state, row.def.id);
      const waitingOn = generatorLockedBy(state, row.def.id);
      row.row.classList.toggle("waiting", waitingOn !== null);
      row.buy.disabled = !quote.affordable || blockedByChallenge;
      row.buy.classList.toggle("affordable", quote.affordable && !blockedByChallenge);
      const count = state.buyAmount === "max" ? Math.max(1, quote.count) : state.buyAmount;
      setTip(
        row.buy,
        `Hire ${count} ${row.def.name}${count === 1 ? "" : row.def.name.endsWith("s") ? "" : "s"} for ${fmt(quote.cost)} Lumen` +
          (gain.gt(0) ? `: +${fmt(gain)} Lumen/s, after the supply chain, the Beam and the lamp.` : ".") +
          (owned > 0 ? ` You have ${owned}.` : ""),
      );
      // The price rides on the button: one line less on every row.
      row.buy.textContent =
        state.buyAmount === "max"
          ? quote.count > 0
            ? `Buy ×${quote.count} · ${fmt(quote.cost)}`
            : `Buy · ${fmt(quote.cost)}`
          : `Buy ×${state.buyAmount} · ${fmt(quote.cost)}`;
      // What this purchase does to the supply chain. The warning takes the
      // note's line (one line, always there) so rows never grow or shrink.
      let warn = "";
      let warnTip = "";
      if (chainNow.unlocked && !waitingOn && quote.affordable && quote.productionGain.gt(0)) {
        const extra = quote.productionGain.mul(lighthouseMultiplier(state));
        const after = efficiencyAtDemand(state, extra, nowMs);
        // Only a real drop earns the row's warning line: the supply strip's
        // status line already says where the chain stands, and a warning on
        // every row ("63% → 62%") read as noise (design review).
        if (chainNow.efficiency - after >= ROW_WARN_DROP) {
          const node = bottleneckAtDemand(state, extra, nowMs);
          warn = `⚠\uFE0E beam ${pct(chainNow.efficiency)} → ${pct(after)}${node ? ` · feed ${CHAIN_NODES[node].name}` : ""}`;
          warnTip =
            `These helpers would add +${fmt(gain)} Lumen/s and ${fmt(extra)}/s of demand on the supply chain. ${node ? `${CHAIN_NODES[node].name} couldn't keep up, ` : ""}so the beam would drop to ${pct(after)} efficiency. Feed it from the supply strip above${stewardActive(state) ? ", or let the Chain Steward catch up" : ""}.`;
        }
      }
      row.note.classList.toggle("gen-warn", warn !== "");
      setTip(row.note, warnTip);
      if (warn) {
        row.note.textContent = warn;
      } else if (waitingOn) {
        row.note.textContent = `Answers the light of ${chainLighthouseById(waitingOn).name} — relight it to hire`;
      } else if (blockedByChallenge) {
        row.note.textContent = "Blocked — First Light Only challenge";
      } else if (quote.affordable) {
        row.note.textContent = gain.gt(0) ? `+${fmt(gain)} Lumen/s` : "";
      } else {
        const tta = timeToAffordCost(state, quote.cost, rateNow);
        row.note.textContent = Number.isFinite(tta) ? affordableIn(tta) : "earn Lumen by flashing";
      }
    }
  }

  // Upgrades view: rebuild on structure change, refresh affordability in place.
  // The Upgrades view.
  if (activeTab === "upgrades") {
    const key = upgradesStructureKey();
    if (key !== upgradeStructureKey) {
      upgradeStructureKey = key;
      rebuildUpgrades();
    }
  }

  // Automation switches where they matter, once their lighthouse is lit.
  for (const [id, unlocked, key, label] of [
    ["#qm-switch", quartermasterUnlocked, "autoLearn", "The Quartermaster (with Gull Rock) learns any upgrade that costs no more than a quarter of your Lumen, cheapest first."],
    ["#crew-switch", lampCrewUnlocked, "autoHire", "The Lamp Crew (with Cormorant Roost) hires the best-value helper with up to a tenth of your Lumen, and never starves the beam."],
  ] as const) {
    const wrap = document.querySelector<HTMLElement>(id);
    if (!wrap) continue;
    const owned = unlocked(state);
    wrap.classList.toggle("hidden", !owned);
    const btn = wrap.querySelector<HTMLButtonElement>("button");
    if (!owned || !btn) continue;
    const on = state[key];
    if (btn.textContent !== (on ? "On" : "Off")) btn.textContent = on ? "On" : "Off";
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
    setTip(btn, `${label} ${on ? "Tap to switch it off." : "Off: tap to switch it back on."}`);
  }
  // The Lamp Crew's note sits beside the helper rows.
  if (activeTab === "light") {
    // A switched-on Lamp Crew that can't hire says why (automation.lampCrewIdleReason).
    if (crewNote) {
      const reason = lampCrewIdleReason(state, nowMs);
      const text = reason === "chain" ? "waiting on the chain" : reason === "budget" ? "saving up" : "";
      if (crewNote.textContent !== text) crewNote.textContent = text;
      setTip(
        crewNote,
        reason === "chain"
          ? "Every helper it could afford would drop the beam below 90% (or below where it is now). Feed the chain, or let the Steward, and the crew gets back to hiring."
          : reason === "budget"
            ? "It hires with a tenth of your Lumen, and nothing costs that little yet."
            : "",
      );
    }
  }

  // The Upgrades view's buttons and progress bars.
  if (activeTab === "upgrades") {
    if (learnAllBtn) {
      // How many fit, cheapest first (the rows are already sorted by cost).
      let budget = state.lumen;
      let n = 0;
      for (const row of availableUpgradeRows) {
        if (budget.lt(row.def.cost)) break;
        budget = budget.sub(row.def.cost);
        n++;
      }
      learnAllBtn.disabled = n < 2;
      learnAllBtn.classList.toggle("affordable", n >= 2);
      learnAllBtn.textContent = n >= 2 ? `Learn all affordable (${n})` : "Learn all affordable";
    }
    for (const row of availableUpgradeRows) {
      const affordable = state.lumen.gte(row.def.cost);
      row.buy.disabled = !affordable;
      row.buy.classList.toggle("affordable", affordable);
      if (affordable) {
        row.note.textContent = "";
      } else {
        const tta = timeToAffordCost(state, new Decimal(row.def.cost), rateNow);
        row.note.textContent = Number.isFinite(tta) ? capitalize(affordableIn(tta)) : "";
      }
    }
    for (const row of lockedUpgradeRows) {
      row.bar.style.width = `${Math.round(unlockProgress(state, row.def) * 100)}%`;
    }
  }

  // Rekindle view
  const gain = rekindleGain(state);
  const perEmberPct = Math.round(emberBonusPerEmber(state) * 100);
  if (hud.rkGain) hud.rkGain.textContent = fmt(gain);
  if (hud.rkHeld) hud.rkHeld.textContent = fmt(state.embers);
  if (hud.rkHeldLabel) {
    hud.rkHeldLabel.textContent =
      state.embers > EMBER_CURVE.knee && EMBER_CURVE.power < 1
        ? `Embers held (+${perEmberPct}% each for the first ${EMBER_CURVE.knee}, then less)`
        : `Embers held (each: +${perEmberPct}% production)`;
  }
  if (hud.rkTotal) hud.rkTotal.textContent = fmt(state.embersTotalEarned);
  if (hud.rkBonus) hud.rkBonus.textContent = state.activeChallenge !== null ? "resting" : bonusText(effectiveEmbers(state.embers) * perEmberPct);
  // The bonus in trillions says little; what a Rekindle does to the light does
  // (design review). Same Ember bonus math as bonusText.
  if (hud.rkRelative) {
    const before = 1 + (effectiveEmbers(state.embers) * perEmberPct) / 100;
    const after = 1 + (effectiveEmbers(state.embers + gain) * perEmberPct) / 100;
    const ratio = after / before;
    hud.rkRelative.textContent =
      state.activeChallenge !== null || gain < 1
        ? ""
        : ratio >= 2
          ? `A Rekindle now makes your light ×${fmt(ratio)} as bright.`
          : `A Rekindle now makes your light ${Math.max(1, Math.round((ratio - 1) * 100))}% brighter.`;
  }
  if (hud.rkAfter) {
    hud.rkAfter.textContent = state.activeChallenge !== null || gain < 1 ? "—" : bonusText(effectiveEmbers(state.embers + gain) * perEmberPct);
  }
  // The hearth teaches the Rekindle moment (game/rekindleMoment.ts, the
  // rule the balance bot plays by): it grows toward the recommended first
  // Rekindle (40 Embers), then with the run's Ember growth, and flares when
  // the run has done its best work.
  const moment = rekindleMoment(state);
  const heat =
    moment.phase === "first"
      ? gain <= 0 ? 0.08 : Math.min(1, 0.15 + 0.85 * (gain / PRESTIGE_RECOMMENDED_EMBERS))
      : moment.phase === "best" || moment.phase === "relight-first"
        ? 1
        : moment.phase === "challenge"
          ? 0.08
          : 0.15 + 0.7 * Math.min(1, Math.log10(moment.multiplier));
  if (hud.rkHearth) {
    hud.rkHearth.style.setProperty("--heat", heat.toFixed(3));
    hud.rkHearth.classList.toggle("ready", moment.phase === "best" || (moment.phase === "first" && gain >= PRESTIGE_RECOMMENDED_EMBERS));
  }
  hud.rkTab?.classList.toggle("tab-ready", moment.phase === "best");
  if (hud.rkRecovery && activeTab === "rekindle") {
    hud.rkRecovery.textContent =
      state.activeChallenge !== null
        ? "— (finish or abandon your challenge first)"
        : gain >= 1
          ? formatRecovery(recoveryEstimate())
          : "— (earn 5,000 lifetime Lumen for your first Ember)";
  }
  if (hud.rkLabel) hud.rkLabel.textContent = rekindleAdvice(moment, gain);
  if (hud.rkBar) hud.rkBar.style.width = `${Math.round(Math.min(1, heat) * 100)}%`;
  if (hud.rkKept && hud.rkLost) {
    const kept: string[] = ["All Embers (old + new)", "Stats & log", "All-time Lumen"];
    // The next run's warm start: lasting bonuses with the new Embers counted in.
    const perEmber = emberBonusPerEmber(state);
    // The next run's warm start (chain.startingWarmth) with the new Embers counted in.
    const warmAfter =
      lastingProductionMultiplier(state).toNumber() * ((1 + (state.embers + gain) * perEmber) / (1 + state.embers * perEmber)) +
      (FIRST_LIGHT_WARMTH.factor - 1);
    kept.push(`A warm start: First Light's starting chain supports ×${fmt(warmAfter)}, so the new run begins fed`);
    const lost: string[] = ["Current Lumen", "All generators", "This run's lifetime"];
    const keptUps = state.upgrades.filter((id) => isPermanentUpgrade(id)).map((id) => upgradeById(id).name);
    const lostUps = state.upgrades.filter((id) => !isPermanentUpgrade(id)).map((id) => upgradeById(id).name);
    if (keptUps.length > 0) kept.push(`Keeper knowledge: ${keptUps.join(", ")}`);
    if (lostUps.length > 0) lost.push(`Upgrades: ${lostUps.join(", ")}`);
    if (state.emberPerks.length > 0) {
      const names = state.emberPerks.map((id) => EMBER_PERKS.find((p) => p.id === id)?.name ?? id);
      kept.push(`Ember perks: ${names.join(", ")}`);
    }
    if (state.moths.length > 0) {
      kept.push(`Lantern moths: all ${state.moths.length} — the collection, duty roster and roost are permanent`);
    }
    if (state.relics.length > 0) {
      const names = state.relics.map((id) => RELICS.find((r) => r.id === id)?.name ?? id);
      kept.push(`Relics: ${names.join(", ")}`);
    }
    if (state.completedChallenges.length > 0) {
      const names = state.completedChallenges.map((id) => challengeById(id).rewardName);
      kept.push(`Challenge rewards: ${names.join(", ")}`);
    }
    const litNames = state.litLighthouses
      .filter((id) => id !== FIRST_LIGHT_ID)
      .map((id) => chainLighthouseById(id).name);
    if (litNames.length > 0) kept.push(`Lighthouses stay lit: ${litNames.join(", ")} (and First Light, always)`);
    if (state.ngPlusCount > 0) {
      kept.push(`Legacy of ${state.ngPlusCount} Keeping${state.ngPlusCount === 1 ? "" : "s"}: production ×${legacyMultiplier(state).toFixed(2)}`);
    }
    const boardsProgressed = state.litLighthouses.some((id) => {
      const start = startBoard(id);
      const board = state.chainBoards[id];
      return board && CHAIN_NODE_IDS.some((n) => board[n] !== start[n]);
    });
    if (boardsProgressed) lost.push("Chain node levels (every board resets to its starting levels)");
    hud.rkKept.innerHTML = kept.map((item) => `<li>${item}</li>`).join("");
    hud.rkLost.innerHTML = lost.map((item) => `<li>${item}</li>`).join("");
  }
  if (rkButton) {
    rkButton.disabled = !canRekindle(state);
    if (!rkButton.classList.contains("armed")) {
      if (state.activeChallenge !== null) {
        rkButton.textContent = `Rekindle unavailable — the ${activeChallenge(state)?.name} challenge is in progress (finish or abandon it first)`;
      } else {
        rkButton.textContent = canRekindle(state)
          ? `Rekindle the Light (+${fmt(gain)} Embers)`
          : "Rekindle the Light (earn 5,000 lifetime Lumen for your first Ember)";
      }
    }
  }

  // Ember Shop: rebuild on ownership change, refresh affordability in place.
  const shopKey = emberShopKey();
  if (shopKey !== shopStructureKey) {
    shopStructureKey = shopKey;
    rebuildEmberShop();
  }
  if (kindleAllBtn) {
    const { count, cost } = kindleAllPreview(state);
    const label = count > 0 ? `Kindle all under 1% (${count})` : "Kindle all under 1%";
    if (kindleAllBtn.textContent !== label) kindleAllBtn.textContent = label;
    kindleAllBtn.disabled = count === 0;
    kindleAllBtn.classList.toggle("affordable", count > 0);
    setTip(
      kindleAllBtn,
      count > 0
        ? `Buys ${count} perk${count === 1 ? "" : "s"} and Kindling level${count === 1 ? "" : "s"} for ${fmt(cost)} Embers in all, cheapest first, each costing no more than ${Math.round(KINDLE_ALL_SHARE * 100)}% of the Embers you hold when it's bought.`
        : `Nothing in the shop costs ${Math.round(KINDLE_ALL_SHARE * 100)}% of your Embers or less right now.`,
    );
  }
  if (hud.shopHeld) {
    hud.shopHeld.textContent = `You hold ${fmt(state.embers)} Embers (${fmt(state.embersTotalEarned)} earned all-time).`;
  }
  for (const row of shopRows) {
    const cost = row.cost();
    const affordable = state.embers >= cost;
    row.buy.disabled = !affordable;
    row.buy.classList.toggle("affordable", affordable);
    if (affordable) {
      const share = cost / Math.max(1, state.embers);
      row.warning.textContent = `Spends ${pct(share)} of your Embers`;
      setTip(row.warning, `Spending ${fmt(cost)} Embers lowers your held bonus from ${bonusText(effectiveEmbers(state.embers) * perEmberPct)} to ${bonusText(effectiveEmbers(state.embers - cost) * perEmberPct)}.`);
    } else {
      row.warning.textContent = `${fmt(cost - state.embers)} more Embers`;
      setTip(row.warning, `You hold ${fmt(state.embers)} Embers.`);
    }
  }

  // The Shore: rebuild on structure change, refresh costs/countdowns in place.
  // The Shore.
  if (activeTab === "shore") {
    const sKey = shoreKey();
    if (sKey !== shoreStructureKey) {
      shoreStructureKey = sKey;
      rebuildShore();
    }
    updateShoreView(nowMs);
  }

  // Challenges: rebuild on active/completed change, refresh progress in place.
  const chKey = challengesStructureKey();
  if (chKey !== challengeStructureKey) {
    challengeStructureKey = chKey;
    rebuildChallenges();
  }
  // Goals follow the keeper's lasting bonuses, so they refresh in place.
  for (const el of challengeContainer?.querySelectorAll<HTMLElement>(".trial-goal") ?? []) {
    const def = CHALLENGES.find((c) => c.id === el.dataset.challenge);
    const text = def ? fmt(challengeGoal(state, def)) : "";
    if (def && el.textContent !== text) el.textContent = text;
  }
  if (activeChallengeRefs) {
    const progress = challengeProgress(state);
    if (progress) {
      activeChallengeRefs.bar.style.width = `${Math.round(progress.fraction * 100)}%`;
      activeChallengeRefs.label.textContent = `${fmt(progress.current)} / ${fmt(progress.goal)} lifetime Lumen (${Math.round(progress.fraction * 100)}%)`;
    }
  }

  // Story section (Log view): rebuilt when a beat lands.
  const stKey = state.storySeen.join(",");
  if (stKey !== storyStructureKey) {
    storyStructureKey = stKey;
    rebuildStory();
  }
  // Notation toggle reflects the setting.
  notationBtns.standard?.classList.toggle("active", state.notation === "standard");
  notationBtns.scientific?.classList.toggle("active", state.notation === "scientific");
  // Ending panel stats, while The Hollow Light burns.
  if (endingStats) {
    endingStats.textContent =
      `This keeping so far: ${fmt(state.allTimeLumen)} all-time Lumen · ${state.totalRekindles} Rekindles · ` +
      `${state.moths.length} moths in the roost · ${state.relics.length} of 8 relics home · ` +
      `${state.storySeen.length} of ${STORY_BEATS.length} story beats heard · ${formatDuration(state.playTimeSeconds)} at the lamp.`;
  }

  // Log view (newest first; story beats get their own styling)
  // Rebuilt only when an entry arrives, so the Log can be read, selected
  // and copied (rebuilding every tick replaced the nodes under the cursor).
  const logKey = `${state.log.length}|${state.log[state.log.length - 1]?.at ?? 0}|${state.log[state.log.length - 1]?.message ?? ""}`;
  if (hud.logList && logKey !== logStructureKey) {
    logStructureKey = logKey;
    hud.logList.innerHTML = state.log
      .slice()
      .reverse()
      .map(
        (e) =>
          // Story beats are saved with a 📖 mark (state.ts keeps old logs as
          // they were); it is drawn as the book glyph.
          // Older saves logged the whole beat; the Story section above holds
          // the text, so the Log keeps to the title either way.
          e.message.startsWith("📖")
            ? `<li class="story-entry"><span class="log-time">${new Date(e.at).toLocaleTimeString()}</span> ${GLYPHS.book} ${storyLogTitle(e.message)} — a new page in The Story So Far</li>`
            : `<li><span class="log-time">${new Date(e.at).toLocaleTimeString()}</span> ${e.message}</li>`,
      )
      .join("");
  }
}

// ── Learn all affordable: cheapest first, until the Lumen runs out ─────────
const learnAllBtn = document.querySelector<HTMLButtonElement>("#learn-all");
const crewNote = document.querySelector<HTMLElement>("#crew-note");
learnAllBtn?.addEventListener("click", () => {
  const ready = UPGRADES.filter((u) => !state.upgrades.includes(u.id) && isUnlocked(state, u)).sort((a, b) => a.cost - b.cost);
  const learned: string[] = [];
  for (const def of ready) {
    if (state.lumen.lt(def.cost)) break;
    if (buyUpgrade(state, def.id)) learned.push(def.name);
  }
  if (learned.length === 0) return;
  sound.chime();
  saveState(state);
  renderDynamic();
});

// ── Game loop: 10×/s from wall-clock time, autosave every 5s ───────────────
// advanceToNow credits the real gap since the last tick: short gaps (even a
// background tab throttled to one tick a minute) at full, tide-aware rate;
// long ones (a sleeping laptop) by the offline rules, as if the tab had been
// closed. A render error is logged once and never stops the clock.
let renderErrorLogged = false;
let lastAutomationAt = 0;
let lastGuideCheckAt = 0;
let lastGuidePageAt = 0;
/** The least time between two guide pages that open on their own. */
const GUIDE_GAP_MS = 90_000;
function gameTick(): void {
  const now = Date.now();
  // A long gap (a sleeping laptop) is time away: note the Shore before it's settled.
  const before = (now - state.lastSeen) / 1000 > LIVE_GAP_LIMIT_SECONDS ? snapshotAway(state) : null;
  const result = advanceToNow(state, now);
  trackRekindleGrowth(state);
  // The Chain Steward takes its share of what was just earned and feeds the chain.
  const fed = tendChain(state, result.gain, now);
  if (fed > 0) {
    stewardLevels += fed;
    pulseSupply();
  }
  // The Quartermaster and the Lamp Crew (with Gull Rock and Cormorant Roost) work once a second, while the game is open.
  if (result.mode === "live" && now - lastAutomationAt >= 1000) {
    lastAutomationAt = now;
    autoLearn(state);
    autoHire(state, now);
    tendBottles(state, Math.random, now);
  }
  if (result.mode === "offline") {
    welcomeBack(result.gain, result.creditedSeconds, result.elapsedSeconds);
    tendBottles(state, Math.random, now);
    if (fed > 0) addLog(state, `While you were away, your Chain Steward saw to the supply line and the Beam: ${fed} level${fed === 1 ? "" : "s"}.`);
  }
  // The guide's next page, when its part of the game first matters, if
  // nothing else is on screen (once a second, while playing).
  // At most one such page every GUIDE_GAP_MS, so two systems waking together
  // (lessons and the chain, around ten helpers) don't arrive back to back.
  if (result.mode === "live" && now - lastGuideCheckAt >= 1000 && now - lastGuidePageAt >= GUIDE_GAP_MS) {
    lastGuideCheckAt = now;
    const page = splash.isOpen || (momentEl && !momentEl.classList.contains("hidden")) ? null : dueGuidePage(state);
    if (page) {
      lastGuidePageAt = now;
      markGuideSeen(state, [page]);
      saveState(state);
      splash.open([guidePageAlone(page)], { kind: "tutorial", finishLabel: "Got it" });
    }
  }
  // Story beats fire the moment their moment arrives (cheap predicates).
  const beats = checkStory(state);
  if (beats.length > 0) {
    sound.story();
    saveState(state);
  }
  if (result.mode === "offline") {
    saveState(state);
    if (before) {
      const offlineResult = { awaySeconds: result.elapsedSeconds, creditedSeconds: result.creditedSeconds, gain: result.gain };
      showAwayCard(awayReport(state, offlineResult, before, now, { stewardLevels: fed, storyTitles: beats.map((b) => b.title) }));
    }
  }
  if (document.hidden) return; // nothing to draw; the clock still runs
  try {
    renderDynamic(now - lastFullRenderAt >= FULL_RENDER_MS);
    refreshScene();
  } catch (err) {
    if (!renderErrorLogged) {
      renderErrorLogged = true;
      console.error("Tidelight render error (the game keeps running):", err);
    }
  }
}
setInterval(gameTick, 100);
// Coming back to the tab settles the gap at once instead of on the next tick.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) gameTick();
  syncSceneRunning();
  sound.setHidden(document.hidden);
});

setInterval(() => saveState(state), 5_000);
window.addEventListener("beforeunload", () => saveState(state));

renderDynamic();
syncSceneRunning();

// A brand-new keeper (no save in this browser) starts with the guide open;
// a returning one sees what the time away brought.
// A new keeper reads the opening pages; the rest arrive with their systems (game/guide.ts).
if (isNewKeeper) {
  markGuideSeen(state, GUIDE_OPENING);
  saveState(state);
  splash.open(GUIDE_OPENING.map(guidePageUnnumbered), { kind: "tutorial", finishLabel: "Start keeping" });
} else if (bootAway) showAwayCard(bootAway);
