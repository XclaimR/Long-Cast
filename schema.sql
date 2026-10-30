-- Long Cast database (Cloudflare D1). The Worker also creates these tables itself on first use.

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

-- Angler codes: a private code that moves a player's progress to another device.
CREATE TABLE IF NOT EXISTS anglers (
  code TEXT PRIMARY KEY,
  player TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- Each finished round, so past results travel with the angler code.
CREATE TABLE IF NOT EXISTS results (
  player TEXT NOT NULL,
  day TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (player, day)
);
