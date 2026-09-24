import { Router, type IRouter } from "express";
import healthRouter from "./health";
import familyRouter from "./family";
import devicesRouter from "./devices";
import rulesRouter from "./rules";
import requestsRouter from "./requests";
import childRouter from "./child";
import reportsRouter from "./reports";
import legalRouter from "./legal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legalRouter);
router.use(familyRouter);
router.use(devicesRouter);
router.use(rulesRouter);
router.use(requestsRouter);
router.use(childRouter);
router.use(reportsRouter);

export default router;
