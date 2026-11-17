import "./style.css";
import Decimal from "break_infinity.js";
import {
  GENERATORS,
  LIGHTHOUSES,
  MILESTONE_THRESHOLDS,
  PRESTIGE_RECOMMENDED_EMBERS,
  milestoneMultiplier,
  type GeneratorDef,
} from "./game/config";
import {
  applyOfflineEarnings,
  buyQuote,
  buyWithAmount,
  clickBeam,
  clickValue,
  generatorProduction,
  productionPerSecond,
  tick,
  timeToAffordCost,
} from "./game/engine";
import { formatDuration, formatNumber } from "./game/format";
import { canRekindle, rekindle, rekindleGain } from "./game/prestige";
import { addLog, createInitialState, loadState, saveState } from "./game/state";
import type { BuyAmount, GameState } from "./game/types";
import {
  UPGRADES,
  buyUpgrade,
  emberBonusPerEmber,
  isPermanentUpgrade,
  isUnlocked,
  unlockText,
  upgradeById,
  type UpgradeDef,
} from "./game/upgrades";

// ── Boot: load (or start) a game, then settle offline earnings ──────────────
const state: GameState = loadState() ?? createInitialState();
const offline = applyOfflineEarnings(state);
if (offline.gain.gt(0)) {
  addLog(
    state,
    `While you were away (${formatDuration(offline.creditedSeconds)} credited): +${formatNumber(offline.gain)} Lumen.`,
  );
}
saveState(state);

// ── Static shell: persistent header + tab menu (separate views, no long page)
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.innerHTML = `
  <header class="hud">
    <div class="brand">🗼 Tidelight</div>
    <div class="hud-stats">
      <div class="stat"><span class="stat-label">Lumen</span><strong id="hud-lumen">0</strong></div>
      <div class="stat"><span class="stat-label">per second</span><strong id="hud-rate">0</strong></div>
      <div class="stat"><span class="stat-label">Embers</span><strong id="hud-embers">0</strong></div>
    </div>
  </header>

  <nav class="tabs" role="tablist">
    <button class="tab active" data-tab="light" role="tab">Light</button>
    <button class="tab" data-tab="upgrades" role="tab">Upgrades</button>
    <button class="tab" data-tab="lighthouses" role="tab">Lighthouses</button>
    <button class="tab" data-tab="rekindle" role="tab">Rekindle</button>
    <button class="tab" data-tab="log" role="tab">Log</button>
  </nav>

  <main>
    <section id="view-light" class="view active">
      <div class="beam-wrap">
        <button id="flash" class="beam">✦ Flash the Beam ✦</button>
        <p class="beam-hint" id="beam-hint"></p>
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
      <p class="muted">One-time lessons for the light. Most are forgotten when you Rekindle — the ones marked ♾ are keeper knowledge and are kept.</p>
      <h3 class="section-title">Available</h3>
      <div id="upgrades-available" class="card-list"></div>
      <h3 class="section-title">Not yet discovered</h3>
      <div id="upgrades-locked" class="card-list"></div>
      <h3 class="section-title">Learned</h3>
      <div id="upgrades-purchased" class="card-list"></div>
    </section>

    <section id="view-lighthouses" class="view">
      <h2>The Seven Lighthouses</h2>
      <p class="muted">One burns. Six are dark shapes on a glass sea. Sprint 0 is a teaser — the voyage comes later.</p>
      <div id="lighthouse-list" class="card-list"></div>
    </section>

    <section id="view-rekindle" class="view">
      <h2>Rekindle</h2>
      <p class="muted">Let the light gutter out and light it again, stronger. Embers are banked from this run's lifetime Lumen: √(lifetime ÷ 5,000).</p>
      <div class="card">
        <div class="row"><span>Embers on Rekindle now</span><strong id="rk-gain">0</strong></div>
        <div class="row"><span id="rk-held-label">Embers held</span><strong id="rk-held">0</strong></div>
        <div class="row"><span>Production bonus now</span><strong id="rk-bonus">+0%</strong></div>
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
    </section>

    <section id="view-log" class="view">
      <h2>Keeper's Log</h2>
      <ul id="log-list" class="log-list"></ul>
    </section>
  </main>
`;

// ── Tab switching ────────────────────────────────────────────────────────────
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.querySelector(`#view-${tab.dataset.tab}`)?.classList.add("active");
    renderDynamic();
  });
}

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
        saveState(state);
        renderDynamic();
      }
    });
    genList.appendChild(row);
    genRows.push({
      def,
      owned: row.querySelector(".gen-owned") as HTMLElement,
      prod: row.querySelector(".gen-prod") as HTMLElement,
      milestone: row.querySelector(".gen-milestone") as HTMLElement,
      cost: row.querySelector(".gen-cost") as HTMLElement,
      note: row.querySelector(".gen-note") as HTMLElement,
      buy,
    });
  }
}

function milestoneHint(owned: number): string {
  const next = MILESTONE_THRESHOLDS.find((t) => owned < t);
  if (next === undefined) return `All milestones reached — production ×${milestoneMultiplier(owned)}`;
  return `Next ×2 at ${next} — ${owned}/${next}`;
}

// ── Upgrades view (rows rebuilt when the unlocked/owned structure changes) ──
interface UpgradeRow {
  def: UpgradeDef;
  buy: HTMLButtonElement;
}

const upgradeContainers = {
  available: document.querySelector<HTMLDivElement>("#upgrades-available"),
  locked: document.querySelector<HTMLDivElement>("#upgrades-locked"),
  purchased: document.querySelector<HTMLDivElement>("#upgrades-purchased"),
};
let availableUpgradeRows: UpgradeRow[] = [];
let upgradeStructureKey = "";

function upgradesStructureKey(): string {
  return UPGRADES.map((u) =>
    state.upgrades.includes(u.id) ? "P" : isUnlocked(state, u) ? "A" : "L",
  ).join("");
}

function permanentBadge(def: UpgradeDef): string {
  return def.permanent ? ` <span class="perm">♾ keeper knowledge</span>` : "";
}

function rebuildUpgrades(): void {
  availableUpgradeRows = [];
  for (const container of Object.values(upgradeContainers)) {
    if (container) container.innerHTML = "";
  }
  let availableCount = 0;
  let purchasedCount = 0;

  for (const def of UPGRADES) {
    const owned = state.upgrades.includes(def.id);
    const unlocked = owned || isUnlocked(state, def);
    const row = document.createElement("div");

    if (owned) {
      purchasedCount++;
      row.className = "gen upgrade purchased";
      row.innerHTML = `
        <div class="gen-main">
          <div class="gen-name">${def.name}${permanentBadge(def)}</div>
          <div class="gen-flavor">${def.effect}</div>
        </div>
        <div class="gen-buy"><span class="learned">Learned ✓</span></div>`;
      upgradeContainers.purchased?.appendChild(row);
    } else if (unlocked) {
      availableCount++;
      row.className = "gen upgrade";
      row.innerHTML = `
        <div class="gen-main">
          <div class="gen-name">${def.name}${permanentBadge(def)}</div>
          <div class="gen-flavor">${def.effect}</div>
        </div>
        <div class="gen-buy">
          <button class="buy">Learn</button>
          <div class="gen-cost">${formatNumber(def.cost)} Lumen</div>
        </div>`;
      const buy = row.querySelector<HTMLButtonElement>(".buy");
      if (!buy) continue;
      buy.addEventListener("click", () => {
        if (buyUpgrade(state, def.id)) {
          saveState(state);
          renderDynamic();
        }
      });
      upgradeContainers.available?.appendChild(row);
      availableUpgradeRows.push({ def, buy });
    } else {
      row.className = "gen upgrade locked";
      row.innerHTML = `
        <div class="gen-main">
          <div class="gen-name">🔒 Undiscovered upgrade</div>
          <div class="gen-flavor">${unlockText(def)}</div>
        </div>`;
      upgradeContainers.locked?.appendChild(row);
    }
  }

  if (upgradeContainers.available && availableCount === 0) {
    upgradeContainers.available.innerHTML = `<p class="muted">Nothing to learn right now — grow the light and new lessons will surface.</p>`;
  }
  if (upgradeContainers.purchased && purchasedCount === 0) {
    upgradeContainers.purchased.innerHTML = `<p class="muted">No upgrades learned yet.</p>`;
  }
}

// ── Lighthouses teaser (static content) ──────────────────────────────────────
const lhList = document.querySelector<HTMLDivElement>("#lighthouse-list");
if (lhList) {
  LIGHTHOUSES.forEach((lh, i) => {
    const card = document.createElement("div");
    card.className = `card lighthouse${i === 0 ? " lit" : " locked"}`;
    card.innerHTML = `<div class="gen-name">${i === 0 ? "🔥" : "🌑"} ${i + 1}. ${lh.name}</div><p class="muted">${lh.hint}</p>`;
    lhList.appendChild(card);
  });
}

// ── Flash the Beam ───────────────────────────────────────────────────────────
document.querySelector<HTMLButtonElement>("#flash")?.addEventListener("click", () => {
  clickBeam(state);
  renderDynamic();
});

// ── Rekindle (two-step confirm so nobody resets by accident) ────────────────
let rekindleArmed = false;
const rkButton = document.querySelector<HTMLButtonElement>("#rk-button");
rkButton?.addEventListener("click", () => {
  if (!canRekindle(state)) return;
  if (!rekindleArmed) {
    rekindleArmed = true;
    rkButton.textContent = `Are you sure? Click again to Rekindle for +${rekindleGain(state)} Embers`;
    return;
  }
  rekindleArmed = false;
  rekindle(state);
  saveState(state);
  renderDynamic();
});

// ── Rendering ────────────────────────────────────────────────────────────────
const hud = {
  lumen: document.querySelector<HTMLElement>("#hud-lumen"),
  rate: document.querySelector<HTMLElement>("#hud-rate"),
  embers: document.querySelector<HTMLElement>("#hud-embers"),
  beamHint: document.querySelector<HTMLElement>("#beam-hint"),
  rkGain: document.querySelector<HTMLElement>("#rk-gain"),
  rkHeld: document.querySelector<HTMLElement>("#rk-held"),
  rkHeldLabel: document.querySelector<HTMLElement>("#rk-held-label"),
  rkBonus: document.querySelector<HTMLElement>("#rk-bonus"),
  rkLabel: document.querySelector<HTMLElement>("#rk-progress-label"),
  rkBar: document.querySelector<HTMLElement>("#rk-progress-bar"),
  rkKept: document.querySelector<HTMLUListElement>("#rk-kept"),
  rkLost: document.querySelector<HTMLUListElement>("#rk-lost"),
  logList: document.querySelector<HTMLUListElement>("#log-list"),
};

function renderDynamic(): void {
  if (hud.lumen) hud.lumen.textContent = formatNumber(state.lumen);
  if (hud.rate) hud.rate.textContent = `${formatNumber(productionPerSecond(state))}/s`;
  if (hud.embers) hud.embers.textContent = String(state.embers);
  if (hud.beamHint) {
    hud.beamHint.textContent = `+${formatNumber(clickValue(state))} Lumen per flash. Hire help below and the light keeps itself.`;
  }

  // Buy toggle: reflect the persisted setting.
  for (const btn of toggleBtns) {
    const raw = btn.dataset.amount;
    const value: BuyAmount = raw === "max" ? "max" : (Number(raw) as BuyAmount);
    btn.classList.toggle("active", state.buyAmount === value);
  }

  for (const row of genRows) {
    const owned = state.generators[row.def.id] ?? 0;
    const quote = buyQuote(state, row.def, state.buyAmount);
    row.owned.textContent = owned > 0 ? `× ${owned}` : "";
    row.prod.textContent =
      owned > 0
        ? `${formatNumber(generatorProduction(state, row.def))} Lumen/s`
        : `${formatNumber(new Decimal(row.def.baseProduction))} Lumen/s each`;
    row.milestone.textContent = milestoneHint(owned);
    const displayCount = state.buyAmount === "max" ? quote.count : state.buyAmount;
    row.cost.textContent = `×${displayCount} · ${formatNumber(quote.cost)} Lumen`;
    row.buy.disabled = !quote.affordable;
    row.buy.classList.toggle("affordable", quote.affordable);
    row.buy.textContent =
      state.buyAmount === "max"
        ? quote.count > 0
          ? `Buy Max (×${quote.count})`
          : "Buy Max"
        : `Buy ×${state.buyAmount}`;
    if (quote.affordable) {
      row.note.textContent = quote.productionGain.gt(0) ? `+${formatNumber(quote.productionGain)} Lumen/s` : "";
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
  }

  // Rekindle view
  const gain = rekindleGain(state);
  const perEmberPct = Math.round(emberBonusPerEmber(state) * 100);
  if (hud.rkGain) hud.rkGain.textContent = String(gain);
  if (hud.rkHeld) hud.rkHeld.textContent = String(state.embers);
  if (hud.rkHeldLabel) hud.rkHeldLabel.textContent = `Embers held (each: +${perEmberPct}% production)`;
  if (hud.rkBonus) hud.rkBonus.textContent = `+${state.embers * perEmberPct}%`;
  if (hud.rkLabel) {
    hud.rkLabel.textContent =
      gain >= PRESTIGE_RECOMMENDED_EMBERS
        ? `Recommended first Rekindle: ${PRESTIGE_RECOMMENDED_EMBERS} Embers — reached ✓`
        : `Recommended first Rekindle: ${PRESTIGE_RECOMMENDED_EMBERS} Embers (${gain} so far — early Rekindles pay very little)`;
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
    hud.rkKept.innerHTML = kept.map((item) => `<li>${item}</li>`).join("");
    hud.rkLost.innerHTML = lost.map((item) => `<li>${item}</li>`).join("");
  }
  if (rkButton) {
    rkButton.disabled = !canRekindle(state);
    if (!rekindleArmed) {
      rkButton.textContent = canRekindle(state)
        ? `Rekindle the Light (+${gain} Embers)`
        : "Rekindle the Light (earn 5,000 lifetime Lumen for your first Ember)";
    }
  }

  // Log view (newest first)
  if (hud.logList) {
    hud.logList.innerHTML = state.log
      .slice()
      .reverse()
      .map((e) => `<li><span class="log-time">${new Date(e.at).toLocaleTimeString()}</span> ${e.message}</li>`)
      .join("");
  }
}

// ── Game loop: tick 10×/s from real elapsed time, autosave every 5s ────────
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min((now - lastTick) / 1000, 1); // clamp tab-switch jumps; offline handles the rest
  lastTick = now;
  tick(state, dt);
  state.lastSeen = Date.now();
  renderDynamic();
}, 100);

setInterval(() => saveState(state), 5_000);
window.addEventListener("beforeunload", () => saveState(state));

renderDynamic();
