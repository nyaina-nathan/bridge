import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "__test__/**/*.unit-test.ts",
      "__test__/**/*.integration-test.ts",
    ],
    hookTimeout: 180_000,
    mockReset: true,
    testTimeout: 30_000,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
