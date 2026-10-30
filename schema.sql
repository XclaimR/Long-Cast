-- Long Cast database (Cloudflare D1). Paste this into the D1 console once.

-- One row per player per day: their first round is the one that counts.
CREATE TABLE IF NOT EXISTS scores (
  day TEXT NOT NULL,
  player TEXT NOT NULL,
  total INTEGER NOT NULL,
  d1 INTEGER NOT NULL, d2 INTEGER NOT NULL, d3 INTEGER NOT NULL,
  n1 INTEGER NOT NULL, n2 INTEGER NOT NULL, n3 INTEGER NOT NULL,
  best_tier TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, player)
);

-- Each player's log book, backed up from their device.
CREATE TABLE IF NOT EXISTS logbook (
  player TEXT NOT NULL,
  fish TEXT NOT NULL,
  n INTEGER NOT NULL,
  best INTEGER NOT NULL,
  first_day TEXT NOT NULL,
  PRIMARY KEY (player, fish)
);
