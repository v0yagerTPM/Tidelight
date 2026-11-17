# Shipping Tidelight to Steam — the Tauri v2 wrapper guide

Tidelight is a plain Vite + TypeScript web app with **no backend, no
network calls, and no build-time secrets**. That makes it an ideal
candidate for a desktop wrapper: the entire game is the static bundle
in `dist/`. This guide wraps that bundle with **Tauri v2** (small
binaries, system webview, no Chromium to ship) and puts it on Steam.
Documentation only — no code in this repo changes.

## Why Tauri (and the one thing to know)

Tauri renders the game in the operating system's own webview
(WebView2 on Windows, WebKit on macOS/Linux) instead of bundling a
browser. The binary stays in the ~5–10 MB range. The one consequence
that matters for Tidelight is **localStorage** — see below.

## Prerequisites

| Need | Notes |
| --- | --- |
| Rust toolchain | `rustup` from https://rustup.rs — Tauri is a Rust shell around the web app |
| Node 20+ | Already required to build the game itself |
| Tauri CLI | `npm install -D @tauri-apps/cli` in this repo |
| Platform webview | Windows: WebView2 runtime (preinstalled on Windows 11; Tauri's installer can bootstrap it). macOS/Linux: system WebKit (preinstalled / `webkit2gtk` package) |
| Steamworks account | $100 Steam Direct fee per app; a Steamworks partner account and the app's App ID |

## Wrapping the game

1. Build the web bundle as usual: `npm run build` → `dist/`.
2. Initialise Tauri in the repo root: `npx tauri init`. Answer with the
   values from the config example below; point the frontend dist at
   `../dist` and the dev URL at `http://localhost:5173` (Vite's default).
3. Set `beforeBuildCommand` to `npm run build` so `npx tauri build`
   always packages a fresh bundle.

### `src-tauri/tauri.conf.json` — the values that matter

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Tidelight",
  "version": "1.0.0",
  "identifier": "app.tidelight.game",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "Tidelight — Keepers of the Hollow Sea",
        "width": 1100,
        "height": 760,
        "minWidth": 380,
        "minHeight": 560,
        "resizable": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi", "dmg", "appimage", "deb"],
    "shortDescription": "A cozy idle game about relighting seven lighthouses on a sea turned to glass."
  }
}
```

Notes:

- `identifier` (`app.tidelight.game`) is the app's permanent identity —
  it also determines where the webview stores its data. **Never change
  it after release**, or existing players' saves become unreachable.
- The window minimums match the game's responsive layout (the CSS is
  built mobile-first and works at phone width).
- No Tauri plugins or permissions are needed: the game uses no
  filesystem, network, or notification APIs. Keep the capability list
  empty — it's the smallest possible attack surface and the fastest
  Steam review.

## localStorage in the webview — read this before shipping

The game saves to `localStorage` under the key **`tidelight-save-v1`**
(the save's internal version field is separate — currently v6). In a
Tauri webview, localStorage is **persistent and per-app**: it survives
restarts and app updates, stored inside the app's data directory keyed
by the `identifier` above. Three consequences:

1. **Saves just work** — no code changes. The autosave (every 5 s and
   on every purchase) writes to the webview's localStorage exactly as
   it does in a browser.
2. **Saves are NOT in Steam Cloud by default.** If the player deletes
   the app data directory, the save is gone. Steam Cloud (Auto-Cloud)
   syncs *files*, and webview storage lives in different places per OS
   (e.g. `%LOCALAPPDATA%\app.tidelight.game\EBWebView\` on Windows) —
   pointing Auto-Cloud at a whole webview profile is fragile and can
   sync cookies/cache junk or corrupt on concurrent writes.
3. **The supported migration path is the game's own export/import**
   (below). If true Steam Cloud saves become a goal later, the proper
   route is a small save-file bridge: read/write a `save.json` in
   Tauri's `appDataDir` via the fs plugin and point Auto-Cloud at that
   folder. That's a post-launch project, not a launch blocker.

## Player migration: save export / import

The Keeper's Desk (bottom of the Log view, in-game since Sprint 5)
exists precisely for this:

- **Export** renders the full save as JSON (the exact
  `serializeState` output) with a Copy button.
- **Import** validates pasted JSON through the normal
  deserialize/sanitize path — older save versions migrate forward
  automatically, invalid JSON changes nothing.

Player instructions to ship in the Steam community hub / FAQ:

> Moving from the web version (or to a new PC)? Open the Log view,
> scroll to the Keeper's Desk, press **Export save** and copy the text
> somewhere safe. In the new copy of the game, paste it into the same
> box and press **Import save**. Everything comes with you — moths,
> relics, story, Keepings and all.

## Steam build & upload checklist

**Before the first build**

- [ ] `npm run typecheck && npm test && npm run build` all green on a
      clean checkout (139 tests at v1.0).
- [ ] Version bumped in three places that must agree: `package.json`,
      `tauri.conf.json` (`version`), and the Steam build description.
- [ ] Game tested from the *packaged* binary (not `tauri dev`) on a
      clean Windows profile: first launch, offline earnings after a
      real absence, export/import round-trip.

**Steamworks setup**

- [ ] App created in Steamworks; store page copy matches the shipped
      game (cozy idle, $9.99 premium, **no in-game store** — say so on
      the page; it's a selling point).
- [ ] Depots: one per OS you ship (Windows at minimum). Content built
      with `npx tauri build`; upload the installer/portable output via
      SteamPipe (Steamworks web upload or `steamcmd`).
- [ ] Launch options: default launch = the Tidelight executable, no
      arguments, no launcher.
- [ ] Steam Cloud: leave **disabled** at launch (see localStorage
      notes) — or enable Auto-Cloud only after the save-file bridge
      exists and has been tested with two machines.
- [ ] Achievements (optional, post-launch): the natural set already
      exists in-game — story beats, lighthouses lit, first Rekindle,
      the ending, NG+ Keepings. Wiring them needs the Steamworks API
      (a Tauri plugin or a thin Rust call) — not in the launch scope.

**Release hygiene**

- [ ] Set the build live on a **beta branch** first; play one full
      session (fresh save → first Rekindle ≈ 1¾ hours at bot pace,
      faster for a clicking human) before promoting to default.
- [ ] Keep the previous build available on a `previous` branch for
      one-click rollback.
- [ ] Post the export/import FAQ (above) in the community hub on day
      one, and pin it.
- [ ] Announce the offline-earnings rule honestly in the FAQ: 8-hour
      cap at 50% (upgrades raise both), exactly as the game states
      in its own welcome-back log lines.
