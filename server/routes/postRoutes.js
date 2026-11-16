// Routes mounted at /api/posts (see app.js): posts and the social feed.

import express from "express";
import {
  createPost,
  deletePost,
  getFeed,
  getUserPosts,
  updatePost,
} from "../controllers/postController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// The feed is personal (it depends on who you follow), so it requires a token.
router.get("/feed", authMiddleware, getFeed);

// Anyone can read a user's posts, e.g. on their profile page.
router.get("/user/:userId", getUserPosts);

// Writing requires a token. Editing and deleting are further limited to the
// post's author inside the controller.
router.post("/", authMiddleware, createPost);
router.patch("/:postId", authMiddleware, updatePost);
router.delete("/:postId", authMiddleware, deletePost);

export default router;
