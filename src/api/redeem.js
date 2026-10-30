// POST /api/redeem { code } -> { player }
// Looks up which angler a code belongs to, so another device can switch to it.
import { json } from "../lib.js";

export const cleanCode = (c) => {
  const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 12 ? `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}` : null;
};

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Body must be JSON" }, 400); }
  const code = cleanCode(body?.code);
  if (!code) return json({ error: "Angler codes are 12 letters and numbers, like ABCD-EFGH-JKMN" }, 400);
  const row = await env.DB.prepare("SELECT player FROM anglers WHERE code = ?").bind(code).first();
  if (!row) return json({ error: "That code doesn't match any angler. Check it and try again." }, 404);
  return json({ player: row.player, code });
}
