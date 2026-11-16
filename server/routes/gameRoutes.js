// Routes mounted at /api/games (see app.js): the shared game catalog.

import express from "express";
import {
  createGame,
  getGame,
  listGames,
} from "../controllers/gameController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Anyone can browse the catalog; adding a game requires a token.
router.get("/", listGames);
router.post("/", authMiddleware, createGame);
router.get("/:gameId", getGame);

export default router;
