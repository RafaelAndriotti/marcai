import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

// .env fica na raiz do monorepo
config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
