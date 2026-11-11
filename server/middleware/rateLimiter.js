// Limits how often one client (identified by IP address) may call the login and
// register endpoints. Without a limit, an attacker could try thousands of
// passwords per minute against an account, or flood the database with accounts.

import { rateLimit } from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

const WINDOW_MINUTES = 15;
// 20 attempts per window by default. AUTH_RATE_LIMIT_MAX can raise it, which the
// integration tests use because they register many accounts from one address.
const MAX_ATTEMPTS_PER_WINDOW = Number(process.env.AUTH_RATE_LIMIT_MAX) || 20;

export const authRateLimiter = rateLimit({
  windowMs: WINDOW_MINUTES * 60 * 1000,
  limit: MAX_ATTEMPTS_PER_WINDOW,
  // Tell well-behaved clients how many attempts remain via RateLimit-* headers.
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Hand over to errorMiddleware so a blocked request gets the same JSON error
  // shape as every other failure.
  handler(request, response, next) {
    next(
      new ApiError(
        429,
        "RATE_LIMITED",
        `Too many attempts. Try again in ${WINDOW_MINUTES} minutes`,
      ),
    );
  },
});
