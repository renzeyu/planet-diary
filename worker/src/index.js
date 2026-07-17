import { VALID_PLANET_IDS } from "./planet-ids.js";

const VISITOR_PATTERN = /^[A-Za-z0-9_-]{20,96}$/;
const MAX_MUTATIONS_PER_MINUTE = 12;
const encoder = new TextEncoder();
let signingKeyPromise;

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

function requestOrigin(request) {
  return request.headers.get("Origin") || "";
}

function originIsAllowed(request, env) {
  return allowedOrigins(env).has(requestOrigin(request));
}

function responseHeaders(request, env) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  });
  const origin = requestOrigin(request);
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function json(request, env, body, status = 200, extraHeaders = {}) {
  const headers = responseHeaders(request, env);
  Object.entries(extraHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

async function signingKey(secret) {
  if (!secret) throw new Error("VOTER_PEPPER is not configured");
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }
  return signingKeyPromise;
}

async function hashVisitor(visitor, env) {
  const signature = await crypto.subtle.sign("HMAC", await signingKey(env.VOTER_PEPPER), encoder.encode(visitor));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function likeState(env, planetId, visitorHash = "") {
  const row = await env.DB.prepare(`
    SELECT
      COALESCE((SELECT like_count FROM planet_like_counts WHERE planet_id = ?1), 0) AS like_count,
      EXISTS(
        SELECT 1 FROM planet_likes
        WHERE planet_id = ?1 AND visitor_hash = ?2
      ) AS liked
  `).bind(planetId, visitorHash).first();
  return {
    planetId,
    count: Number(row?.like_count || 0),
    liked: Boolean(row?.liked)
  };
}

async function rateLimitMutation(env, visitorHash) {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - 60;
  const row = await env.DB.prepare(`
    INSERT INTO like_rate_limits (visitor_hash, window_started_at, mutation_count, updated_at)
    VALUES (?1, ?2, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (visitor_hash) DO UPDATE SET
      window_started_at = CASE
        WHEN like_rate_limits.window_started_at <= ?3 THEN excluded.window_started_at
        ELSE like_rate_limits.window_started_at
      END,
      mutation_count = CASE
        WHEN like_rate_limits.window_started_at <= ?3 THEN 1
        ELSE like_rate_limits.mutation_count + 1
      END,
      updated_at = CURRENT_TIMESTAMP
    RETURNING mutation_count
  `).bind(visitorHash, now, cutoff).first();
  return Number(row?.mutation_count || 0) <= MAX_MUTATIONS_PER_MINUTE;
}

async function parseMutation(request) {
  const bodyText = await request.text();
  if (bodyText.length > 512) throw new Error("Request body is too large");
  const body = JSON.parse(bodyText);
  if (!VISITOR_PATTERN.test(String(body.visitor || ""))) throw new Error("Invalid anonymous visitor token");
  if (typeof body.liked !== "boolean") throw new Error("Invalid liked state");
  return { visitor: String(body.visitor), liked: body.liked };
}

async function handleLikeRequest(request, env, planetId) {
  if (request.method === "GET") {
    const visitor = new URL(request.url).searchParams.get("visitor") || "";
    const visitorHash = VISITOR_PATTERN.test(visitor) ? await hashVisitor(visitor, env) : "";
    return json(request, env, await likeState(env, planetId, visitorHash));
  }

  if (request.method !== "POST") {
    return json(request, env, { error: "Method not allowed" }, 405, { Allow: "GET, POST, OPTIONS" });
  }

  if (!originIsAllowed(request, env)) {
    return json(request, env, { error: "Origin not allowed" }, 403);
  }

  let mutation;
  try {
    mutation = await parseMutation(request);
  } catch (error) {
    return json(request, env, { error: error.message || "Invalid request" }, 400);
  }

  const visitorHash = await hashVisitor(mutation.visitor, env);
  if (!await rateLimitMutation(env, visitorHash)) {
    return json(request, env, { error: "Too many like changes. Please wait a minute." }, 429, { "Retry-After": "60" });
  }

  if (mutation.liked) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO planet_likes (planet_id, visitor_hash)
      VALUES (?1, ?2)
    `).bind(planetId, visitorHash).run();
  } else {
    await env.DB.prepare(`
      DELETE FROM planet_likes
      WHERE planet_id = ?1 AND visitor_hash = ?2
    `).bind(planetId, visitorHash).run();
  }

  return json(request, env, await likeState(env, planetId, visitorHash));
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        if (!originIsAllowed(request, env)) return json(request, env, { error: "Origin not allowed" }, 403);
        return new Response(null, { status: 204, headers: responseHeaders(request, env) });
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return json(request, env, { ok: true, service: "planet-diary-likes" });
      }

      const match = url.pathname.match(/^\/v1\/likes\/([0-9]{1,20})$/);
      if (!match || !VALID_PLANET_IDS.has(match[1])) {
        return json(request, env, { error: "Planet not found" }, 404);
      }

      return await handleLikeRequest(request, env, match[1]);
    } catch (error) {
      console.error("Like API request failed", error);
      return json(request, env, { error: "Service unavailable" }, 500);
    }
  }
};
