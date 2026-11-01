import { defineConfig } from "vitest/config";

// Testes sempre usam o banco marcai_test. dotenv (env.ts) não sobrescreve variáveis já setadas.
const TEST_DATABASE_URL =
  "postgresql://marcai:marcai_dev@localhost:5435/marcai_test?schema=public";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: TEST_DATABASE_URL },
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
