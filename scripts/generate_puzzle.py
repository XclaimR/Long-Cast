#!/usr/bin/env python3
"""Generate daily Long Cast puzzles with Claude and write them into puzzles/.

Fills in any missing days from today (UTC) through DAYS_AHEAD days ahead, so a
failed run is caught up by the next one. Each day gets three categories, one
from each group in categories.txt, skipping anything used recently.

Env:
  ANTHROPIC_API_KEY  required
  MODEL              Claude model id (default: claude-haiku-5-5)
  DAYS_AHEAD         how many days ahead to keep ready (default: 2)
  FAKE_RESPONSE_DIR  testing only: read model replies from <dir>/<n>.json
"""
import datetime as dt
import json
import os
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUZZLES = ROOT / "puzzles"
BANK = ROOT / "categories.txt"
MODEL = os.environ.get("MODEL", "claude-haiku-5-5")
DAYS_AHEAD = int(os.environ.get("DAYS_AHEAD", "2"))
RECENT_DAYS = 120          # don't repeat a category used in this many past days
MIN = {"c": 8, "u": 10, "r": 8}
MAX_TRIES = 3


# ---------- matching rules, mirrored from index.html ----------
def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.replace("&", "and").replace("+", "plus").replace("#", "sharp")
    return re.sub(r"[^a-z0-9]", "", s)


# ---------- category choice ----------
def load_bank():
    groups = {}
    for line in BANK.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        g, cat = line.split(":", 1)
        groups.setdefault(g.strip(), []).append(cat.strip())
    return groups


def load_index():
    p = PUZZLES / "index.json"
    return json.loads(p.read_text()) if p.exists() else {"days": []}


def recent_categories(index, day):
    cutoff = (day - dt.timedelta(days=RECENT_DAYS)).isoformat()
    return {norm(c) for d in index["days"] if d["day"] >= cutoff for c in d["cats"]}


def pick_categories(groups, used, rng):
    picks = []
    for g in ("everyday", "world", "deep"):
        pool = [c for c in groups.get(g, []) if norm(c) not in used and c not in picks]
        picks.append(rng.choice(pool) if pool else None)  # None: let the model invent one
    return picks


# ---------- Claude ----------
PROMPT = """You write puzzles for Long Cast, a daily word game. For each category the
player types as many valid answers as they can in 40 seconds. Answers are sorted
into tiers by how many players would think of them:
  "c" common: the first things most people name
  "u" uncommon: known, but takes some thought
  "r" rare: correct answers few people would come up with
Players are worldwide, many from India, so include well-known Indian answers too.

Make a puzzle with exactly these three categories, in this order:
{cats}
{invent}
Rules:
- Output ONLY a JSON object, no prose, no code fences, matching this shape:
  {{"casts":[{{"cat":"...","hint":"...","c":[...],"u":[...],"r":[...]}}, ...]}}
- "hint": one short sentence saying what counts and what doesn't. No em dashes.
- At least 12 common, 20 uncommon and 15 rare answers when the category allows.
  Closed sets (like US states) should list every member exactly once across tiers.
- Every answer must be factually correct and fit the category. Leave out anything doubtful.
- Alternate spellings or names go in the same string separated by "|", main name first,
  e.g. "Mercedes|mercedes benz|benz". Never list the same thing twice.
- Plain names only: no numbering, no explanations in brackets.

Here is a past puzzle cast for style:
{example}
Categories used recently, which you must not reuse: {avoid}
"""


def call_claude(prompt, attempt_no):
    fake = os.environ.get("FAKE_RESPONSE_DIR")
    if fake:
        return Path(fake, f"{attempt_no}.json").read_text()
    key = os.environ["ANTHROPIC_API_KEY"]
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 8000,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body, method="POST",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    for wait in (0, 10, 30):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            return "".join(b.get("text", "") for b in data["content"])
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            print(f"  API error {e.code}: {msg}", file=sys.stderr)
            if e.code < 500 and e.code != 429:
                raise
        except urllib.error.URLError as e:
            print(f"  network error: {e}", file=sys.stderr)
    raise RuntimeError("Claude API unavailable")


def extract_json(text):
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start:end + 1])


# ---------- validation ----------
def clean_cast(cast):
    """Drop malformed or duplicate answers, keeping the first (lowest tier) copy."""
    seen = set()
    out = {"cat": str(cast.get("cat", "")).strip(), "hint": str(cast.get("hint", "")).strip()}
    out["hint"] = re.sub(r"\s*[—–]\s*", ", ", out["hint"])
    for tier in ("c", "u", "r"):
        kept = []
        for a in cast.get(tier, []) or []:
            if not isinstance(a, str):
                continue
            parts = [p.strip() for p in a.split("|") if p.strip() and norm(p)]
            parts = [p for i, p in enumerate(parts) if norm(p) not in {norm(q) for q in parts[:i]}]
            if not parts or len(parts[0]) > 60:
                continue
            keys = {norm(p) for p in parts}
            if keys & seen:          # clashes with an earlier answer
                parts = [p for p in parts if norm(p) not in seen]
                if not parts or norm(parts[0]) in seen:
                    continue
                keys = {norm(p) for p in parts}
            seen |= keys
            kept.append("|".join(parts))
        out[tier] = kept
    return out


def validate(puzzle, wanted):
    casts = puzzle.get("casts")
    if not isinstance(casts, list) or len(casts) != 3:
        return None, "need exactly 3 casts"
    cleaned = [clean_cast(c) for c in casts]
    names = [norm(c["cat"]) for c in cleaned]
    if len(set(names)) != 3 or not all(names):
        return None, "category names missing or repeated"
    for want, c in zip(wanted, cleaned):
        if want and norm(want) != norm(c["cat"]):
            c["cat"] = want  # keep the bank's wording
        if not c["hint"]:
            return None, f"{c['cat']}: missing hint"
        for t, n in MIN.items():
            if len(c[t]) < n:
                return None, f"{c['cat']}: only {len(c[t])} '{t}' answers (need {n})"
    return cleaned, None


# ---------- files ----------
def write_day(day, casts, index):
    label = f"{day.day} {day.strftime('%b')}"
    puzzle = {"id": day.isoformat(), "label": label, "casts": casts}
    text = json.dumps(puzzle, ensure_ascii=False, separators=(",", ":"))
    (PUZZLES / f"{day.isoformat()}.json").write_text(text)
    index["days"] = [d for d in index["days"] if d["day"] != day.isoformat()]
    index["days"].append({"day": day.isoformat(), "cats": [c["cat"] for c in casts]})
    index["days"].sort(key=lambda d: d["day"], reverse=True)
    (PUZZLES / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))


def update_latest(today):
    """latest.json is the fallback when a player's date has no file: newest day up to tomorrow."""
    limit = (today + dt.timedelta(days=1)).isoformat()
    days = sorted(p.stem for p in PUZZLES.glob("????-??-??.json") if p.stem <= limit)
    if days:
        (PUZZLES / "latest.json").write_text((PUZZLES / f"{days[-1]}.json").read_text())


def example_cast():
    files = sorted(PUZZLES.glob("????-??-??.json"))
    cast = json.loads(files[0].read_text())["casts"][0]
    short = {k: (v[:6] if isinstance(v, list) else v) for k, v in cast.items()}
    return json.dumps(short, ensure_ascii=False)


def generate_day(day, groups, index, rng, call_no):
    used = recent_categories(index, day)
    wanted = pick_categories(groups, used, rng)
    cats = "\n".join(f"{i + 1}. {c or '(invent a fresh, fun category of your own)'}"
                     for i, c in enumerate(wanted))
    invent = ("For invented categories pick something broad enough to have 40+ answers."
              if None in wanted else "")
    avoid = ", ".join(sorted({c for d in index["days"] for c in d["cats"]})) or "none"
    prompt = PROMPT.format(cats=cats, invent=invent, example=example_cast(), avoid=avoid)
    for attempt in range(1, MAX_TRIES + 1):
        call_no[0] += 1
        try:
            casts, err = validate(extract_json(call_claude(prompt, call_no[0])), wanted)
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            casts, err = None, f"bad JSON: {e}"
        if casts:
            write_day(day, casts, index)
            print(f"{day}: " + " / ".join(f"{c['cat']} ({len(c['c'])}/{len(c['u'])}/{len(c['r'])})" for c in casts))
            return True
        print(f"{day}: attempt {attempt} rejected: {err}", file=sys.stderr)
    return False


def missing_days(today):
    return [today + dt.timedelta(days=i) for i in range(DAYS_AHEAD + 1)
            if not (PUZZLES / f"{(today + dt.timedelta(days=i)).isoformat()}.json").exists()]


def cmd_plan():
    """Print what to write: missing days, chosen categories, rules and an example."""
    today = dt.datetime.now(dt.timezone.utc).date()
    groups, index = load_bank(), load_index()
    rng, plan = random.Random(), []
    for day in missing_days(today):
        used = recent_categories(index, day) | {norm(c) for p in plan for c in p["categories"] if c}
        plan.append({"day": day.isoformat(), "categories": pick_categories(groups, used, rng)})
    avoid = sorted({c for d in index["days"] for c in d["cats"]})
    print(json.dumps({"days": plan, "min_answers": MIN, "avoid": avoid,
                      "example": json.loads(example_cast())}, ensure_ascii=False, indent=1))


def cmd_add(day_str, path):
    """Validate a puzzle JSON written by hand or by Claude and add it for that day."""
    day, index = dt.date.fromisoformat(day_str), load_index()
    if (PUZZLES / f"{day_str}.json").exists():
        sys.exit(f"{day_str} already exists")
    try:
        data = extract_json(Path(path).read_text())
    except (ValueError, json.JSONDecodeError) as e:
        sys.exit(f"rejected: bad JSON: {e}")
    casts, err = validate(data, [None, None, None])
    if not casts:
        sys.exit(f"rejected: {err}")
    taken = recent_categories(index, day)
    clash = [c["cat"] for c in casts if norm(c["cat"]) in taken]
    if clash:
        sys.exit(f"rejected: used recently: {', '.join(clash)}")
    write_day(day, casts, index)
    update_latest(dt.datetime.now(dt.timezone.utc).date())
    print(f"added {day_str}: " + " / ".join(f"{c['cat']} ({len(c['c'])}/{len(c['u'])}/{len(c['r'])})" for c in casts))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "plan":
        return cmd_plan()
    if len(sys.argv) == 4 and sys.argv[1] == "add":
        return cmd_add(sys.argv[2], sys.argv[3])
    today = dt.datetime.now(dt.timezone.utc).date()
    groups, index = load_bank(), load_index()
    rng = random.Random()
    call_no = [0]
    made = failed = 0
    for i in range(DAYS_AHEAD + 1):
        day = today + dt.timedelta(days=i)
        if (PUZZLES / f"{day.isoformat()}.json").exists():
            continue
        if generate_day(day, groups, index, rng, call_no):
            made += 1
        else:
            failed += 1
    update_latest(today)
    print(f"done: {made} new, {failed} failed")
    sys.exit(1 if failed and not made else 0)


if __name__ == "__main__":
    main()
