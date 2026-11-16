// Routes mounted at /api/news (see app.js): official gaming news.

import express from "express";
import { getNews } from "../controllers/newsController.js";

const router = express.Router();

// Public. The news provider's API key stays on the server (see newsService.js).
router.get("/", getNews);

export default router;
