import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    // Id por requisição, devolvido em X-Request-Id: o suporte acha o erro no log a partir do que o app mostra.
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"];
      const id = typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
// Apps nativos não enviam Origin; navegadores só são aceitos se listados em CORS_ORIGINS.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)), exposedHeaders: ["X-Request-Id"] }));
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // A API só devolve JSON e as páginas legais (HTML estático sem script): nada de iframe, script ou recurso externo.
  res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.set("X-Frame-Options", "DENY");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  res.set("Cross-Origin-Resource-Policy", "same-site");
  next();
});
// Contra inundação: 600 requisições por 5 min por IP — folgado para famílias atrás do mesmo roteador
// (aparelhos sincronizam 1x/min) e firme contra abuso. Rotas sensíveis têm limites próprios e mais baixos.
app.use("/api", rateLimit({
  windowMs: 5 * 60_000,
  limit: Number(process.env.RATE_LIMIT_GLOBAL ?? 600),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.path === "/healthz" || req.path === "/readyz",
  message: { error: "Muitas requisições. Aguarde alguns minutos.", code: "RATE_LIMITED" },
}));
// Inventário Android (até 600 apps) passa do limite padrão de 100 KB. A API só aceita JSON.
app.use(express.json({ limit: "512kb" }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
  })),
);

app.use("/api", router);

// Rota inexistente: JSON como o resto da API (o padrão do Express é uma página HTML).
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Erros não tratados viram JSON (sem stack para o cliente); o detalhe fica no log.
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log?.error({ err }, "Erro não tratado");
  if (res.headersSent) return;
  const status = (err as { status?: number; type?: string }).type === "entity.too.large" ? 413 : (err as { status?: number }).status === 400 ? 400 : 500;
  res.status(status).json({ error: status === 500 ? "Erro interno. Tente novamente." : "Requisição inválida" });
});

export default app;
