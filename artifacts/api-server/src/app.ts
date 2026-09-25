import express, { type Express } from "express";
import cors from "cors";
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
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)) }));
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
// Inventário Android (até 600 apps) passa do limite padrão de 100 KB.
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
  })),
);

app.use("/api", router);

// Erros não tratados viram JSON (sem stack para o cliente); o detalhe fica no log.
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log?.error({ err }, "Erro não tratado");
  if (res.headersSent) return;
  const status = (err as { status?: number; type?: string }).type === "entity.too.large" ? 413 : (err as { status?: number }).status === 400 ? 400 : 500;
  res.status(status).json({ error: status === 500 ? "Erro interno. Tente novamente." : "Requisição inválida" });
});

export default app;
