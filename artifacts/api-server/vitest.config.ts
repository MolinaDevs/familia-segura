import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/globalSetup.ts"],
    setupFiles: ["test/setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      PREMIUM_BYPASS: "true",
      RATE_LIMIT_PAIR: "1000",
      RATE_LIMIT_GLOBAL: "100000",
      // Banco separado: os testes apagam tudo a cada caso.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://familia:familia@localhost:55432/familia_segura_test",
    },
  },
});
