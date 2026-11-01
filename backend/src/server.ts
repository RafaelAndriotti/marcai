import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

// Sem login ainda: só aceita conexões desta máquina.
const server = app.listen(env.PORT, "127.0.0.1", () => {
  console.log(`Marcaí API em http://127.0.0.1:${env.PORT}/api`);
});

function shutdown(): void {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
