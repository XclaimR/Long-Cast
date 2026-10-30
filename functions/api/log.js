// GET  /api/log?player=<id>            -> { log }
// POST /api/log { player, log }        -> merges (keeps the higher count and best size) and returns { log }
import { json, isPlayer, isDay } from "../_lib.js";

async function read(env, player) {
  const { results } = await env.DB.prepare(
    "SELECT fish, n, best, first_day FROM logbook WHERE player = ?"
  ).bind(player).all();
  const log = {};
  results.forEach((r) => (log[r.fish] = { n: r.n, best: r.best, first: r.first_day }));
  return log;
}

export async function onRequestGet({ request, env }) {
  const player = new URL(request.url).searchParams.get("player");
  if (!isPlayer(player)) return json({ error: "Missing or invalid player id" }, 400);
  return json({ log: await read(env, player) });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Body must be JSON" }, 400); }
  const { player, log } = body || {};
  if (!isPlayer(player)) return json({ error: "Missing or invalid player id" }, 400);
  const entries = Object.entries(log && typeof log === "object" ? log : {})
    .filter(([id, e]) => /^[a-z]{2,24}$/.test(id) && e && Number.isInteger(e.n) && e.n > 0)
    .slice(0, 64);
  if (entries.length) {
    const stmt = env.DB.prepare(
      `INSERT INTO logbook (player, fish, n, best, first_day) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (player, fish) DO UPDATE SET
         n = max(n, excluded.n), best = max(best, excluded.best),
         first_day = min(first_day, excluded.first_day)`
    );
    await env.DB.batch(entries.map(([id, e]) =>
      stmt.bind(player, id, Math.min(e.n, 100000), Math.min(Math.max(0, e.best | 0), 5000), isDay(e.first) ? e.first : "9999-12-31")));
  }
  return json({ log: await read(env, player) });
}
