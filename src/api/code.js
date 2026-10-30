// POST /api/code { player } -> { code }
// Returns the player's angler code, creating one the first time it's asked for.
import { json, isPlayer } from "../lib.js";

// No 0/O, 1/I/L, so codes are easy to read aloud and type.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Body must be JSON" }, 400); }
  const player = body?.player;
  if (!isPlayer(player)) return json({ error: "Missing or invalid player id" }, 400);
  const found = await env.DB.prepare("SELECT code FROM anglers WHERE player = ?").bind(player).first();
  if (found) return json({ code: found.code });
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const ins = await env.DB.prepare("INSERT OR IGNORE INTO anglers (code, player, created_at) VALUES (?, ?, ?)")
      .bind(code, player, Date.now()).run();
    if (ins.meta.changes === 1) return json({ code });
    const again = await env.DB.prepare("SELECT code FROM anglers WHERE player = ?").bind(player).first();
    if (again) return json({ code: again.code }); // created by a parallel request
  }
  return json({ error: "Couldn't make a code, try again" }, 500);
}
