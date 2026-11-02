import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(import.meta.dirname, "../.env"), quiet: true });

// Testes sempre usam o banco marcai_test (derivado de DATABASE_URL). dotenv (env.ts) não sobrescreve variáveis já setadas.
if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL no .env da raiz");
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/marcai_test";
const TEST_DATABASE_URL = url.toString();

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
