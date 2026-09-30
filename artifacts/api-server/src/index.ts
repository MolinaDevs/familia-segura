import "./lib/env";
import { pool } from "@workspace/db";
import app from "./app";
import { stopJobs } from "./lib/jobs";
import { logger } from "./lib/logger";
import { scheduleRetention } from "./lib/retention";
import { scheduleUnlockExpiry } from "./lib/unlockExpiry";
import { scheduleWeeklySummaries } from "./lib/weeklySummary";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Em produção, configuração incompleta derruba o deploy na hora (melhor que subir e falhar no primeiro login).
if (process.env.NODE_ENV === "production") {
  const missing = ["DATABASE_URL", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"].filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Variáveis obrigatórias ausentes em produção: ${missing.join(", ")}`);
  for (const name of ["REVENUECAT_PROJECT_ID", "REVENUECAT_SECRET_API_KEY"]) {
    if (!process.env[name]) logger.warn(`${name} ausente: todas as famílias ficam no plano gratuito`);
  }
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  scheduleRetention();
  scheduleUnlockExpiry();
  scheduleWeeklySummaries();
});

// Conexões ociosas presas ao balanceador não podem segurar o processo; requisições longas têm teto.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

/**
 * Desligamento gracioso (deploy/escala): para de aceitar conexões, termina as requisições em andamento,
 * cancela as tarefas periódicas e fecha o pool. Se algo travar, sai à força depois de 10 s.
 */
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Encerrando o servidor");
  stopJobs();
  setTimeout(() => {
    logger.error("Encerramento demorou demais; saindo à força");
    process.exit(1);
  }, 10_000).unref();
  server.close(() => {
    pool.end()
      .catch((err) => logger.error({ err }, "Falha ao fechar o pool do banco"))
      .finally(() => process.exit(0));
  });
  server.closeIdleConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Promise rejeitada sem tratamento");
});
process.on("uncaughtException", (err) => {
  // Estado desconhecido: registra e reinicia (a plataforma sobe o processo de novo).
  logger.fatal({ err }, "Exceção não tratada");
  shutdown("uncaughtException");
});
