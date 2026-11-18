// ── Icon set ─────────────────────────────────────────────────────────────────
// Inline SVG, drawn on a 32×32 grid: strokes use currentColor (they follow the
// row's text colour), the warm accents use the --lamp token. No image files —
// the whole set ships inside the bundle and works offline in the Steam build.

const svg = (body: string, label?: string): string =>
  `<svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${
    label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'
  }>${body}</svg>`;

const FLAME = (x: number, y: number, s = 1): string =>
  `<path d="M${x} ${y - 5 * s}c${2 * s} ${2.4 * s} ${2.2 * s} ${3.6 * s} 0 ${5 * s}c${-2.2 * s} ${-1.4 * s} ${-2 * s} ${-2.6 * s} 0 ${-5 * s}z" fill="var(--lamp)" stroke="none"/>`;

/** One icon per generator id, in tier order. */
export const GENERATOR_ICONS: Record<string, string> = {
  "candle-crab": svg(
    `<ellipse cx="16" cy="22" rx="8" ry="4.5"/><path d="M8.5 21 5 17.5M7 18.5 4 19.5M23.5 21 27 17.5M25 18.5l3 1M11 25.5 9.5 28M21 25.5 22.5 28"/>` +
      `<path d="M15 17.5v-6h2v6"/>${FLAME(16, 10)}`,
  ),
  "lantern-moth": svg(
    `<path d="M16 10v13"/><path d="M15.5 13C11 7 4 8 5 13c.7 3.6 6 4.6 10.5 2"/><path d="M16.5 13C21 7 28 8 27 13c-.7 3.6-6 4.6-10.5 2"/>` +
      `<path d="M15.5 17c-3.5 1-6 3.5-4.5 6 1.2 2 3.7.4 4.5-2.5M16.5 17c3.5 1 6 3.5 4.5 6-1.2 2-3.7.4-4.5-2.5"/><path d="M15 9.5 13 6.5M17 9.5l2-3"/>` +
      `<circle cx="16" cy="13" r="2" fill="var(--lamp)" stroke="none"/>`,
  ),
  "tide-bell": svg(
    `<path d="M16 5v2.5"/><path d="M9.5 21.5c0-9 1.6-14 6.5-14s6.5 5 6.5 14z"/><path d="M7 21.5h18"/>` +
      `<circle cx="16" cy="24.5" r="1.8" fill="var(--lamp)" stroke="none"/><path d="M4 28c2 1 4 1 6 0s4-1 6 0 4 1 6 0 4-1 6 0" opacity=".6"/>`,
  ),
  "oil-keeper": svg(
    `<path d="M10 27h12M12 27v-3h8v3"/><path d="M11 24c-1.5-5 0-10 5-10s6.5 5 5 10"/><path d="M14 14v-2.5h4V14"/>` +
      `<path d="M21.5 18.5c2.5-.2 4.5 1 4.5 3"/>${FLAME(16, 10.5, 0.9)}`,
  ),
  "lens-polisher": svg(
    `<circle cx="16" cy="16" r="10"/><path d="M16 9.5a6.5 6.5 0 0 1 0 13M16 12.5a3.5 3.5 0 0 1 0 7" opacity=".75"/>` +
      `<circle cx="16" cy="16" r="1.6" fill="var(--lamp)" stroke="none"/><path d="M25 5v4M23 7h4" stroke="var(--lamp)"/>`,
  ),
  "storm-lantern": svg(
    `<path d="M12 6h8M16 3.5V6"/><path d="M11 9h10M11 25h10"/><path d="M12 9c-2 4-2 12 0 16M20 9c2 4 2 12 0 16"/>` +
      `${FLAME(16, 20, 1.2)}<path d="M5 12l3-2-1 3 3-2M27 15l-3 2 1-3-3 2" opacity=".6"/>`,
  ),
  "beacon-whale": svg(
    `<path d="M4 19c3-6 13-8 19-4 2 1.4 3 3 3.5 4.5l2.5-2.5v6l-3-1.5c-4 4.5-16 5-22-2.5z"/><circle cx="9.5" cy="18.5" r=".9" fill="currentColor"/>` +
      `<path d="M14 12.5c0-3 1-5 2-6.5" stroke="var(--lamp)"/><circle cx="16.5" cy="5" r="2" fill="var(--lamp)" stroke="none"/>`,
  ),
  "seventh-light": svg(
    `<circle cx="16" cy="16" r="4.5" fill="var(--lamp)" stroke="none"/><circle cx="16" cy="16" r="8"/>` +
      `<path d="M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4M6.5 6.5l2.8 2.8M22.7 22.7l2.8 2.8M6.5 25.5l2.8-2.8M22.7 9.3l2.8-2.8"/>`,
  ),
};

/** A silhouette for a generator tier not yet discovered. */
export const UNKNOWN_ICON = svg(`<circle cx="16" cy="16" r="10" stroke-dasharray="2 3"/><path d="M13 13a3 3 0 1 1 3.5 3c-.5.2-.5.8-.5 1.5M16 21v.5"/>`);

/** The Tidelight mark: a lighthouse throwing its beam. */
export const BRAND_MARK = svg(
  `<path d="M12.5 28 14 11h4l1.5 17z" fill="currentColor" stroke="none" opacity=".9"/><path d="M13.3 18h5.4M13 23h6" stroke="var(--ink)" stroke-width="1.8"/>` +
    `<path d="M13 11V8.5h6V11M12 8.5h8M16 6V4.5"/><path d="M19 9.2 30 6.5v6z" fill="var(--lamp)" stroke="none" opacity=".75"/>` +
    `<circle cx="16" cy="9.7" r="1.4" fill="var(--lamp)" stroke="none"/><path d="M3 28h26"/>`,
  "Tidelight",
);

/** Tab icons (shown above the label in the phone tab bar). */
export const TAB_ICONS: Record<string, string> = {
  light: svg(`<circle cx="16" cy="16" r="4.5" fill="var(--lamp)" stroke="none"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M7.5 24.5l2.8-2.8M21.7 10.3l2.8-2.8"/>`),
  upgrades: svg(`<path d="M8 6h13l3 3v17H8z"/><path d="M12 13h8M12 17h8M12 21h5"/>`),
  lighthouses: svg(`<path d="M12.5 28 14 12h4l1.5 16z"/><path d="M13 12V9h6v3M16 6.5V9"/><path d="M20 10l8-2.5v5z" fill="var(--lamp)" stroke="none"/><path d="M4 28h24"/>`),
  shore: svg(`<path d="M15.5 13C11 7 4 8 5 13c.7 3.6 6 4.6 10.5 2M16.5 13C21 7 28 8 27 13c-.7 3.6-6 4.6-10.5 2"/><path d="M16 10v9"/><path d="M4 25c3 1.5 5 1.5 8 0s5-1.5 8 0 5 1.5 8 0"/>`),
  rekindle: svg(`<path d="M16 4c5 5 7 8.5 7 13a7 7 0 0 1-14 0c0-2.5 1-4.5 2.5-6 .5 2.5 2 3.5 3.5 3.5C14.5 11 14.5 7.5 16 4z"/><path d="M16 27a3 3 0 0 1-3-3c0-1.8 1.4-3 3-4.5 1.6 1.5 3 2.7 3 4.5a3 3 0 0 1-3 3z" fill="var(--lamp)" stroke="none"/>`),
  log: svg(`<path d="M6 6.5c3-1 7-1 10 1.5 3-2.5 7-2.5 10-1.5v19c-3-1-7-1-10 1.5-3-2.5-7-2.5-10-1.5z"/><path d="M16 8v19.5"/>`),
};

/** One icon per relic id, for the relic cabinet on the Shore. */
export const RELIC_ICONS: Record<string, string> = {
  "brass-compass": svg(
    `<circle cx="16" cy="16" r="10.5"/><circle cx="16" cy="16" r="8" opacity=".5"/><path d="M16 9.5 18.3 16 16 22.5 13.7 16z" fill="var(--lamp)" stroke="none"/><path d="M16 4v2M16 26v2M4 16h2M26 16h2"/>`,
  ),
  "tide-chart": svg(
    `<path d="M6 7h20v18H6z"/><path d="M9 13c2-1.5 4-1.5 6 0s4 1.5 6 0M9 18c2-1.5 4-1.5 6 0s4 1.5 6 0" opacity=".8"/><circle cx="22" cy="10.5" r="1.3" fill="var(--lamp)" stroke="none"/><path d="M6 7c-1 0-2 1-2 2v14c0 1 1 2 2 2M26 7c1 0 2 1 2 2v14c0 1-1 2-2 2"/>`,
  ),
  "salt-lens": svg(
    `<circle cx="14" cy="14" r="8"/><path d="M10 11a5 5 0 0 1 5-3" stroke="var(--lamp)"/><path d="m20 20 7 7"/><path d="M24 6.5v3M22.5 8h3M7 23.5v2M6 24.5h2" opacity=".7"/>`,
  ),
  "keepers-coat": svg(
    `<path d="M12 5h8l2 3 5 3-2 6-3-1v11H10V16l-3 1-2-6 5-3z"/><path d="M16 8v19" opacity=".6"/><circle cx="14.5" cy="13" r=".9" fill="var(--lamp)" stroke="none"/><circle cx="14.5" cy="18" r=".9" fill="var(--lamp)" stroke="none"/>`,
  ),
  "gull-feather": svg(
    `<path d="M7 26C9 16 15 8 25 5c-1 9-7 16-16 19"/><path d="M7 26l10-12M12 21.5l-2.5-1.5M15 18.5l-2.5-2M18 15.5l-2-2.5M21 12l-1.5-2.5" opacity=".7"/>`,
  ),
  "amber-heart": svg(
    `<path d="M16 26C9 21 5 17 5 12.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 11 2.5C27 17 23 21 16 26z" fill="var(--lamp)" fill-opacity=".35"/><path d="M11 12.5a2.5 2.5 0 0 1 2.5-2.5" stroke="var(--lamp)"/>`,
  ),
  "driftwood-cradle": svg(
    `<path d="M4 17c3 6 21 6 24 0"/><path d="M6 16.5c4 2.5 16 2.5 20 0M8 21h16" opacity=".6"/><path d="M15.5 13C13 9.5 9.5 10.5 10 12.5c.4 1.6 3.4 2 5.5.9M16.5 13c2.5-3.5 6-2.5 5.5-.5-.4 1.6-3.4 2-5.5.9" fill="var(--lamp)" fill-opacity=".4"/>`,
  ),
  "storm-in-a-bottle": svg(
    `<path d="M13 4h6M14 4v5c-3 1.5-5 4-5 8v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-8c0-4-2-6.5-5-8V4"/><path d="M12 17c2-2 6-2 8 0" opacity=".6"/><path d="m17 18-3 4.5h3.5L15 27" stroke="var(--lamp)"/>`,
  ),
};

/** The header's sound toggle. */
export const SOUND_ON_ICON = svg(`<path d="M5 12.5h4.5L16 7v18l-6.5-5.5H5z"/><path d="M20 12a5 5 0 0 1 0 8M23 9a9 9 0 0 1 0 14"/>`);
export const SOUND_OFF_ICON = svg(`<path d="M5 12.5h4.5L16 7v18l-6.5-5.5H5z"/><path d="m21 13 6 6M27 13l-6 6"/>`);

// ── Upgrades, perks and challenges ───────────────────────────────────────────

/** The click lessons: a hand-held lens throwing a flash. */
export const CLICK_ICON = svg(
  `<circle cx="13" cy="13" r="7"/><path d="m18 18 7.5 7.5"/><path d="M10 10.5a3.5 3.5 0 0 1 3-2" stroke="var(--lamp)"/>` +
    `<path d="M24 4v4M22 6h4M27.5 10.5l-2 1" stroke="var(--lamp)"/>`,
);

/** Keeper-wide lessons. */
export const GLOBAL_UPGRADE_ICONS: Record<string, string> = {
  "keepers-focus": svg(
    `<path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z"/><circle cx="16" cy="16" r="4.5" fill="var(--lamp)" stroke="none"/><circle cx="16" cy="16" r="1.6" fill="var(--ink)" stroke="none"/>`,
  ),
  "longer-wicks": svg(
    `<path d="M12 28V14h8v14M10 28h12"/><path d="M16 14v-3"/>${FLAME(16, 9)}<path d="M24.5 5.5a4 4 0 1 0 3 5.5 3.2 3.2 0 0 1-3-5.5z" opacity=".8"/>`,
  ),
  "ember-resonance": svg(
    `<path d="M16 9c3 3 4.5 5.5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.6.7-3 1.6-4 .3 1.6 1.3 2.3 2.2 2.3C15 13.5 15 11 16 9z" fill="var(--lamp)" stroke="none"/>` +
      `<path d="M6.5 11a12 12 0 0 0 0 13M25.5 11a12 12 0 0 1 0 13M3 8a17 17 0 0 0 0 19M29 8a17 17 0 0 1 0 19" opacity=".7"/>`,
  ),
};

/** Ember Shop perks. */
export const PERK_ICONS: Record<string, string> = {
  "head-start": svg(
    `<path d="M4 23h24"/><path d="M8 23a8 8 0 0 1 16 0" fill="var(--lamp)" fill-opacity=".35"/><path d="M16 9v-3M8.5 12.5l-2-2M23.5 12.5l2-2M5 18H2.5M27 18h2.5"/>`,
  ),
  "warm-lamp": svg(
    `<path d="M8 22h14a4 4 0 0 0 0-8H8z"/><path d="M22 14c3 0 5.5 1 6 3M8 18H4"/><path d="M12 22v4h6v-4"/>${FLAME(6, 16.5, 0.8)}`,
  ),
  "gull-friend": svg(
    `<path d="M3 15c4-4 8-4 13 1 5-5 9-5 13-1"/><path d="M9 20c2.5-2 4.5-2 7 .5 2.5-2.5 4.5-2.5 7-.5" opacity=".6"/><circle cx="25" cy="7" r="2.5" fill="var(--lamp)" stroke="none"/>`,
  ),
  "deep-wicks": svg(
    `<path d="M10 6h12M10 26h12M12 6v20M20 6v20"/><path d="M12 11c3 1.5 5 1.5 8 0M12 16c3 1.5 5 1.5 8 0M12 21c3 1.5 5 1.5 8 0" stroke="var(--lamp)"/>`,
  ),
  "long-night": svg(
    `<path d="M20 5a10 10 0 1 0 7 15 8 8 0 0 1-7-15z" fill="var(--lamp)" fill-opacity=".3"/><path d="M8 7v3M6.5 8.5h3M24 25v2.5M22.75 26.25h2.5" stroke="var(--lamp)"/>`,
  ),
  "full-lamp": svg(
    `<path d="M11 4h10M12.5 4v5c-3.5 1.5-5.5 4.5-5.5 8.5v7a3.5 3.5 0 0 0 3.5 3.5h11a3.5 3.5 0 0 0 3.5-3.5v-7c0-4-2-7-5.5-8.5V4"/>` +
      `<path d="M7.5 16.5h17v8a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z" fill="var(--lamp)" fill-opacity=".45" stroke="none"/>`,
  ),
  "ember-heart": svg(
    `<path d="M16 27C9 22 5 18 5 13.5A5.5 5.5 0 0 1 16 11a5.5 5.5 0 0 1 11 2.5C27 18 23 22 16 27z"/>` +
      `<path d="M16 13c2 2 3 3.6 3 5.4a3 3 0 0 1-6 0c0-1 .4-1.9 1-2.5.2 1 .8 1.5 1.4 1.5-.4-1.4-.4-3 .6-4.4z" fill="var(--lamp)" stroke="none"/>`,
  ),
  "second-wind": svg(
    `<path d="M3 12h15a4 4 0 1 0-4-4"/><path d="M3 18h21a4 4 0 1 1-4 4"/><path d="M3 24h9" opacity=".6"/><circle cx="26" cy="9" r="2" fill="var(--lamp)" stroke="none"/>`,
  ),
};

/** The three challenges. */
export const CHALLENGE_ICONS: Record<string, string> = {
  fogbound: svg(
    `<path d="M4 10c4-2 8-2 12 0s8 2 12 0M2 16c4-2 8-2 12 0s8 2 12 0M4 22c4-2 8-2 12 0s8 2 12 0" opacity=".75"/><circle cx="16" cy="16" r="3" fill="var(--lamp)" fill-opacity=".5" stroke="none"/>`,
  ),
  "still-hands": svg(
    `<path d="M11 27v-6l-3.5-4.5a1.8 1.8 0 0 1 2.8-2.2L12 16V7a1.8 1.8 0 0 1 3.6 0v6V5.5a1.8 1.8 0 0 1 3.6 0V13V7a1.8 1.8 0 0 1 3.6 0v10c0 4-1.5 6-3.5 7.5V27z"/>`,
  ),
  "first-light-only": svg(
    `<path d="M7 27h18"/><path d="M10 27v-6M16 27V17M22 27v-9" stroke="var(--lamp)" stroke-width="2.5"/><path d="M10 13.5l1-1M16 9.5V8M22 10.5l-1-1" opacity=".5"/>`,
  ),
};

/** A small ember, for prices in Embers. */
export const EMBER_GLYPH = `<svg class="ember-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.5c2.6 2.5 4 4.6 4 7a4 4 0 0 1-8 0c0-1.4.6-2.7 1.4-3.5.3 1.4 1.2 2 2 2C7.1 5.5 7.1 3.3 8 1.5z" fill="currentColor"/></svg>`;

/**
 * The Rekindle hearth: a stone arch, a bed of coals and a flame. The flame
 * and coals are scaled by the CSS custom property --heat (0–1) on an
 * ancestor, so the fire grows with the Embers a Rekindle would bank.
 */
export const HEARTH_ART = `<svg class="hearth-svg" viewBox="0 0 120 120" aria-hidden="true">
  <path d="M14 112V58a46 46 0 0 1 92 0v54" fill="#0c1726" stroke="#234560" stroke-width="2"/>
  <path d="M26 112V62a34 34 0 0 1 68 0v50" fill="#060c16"/>
  <path d="M14 58h92M16 72h10M94 72h10M16 88h10M94 88h10M14 104h12M94 104h12" stroke="#1a3049" stroke-width="2"/>
  <g class="hearth-fire">
    <path class="hearth-flame-outer" d="M60 104c-15 0-22-9-22-20 0-9 6-16 10-21 1 7 5 10 8 10-3-9-2-21 9-31 1 11 7 17 12 24 4 6 5 11 5 17 0 12-8 21-22 21z" fill="#ffb347"/>
    <path class="hearth-flame-inner" d="M60 104c-8 0-12-5-12-11 0-5 3-9 6-12 1 4 3 6 5 6-1-6 0-12 6-17 1 6 4 10 6 14 2 3 3 6 3 9 0 7-6 11-14 11z" fill="#ffe8b0"/>
  </g>
  <path d="M34 106c6-5 12-5 18-1 6-4 12-4 18 0 6-4 12-4 16 1" fill="none" stroke="#c4512f" stroke-width="5" stroke-linecap="round" class="hearth-coals"/>
</svg>`;
