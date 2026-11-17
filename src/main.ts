import "./style.css";
import Decimal from "break_infinity.js";
import {
  CHAIN_LIGHTHOUSES,
  CHAIN_NODES,
  CHAIN_NODE_IDS,
  CHAIN_UNLOCK_GENERATORS,
  FIRST_LIGHT_ID,
  GENERATORS,
  GULL_ROCK_ID,
  MILESTONE_THRESHOLDS,
  PRESTIGE_RECOMMENDED_EMBERS,
  TEASER_LIGHTHOUSES,
  chainLighthouseById,
  milestoneMultiplier,
  type ChainNodeId,
  type GeneratorDef,
} from "./game/config";
import {
  buyNodeUpgrade,
  chainStatus,
  gullRockStatus,
  isLit,
  nextNodeCost,
  relightGullRock,
  totalSupport,
} from "./game/chain";
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
import { addLog, createInitialState, loadState, saveState, startBoard } from "./game/state";
import type { BuyAmount, GameState } from "./game/types";
import {
  UPGRADES,
  buyUpgrade,
  emberBonusPerEmber,
  isPermanentUpgrade,
  isUnlocked,
  totalGeneratorsOwned,
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
      <div id="chain-banner" class="chain-banner hidden" role="button" tabindex="0"></div>
      <div class="beam-wrap">
        <button id="flash" class="beam">✦ Flash the Beam ✦</button>
        <p class="beam-hint" id="beam-hint"></p>
        <p class="beam-efficiency" id="beam-efficiency"></p>
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
      <p class="muted">Lit lighthouses stay lit forever — even through a Rekindle. Their supply chains don't: every board is stripped back to its starting levels when the light gutters.</p>
      <div id="lighthouse-list" class="card-list"></div>
      <h3 class="section-title">Supply Chain — Wick → Oil → Lens → Beam</h3>
      <div id="chain-area"></div>
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
function activateTab(name: string): void {
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelector(`#view-${name}`)?.classList.add("active");
  renderDynamic();
}
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    if (tab.dataset.tab) activateTab(tab.dataset.tab);
  });
}

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

// ── Lighthouses & the supply chain ───────────────────────────────────────────
// Cards and the flow board are rebuilt when their structure changes (a
// lighthouse lights, a node level changes, the selected board switches);
// numbers, statuses and affordability refresh in place every frame.
const lhList = document.querySelector<HTMLDivElement>("#lighthouse-list");
const chainArea = document.querySelector<HTMLDivElement>("#chain-area");
let selectedBoardId: string = FIRST_LIGHT_ID;
let lhStructureKey = "";
let relightBtn: HTMLButtonElement | null = null;
let relightNote: HTMLElement | null = null;
let lockedChainNote: HTMLElement | null = null;
let chainSummary: HTMLElement | null = null;

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
  lockedChainNote = null;
  chainSummary = null;
  nodeRows = new Map();
  if (!isLit(state, selectedBoardId)) selectedBoardId = state.litLighthouses[0] ?? FIRST_LIGHT_ID;

  // ── Cards: the two chain lighthouses, then the five dark teasers ──
  if (lhList) {
    lhList.innerHTML = "";
    CHAIN_LIGHTHOUSES.forEach((def, i) => {
      const lit = isLit(state, def.id);
      const card = document.createElement("div");
      card.className = `card lighthouse${lit ? " lit" : " locked"}`;
      const bonus =
        def.productionBonus > 0 ? ` · +${Math.round(def.productionBonus * 100)}% production while lit` : "";
      card.innerHTML = `
        <div class="gen-name">${lit ? "🔥" : "🌑"} ${i + 1}. ${def.name}</div>
        <p class="muted">${def.hint}</p>
        ${lit ? `<p class="learned">Lit ✓${bonus}</p>` : ""}`;
      if (!lit && def.relightCost !== null) {
        const buyWrap = document.createElement("div");
        buyWrap.className = "relight-row";
        buyWrap.innerHTML = `<button class="buy">Relight — ${formatNumber(def.relightCost)} Lumen</button><div class="gen-note muted"></div>`;
        relightBtn = buyWrap.querySelector<HTMLButtonElement>(".buy");
        relightNote = buyWrap.querySelector<HTMLElement>(".gen-note");
        relightBtn?.addEventListener("click", () => {
          if (relightGullRock(state)) {
            selectedBoardId = def.id;
            saveState(state);
            renderDynamic();
          }
        });
        card.appendChild(buyWrap);
      }
      lhList.appendChild(card);
    });
    TEASER_LIGHTHOUSES.forEach((lh, i) => {
      const card = document.createElement("div");
      card.className = "card lighthouse locked";
      card.innerHTML = `<div class="gen-name">🌑 ${i + 3}. ${lh.name}</div><p class="muted">${lh.hint}</p>`;
      lhList.appendChild(card);
    });
  }

  // ── Chain area: locked teaser, or switcher + flow board ──
  if (!chainArea) return;
  chainArea.innerHTML = "";
  const status = chainStatus(state);
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
  const status = chainStatus(state);

  if (lockedChainNote) {
    lockedChainNote.textContent = `Own ${CHAIN_UNLOCK_GENERATORS} generators to wake it (you own ${totalGeneratorsOwned(state)}). Until then the beam burns at full strength — after that, wick, oil and lens must keep up with what your generators produce.`;
  }

  // Relight button: enabled only when every gate passes; the note says why not.
  if (relightBtn && relightNote) {
    const gr = gullRockStatus(state);
    relightBtn.disabled = !gr.canRelight;
    relightBtn.classList.toggle("affordable", gr.canRelight);
    const reasons: string[] = [];
    if (!gr.chainUnlocked) reasons.push(`wake the supply chain first (own ${CHAIN_UNLOCK_GENERATORS} generators)`);
    if (gr.chainUnlocked && !gr.efficiencyOk) {
      reasons.push(`needs beam efficiency ≥ ${Math.round(gr.efficiencyRequired * 100)}% — yours is ${Math.round(gr.efficiency * 100)}%`);
    }
    if (!gr.affordable) {
      const tta = timeToAffordCost(state, gr.cost);
      reasons.push(
        Number.isFinite(tta) ? `affordable in ${formatDuration(tta)}` : `costs ${formatNumber(gr.cost)} Lumen`,
      );
    }
    relightNote.textContent = gr.canRelight ? "The rock is within reach of your beam." : reasons.join(" · ");
  }

  const board = state.chainBoards[selectedBoardId];
  if (!board) return;
  for (const [nodeId, refs] of nodeRows) {
    const level = board[nodeId];
    refs.level.textContent = `Level ${level}`;
    const cost = nextNodeCost(state, selectedBoardId, nodeId);
    refs.cost.textContent = `${formatNumber(cost)} Lumen`;
    const affordable = state.lumen.gte(cost);
    refs.buy.disabled = !affordable;
    refs.buy.classList.toggle("affordable", affordable);
    if (affordable) {
      refs.note.textContent = `→ Level ${level + 1}`;
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
      refs.detail.textContent = `Supports ${formatNumber(totalSupport(state, nodeId))}/s of ${formatNumber(status.demand)}/s produced · ${Math.round(nodeStatus.efficiency * 100)}%`;
      const isBottleneck = status.bottleneck === nodeId;
      refs.box.classList.toggle("bottleneck", isBottleneck);
      refs.flag.textContent = isBottleneck
        ? `⚠ BOTTLENECK — short by ${formatNumber(status.shortfall)}/s`
        : "";
    }
  }

  if (chainSummary) {
    const beamPct = Math.round((status.beamMultiplier.toNumber() - 1) * 100);
    chainSummary.textContent =
      `${chainLighthouseById(selectedBoardId).name} board · Beam efficiency ${Math.round(status.efficiency * 100)}% ` +
      `(chain factor ×${status.chainFactor.toFixed(2)}${beamPct > 0 ? `, Beam +${beamPct}%` : ""}). ` +
      `Support sums across every lit lighthouse; node costs on Gull Rock's board are ×8.`;
  }
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
  beamEfficiency: document.querySelector<HTMLElement>("#beam-efficiency"),
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

  // Supply chain: efficiency line in the Light view + bottleneck banner.
  const chain = chainStatus(state);
  if (hud.beamEfficiency) {
    if (!chain.unlocked) {
      hud.beamEfficiency.textContent = "";
    } else {
      const beamPct = Math.round((chain.beamMultiplier.toNumber() - 1) * 100);
      hud.beamEfficiency.textContent = `Beam efficiency: ${Math.round(chain.efficiency * 100)}%${beamPct > 0 ? ` · Beam +${beamPct}%` : ""}`;
    }
  }
  if (chainBanner) {
    if (chain.unlocked && chain.efficiency < 1 && chain.bottleneck) {
      const bn = chain.nodes.find((n) => n.nodeId === chain.bottleneck);
      chainBanner.textContent = `⚠ ${CHAIN_NODES[chain.bottleneck].name.toUpperCase()} is limiting your beam to ${Math.round(chain.efficiency * 100)}% — supports ${formatNumber(bn?.support ?? 0)}/s vs ${formatNumber(chain.demand)}/s produced. Tap to see the chain board.`;
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
    if (isLit(state, GULL_ROCK_ID)) kept.push("Gull Rock Light stays lit (+50% production)");
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
