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
  "memory-ship": svg(
    `<path d="M5 21h22l-3.5 5h-15z"/><path d="M15 21V5M15 6c5 2 8 6 8 13H15M15 9c-3.5 2-5.5 5.5-6 10h6"/>` +
      `${FLAME(19.5, 25, 0.8)}<path d="M3 29c3 1 5 1 8 0s5-1 8 0 5 1 8 0" opacity=".55"/>`,
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
  // Late perks
  quartermaster: svg(
    `<rect x="7" y="5" width="18" height="23" rx="2"/><path d="M12 5V3h8v2"/><path d="M11 12l2 2 4-4M11 19l2 2 4-4" stroke="var(--lamp)"/><path d="M19 13h3M19 20h3"/>`,
  ),
  "lamp-crew": svg(
    `<circle cx="10" cy="10" r="3"/><circle cx="22" cy="10" r="3"/><path d="M4 24c0-4 3-7 6-7s6 3 6 7M16 24c0-4 3-7 6-7s6 3 6 7"/>${FLAME(16, 8, 0.8)}`,
  ),
  "warm-hearth": svg(
    `<path d="M5 27V14l11-8 11 8v13z"/><path d="M12 27v-6a4 4 0 0 1 8 0v6"/>${FLAME(16, 24, 0.9)}`,
  ),
  "steward-ledger": svg(
    `<path d="M6 6h9a3 3 0 0 1 3 3v17a2 2 0 0 0-2-2H6zM26 6h-6a2 2 0 0 0-2 2"/><path d="M26 6v18h-8"/><path d="M9 11h5M9 15h5M9 19h3" stroke="var(--lamp)"/>`,
  ),
  "storm-charts": svg(
    `<path d="M4 7l8-3 8 3 8-3v21l-8 3-8-3-8 3z"/><path d="M12 4v21M20 7v21" opacity=".5"/><path d="M17 11l-3 5h4l-3 5" stroke="var(--lamp)"/>`,
  ),
  "moth-lantern": svg(
    `<path d="M12 5h8M13 5v3h6V5M11 8h10l-1 15H12z"/><path d="M14 27h4"/><path d="M16 15c-2-2-4-2-4 0s2 2 4 0c2 2 4 2 4 0s-2-2-4 0z" fill="var(--lamp)" fill-opacity=".6" stroke="none"/>`,
  ),
  "ember-memory": svg(
    `<path d="M16 5a9 9 0 0 0-9 9c0 3.5 2 5.5 2 8v3h14v-3c0-2.5 2-4.5 2-8a9 9 0 0 0-9-9z"/><path d="M12 28h8"/>${FLAME(16, 18, 1.1)}`,
  ),
  "glass-charts": svg(
    `<path d="M5 8l7-3 8 3 7-3v19l-7 3-8-3-7 3z"/><path d="M12 5v19M20 8v19" opacity=".5"/><path d="M8 18c3-4 7-2 9-6s5-3 7-3" stroke="var(--lamp)" stroke-dasharray="2 2"/>`,
  ),
  // The far shelf (opens with Siren's Rest)
  "second-memory": svg(
    `<path d="M12 5a8 8 0 0 0-8 8c0 3 1.7 4.8 1.7 7v3h12.6v-3c0-2.2 1.7-4 1.7-7a8 8 0 0 0-8-8z"/><path d="M20 7.5a8 8 0 0 1 8 5.5c0 3-1.7 4.8-1.7 7v3h-5" opacity=".6"/>${FLAME(12, 16, 0.9)}`,
  ),
  "moth-watch": svg(
    `<circle cx="16" cy="16" r="11" opacity=".5"/><path d="M16 16c-3-3-6-3-6 0s3 3 6 0c3 3 6 3 6 0s-3-3-6 0z" fill="var(--lamp)" fill-opacity=".7" stroke="none"/><path d="M16 3v3M16 26v3M3 16h3M26 16h3" stroke="var(--lamp)"/>`,
  ),
  "full-hearth": svg(
    `<path d="M3 27V14l13-9 13 9v13z"/><path d="M9 27v-5a3 3 0 0 1 6 0v5M17 27v-5a3 3 0 0 1 6 0v5"/>${FLAME(12, 24, 0.7)}${FLAME(20, 24, 0.7)}`,
  ),
};

/** Kindlings: repeatable Ember perks. */
export const KINDLING_ICONS: Record<string, string> = {
  "ember-glow": svg(`<circle cx="16" cy="17" r="7" fill="var(--lamp)" fill-opacity=".3"/><path d="M16 3v4M16 27v2M4 17H2M30 17h-2M7 8l2 2M25 8l-2 2"/>${FLAME(16, 21, 1.4)}`),
  "quick-lures": svg(`<path d="M16 4v8"/><circle cx="16" cy="15" r="3" fill="var(--lamp)" stroke="none"/><path d="M9 22c2-2 4-2 7 0 3-2 5-2 7 0M5 27h22" opacity=".7"/><path d="M24 6l3-2M24 10h4" stroke="var(--lamp)"/>`),
  "spinning-silk": svg(`<path d="M16 3v5"/><ellipse cx="16" cy="17" rx="6" ry="9"/><path d="M10.5 13c3 1.5 8 1.5 11 0M10.5 19c3 1.5 8 1.5 11 0" opacity=".6"/><path d="M25 8a6 6 0 0 1 0 8" stroke="var(--lamp)"/>`),
  tailwind: svg(`<path d="M3 11h16a3 3 0 1 0-3-3M3 17h21a3 3 0 1 1-3 3"/><path d="M20 26c3-1 5-3 6-6" stroke="var(--lamp)"/><path d="M3 23h8" opacity=".6"/>`),
  "long-watch": svg(`<circle cx="16" cy="17" r="10"/><path d="M16 11v6l4 3"/><path d="M12 4h8" stroke="var(--lamp)"/>`),
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

/** The bottle splash: a message bottle, cork and scroll, on a little swell. */
export const BOTTLE_ART = `<svg class="bottle-art" viewBox="0 0 96 96" width="96" height="96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g class="bottle-body">
    <path d="M30 30c-6 6-6 14 0 20l16 16c6 6 14 6 20 0s6-14 0-20L50 30c-6-6-14-6-20 0z" fill="rgba(143,214,196,0.14)"/>
    <path d="M30 30 24 24M24 24l-4-4"/>
    <rect class="bottle-cork" x="13" y="13" width="9" height="7" rx="2" transform="rotate(45 17.5 16.5)" fill="var(--lamp-deep)" stroke="none"/>
    <path d="M38 40c4-2 9 3 13 1s8 3 12 1l-5 13c-4 2-8-3-12-1s-9-3-13-1z" fill="var(--lamp-soft)" stroke="var(--lamp-deep)" stroke-width="1.2"/>
    <path d="M42 45h14M41 49h12" stroke="var(--lamp-deep)" stroke-width="1"/>
    <path d="M58 36c3 1 5 3 6 6" stroke="rgba(255,255,255,0.55)"/>
  </g>
  <path class="bottle-swell" d="M6 82c8 4 14 4 22 0s14-4 22 0 14 4 22 0 14-4 22 0" stroke="var(--seafoam)" opacity="0.7"/>
</svg>`;

// ── Glyphs: icons that sit inside a line of text ────────────────────────────
// Headings, log lines, the tide strip, the welcome-back card. They replace
// the system emoji the UI used to borrow (🦋 🍾 📖 🌀 🔒 🌊 🌕 🪞 ⛈️ …),
// which drew in each platform's own colours and broke the nocturne palette
// (design review). Sized 1em so they follow the text; same 32-grid, same
// currentColor strokes and lamp accents as the rest of the set.
const glyph = (body: string): string =>
  `<svg class="glyph" viewBox="0 0 32 32" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const GLYPHS = {
  moth: glyph(
    `<path d="M15.5 13C11 7 4 8 5 13c.7 3.6 6 4.6 10.5 2M16.5 13C21 7 28 8 27 13c-.7 3.6-6 4.6-10.5 2"/><path d="M16 10v12"/>` +
      `<path d="M15.5 17c-3 1-5 3-4 5.5M16.5 17c3 1 5 3 4 5.5"/><circle cx="16" cy="13" r="1.8" fill="var(--lamp)" stroke="none"/>`,
  ),
  bottle: glyph(
    `<path d="M13.5 4h5M14.5 4v6.5C11.5 12 10 14.5 10 18v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8c0-3.5-1.5-6-4.5-7.5V4"/>` +
      `<path d="M10.5 20c3.5-1.5 7.5 1.5 11 0" stroke="var(--lamp)"/>`,
  ),
  book: glyph(`<path d="M6 6.5c3-1 7-1 10 1.5 3-2.5 7-2.5 10-1.5v19c-3-1-7-1-10 1.5-3-2.5-7-2.5-10-1.5z"/><path d="M16 8v19.5"/>`),
  cocoon: glyph(
    `<path d="M16 3v4"/><ellipse cx="16" cy="18" rx="6" ry="10"/>` +
      `<path d="M10.5 14c3 1.5 8 1.5 11 0M10.2 19c3 1.5 8.6 1.5 11.6 0M11 24c3 1.2 7 1.2 10 0" opacity=".7"/>`,
  ),
  lock: glyph(`<rect x="8" y="14" width="16" height="13" rx="2"/><path d="M11 14v-4a5 5 0 0 1 10 0v4"/><circle cx="16" cy="20.5" r="1.6" fill="var(--lamp)" stroke="none"/>`),
  tower: glyph(`<path d="M12.5 28 14 12h4l1.5 16z"/><path d="M13 12V9h6v3M16 6.5V9"/><path d="M20 10l8-2.5v5z" fill="var(--lamp)" stroke="none"/><path d="M4 28h24"/>`),
  dawn: glyph(`<path d="M9 23a7 7 0 0 1 14 0z" fill="var(--lamp)" fill-opacity=".35"/><path d="M4 23h24M8 27h16"/><path d="M16 8v3M7.5 13l2 2M24.5 13l-2 2"/>`),
  fog: glyph(`<path d="M5 11c3-2 6-2 9 0s6 2 9 0M7 17c3-2 6-2 9 0s6 2 9 0M5 23c3-2 6-2 9 0s6 2 9 0" opacity=".85"/>`),
  hourglass: glyph(`<path d="M9 4h14M9 28h14"/><path d="M10 4c0 6 6 8 6 12s-6 6-6 12M22 4c0 6-6 8-6 12s6 6 6 12"/><path d="M12.5 26c1.5-1.8 5.5-1.8 7 0z" fill="var(--lamp)" stroke="none"/>`),
  gear: glyph(`<circle cx="16" cy="16" r="3.5" fill="var(--lamp)" stroke="none"/><circle cx="16" cy="16" r="7.5"/><path d="M16 4v4.5M16 23.5V28M4 16h4.5M23.5 16H28M7.5 7.5l3.2 3.2M21.3 21.3l3.2 3.2M7.5 24.5l3.2-3.2M21.3 10.7l3.2-3.2"/>`),
  scroll: glyph(`<path d="M10 6h13a3 3 0 0 1 0 6h-2v13a3 3 0 0 1-3 3H8a3 3 0 0 1 0-6h2z"/><path d="M14 13h4M14 17h4" opacity=".7"/><path d="M10 6a3 3 0 0 0-3 3"/>`),
  challenge: glyph(`<path d="M9 28V4"/><path d="M9 5h15l-4 5 4 5H9z" fill="var(--lamp)" fill-opacity=".35"/>`),
};

/** One glyph per tide id (tides.ts), for the tide strip, forecast and tutorial. */
export const TIDE_GLYPHS: Record<string, string> = {
  low: glyph(`<path d="M16 5v9M12 10l4 4 4-4" stroke="var(--lamp)"/><path d="M3 20c3-2 5-2 8 0s5 2 8 0 5-2 8 0"/><path d="M6 26h20" opacity=".6"/>`),
  high: glyph(`<path d="M19 3.5a7 7 0 1 0 7 10 6 6 0 0 1-7-10z" fill="var(--lamp)" stroke="none"/><path d="M3 21c3-2 5-2 8 0s5 2 8 0 5-2 8 0M3 26.5c3-2 5-2 8 0s5 2 8 0 5-2 8 0"/>`),
  calm: glyph(`<path d="M4 19h24"/><path d="M8 23.5h16M11 27.5h10" opacity=".6"/><path d="M16 5v8M12 9h8" stroke="var(--lamp)"/>`),
  storm: glyph(`<path d="M9 18a5 5 0 0 1 .5-10 7 7 0 0 1 13 1.5A4.5 4.5 0 0 1 23 18z"/><path d="M17 18l-3 5h4l-3 6" stroke="var(--lamp)"/>`),
};

/** A moth's wing pattern as a small dot of its own swatch, in place of an emoji. */
export function wingDot(swatch: string, label: string): string {
  return `<span class="wing-dot" style="background:${swatch}" role="img" aria-label="${label} wings"></span>`;
}
