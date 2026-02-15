import { config } from "./config.js";

const hits = new Map(); // ip -> {count, resetMs}

export function requireServerKey(req, res, next) {
  const key = req.header("X-Server-Key");
  if (key !== config.serverKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function rateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const windowMs = 60_000;

  const entry = hits.get(ip) || { count: 0, resetMs: now + windowMs };
  if (now > entry.resetMs) {
    entry.count = 0;
    entry.resetMs = now + windowMs;
  }
  entry.count += 1;
  hits.set(ip, entry);

  if (entry.count > config.rateLimitPerMin) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  next();
}
