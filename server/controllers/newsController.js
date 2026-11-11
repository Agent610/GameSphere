// Official gaming news for the news panel. The real work (calling the outside
// news provider and tidying its response) is in services/newsService.js; this
// controller only connects that service to the HTTP route.

import { getGamingNews } from "../services/newsService.js";

// GET /api/news
// Responds with { items: [{ title, url, summary, imageUrl, publishedAt, source }] }.
export async function getNews(request, response) {
  const items = await getGamingNews();
  response.json({ items });
}
