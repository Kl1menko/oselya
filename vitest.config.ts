import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Sim and server logic is Node-side; no DOM needed for MVP unit tests.
    environment: "node",
    include: ["packages/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/sim/src/**", "packages/server/src/**"],
    },
  },
});
