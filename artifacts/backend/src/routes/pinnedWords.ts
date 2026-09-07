import { Router } from "express";
import { getUserId } from "../middleware/auth";
import {
  getPinnedWordIds,
  importPinnedWordIds,
  parsePinScope,
  parseWordIds,
  togglePinnedWordIds,
} from "../lib/pinnedWords";

const router = Router();

router.get("/pinned-words", async (req, res, next) => {
  try {
    const scope = parsePinScope(req.query.scope);
    if (!scope) {
      res.status(400).json({ error: "Invalid scope" });
      return;
    }
    const wordIds = await getPinnedWordIds(getUserId(req), scope);
    res.json({ wordIds });
  } catch (err) {
    next(err);
  }
});

router.post("/pinned-words/toggle", async (req, res, next) => {
  try {
    const scope = parsePinScope(req.body?.scope);
    const wordIds = parseWordIds(req.body?.wordIds);
    if (!scope) {
      res.status(400).json({ error: "Invalid scope" });
      return;
    }
    const nextIds = await togglePinnedWordIds(getUserId(req), scope, wordIds);
    res.json({ wordIds: nextIds });
  } catch (err) {
    next(err);
  }
});

router.post("/pinned-words/import", async (req, res, next) => {
  try {
    const scope = parsePinScope(req.body?.scope);
    const wordIds = parseWordIds(req.body?.wordIds);
    if (!scope) {
      res.status(400).json({ error: "Invalid scope" });
      return;
    }
    const nextIds = await importPinnedWordIds(getUserId(req), scope, wordIds);
    res.json({ wordIds: nextIds });
  } catch (err) {
    next(err);
  }
});

export default router;
