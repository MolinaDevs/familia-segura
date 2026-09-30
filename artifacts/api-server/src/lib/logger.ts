import pino from "pino";
import { reportError } from "./monitoring";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  // Todo log de erro com o objeto do erro vai para o Sentry (quando ligado): rotas, tarefas periódicas, push.
  hooks: {
    logMethod(args, method, level) {
      if (level >= 50) {
        const first = args[0] as unknown;
        const err = first instanceof Error ? first : (first as { err?: unknown } | null)?.err;
        const message = typeof args[1] === "string" ? args[1] : typeof first === "string" ? first : undefined;
        reportError(err, message ? { log: message } : undefined);
      }
      method.apply(this, args);
    },
  },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
