// Routes mounted at /api/auth (see app.js).
//
// A routes file is a table of contents: it maps "HTTP method + URL" to the
// controller function that handles it, and lists any middleware that must run
// first. The logic itself lives in controllers/.

import express from "express";
import {
  getCurrentUser,
  login,
  register,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public, but rate limited to slow down password guessing and mass sign-ups.
router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);

// Requires a token: returns the account the token belongs to.
router.get("/me", authMiddleware, getCurrentUser);

export default router;
