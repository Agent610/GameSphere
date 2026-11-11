// Routes mounted at /api/me/wishlist (see app.js): the signed-in user's wishlist.

import express from "express";
import {
  addWishlistItem,
  listWishlist,
  removeWishlistItem,
} from "../controllers/wishlistController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Every wishlist route requires a token.
router.use(authMiddleware);

router.get("/", listWishlist);
router.post("/", addWishlistItem);
// :itemId is the id of the wishlist item, not of the game.
router.delete("/:itemId", removeWishlistItem);

export default router;
