import { createHash } from "node:crypto";
import { json } from "./ica.mjs";

const memoryBuckets = new Map();
const MAX_MEMORY_BUCKETS = 10_000;

function header(request, name) {
  const headers = request?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  return headers[name] || headers[name.toLowerCase()] || "";
}

export function clientId(request) {
  const forwarded = header(request, "x-vercel-forwarded-for") || header(request, "x-forwarded-for");
  const address = forwarded.split(",")[0].trim() || request?.socket?.remoteAddress || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || "resumeai-rate-limit";
  return createHash("sha256").update(`${salt}:${address}`).digest("hex");
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function sharedCount(key, windowSeconds) {
  const settings = redisConfig();
  if (!settings) return null;
  const response = await fetch(`${settings.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["INCR", key], ["EXPIRE", key, windowSeconds, "NX"], ["TTL", key]])
  });
  if (!response.ok) throw new Error("Rate-limit store request failed");
  const results = await response.json();
  const count = Number(results?.[0]?.result);
  const ttl = Number(results?.[2]?.result);
  if (!Number.isFinite(count)) throw new Error("Rate-limit store returned an invalid response");
  return { count, retryAfter: Math.max(1, Number.isFinite(ttl) ? ttl : windowSeconds) };
}

function localCount(key, windowSeconds) {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.expiresAt <= now) {
    if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
      for (const [oldKey, value] of memoryBuckets) if (value.expiresAt <= now) memoryBuckets.delete(oldKey);
      if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) memoryBuckets.delete(memoryBuckets.keys().next().value);
    }
    const value = { count: 1, expiresAt: now + windowSeconds * 1000 };
    memoryBuckets.set(key, value);
    return { count: value.count, retryAfter: windowSeconds };
  }
  current.count += 1;
  return { count: current.count, retryAfter: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)) };
}

export async function enforceRateLimit(request, response, { name, limit, windowSeconds }) {
  const key = `resumeai:rate-limit:${name}:${clientId(request)}`;
  let result;
  try {
    result = await sharedCount(key, windowSeconds) || localCount(key, windowSeconds);
  } catch (error) {
    console.error("Rate-limit store unavailable; rejecting request.", error.message);
    response.setHeader("Retry-After", "60");
    json(response, 503, { error: "Service protection is temporarily unavailable. Please try again shortly." });
    return false;
  }
  if (result.count <= limit) return true;
  response.setHeader("Retry-After", String(result.retryAfter));
  json(response, 429, { error: "Too many requests. Please wait before trying again." });
  return false;
}

export function resetRateLimits() {
  memoryBuckets.clear();
}