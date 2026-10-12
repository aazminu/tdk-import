import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["e2e/global-setup.ts"],
    // The e2e tests spawn the built CLI, up to three times per test; a loaded runner needs more than 5 s.
    testTimeout: 30_000,
  },
});
