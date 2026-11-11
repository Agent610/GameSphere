// Routes mounted at /api/me/games (see app.js): the signed-in user's library.

import express from "express";
import {
  addUserGame,
  listUserGames,
  removeUserGame,
  updateUserGame,
} from "../controllers/userGameController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// router.use() applies the middleware to every route below it, so the whole
// library is private without repeating authMiddleware on each line.
router.use(authMiddleware);

router.get("/", listUserGames);
router.post("/", addUserGame);
// :entryId is the id of the library entry (UserGame), not of the game.
router.patch("/:entryId", updateUserGame);
router.delete("/:entryId", removeUserGame);

export default router;
