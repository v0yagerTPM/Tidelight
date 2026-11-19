import {
  BEAM_BONUS_PER_LEVEL,
  CHAIN_LIGHTHOUSES,
  CHAIN_UNLOCK_GENERATORS,
  EMBER_PRODUCTION_BONUS,
  MILESTONE_THRESHOLDS,
  OFFLINE_CAP_SECONDS,
  OFFLINE_RATE,
  PRESTIGE_RECOMMENDED_EMBERS,
} from "../game/config";
import { DUTY_GLOW_BONUS, LURE_BANK, LURE_REGROW_MS, MAX_DUTY_MOTHS } from "../game/moths";
import { TIDES } from "../game/tides";
import { BRAND_MARK, CLICK_ICON, TAB_ICONS } from "./icons";
import type { SplashPage } from "./splash";

// ── How to keep the light ────────────────────────────────────────────────────
// The tutorial splash: what a new keeper needs, one idea per page. It opens
// by itself for a brand-new keeper and again from the ? button in the header
// or the Keeper's Desk. Numbers come from the game's own constants so the
// guide can't drift from the rules.

const pct = (x: number): string => `${Math.round(x * 100)}%`;

export function tutorialPages(): SplashPage[] {
  const gates = CHAIN_LIGHTHOUSES.slice(1).map((l) => l.efficiencyRequirement);
  const hours = OFFLINE_CAP_SECONDS / 3600;
  return [
    {
      art: BRAND_MARK,
      eyebrow: "How to keep the light · 1 of 8",
      title: "Welcome to Candlewick Point",
      html: `
        <p>The sea has turned to glass, and six of its seven lighthouses have gone dark. You keep the last one burning: <strong>First Light</strong>.</p>
        <p>Your goal is to relight all seven, one after another, ending at <strong>The Hollow Light</strong>.</p>
        <p><strong>Lumen</strong> is your light and your money. The top bar shows how much you hold, how much you make per second, and your <strong>Embers</strong> (more on those later).</p>`,
    },
    {
      art: CLICK_ICON,
      eyebrow: "The Light tab · 2 of 8",
      title: "Make light",
      html: `
        <ul>
          <li><strong>Flash the Beam</strong> (or tap the scene) for a little Lumen by hand.</li>
          <li><strong>Hire helpers</strong> below the scene, starting with Candle Crabs. Each produces Lumen every second, even while you watch; each copy costs a little more than the last.</li>
          <li>Owning ${MILESTONE_THRESHOLDS.join(", ")} of one helper <strong>doubles</strong> its output each time.</li>
          <li>Use <strong>×1 / ×10 / ×100 / Max</strong> to buy in bulk. Bigger helpers answer as lighthouses relight.</li>
        </ul>`,
    },
    {
      art: TAB_ICONS.upgrades,
      eyebrow: "The Upgrades tab · 3 of 8",
      title: "Learn upgrades",
      html: `
        <p>Upgrades are one-time lessons, most of which double a helper's output or your clicks. They appear as you grow.</p>
        <p>Most are forgotten when you Rekindle; the ones marked <strong>♾</strong> are keeper knowledge and stay with you.</p>`,
    },
    {
      art: TAB_ICONS.lighthouses,
      eyebrow: "The supply chain · 4 of 8",
      title: "Feed the supply chain",
      html: `
        <p>Once you own ${CHAIN_UNLOCK_GENERATORS} helpers, the lamp needs supplies: <strong>Wick → Oil → Lens</strong> must each carry your production.</p>
        <ul>
          <li><strong>Efficiency</strong> is set by the weakest node. The beam runs at 25% + 75% × efficiency, so a starved chain throttles everything.</li>
          <li>The <strong>supply strip</strong> under the scene shows all three. The weakest one glows: press its <strong>Feed</strong>, or <strong>Fill the chain</strong> to feed it until the beam is full.</li>
          <li><strong>Beam</strong> levels add +${pct(BEAM_BONUS_PER_LEVEL)} production each. Relight Widow's Walk and a <strong>Chain Steward</strong> feeds the chain for you.</li>
        </ul>`,
    },
    {
      art: TAB_ICONS.lighthouses,
      eyebrow: "The Lighthouses tab · 5 of 8",
      title: "Relight the lighthouses",
      html: `
        <p>Lighthouses relight in order. Each costs Lumen and asks for a well-fed beam: chain efficiency of ${pct(gates[0])} for the first, rising to ${pct(gates[gates.length - 1])} for The Hollow Light.</p>
        <p>A lit lighthouse <strong>stays lit forever</strong>, even through a Rekindle. Each brings a new supply board, a lasting bonus, and often a new kind of helper.</p>`,
    },
    {
      art: TAB_ICONS.rekindle,
      eyebrow: "The Rekindle tab · 6 of 8",
      title: "Rekindle for Embers",
      html: `
        <p>When growth slows, <strong>Rekindle</strong>: your run's Lumen, helpers, most upgrades and chain levels reset, and you bank <strong>Embers</strong>: √(this run's lifetime Lumen ÷ 5,000).</p>
        <ul>
          <li>Every Ember you hold adds <strong>+${pct(EMBER_PRODUCTION_BONUS)}</strong> to all production, so the next run is much faster.</li>
          <li>About ${PRESTIGE_RECOMMENDED_EMBERS} Embers makes a good first Rekindle. The tab shows what you keep, what you lose, and how long recovering will take.</li>
          <li>Spend Embers in the <strong>Ember Shop</strong> on permanent perks, and try <strong>Challenges</strong> for lasting rewards.</li>
        </ul>`,
    },
    {
      art: TAB_ICONS.shore,
      eyebrow: "The Shore tab · 7 of 8",
      title: "Moths and bottles",
      html: `
        <ul>
          <li>Hire a Lantern Moth helper to open the <strong>Moth Garden</strong>. Wild moths come on lures: you hold ${LURE_BANK}, and one regrows every ${LURE_REGROW_MS / 60_000} minutes.</li>
          <li>Up to ${MAX_DUTY_MOTHS} moths on <strong>duty</strong> each add glow × ${(DUTY_GLOW_BONUS * 100).toFixed(1)}% to production. <strong>Breed</strong> two for brighter, rarer wings; post one at a lighthouse to strengthen its chain; fill the <strong>Wing Almanac</strong> for rewards.</li>
          <li>Send <strong>bottles</strong> out on the glass for Lumen, permanent <strong>relics</strong> and pieces of the story. A moth can ride along.</li>
          <li>Moths, relics and the story are yours for good: a Rekindle never touches them.</li>
        </ul>`,
    },
    {
      art: TAB_ICONS.log,
      eyebrow: "Tides & time away · 8 of 8",
      title: "The sea keeps time",
      html: `
        <ul>
          <li>The <strong>tide</strong> turns every 30 minutes, and the strip on the Light tab forecasts it exactly: ${TIDES.map((t) => `${t.icon} ${t.name}`).join(", ")}.</li>
          <li><strong>Away from the lamp</strong>, your keepers earn ${pct(OFFLINE_RATE)} of your production for up to ${hours} hours (upgrades, relics and lighthouses raise both). Cocoons, lures and bottles keep going too, and a card tells you what happened when you're back.</li>
          <li>The game <strong>saves itself</strong> in this browser. Export a copy from the Keeper's Desk in the Log tab.</li>
        </ul>
        <p>Hover over (or press and hold) anything with a dotted underline or an ⓘ for more about it.</p>
        <p class="splash-reopen">Open this guide again any time with the <strong>?</strong> button at the top, or from the Keeper's Desk.</p>`,
    },
  ];
}
