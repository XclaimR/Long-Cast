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

On GitHub Pages the game saves everything on the player's device only, and the results screen shows a sample crowd. Hosting the same repo on Cloudflare Pages switches on the small server in `functions/`:

- `functions/api/log.js` backs up each player's log book under their anonymous id.
- `functions/api/score.js` saves each player's first round of the day, re-scoring it from their answers.
- `functions/api/stats.js` powers "Further than X% of anglers", the chart and the comparison table.

Everything below works from a phone browser.

1. Log in at dash.cloudflare.com (a free account is enough).
2. **Create the database:** Storage & Databases > D1 > Create. Name it `long-cast`. Open it, go to the Console tab, paste the contents of `schema.sql`, and run it.
3. **Connect the repo:** Workers & Pages > Create > Pages > Connect to Git. Allow access to `XclaimR/Long-Cast` and pick it. Framework preset: None. Build command: leave empty. Build output directory: `/`. Save and deploy.
4. **Link the database:** in the new Pages project, Settings > Bindings > Add > D1 database. Variable name `DB`, database `long-cast`. Save.
5. **Redeploy** so the link takes effect: Deployments > the latest one > ... > Retry deployment.
6. Play at the `*.pages.dev` address Cloudflare shows. After a round, the results screen should say "Further than X% of anglers today" without the sample-crowd note.

Every push to `main`, including the daily puzzle task, redeploys automatically. GitHub Pages can stay on as well; it just won't save progress.

