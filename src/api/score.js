// POST /api/score  { player, day, bestTier, casts:[{answers:[{name,g}]}] }
// Re-scores the round and stores it. Only a player's first round of the day counts.
import { json, isPlayer, loadPuzzle, scoreRound, TIERS } from "../lib.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Body must be JSON" }, 400); }
  const { player, day, casts, bestTier } = body || {};
  if (!isPlayer(player)) return json({ error: "Missing or invalid player id" }, 400);
  const puzzle = await loadPuzzle(env, request, day);
  if (!puzzle) return json({ error: `No puzzle for ${day}` }, 404);

  let round;
  try { round = scoreRound(puzzle, casts); } catch (e) { return json({ error: e.message }, 400); }
  const total = round.reduce((a, c) => a + c.d, 0);
  const tier = TIERS.includes(bestTier) ? bestTier : null;

  const ins = await env.DB.prepare(
    `INSERT OR IGNORE INTO scores (day, player, total, d1, d2, d3, n1, n2, n3, best_tier, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(day, player, total, round[0].d, round[1].d, round[2].d, round[0].n, round[1].n, round[2].n, tier, Date.now()).run();

  const official = await env.DB.prepare(
    "SELECT total, d1, d2, d3 FROM scores WHERE day = ? AND player = ?"
  ).bind(day, player).first();

  return json({ counted: ins.meta.changes === 1, round, total, official });
}
