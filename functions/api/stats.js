// GET /api/stats?day=YYYY-MM-DD&player=<id>
// How today's anglers did: percentile, distance histogram, per-cast averages and top 10%.
import { json, isDay, isPlayer } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const day = url.searchParams.get("day"), player = url.searchParams.get("player");
  if (!isDay(day)) return json({ error: "Missing or invalid day" }, 400);

  const { results: rows } = await env.DB.prepare(
    "SELECT player, total, d1, d2, d3, best_tier FROM scores WHERE day = ?"
  ).bind(day).all();
  const N = rows.length;
  if (!N) return json({ players: 0 });

  const me = isPlayer(player) ? rows.find((r) => r.player === player) : null;
  const pick = (k) => {
    const v = rows.map((r) => r[k]).sort((a, b) => a - b);
    return { avg: Math.round(v.reduce((a, b) => a + b, 0) / N), p90: v[Math.floor(0.9 * (N - 1))] };
  };
  const max = Math.max(...rows.map((r) => r.total));
  const size = Math.max(50, Math.ceil(max / 12 / 50) * 50);
  const counts = new Array(Math.floor(max / size) + 1).fill(0);
  rows.forEach((r) => counts[Math.floor(r.total / size)]++);
  const tiers = {};
  ["c", "u", "r", "l", "m"].forEach((t) => (tiers[t] = Math.round((rows.filter((r) => r.best_tier === t).length / N) * 100)));

  return json({
    players: N,
    percentile: me ? (N > 1 ? Math.round((rows.filter((r) => r.total < me.total).length / (N - 1)) * 100) : 100) : null,
    casts: ["d1", "d2", "d3"].map(pick),
    total: pick("total"),
    hist: { size, counts },
    tiers,
  });
}
