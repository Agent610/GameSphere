// Routes mounted at /api/news (see app.js): official gaming news.

import express from "express";
import { getNews } from "../controllers/newsController.js";

const router = express.Router();

// Public. The server reads the feeds and caches them (see newsService.js).
router.get("/", getNews);

export default router;
