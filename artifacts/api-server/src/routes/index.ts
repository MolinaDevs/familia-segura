import { Router, type IRouter } from "express";
import healthRouter from "./health";
import familyRouter from "./family";
import legalRouter from "./legal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legalRouter);
router.use(familyRouter);

export default router;
