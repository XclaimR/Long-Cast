# Long Cast

A daily pixel-art fishing word game. Each day has three casts, one category each. Every answer you name blows wind that carries your line further out; the further you cast, the rarer the fish you can hook. Fill your log book with all 25 fish.

## Play

Open `index.html` in a browser, or play the hosted version on GitHub Pages.

## How it works

- `index.html` is the whole game (HTML, CSS and JavaScript, no build step).
- `puzzles/YYYY-MM-DD.json` holds each day's three categories, with answers split into common (`c`), uncommon (`u`) and rare (`r`). Alternate spellings are separated by `|`.
- `puzzles/latest.json` is the fallback puzzle when there is no file for today.
- `puzzles/index.json` lists past days for the archive.
- Progress (log book, results) is saved in the browser's localStorage.

## Adding a puzzle

1. Add `puzzles/YYYY-MM-DD.json` in the same shape as the existing files.
2. Copy it to `puzzles/latest.json`.
3. Add the day to the top of `puzzles/index.json`.
