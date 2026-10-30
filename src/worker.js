// Cloudflare Worker entry: /api/* goes to the handlers, everything else is the static game.
import * as score from "./api/score.js";
import * as stats from "./api/stats.js";
import * as log from "./api/log.js";
import * as code from "./api/code.js";
import * as redeem from "./api/redeem.js";
import * as resultsApi from "./api/results.js";
import { json } from "./lib.js";

const routes = {
  "/api/score": score, "/api/stats": stats, "/api/log": log,
  "/api/code": code, "/api/redeem": redeem, "/api/results": resultsApi,
};

// Tables are created on first use, so new features don't need a manual step in the D1 console.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scores (day TEXT NOT NULL, player TEXT NOT NULL, total INTEGER NOT NULL, d1 INTEGER NOT NULL, d2 INTEGER NOT NULL, d3 INTEGER NOT NULL, n1 INTEGER NOT NULL, n2 INTEGER NOT NULL, n3 INTEGER NOT NULL, best_tier TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (day, player))`,
  `CREATE TABLE IF NOT EXISTS logbook (player TEXT NOT NULL, fish TEXT NOT NULL, n INTEGER NOT NULL, best INTEGER NOT NULL, first_day TEXT NOT NULL, PRIMARY KEY (player, fish))`,
  `CREATE TABLE IF NOT EXISTS anglers (code TEXT PRIMARY KEY, player TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS results (player TEXT NOT NULL, day TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (player, day))`,
];
let schemaReady = null;
const ensureSchema = (env) =>
  (schemaReady ??= env.DB.batch(SCHEMA.map((q) => env.DB.prepare(q))).catch((e) => { schemaReady = null; throw e; }));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const mod = routes[url.pathname];
    if (mod) {
      if (!env.DB) return json({ error: "Database not linked yet" }, 503);
      const handler = request.method === "POST" ? mod.onRequestPost : request.method === "GET" ? mod.onRequestGet : null;
      if (!handler) return json({ error: "Method not allowed" }, 405);
      try { await ensureSchema(env); return await handler({ request, env }); }
      catch (e) { return json({ error: "Server error" }, 500); }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
