import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    host: true, // reachable from Docker
  },
  // @oselya/shared is TS source; Vite compiles workspace deps on the fly.
  optimizeDeps: {
    exclude: ["@oselya/shared"],
  },
});
