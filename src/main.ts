import "./style.css";
import Decimal from "break_infinity.js";
import { GENERATORS, LIGHTHOUSES, PRESTIGE_RECOMMENDED_EMBERS, type GeneratorDef } from "./game/config";
import {
  applyOfflineEarnings,
  buyGenerator,
  clickBeam,
  costFor,
  generatorProduction,
  productionPerSecond,
  tick,
  timeToAfford,
} from "./game/engine";
import { formatDuration, formatNumber } from "./game/format";
import { canRekindle, rekindle, rekindleGain } from "./game/prestige";
import { addLog, createInitialState, loadState, saveState } from "./game/state";
import type { GameState } from "./game/types";

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
    <button class="tab" data-tab="lighthouses" role="tab">Lighthouses</button>
    <button class="tab" data-tab="rekindle" role="tab">Rekindle</button>
    <button class="tab" data-tab="log" role="tab">Log</button>
  </nav>

  <main>
    <section id="view-light" class="view active">
      <div class="beam-wrap">
        <button id="flash" class="beam">✦ Flash the Beam ✦</button>
        <p class="beam-hint">+1 Lumen per flash. Hire help below and the light keeps itself.</p>
      </div>
      <div id="generators" class="gen-list"></div>
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
        <div class="row"><span>Embers held (each: +2% production)</span><strong id="rk-held">0</strong></div>
        <div class="row"><span>Production bonus now</span><strong id="rk-bonus">+0%</strong></div>
        <div class="progress-wrap">
          <div class="progress-label" id="rk-progress-label"></div>
          <div class="progress"><div id="rk-progress-bar" class="progress-bar"></div></div>
        </div>
        <div class="kept-lost">
          <div><h3>Kept</h3><ul><li>All Embers (old + new)</li><li>Stats &amp; log</li><li>All-time Lumen</li></ul></div>
          <div><h3>Lost</h3><ul><li>Current Lumen</li><li>All generators</li><li>This run's lifetime</li></ul></div>
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

// ── Generator rows (built once, updated in place) ────────────────────────────
interface GenRow {
  def: GeneratorDef;
  owned: HTMLElement;
  prod: HTMLElement;
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
      </div>
      <div class="gen-buy">
        <button class="buy">Buy</button>
        <div class="gen-cost"></div>
        <div class="gen-note muted"></div>
      </div>`;
    const buy = row.querySelector<HTMLButtonElement>(".buy");
    if (!buy) continue;
    buy.addEventListener("click", () => {
      if (buyGenerator(state, def.id, 1)) {
        saveState(state);
        renderDynamic();
      }
    });
    genList.appendChild(row);
    genRows.push({
      def,
      owned: row.querySelector(".gen-owned") as HTMLElement,
      prod: row.querySelector(".gen-prod") as HTMLElement,
      cost: row.querySelector(".gen-cost") as HTMLElement,
      note: row.querySelector(".gen-note") as HTMLElement,
      buy,
    });
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
  rkGain: document.querySelector<HTMLElement>("#rk-gain"),
  rkHeld: document.querySelector<HTMLElement>("#rk-held"),
  rkBonus: document.querySelector<HTMLElement>("#rk-bonus"),
  rkLabel: document.querySelector<HTMLElement>("#rk-progress-label"),
  rkBar: document.querySelector<HTMLElement>("#rk-progress-bar"),
  logList: document.querySelector<HTMLUListElement>("#log-list"),
};

function renderDynamic(): void {
  if (hud.lumen) hud.lumen.textContent = formatNumber(state.lumen);
  if (hud.rate) hud.rate.textContent = `${formatNumber(productionPerSecond(state))}/s`;
  if (hud.embers) hud.embers.textContent = String(state.embers);

  for (const row of genRows) {
    const owned = state.generators[row.def.id] ?? 0;
    const cost = costFor(row.def, owned);
    const affordable = state.lumen.gte(cost);
    row.owned.textContent = owned > 0 ? `× ${owned}` : "";
    row.prod.textContent =
      owned > 0
        ? `${formatNumber(generatorProduction(state, row.def))} Lumen/s`
        : `${formatNumber(new Decimal(row.def.baseProduction))} Lumen/s each`;
    row.cost.textContent = `${formatNumber(cost)} Lumen`;
    row.buy.disabled = !affordable;
    row.buy.classList.toggle("affordable", affordable);
    if (affordable) {
      row.note.textContent = "";
    } else {
      const tta = timeToAfford(state, row.def);
      row.note.textContent = Number.isFinite(tta) ? `affordable in ${formatDuration(tta)}` : "earn Lumen by flashing";
    }
  }

  // Rekindle view
  const gain = rekindleGain(state);
  if (hud.rkGain) hud.rkGain.textContent = String(gain);
  if (hud.rkHeld) hud.rkHeld.textContent = String(state.embers);
  if (hud.rkBonus) hud.rkBonus.textContent = `+${state.embers * 2}%`;
  if (hud.rkLabel) {
    hud.rkLabel.textContent =
      gain >= PRESTIGE_RECOMMENDED_EMBERS
        ? `Recommended first Rekindle: ${PRESTIGE_RECOMMENDED_EMBERS} Embers — reached ✓`
        : `Recommended first Rekindle: ${PRESTIGE_RECOMMENDED_EMBERS} Embers (${gain} so far — early Rekindles pay very little)`;
  }
  if (hud.rkBar) {
    hud.rkBar.style.width = `${Math.min(100, (gain / PRESTIGE_RECOMMENDED_EMBERS) * 100)}%`;
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
