// Shared helpers for the Long Cast API (Cloudflare Worker + D1).
// Only runs on Cloudflare. On GitHub Pages these files are ignored and the game
// falls back to saving on the device.

// Must match the game: metres per answer by rarity, x1.5 during a tailwind.
export const PTS = { 1: 25, 2: 45, 3: 80 };
export const TIERS = ["c", "u", "r", "l", "m"];

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const isPlayer = (v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
export const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const norm = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and").replace(/\+/g, "plus").replace(/#/g, "sharp").replace(/[^a-z0-9]/g, "");

// Puzzles are the encoded files in /puzzles (written by scripts/generate_puzzle.py).
const KEY = new TextEncoder().encode("longcast-v1");
function decodePuzzle(obj) {
  if (!obj || !obj.data) return obj; // older plain file
  const bytes = Uint8Array.from(atob(obj.data), (c) => c.charCodeAt(0)).map((x, i) => x ^ KEY[i % KEY.length]);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function loadPuzzle(env, request, day) {
  if (!isDay(day)) return null;
  const res = await env.ASSETS.fetch(new URL(`/puzzles/${day}.json`, request.url));
  // Missing files can fall back to index.html with a 200, so check that we really got JSON.
  if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
  try { return decodePuzzle(await res.json()); } catch { return null; }
}

// Re-score a round from the answer names the game accepted. Never trusts the client's distances.
export function scoreRound(puzzle, casts) {
  if (!Array.isArray(casts) || casts.length !== 3 || puzzle.casts.length !== 3) {
    throw new Error("A round has exactly 3 casts");
  }
  return casts.map((cast, i) => {
    const tierOf = new Map();
    [["c", 1], ["u", 2], ["r", 3]].forEach(([k, t]) =>
      puzzle.casts[i][k].forEach((entry) => tierOf.set(norm(entry.split("|")[0]), t)));
    const seen = new Set();
    let d = 0, n = 0, g = 0;
    const answers = Array.isArray(cast?.answers) ? cast.answers.slice(0, 80) : [];
    for (const a of answers) {
      const key = norm(a?.name ?? "");
      const tier = tierOf.get(key);
      if (!tier || seen.has(key)) continue;
      seen.add(key);
      // Same rule as the game: a tailwind answer only counts while tailwind answers < normal answers.
      if (a.g && g < n - g) { g++; d += Math.round(PTS[tier] * 1.5); } else d += PTS[tier];
      n++;
    }
    return { d, n };
  });
}
