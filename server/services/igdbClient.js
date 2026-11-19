// Server-side client for the IGDB API. IGDB rejects browser calls, and the
// Twitch client secret must stay on the server. Requests are spaced out to
// stay under IGDB's limit of 4 per second.

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.igdb.com/v4";
const MIN_INTERVAL_MS = 260;

export function createIgdbClient({ clientId, clientSecret }) {
  if (!clientId || !clientSecret) {
    throw new Error(
      "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in server/.env",
    );
  }

  let accessToken;
  let expiresAt = 0;
  let lastRequestAt = 0;

  async function pace() {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
  }

  async function token() {
    if (accessToken && Date.now() < expiresAt - 60_000) {
      return accessToken;
    }

    // The secret goes in the body, not the URL, so it cannot leak into a log.
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || typeof body?.access_token !== "string") {
      throw new Error(
        `Twitch rejected the IGDB credentials (${response.status})`,
      );
    }

    accessToken = body.access_token;
    expiresAt = Date.now() + Number(body.expires_in ?? 0) * 1000;
    return accessToken;
  }

  // `endpoint` is an IGDB path such as "games". `apicalypse` is the text body.
  async function query(endpoint, apicalypse) {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await pace();
      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${await token()}`,
          Accept: "application/json",
        },
        body: apicalypse,
      });

      if (response.status === 429 && attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        continue;
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const detail =
          body && typeof body.message === "string" ? `: ${body.message}` : "";
        throw new Error(
          `IGDB ${endpoint} failed (${response.status})${detail}`,
        );
      }
      return body;
    }

    throw new Error(`IGDB ${endpoint} was rate limited`);
  }

  return { query };
}
