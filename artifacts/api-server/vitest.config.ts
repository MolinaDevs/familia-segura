import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      PREMIUM_BYPASS: "true",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://familia:familia@localhost:55432/familia_segura",
    },
  },
});
