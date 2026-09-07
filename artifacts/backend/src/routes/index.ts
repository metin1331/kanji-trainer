import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth";
import authRouter from "./auth";
import healthRouter from "./health";
import wordsRouter from "./words";
import srsRouter from "./srs";
import troubleWordsRouter from "./troubleWords";
import themesRouter from "./themes";
import backupRouter from "./backup";
import studyActivityRouter from "./studyActivity";
import categoriesRouter from "./categories";
import pinnedWordsRouter from "./pinnedWords";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

const protectedRouter: IRouter = Router();
protectedRouter.use(requireAuth);
protectedRouter.use(wordsRouter);
protectedRouter.use(srsRouter);
protectedRouter.use(troubleWordsRouter);
protectedRouter.use(themesRouter);
protectedRouter.use(backupRouter);
protectedRouter.use(studyActivityRouter);
protectedRouter.use(categoriesRouter);
protectedRouter.use(pinnedWordsRouter);

router.use(protectedRouter);

export default router;
