// Routes mounted at /api/users (see app.js): profiles and follows.

import express from "express";
import {
  deleteAccount,
  getUserById,
  updateProfile,
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  followUser,
  getFollowers,
  getFollowing,
  unfollowUser,
} from "../controllers/followController.js";

const router = express.Router();

// The signed-in user's own account. "me" stands in for their id, which is read
// from the token rather than the URL.
router.patch("/me", authMiddleware, updateProfile);
router.delete("/me", authMiddleware, deleteAccount);

// Anyone can see who follows whom; changing your follows requires a token.
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);
router.post("/:userId/follow", authMiddleware, followUser);
router.delete("/:userId/follow", authMiddleware, unfollowUser);

// Public profile.
router.get("/:userId", getUserById);

export default router;
