/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

// Vite serves/bundles the game; Vitest reuses this config for tests.
export default defineConfig({
  // Relative asset paths ("./assets/…"), so the same build runs wherever it
  // is served: GitHub Pages under /Tidelight/, a claude.ai Artifact, or the
  // Tauri webview's local files for the Steam build.
  base: "./",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
