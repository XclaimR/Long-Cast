// POST /api/results { player, results: { "YYYY-MM-DD": "<saved result JSON>" } } -> { results }
// Backs up each day's finished round so it travels with the angler code. Existing days are kept.
import { json, isPlayer, isDay } from "../lib.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Body must be JSON" }, 400); }
  const { player, results } = body || {};
  if (!isPlayer(player)) return json({ error: "Missing or invalid player id" }, 400);
  const entries = Object.entries(results && typeof results === "object" ? results : {})
    .filter(([day, data]) => isDay(day) && typeof data === "string" && data.length <= 12000)
    .slice(0, 400);
  if (entries.length) {
    const stmt = env.DB.prepare("INSERT OR IGNORE INTO results (player, day, data) VALUES (?, ?, ?)");
    await env.DB.batch(entries.map(([day, data]) => stmt.bind(player, day, data)));
  }
  const { results: rows } = await env.DB.prepare("SELECT day, data FROM results WHERE player = ?").bind(player).all();
  const out = {};
  rows.forEach((r) => (out[r.day] = r.data));
  return json({ results: out });
}
