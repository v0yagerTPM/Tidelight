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
