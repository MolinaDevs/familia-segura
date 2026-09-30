import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/** Vivo: o processo responde (sem tocar no banco — reiniciar não resolve banco fora do ar). */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/** Pronto para tráfego: o banco responde. O balanceador tira a instância do ar enquanto der 503. */
router.get("/readyz", async (req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch (err) {
    req.log.error({ err }, "Banco indisponível na checagem de prontidão");
    res.status(503).json({ status: "unavailable" });
  }
});

export default router;
