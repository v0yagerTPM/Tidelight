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
  FIRST_LIGHT_ID,
  GENERATORS,
  HOLLOW_LIGHT_ID,
  MILESTONE_THRESHOLDS,
  PRESTIGE_RECOMMENDED_EMBERS,
  chainLighthouseById,
  milestoneMultiplier,
  type ChainNodeId,
  type GeneratorDef,
} from "./game/config";
import {
  abandonChallenge,
  activeChallenge,
  canBuyGenerator,
  challengeById,
  challengeProgress,
  generatorLockedBy,
  startChallenge,
  CHALLENGES,
} from "./game/challenges";
import {
  buyNodeUpgrade,
  chainStatus,
  isLit,
  lighthouseStatus,
  nextLighthouseId,
  nextLevelSupportGain,
  nextNodeCost,
  relightLighthouse,
  totalSupport,
} from "./game/chain";
import { EMBER_PERKS, buyPerk, type EmberPerkDef } from "./game/emberShop";
import {
  advanceToNow,
  applyOfflineEarnings,
  buyQuote,
  buyWithAmount,
  clickBeam,
  clickValue,
  generatorProduction,
  productionPerSecond,
  timeToAffordCost,
} from "./game/engine";
import { estimateRecoveryMinutes } from "./game/estimate";
import {
  EXPEDITION_ROUTES,
  RELICS,
  claimExpedition,
  expeditionReady,
  routeById,
  sendExpedition,
} from "./game/expeditions";
import { formatDuration, formatNumber } from "./game/format";
import {
  MAX_DUTY_MOTHS,
  attractCost,
  attractMoth,
  cocoonReady,
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
  releasePayout,
  roostExpansionCost,
  startBreeding,
  toggleDuty,
} from "./game/moths";
import { legacyMultiplier, startNgPlus } from "./game/ngplus";
import { canRekindle, rekindle, rekindleGain } from "./game/prestige";
import { STORY_ACTS, STORY_BEATS, checkStory } from "./game/story";
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
import type { BuyAmount, GameState } from "./game/types";
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
  PERK_ICONS,
  HEARTH_ART,
  RELIC_ICONS,
  SOUND_OFF_ICON,
  SOUND_ON_ICON,
  TAB_ICONS,
  UNKNOWN_ICON,
} from "./ui/icons";
import {
  UPGRADES,
  buyUpgrade,
  emberBonusPerEmber,
  isPermanentUpgrade,
  isUnlocked,
  totalGeneratorsOwned,
  unlockProgress,
  unlockText,
  upgradeById,
  type UpgradeDef,
} from "./game/upgrades";

// ── Boot: load (or start) a game, then settle offline earnings ──────────────
const state: GameState = loadState() ?? createInitialState();

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
    if (state.cocoon && cocoonReady(state)) shoreNotes.push("the cocoon is ready to hatch");
    if (state.expedition && expeditionReady(state)) shoreNotes.push("a bottle has washed back onto the glass");
    if (shoreNotes.length > 0) {
      addLog(state, `While you were away: ${shoreNotes.join(", and ")} — see the Shore.`);
    }
  }
}

const offline = applyOfflineEarnings(state);
welcomeBack(offline.gain, offline.creditedSeconds, offline.awaySeconds);
// Story beats can be earned offline too (a lighthouse of Lumen, a record
// crossed in the dark) — deliver whatever is due before the first frame.
checkStory(state);
saveState(state);

// ── Static shell: persistent header + tab menu (separate views, no long page)
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.innerHTML = `
  <header class="hud">
    <div class="brand"><span class="brand-mark">${BRAND_MARK}</span><span class="brand-name">Tidelight</span></div>
    <button id="sound-toggle" class="sound-toggle" aria-pressed="true" aria-label="Sound"></button>
    <div class="hud-stats">
      <div class="stat"><span class="stat-label">Lumen</span><strong id="hud-lumen">0</strong></div>
      <div class="stat"><span class="stat-label">per second</span><strong id="hud-rate">0</strong></div>
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
      <div id="chain-banner" class="chain-banner hidden" role="button" tabindex="0"></div>
      <div class="scene">
        <canvas id="scene-canvas" aria-hidden="true"></canvas>
        <div id="tide-strip" class="tide-strip"></div>
        <div class="scene-foot">
          <button id="flash" class="beam">Flash the Beam</button>
          <p class="beam-hint" id="beam-hint"></p>
          <p class="beam-efficiency" id="beam-efficiency"></p>
        </div>
      </div>
      <div class="buy-toggle" role="group" aria-label="Buy amount">
        <span class="buy-toggle-label">Buy</span>
        <button class="toggle-btn" data-amount="1">×1</button>
        <button class="toggle-btn" data-amount="10">×10</button>
        <button class="toggle-btn" data-amount="100">×100</button>
        <button class="toggle-btn" data-amount="max">Max</button>
      </div>
      <div id="generators" class="gen-list"></div>
    </section>

    <section id="view-upgrades" class="view">
      <h2>Upgrades</h2>
      <p class="muted">One-time lessons for the light. Most are forgotten when you Rekindle — the ones marked ♾ are keeper knowledge and are kept. <span id="upgrades-summary"></span></p>
      <h3 class="section-title">Ready to learn</h3>
      <div id="upgrades-available" class="lesson-grid"></div>
      <h3 class="section-title">Not yet discovered</h3>
      <div id="upgrades-locked" class="lesson-grid locked-grid"></div>
      <h3 class="section-title">Learned</h3>
      <div id="upgrades-purchased" class="lesson-shelf"></div>
    </section>

    <section id="view-lighthouses" class="view">
      <h2>The Seven Lighthouses</h2>
      <p class="muted">Lit lighthouses stay lit forever — even through a Rekindle. Their supply chains don't: every board is stripped back to its starting levels when the light gutters. They relight in order, and each demands a beam running at its efficiency — tend the chain, then reach.</p>
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
      <h2>The Shore</h2>
      <p class="muted">What the glass sea gives back. Moths, relics and story fragments are permanent — they roost through every Rekindle.</p>
      <div class="meadow"><canvas id="meadow-canvas" aria-hidden="true"></canvas></div>
      <h3 class="section-title">Lantern Moth Garden</h3>
      <div id="moth-area"></div>
      <h3 class="section-title">Bottle Expeditions</h3>
      <div id="expedition-area"></div>
      <h3 class="section-title">Relics of the Glass Sea</h3>
      <div id="relic-shelf" class="relic-cabinet"></div>
    </section>

    <section id="view-rekindle" class="view">
      <h2>Rekindle</h2>
      <p class="muted">Let the light gutter out and light it again, stronger. Embers are banked from this run's lifetime Lumen: √(lifetime ÷ 5,000).</p>
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
      </div>

      <h3 class="section-title">Ember Shop</h3>
      <p class="muted">Spend held Embers on permanent perks. Every Ember spent lowers your held-Ember production bonus — that's the trade. <span id="shop-held"></span></p>
      <div id="ember-shop" class="perk-grid"></div>

      <h3 class="section-title">Challenges</h3>
      <p class="muted">Opt-in rule-changing runs. Starting one resets your run like a Rekindle — but grants no Embers. Reach the goal to bank a permanent reward; the run then continues. Abandoning resets the run with no reward.</p>
      <div id="challenges" class="trial-list"></div>
    </section>

    <section id="view-log" class="view">
      <h2>The Story So Far</h2>
      <div id="story-area"></div>
      <h2>Keeper's Log</h2>
      <ul id="log-list" class="log-list"></ul>
      <h3 class="section-title">Keeper's Desk</h3>
      <div class="card desk">
        <div class="row"><span>Number notation</span>
          <span class="buy-toggle desk-toggle">
            <button class="toggle-btn" id="notation-standard">Standard (1.23M)</button>
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
  if (name === "rekindle") recoveryCacheKey = "";
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

// The bottleneck banner in the Light view jumps straight to the chain board.
const chainBanner = document.querySelector<HTMLDivElement>("#chain-banner");
chainBanner?.addEventListener("click", () => activateTab("lighthouses"));
chainBanner?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") activateTab("lighthouses");
});

// ── Buy-amount toggle (persisted in the save) ────────────────────────────────
const toggleBtns = Array.from(document.querySelectorAll<HTMLButtonElement>(".toggle-btn"));
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
  milestone: HTMLElement;
  cost: HTMLElement;
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
        <div class="gen-name">${def.name} <span class="gen-owned"></span></div>
        <div class="gen-flavor">${def.flavor}</div>
        <div class="gen-prod muted"></div>
        <div class="gen-milestone muted"></div>
      </div>
      <div class="gen-buy">
        <button class="buy">Buy</button>
        <div class="gen-cost"></div>
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
    genRows.push({
      def,
      row,
      ring: row.querySelector(".gen-ring-fill") as SVGCircleElement,
      owned: row.querySelector(".gen-owned") as HTMLElement,
      prod: row.querySelector(".gen-prod") as HTMLElement,
      milestone: row.querySelector(".gen-milestone") as HTMLElement,
      cost: row.querySelector(".gen-cost") as HTMLElement,
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

/** The art for a lesson: its generator, the beam's lens, or a keeper-wide mark. */
function lessonIcon(def: UpgradeDef): string {
  if (def.kind === "generator" && def.generatorId) return GENERATOR_ICONS[def.generatorId] ?? UNKNOWN_ICON;
  if (def.kind === "click") return CLICK_ICON;
  return GLOBAL_UPGRADE_ICONS[def.id] ?? UNKNOWN_ICON;
}

/** Where a lesson belongs: "Candle Crab · lesson I", "Flash the Beam · tier 2", "Keeper-wide". */
function lessonKind(def: UpgradeDef): string {
  if (def.kind === "generator" && def.generatorId) {
    const gen = GENERATORS.find((g) => g.id === def.generatorId);
    return `${gen?.name ?? "Helper"} · lesson\u00a0${def.id.endsWith("-u2") ? "II" : "I"}`;
  }
  if (def.kind === "click") return `Flash the Beam · tier\u00a0${def.id.replace("click-", "")}`;
  return "Keeper-wide";
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
    const seal = def.kind === "global" ? "" : `<span class="lesson-seal">×2</span>`;
    card.innerHTML = `
      <div class="lesson-art">${lessonIcon(def)}${seal}</div>
      <div class="lesson-body">
        <div class="lesson-kind">${lessonKind(def)}</div>
        <h4 class="lesson-name">${def.name}</h4>
        <p class="lesson-effect">${def.effect}</p>
        ${def.permanent ? `<p class="lesson-perm">♾ Keeper knowledge — kept through every Rekindle</p>` : ""}
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
    chip.innerHTML = `<span class="lesson-chip-icon">${lessonIcon(def)}</span><span class="lesson-chip-name">${def.name}</span><span class="lesson-chip-mark">${def.permanent ? "♾" : "✓"}</span>`;
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
interface PerkRow {
  def: EmberPerkDef;
  buy: HTMLButtonElement;
  warning: HTMLElement;
}
const shopContainer = document.querySelector<HTMLDivElement>("#ember-shop");
let shopRows: PerkRow[] = [];
let shopStructureKey: string | null = null;

function rebuildEmberShop(): void {
  shopRows = [];
  if (!shopContainer) return;
  shopContainer.innerHTML = "";
  for (const def of EMBER_PERKS) {
    const owned = state.emberPerks.includes(def.id);
    const card = document.createElement("article");
    card.className = `perk${owned ? " owned" : ""}`;
    card.innerHTML = `
      <div class="perk-art">${PERK_ICONS[def.id] ?? UNKNOWN_ICON}</div>
      <div class="perk-body">
        <h4 class="perk-name">${def.name}</h4>
        <p class="perk-effect">${def.effect}</p>
        ${owned ? "" : `<p class="perk-warning"></p>`}
      </div>
      <div class="perk-foot">
        ${
          owned
            ? `<span class="learned">Kindled ✓ · permanent</span>`
            : `<span class="perk-cost">${EMBER_GLYPH}${fmt(def.costEmbers)}</span><button class="buy">Kindle</button>`
        }
      </div>`;
    if (!owned) {
      const buy = card.querySelector<HTMLButtonElement>(".buy");
      const warning = card.querySelector<HTMLElement>(".perk-warning");
      if (!buy || !warning) continue;
      buy.addEventListener("click", () => {
        if (buyPerk(state, def.id)) {
          sound.chime();
          saveState(state);
          renderDynamic();
        }
      });
      shopRows.push({ def, buy, warning });
    }
    shopContainer.appendChild(card);
  }
}

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
          <div><dt>Goal</dt><dd>${fmt(def.goalLifetime)} lifetime Lumen in one run</dd></div>
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
      html += `<button class="buy challenge-start" ${active ? "disabled" : ""}>Start challenge — resets your run, no Embers</button>
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
const expeditionArea = document.querySelector<HTMLDivElement>("#expedition-area");
const relicShelf = document.querySelector<HTMLDivElement>("#relic-shelf");
let shoreStructureKey: string | null = null;
let breedParentA = "";
let breedParentB = "";

interface ShoreRefs {
  attractBtn: HTMLButtonElement | null;
  attractNote: HTMLElement | null;
  roostBtn: HTMLButtonElement | null;
  roostNote: HTMLElement | null;
  cocoonNote: HTMLElement | null;
  hatchBtn: HTMLButtonElement | null;
  expeditionNote: HTMLElement | null;
  claimBtn: HTMLButtonElement | null;
  sendBtns: { routeId: string; btn: HTMLButtonElement; note: HTMLElement | null }[];
}
let shoreRefs: ShoreRefs = {
  attractBtn: null, attractNote: null, roostBtn: null, roostNote: null,
  cocoonNote: null, hatchBtn: null, expeditionNote: null, claimBtn: null, sendBtns: [],
};

function shoreKey(): string {
  return [
    mothsUnlocked(state) ? "U" : "L",
    state.moths.map((m) => m.id).join(","),
    state.mothDuty.join(","),
    state.roostExpansions,
    state.cocoon ? `${state.cocoon.parentIds.join("+")}@${state.cocoon.readyAt}` : "-",
    state.expedition ? `${state.expedition.routeId}@${state.expedition.returnsAt}` : "-",
    state.relics.join(","),
  ].join("|");
}

function rebuildShore(): void {
  shoreRefs = {
    attractBtn: null, attractNote: null, roostBtn: null, roostNote: null,
    cocoonNote: null, hatchBtn: null, expeditionNote: null, claimBtn: null, sendBtns: [],
  };

  // ── Moth Garden ──
  if (mothArea) {
    mothArea.innerHTML = "";
    if (!mothsUnlocked(state)) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="gen-name">🔒 The roost is quiet</div>
        <p class="muted">Hire a Lantern Moth (the second helper, in the Light view) and the wild moths of the glass sea will start following your light home. Collect them, set the brightest on duty, and breed new wings.</p>`;
      mothArea.appendChild(card);
    } else {
      // Controls: attract + roost expansion.
      const controls = document.createElement("div");
      controls.className = "card";
      controls.innerHTML = `
        <div class="gen-name">🦋 The Roost</div>
        <p class="muted moth-roost-line"></p>
        <div class="shore-actions">
          <span class="shore-action"><button class="buy moth-attract">Attract a moth</button><span class="gen-note muted moth-attract-note"></span></span>
          <span class="shore-action"><button class="buy moth-roost">Expand the roost (+2)</button><span class="gen-note muted moth-roost-note"></span></span>
        </div>`;
      shoreRefs.attractBtn = controls.querySelector<HTMLButtonElement>(".moth-attract");
      shoreRefs.attractNote = controls.querySelector<HTMLElement>(".moth-attract-note");
      shoreRefs.roostBtn = controls.querySelector<HTMLButtonElement>(".moth-roost");
      shoreRefs.roostNote = controls.querySelector<HTMLElement>(".moth-roost-note");
      shoreRefs.attractBtn?.addEventListener("click", () => {
        if (attractMoth(state, Math.random)) {
          sound.chime();
          saveState(state);
          renderDynamic();
        }
      });
      shoreRefs.roostBtn?.addEventListener("click", () => {
        if (expandRoost(state)) {
          saveState(state);
          renderDynamic();
        }
      });
      mothArea.appendChild(controls);

      // Collection cards.
      const list = document.createElement("div");
      list.className = "card-list";
      const onDuty = dutyMoths(state);
      for (const moth of state.moths) {
        const pattern = patternById(moth.pattern);
        const isDuty = onDuty.some((m) => m.id === moth.id);
        const inCocoon = isCocoonParent(state, moth.id);
        const card = document.createElement("div");
        card.className = `gen moth${isDuty ? " purchased" : ""}`;
        card.innerHTML = `
          <div class="moth-portrait"><div class="moth-swatch" style="background:${pattern.swatch}"></div></div>
          <div class="gen-main">
            <div class="gen-name">${pattern.emoji} ${moth.name}${isDuty ? ` <span class="perm">on duty</span>` : ""}${inCocoon ? ` <span class="perm">in the cocoon</span>` : ""}</div>
            <div class="gen-flavor">${pattern.name} wings (tier ${pattern.tier}) · glow ${moth.glow} · generation ${moth.generation}${isDuty ? ` · duty bonus +${(moth.glow * 0.2).toFixed(1)}%` : ""}</div>
          </div>
          <div class="gen-buy moth-actions">
            <button class="buy moth-duty">${isDuty ? "Stand down" : "Put on duty"}</button>
            <button class="buy moth-release">Release (+${fmt(releasePayout(state, moth))})</button>
          </div>`;
        const dutyBtn = card.querySelector<HTMLButtonElement>(".moth-duty");
        dutyBtn?.addEventListener("click", () => {
          if (toggleDuty(state, moth.id)) {
            saveState(state);
            renderDynamic();
          }
        });
        const releaseBtn = card.querySelector<HTMLButtonElement>(".moth-release");
        if (releaseBtn && !inCocoon) {
          armTwoStep(releaseBtn, `Are you sure? ${moth.name} won't come back`, () => {
            if (releaseMoth(state, moth.id) !== null) {
              saveState(state);
              renderDynamic();
            }
          });
        }
        if (inCocoon && releaseBtn) releaseBtn.disabled = true;
        list.appendChild(card);
      }
      if (state.moths.length === 0) {
        list.innerHTML = `<p class="muted">No moths yet. Attract one — the first always remembers the way.</p>`;
      }
      mothArea.appendChild(list);

      // Breeding: two selects + cocoon card.
      const breed = document.createElement("div");
      breed.className = "card";
      if (state.cocoon) {
        const a = mothById(state, state.cocoon.parentIds[0]);
        const b = mothById(state, state.cocoon.parentIds[1]);
        breed.innerHTML = `
          <div class="gen-name">🌀 The Cocoon</div>
          <p class="muted">${a?.name ?? "?"} × ${b?.name ?? "?"} — something small is dreaming in there.</p>
          <p class="muted cocoon-note"></p>
          <button class="buy cocoon-hatch">Hatch</button>`;
        shoreRefs.cocoonNote = breed.querySelector<HTMLElement>(".cocoon-note");
        shoreRefs.hatchBtn = breed.querySelector<HTMLButtonElement>(".cocoon-hatch");
        shoreRefs.hatchBtn?.addEventListener("click", () => {
          if (hatchCocoon(state, Math.random)) {
            sound.chime();
            saveState(state);
            renderDynamic();
          }
        });
      } else if (state.moths.length >= 2) {
        if (!state.moths.some((m) => m.id === breedParentA)) breedParentA = state.moths[0].id;
        if (!state.moths.some((m) => m.id === breedParentB) || breedParentB === breedParentA) {
          breedParentB = state.moths.find((m) => m.id !== breedParentA)?.id ?? "";
        }
        const options = state.moths
          .map((m) => `<option value="${m.id}">${m.name} (${patternById(m.pattern).name}, glow ${m.glow})</option>`)
          .join("");
        breed.innerHTML = `
          <div class="gen-name">🌀 Breeding</div>
          <p class="muted">Choose two moths. The child inherits a parent's wing pattern (usually the rarer one, ± a tier of luck), the average of their glows, and a little chaos. Parents keep their wings — nobody is consumed. A cocoon takes 5 minutes, even while you're away.</p>
          <div class="shore-actions">
            <select class="breed-select breed-a">${options}</select>
            <select class="breed-select breed-b">${options}</select>
            <button class="buy breed-start">Spin a cocoon</button>
          </div>`;
        const selA = breed.querySelector<HTMLSelectElement>(".breed-a");
        const selB = breed.querySelector<HTMLSelectElement>(".breed-b");
        if (selA) {
          selA.value = breedParentA;
          selA.addEventListener("change", () => { breedParentA = selA.value; });
        }
        if (selB) {
          selB.value = breedParentB;
          selB.addEventListener("change", () => { breedParentB = selB.value; });
        }
        breed.querySelector<HTMLButtonElement>(".breed-start")?.addEventListener("click", () => {
          if (startBreeding(state, breedParentA, breedParentB)) {
            sound.buy();
            saveState(state);
            renderDynamic();
          }
        });
      } else {
        breed.innerHTML = `
          <div class="gen-name">🌀 Breeding</div>
          <p class="muted">Breeding needs two moths. Attract another, and the roost gets interesting.</p>`;
      }
      mothArea.appendChild(breed);
    }
  }

  // ── Expeditions ──
  if (expeditionArea) {
    expeditionArea.innerHTML = "";
    if (state.expedition) {
      const route = routeById(state.expedition.routeId);
      const card = document.createElement("div");
      card.className = "card challenge active";
      card.innerHTML = `
        <div class="gen-name">🍾 Out at sea — ${route?.name ?? "an unknown route"}</div>
        <p class="muted expedition-note"></p>
        <button class="buy expedition-claim">Claim the bottle</button>`;
      shoreRefs.expeditionNote = card.querySelector<HTMLElement>(".expedition-note");
      shoreRefs.claimBtn = card.querySelector<HTMLButtonElement>(".expedition-claim");
      shoreRefs.claimBtn?.addEventListener("click", () => {
        if (claimExpedition(state, Math.random)) {
          sound.chime();
          saveState(state);
          renderDynamic();
        }
      });
      expeditionArea.appendChild(card);
    }
    const routes = document.createElement("div");
    routes.className = "card-list";
    for (const route of EXPEDITION_ROUTES) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="gen-name">${route.name}</div>
        <p class="muted">${route.flavor}</p>
        <p class="muted">${route.durationMinutes >= 60 ? `${route.durationMinutes / 60} hour${route.durationMinutes > 60 ? "s" : ""}` : `${route.durationMinutes} minutes`} · relic chance ${Math.round(route.relicChance * 100)}% · cache at least ${fmt(route.minCache)} Lumen</p>
        <button class="buy route-send">Send a bottle — ${fmt(route.cost)} Lumen</button>
        <span class="gen-note muted route-note"></span>`;
      const btn = card.querySelector<HTMLButtonElement>(".route-send");
      const note = card.querySelector<HTMLElement>(".route-note");
      if (btn) {
        btn.addEventListener("click", () => {
          if (sendExpedition(state, route.id)) {
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

/** In-place refresh of the Shore's moving parts: costs, countdowns, gates. */
function updateShoreView(now: number): void {
  const roostLine = mothArea?.querySelector<HTMLElement>(".moth-roost-line");
  if (roostLine) {
    const duty = dutyMoths(state);
    roostLine.textContent = `Roost: ${state.moths.length}/${mothCapacity(state)} moths · ${duty.length}/${MAX_DUTY_MOTHS} on duty (duty glow ${dutyGlowTotal(state)} → +${(dutyGlowTotal(state) * 0.2).toFixed(1)}% production). Moths are permanent — Rekindle can't touch them.`;
  }
  if (shoreRefs.attractBtn && shoreRefs.attractNote) {
    const cost = attractCost(state);
    const full = state.moths.length >= mothCapacity(state);
    const affordable = state.lumen.gte(cost);
    shoreRefs.attractBtn.disabled = full || !affordable;
    shoreRefs.attractBtn.classList.toggle("affordable", !full && affordable);
    shoreRefs.attractBtn.textContent = `Attract a moth — ${fmt(cost)} Lumen`;
    if (full) {
      shoreRefs.attractNote.textContent = "the roost is full — expand it, release a moth, or make room by hatching later";
    } else if (!affordable) {
      const tta = timeToAffordCost(state, cost);
      shoreRefs.attractNote.textContent = Number.isFinite(tta) ? `affordable in ${formatDuration(tta)}` : "earn Lumen first";
    } else {
      shoreRefs.attractNote.textContent = "a new moth follows the light home";
    }
  }
  if (shoreRefs.roostBtn && shoreRefs.roostNote) {
    const cost = roostExpansionCost(state);
    const affordable = state.lumen.gte(cost);
    shoreRefs.roostBtn.disabled = !affordable;
    shoreRefs.roostBtn.classList.toggle("affordable", affordable);
    shoreRefs.roostBtn.textContent = `Expand the roost (+2) — ${fmt(cost)} Lumen`;
    shoreRefs.roostNote.textContent = affordable ? `room for ${mothCapacity(state) + 2}` : "";
  }
  if (state.cocoon && shoreRefs.cocoonNote) {
    const ready = cocoonReady(state, now);
    const full = state.moths.length >= mothCapacity(state);
    shoreRefs.cocoonNote.textContent = ready
      ? full
        ? "Ready to hatch — but the roost is full. Expand it or release a moth first."
        : "Ready to hatch."
      : `Hatches in ${formatDuration((state.cocoon.readyAt - now) / 1000)}.`;
    if (shoreRefs.hatchBtn) {
      shoreRefs.hatchBtn.disabled = !ready || full;
      shoreRefs.hatchBtn.classList.toggle("affordable", ready && !full);
    }
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
    btn.disabled = busy || !affordable;
    btn.classList.toggle("affordable", !busy && affordable);
    if (note) {
      if (busy) note.textContent = "one bottle at a time — the sea is only so wide";
      else if (!affordable) {
        const tta = timeToAffordCost(state, new Decimal(route.cost));
        note.textContent = Number.isFinite(tta) ? `affordable in ${formatDuration(tta)}` : "";
      } else note.textContent = "";
    }
  }
}

// ── Recovery estimate (cached: it runs a bounded bot sim, not per-frame) ────
let recoveryCacheKey = "";
let recoveryCache: number | null = null;

function recoveryEstimate(): number | null {
  const key = [
    rekindleGain(state),
    state.embers,
    state.totalRekindles,
    state.emberPerks.join(","),
    state.litLighthouses.join(","),
    state.activeChallenge ?? "",
  ].join("|");
  if (key !== recoveryCacheKey) {
    recoveryCacheKey = key;
    recoveryCache = estimateRecoveryMinutes(state);
  }
  return recoveryCache;
}

function formatRecovery(minutes: number | null): string {
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
    <div class="gen-name">🌅 The Sea Remembers</div>
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

function lighthouseStructureKey(): string {
  const levels = state.litLighthouses
    .map((id) => CHAIN_NODE_IDS.map((n) => state.chainBoards[id]?.[n] ?? 0).join(","))
    .join(";");
  const unlocked = totalGeneratorsOwned(state) >= CHAIN_UNLOCK_GENERATORS;
  return `${state.litLighthouses.join(",")}|${selectedBoardId}|${unlocked}|${levels}`;
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
        <div class="gen-name"><span class="lh-num">${i + 1}</span> ${def.name}</div>
        ${isNextCard ? `<p class="muted">${def.hint}</p>${bonus ? `<p class="lh-grants">Relighting it grants: ${bonus}</p>` : ""}` : ""}
        ${lit ? `<p class="learned">Lit ✓${bonus ? ` — ${bonus}` : ""}</p>` : ""}`;
      if (!lit && def.id === relightTargetId) {
        const buyWrap = document.createElement("div");
        buyWrap.className = "relight-row";
        buyWrap.innerHTML = `<button class="buy">Relight — ${fmt(def.relightCost ?? 0)} Lumen</button><div class="gen-note muted"></div>`;
        relightBtn = buyWrap.querySelector<HTMLButtonElement>(".buy");
        relightNote = buyWrap.querySelector<HTMLElement>(".gen-note");
        relightBtn?.addEventListener("click", () => {
          if (relightLighthouse(state, def.id, Date.now())) {
            selectedBoardId = def.id;
            checkStory(state);
            saveState(state);
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
        card.innerHTML += `<p class="muted">Dark — after ${prev?.name ?? "the previous light"} · ${fmt(def.relightCost)} Lumen${gate}${bonus ? ` · grants ${bonus}` : ""}</p>`;
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
      <div class="gen-name">🔒 The supply chain is asleep</div>
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
      <div class="node-head"><span class="node-name">${def.name}</span><span class="node-status"></span></div>
      <div class="node-level"></div>
      <div class="gen-flavor">${def.flavor}</div>
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

function statusWord(efficiency: number): { word: string; cls: string } {
  if (efficiency >= 1) return { word: "● FLOWING", cls: "status-flowing" };
  if (efficiency >= 0.7) return { word: "● STRAINED", cls: "status-strained" };
  return { word: "● STARVED", cls: "status-starved" };
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
    relightBtn.textContent = `Relight — ${fmt(ls.cost)} Lumen`;
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
        Number.isFinite(tta) ? `affordable in ${formatDuration(tta)}` : `costs ${fmt(ls.cost)} Lumen`,
      );
    }
    relightNote.textContent = ls.canRelight
      ? `${def.name} is within reach of your beam.`
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
      refs.note.textContent = Number.isFinite(tta) ? `affordable in ${formatDuration(tta)}` : "earn Lumen first";
    }

    if (nodeId === "beam") {
      const total = status.beamLevels;
      refs.status.textContent = `+${Math.round((status.beamMultiplier.toNumber() - 1) * 100)}% output`;
      refs.status.className = "node-status status-flowing";
      refs.detail.textContent = `${total} Beam level${total === 1 ? "" : "s"} across all boards · +5% production each`;
      refs.box.classList.remove("bottleneck");
      refs.flag.textContent = "";
    } else {
      const nodeStatus = status.nodes.find((n) => n.nodeId === nodeId);
      if (!nodeStatus) continue;
      const { word, cls } = statusWord(nodeStatus.efficiency);
      refs.status.textContent = word;
      refs.status.className = `node-status ${cls}`;
      refs.detail.textContent = `Supports ${fmt(totalSupport(state, nodeId, Date.now()))}/s of ${fmt(status.demand)}/s produced · ${pct(nodeStatus.efficiency)}`;
      const isBottleneck = status.bottleneck === nodeId;
      refs.box.classList.toggle("bottleneck", isBottleneck);
      refs.flag.textContent = isBottleneck
        ? `⚠ BOTTLENECK — short by ${fmt(status.shortfall)}/s`
        : "";
    }
  }

  if (chainSummary) {
    const beamPct = Math.round((status.beamMultiplier.toNumber() - 1) * 100);
    const boardDef = chainLighthouseById(selectedBoardId);
    chainSummary.textContent =
      `${boardDef.name} board · Beam efficiency ${pct(status.efficiency)} ` +
      `(chain factor ×${status.chainFactor.toFixed(2)}${beamPct > 0 ? `, Beam +${beamPct}%` : ""}). ` +
      `Support sums across every lit lighthouse. This board works at ×${boardDef.boardScale} scale: its levels cost and support ×${boardDef.boardScale}.`;
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
        ? `<div class="gen-name">📖 ${beat.title}</div><p>${beat.text}</p>`
        : `<div class="gen-name">🌫 A story not yet heard</div><p class="muted">${beat.hint}</p>`;
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

function flashBeam(): void {
  const now = Date.now();
  const value = clickValue(state, now);
  clickBeam(state, now);
  sound.flash();
  if (value.gt(0)) scene?.flash(`+${fmt(value)}`);
  renderDynamic();
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
const MOMENT_TEXT_DELAY: Record<MomentKind, number> = { rekindle: 2.2, relight: 1.2, ending: 4.6 };

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
if (rkButton) {
  armTwoStep(rkButton, () => `Are you sure? Click again to Rekindle for +${fmt(rekindleGain(state))} Embers`, () => {
    if (!canRekindle(state)) return;
    const gained = rekindle(state);
    saveState(state);
    renderDynamic();
    sound.rekindle();
    playMoment(
      "rekindle",
      "Rekindle",
      "The light catches again",
      `+${fmt(gained)} Embers banked. You hold ${fmt(state.embers)}, and every flame burns +${fmt(state.embers * Math.round(emberBonusPerEmber(state) * 100))}% brighter.`,
    );
  });
}

// ── Rendering ────────────────────────────────────────────────────────────────
const hud = {
  lumen: document.querySelector<HTMLElement>("#hud-lumen"),
  rate: document.querySelector<HTMLElement>("#hud-rate"),
  embers: document.querySelector<HTMLElement>("#hud-embers"),
  beamHint: document.querySelector<HTMLElement>("#beam-hint"),
  beamEfficiency: document.querySelector<HTMLElement>("#beam-efficiency"),
  rkGain: document.querySelector<HTMLElement>("#rk-gain"),
  rkHeld: document.querySelector<HTMLElement>("#rk-held"),
  rkHeldLabel: document.querySelector<HTMLElement>("#rk-held-label"),
  rkTotal: document.querySelector<HTMLElement>("#rk-total"),
  rkBonus: document.querySelector<HTMLElement>("#rk-bonus"),
  rkAfter: document.querySelector<HTMLElement>("#rk-after"),
  rkHearth: document.querySelector<HTMLElement>("#rk-hearth"),
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

function renderDynamic(): void {
  const nowMs = Date.now();
  if (hud.lumen) hud.lumen.textContent = fmt(state.lumen);
  if (hud.rate) hud.rate.textContent = `${fmt(productionPerSecond(state, nowMs))}/s`;
  if (hud.embers) hud.embers.textContent = fmt(state.embers);
  if (hud.beamHint) {
    hud.beamHint.textContent = `+${fmt(clickValue(state, nowMs))} Lumen per flash. Hire help below and the light keeps itself.`;
  }

  // Tide strip (Sprint 4): current tide, its effect in words, the turn
  // countdown, and what's coming next.
  if (hud.tideStrip) {
    const [current, next] = tideForecast(nowMs);
    const stormRelic =
      current.def.id === "storm" && state.relics.includes("storm-in-a-bottle")
        ? " Your Storm in a Bottle hums: ×1.45 for you."
        : "";
    const nextHint = next.def.id === "storm" ? " — shore up your chain." : "";
    hud.tideStrip.innerHTML =
      `${current.def.icon} <strong>${current.def.name}</strong><span class="tide-detail"> — ${current.def.effectText}${stormRelic}</span> ` +
      `<span class="tide-turn">· turns in ${formatDuration((current.endsAt - nowMs) / 1000)} · next: ${next.def.icon} ${next.def.name}<span class="tide-detail">${nextHint}</span></span>`;
  }

  // Challenge banner in the Light view while a challenge run is active.
  if (challengeBanner) {
    const progress = challengeProgress(state);
    if (progress) {
      challengeBanner.textContent = `⚔ Challenge: ${progress.def.name} — ${fmt(progress.current)} / ${fmt(progress.goal)} lifetime Lumen. Tap for details.`;
      challengeBanner.classList.remove("hidden");
    } else {
      challengeBanner.classList.add("hidden");
    }
  }

  // Supply chain: efficiency line in the Light view + bottleneck banner.
  const chain = chainStatus(state, nowMs);
  if (hud.beamEfficiency) {
    if (!chain.unlocked) {
      hud.beamEfficiency.textContent = "";
    } else {
      const beamPct = Math.round((chain.beamMultiplier.toNumber() - 1) * 100);
      hud.beamEfficiency.textContent = `Beam efficiency: ${pct(chain.efficiency)}${beamPct > 0 ? ` · Beam +${beamPct}%` : ""}`;
    }
  }
  if (chainBanner) {
    if (chain.unlocked && chain.efficiency < 1 && chain.bottleneck) {
      const bn = chain.nodes.find((n) => n.nodeId === chain.bottleneck);
      chainBanner.textContent = `⚠ ${CHAIN_NODES[chain.bottleneck].name} is the bottleneck: it supports ${fmt(bn?.support ?? 0)}/s of ${fmt(chain.demand)}/s produced (${pct(chain.efficiency)}), so the beam runs at ${Math.round(chain.chainFactor * 100)}% strength. Tap to see the chain board.`;
      chainBanner.classList.remove("hidden");
    } else {
      chainBanner.classList.add("hidden");
    }
  }

  // Lighthouses view: rebuild on structure change, refresh in place after.
  const key2 = lighthouseStructureKey();
  if (key2 !== lhStructureKey) {
    lhStructureKey = key2;
    rebuildLighthouses();
  }
  updateChainView();
  updateCoastPins();

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
      : `Hire a ${GENERATORS[revealUpTo].name} and you'll see what else answers the light.`;
  }
  for (const row of genRows) {
    const owned = state.generators[row.def.id] ?? 0;
    row.ring.style.strokeDashoffset = String(100 - milestoneProgress(owned) * 100);
    row.row.classList.toggle("owned", owned > 0);
    const quote = buyQuote(state, row.def, state.buyAmount);
    row.owned.textContent = owned > 0 ? `× ${owned}` : "";
    row.prod.textContent =
      owned > 0
        ? `${fmt(generatorProduction(state, row.def))} Lumen/s`
        : `${fmt(new Decimal(row.def.baseProduction))} Lumen/s each`;
    row.milestone.textContent = milestoneHint(owned);
    const displayCount = state.buyAmount === "max" ? quote.count : state.buyAmount;
    row.cost.textContent = `×${displayCount} · ${fmt(quote.cost)} Lumen`;
    // First Light Only challenge: tiers 4+ are blocked outright.
    const blockedByChallenge = !canBuyGenerator(state, row.def.id);
    const waitingOn = generatorLockedBy(state, row.def.id);
    row.row.classList.toggle("waiting", waitingOn !== null);
    row.buy.disabled = !quote.affordable || blockedByChallenge;
    row.buy.classList.toggle("affordable", quote.affordable && !blockedByChallenge);
    row.buy.textContent =
      state.buyAmount === "max"
        ? quote.count > 0
          ? `Buy Max (×${quote.count})`
          : "Buy Max"
        : `Buy ×${state.buyAmount}`;
    if (waitingOn) {
      row.note.textContent = `Answers the light of ${chainLighthouseById(waitingOn).name} — relight it to hire`;
    } else if (blockedByChallenge) {
      row.note.textContent = "Blocked — First Light Only challenge";
    } else if (quote.affordable) {
      row.note.textContent = quote.productionGain.gt(0) ? `+${fmt(quote.productionGain)} Lumen/s` : "";
    } else {
      const tta = timeToAffordCost(state, quote.cost);
      row.note.textContent = Number.isFinite(tta) ? `affordable in ${formatDuration(tta)}` : "earn Lumen by flashing";
    }
  }

  // Upgrades view: rebuild on structure change, refresh affordability in place.
  const key = upgradesStructureKey();
  if (key !== upgradeStructureKey) {
    upgradeStructureKey = key;
    rebuildUpgrades();
  }
  for (const row of availableUpgradeRows) {
    const affordable = state.lumen.gte(row.def.cost);
    row.buy.disabled = !affordable;
    row.buy.classList.toggle("affordable", affordable);
    if (affordable) {
      row.note.textContent = "";
    } else {
      const tta = timeToAffordCost(state, new Decimal(row.def.cost));
      row.note.textContent = Number.isFinite(tta) ? `Affordable in ${formatDuration(tta)}` : "";
    }
  }
  for (const row of lockedUpgradeRows) {
    row.bar.style.width = `${Math.round(unlockProgress(state, row.def) * 100)}%`;
  }

  // Rekindle view
  const gain = rekindleGain(state);
  const perEmberPct = Math.round(emberBonusPerEmber(state) * 100);
  if (hud.rkGain) hud.rkGain.textContent = fmt(gain);
  if (hud.rkHeld) hud.rkHeld.textContent = fmt(state.embers);
  if (hud.rkHeldLabel) hud.rkHeldLabel.textContent = `Embers held (each: +${perEmberPct}% production)`;
  if (hud.rkTotal) hud.rkTotal.textContent = fmt(state.embersTotalEarned);
  if (hud.rkBonus) hud.rkBonus.textContent = bonusText(state.embers * perEmberPct);
  if (hud.rkAfter) {
    hud.rkAfter.textContent = state.activeChallenge !== null || gain < 1 ? "—" : bonusText((state.embers + gain) * perEmberPct);
  }
  // The hearth's fire grows toward the recommended Rekindle (40 Embers) —
  // and beyond it, with the gain relative to what's already held.
  if (hud.rkHearth) {
    const target = Math.max(PRESTIGE_RECOMMENDED_EMBERS, state.embers);
    const heat = gain <= 0 ? 0.08 : Math.min(1, 0.15 + 0.85 * (gain / target));
    hud.rkHearth.style.setProperty("--heat", heat.toFixed(3));
    hud.rkHearth.classList.toggle("ready", gain >= PRESTIGE_RECOMMENDED_EMBERS && state.activeChallenge === null);
  }
  if (hud.rkRecovery) {
    hud.rkRecovery.textContent =
      state.activeChallenge !== null
        ? "— (finish or abandon your challenge first)"
        : gain >= 1
          ? formatRecovery(recoveryEstimate())
          : "— (earn 5,000 lifetime Lumen for your first Ember)";
  }
  if (hud.rkLabel) {
    hud.rkLabel.textContent =
      gain >= PRESTIGE_RECOMMENDED_EMBERS
        ? `Recommended first Rekindle: ${PRESTIGE_RECOMMENDED_EMBERS} Embers — reached ✓`
        : `Recommended first Rekindle: ${PRESTIGE_RECOMMENDED_EMBERS} Embers (${fmt(gain)} so far — early Rekindles pay very little)`;
  }
  if (hud.rkBar) {
    hud.rkBar.style.width = `${Math.min(100, (gain / PRESTIGE_RECOMMENDED_EMBERS) * 100)}%`;
  }
  if (hud.rkKept && hud.rkLost) {
    const kept: string[] = ["All Embers (old + new)", "Stats & log", "All-time Lumen"];
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
  const shopKey = state.emberPerks.join(",");
  if (shopKey !== shopStructureKey) {
    shopStructureKey = shopKey;
    rebuildEmberShop();
  }
  if (hud.shopHeld) {
    hud.shopHeld.textContent = `You hold ${fmt(state.embers)} Embers (${fmt(state.embersTotalEarned)} earned all-time).`;
  }
  for (const row of shopRows) {
    const affordable = state.embers >= row.def.costEmbers;
    row.buy.disabled = !affordable;
    row.buy.classList.toggle("affordable", affordable);
    const bonusLoss = row.def.costEmbers * perEmberPct;
    row.warning.textContent = `Spending ${row.def.costEmbers} Embers lowers your held bonus by ${bonusLoss}% (from ${bonusText(state.embers * perEmberPct)} to ${bonusText((state.embers - row.def.costEmbers) * perEmberPct)}).`;
  }

  // The Shore: rebuild on structure change, refresh costs/countdowns in place.
  const sKey = shoreKey();
  if (sKey !== shoreStructureKey) {
    shoreStructureKey = sKey;
    rebuildShore();
  }
  updateShoreView(nowMs);

  // Challenges: rebuild on active/completed change, refresh progress in place.
  const chKey = challengesStructureKey();
  if (chKey !== challengeStructureKey) {
    challengeStructureKey = chKey;
    rebuildChallenges();
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
          `<li${e.message.startsWith("📖") ? ` class="story-entry"` : ""}><span class="log-time">${new Date(e.at).toLocaleTimeString()}</span> ${e.message}</li>`,
      )
      .join("");
  }
}

// ── Game loop: 10×/s from wall-clock time, autosave every 5s ───────────────
// advanceToNow credits the real gap since the last tick: short gaps (even a
// background tab throttled to one tick a minute) at full, tide-aware rate;
// long ones (a sleeping laptop) by the offline rules, as if the tab had been
// closed. A render error is logged once and never stops the clock.
let renderErrorLogged = false;
function gameTick(): void {
  const result = advanceToNow(state, Date.now());
  if (result.mode === "offline") {
    welcomeBack(result.gain, result.creditedSeconds, result.elapsedSeconds);
    saveState(state);
  }
  // Story beats fire the moment their moment arrives (cheap predicates).
  if (checkStory(state).length > 0) {
    sound.story();
    saveState(state);
  }
  if (document.hidden) return; // nothing to draw; the clock still runs
  try {
    renderDynamic();
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
