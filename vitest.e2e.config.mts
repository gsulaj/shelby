import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Browser-driven endurance tests (npm run test:loop). Kept out of `npm test` because they need the dev server
// and run for minutes.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.e2e.ts"],
    testTimeout: 300_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
