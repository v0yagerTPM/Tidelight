/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

// Vite serves/bundles the game; Vitest reuses this config for tests.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
