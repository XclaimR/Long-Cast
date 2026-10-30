# Long Cast

A daily pixel-art fishing word game. Each day has three casts, one category each. Every answer you name blows wind that carries your line further out; the further you cast, the rarer the fish you can hook. Fill your log book with all 25 fish.

## Play

Open `index.html` in a browser, or play the hosted version on GitHub Pages.

## How it works

- `index.html` is the whole game (HTML, CSS and JavaScript, no build step).
- `puzzles/YYYY-MM-DD.json` holds each day's three categories, with answers split into common (`c`), uncommon (`u`) and rare (`r`). Alternate spellings are separated by `|`. The files are lightly encoded so players can't read the categories in the browser before playing; run `python3 scripts/generate_puzzle.py show YYYY-MM-DD` to see one in plain text.
- `puzzles/latest.json` is the fallback puzzle when there is no file for today.
- `puzzles/index.json` lists the days for the Past puzzles screen. It holds dates only, no categories.
- Progress (log book, results) is saved in the browser's localStorage.

## Daily puzzles (automatic)

A daily Claude scheduled task makes new puzzles and pushes them here. Each run:

1. Runs `python3 scripts/generate_puzzle.py plan` to list missing days (today in UTC up to 2 days ahead) and pick three categories per day from `categories.txt`, one per group (everyday, world, deep), skipping any used in the last 120 days.
2. Writes each day's answers as JSON.
3. Runs `python3 scripts/generate_puzzle.py add YYYY-MM-DD file.json`, which cleans the answers (drops duplicates and malformed entries), rejects the puzzle if any tier is too short or a category was used recently, and otherwise writes the day's file and updates `index.json` and `latest.json`.
4. Commits and pushes. GitHub Pages then redeploys.

Only puzzles that pass `add` are committed. If a day is missing, the game falls back to `latest.json`.

The script can also run unattended with the Claude API (`ANTHROPIC_API_KEY` set, no arguments), for example from a GitHub Action.

### Adding categories

Add lines to `categories.txt` as `group: Category name`.

### Adding a puzzle by hand

Write the puzzle as plain JSON (`{"casts":[{"cat","hint","c","u","r"}, ...]}`) and run `python3 scripts/generate_puzzle.py add YYYY-MM-DD file.json`. It checks it, encodes it and updates `index.json`. The script never overwrites a day that already has a file.

If you ever edit puzzle files directly, run `python3 scripts/generate_puzzle.py encode-all` afterwards to re-encode them and rebuild `index.json`.

Encoding only stops casual peeking. The game has to decode puzzles to play them, so someone determined could still read them from the game's code.

## Saving progress and daily comparisons (Cloudflare)

On GitHub Pages the game saves everything on the player's device only, and the results screen shows a sample crowd. Hosting the same repo as a Cloudflare Worker switches on the small server in `src/`:

- `src/worker.js` sends `/api/*` to the handlers and serves the game for everything else.
- `src/api/log.js` backs up each player's log book under their anonymous id.
- `src/api/score.js` saves each player's first round of the day, re-scoring it from their answers.
- `src/api/stats.js` powers "Further than X% of anglers", the chart and the comparison table.

`wrangler.jsonc` configures the Worker, and `.assetsignore` keeps the server code and scripts from being served as website files.

Setup (works from a phone browser):

1. In dash.cloudflare.com, create a D1 database named `long-cast` (Storage & Databases > D1). In its Console, run the SQL in `schema.sql`.
2. Copy the database ID from the D1 page into `wrangler.jsonc` under `d1_databases` (see below), and push.
3. Create a Worker from this repo (Workers & Pages > Create > Import a repository). Leave the build command empty and the deploy command as `npx wrangler deploy`. The Worker name must match `name` in `wrangler.jsonc` (`long-cast`). The game is live at https://long-cast.xclaimr.workers.dev.

```jsonc
"d1_databases": [{ "binding": "DB", "database_name": "long-cast", "database_id": "<id from the D1 page>" }]
```

Until the database is linked, the game still works and saves on the device; the API answers "Database not linked yet".

Every push to `main`, including the daily puzzle task, redeploys automatically. GitHub Pages can stay on as well; it just won't save progress.
