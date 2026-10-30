// Cloudflare Worker entry: /api/* goes to the handlers, everything else is the static game.
import * as score from "./api/score.js";
import * as stats from "./api/stats.js";
import * as log from "./api/log.js";
import { json } from "./lib.js";

const routes = { "/api/score": score, "/api/stats": stats, "/api/log": log };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const mod = routes[url.pathname];
    if (mod) {
      if (!env.DB) return json({ error: "Database not linked yet" }, 503);
      const handler = request.method === "POST" ? mod.onRequestPost : request.method === "GET" ? mod.onRequestGet : null;
      if (!handler) return json({ error: "Method not allowed" }, 405);
      try { return await handler({ request, env }); }
      catch (e) { return json({ error: "Server error" }, 500); }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
