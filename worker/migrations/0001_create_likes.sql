CREATE TABLE IF NOT EXISTS planet_likes (
  planet_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (planet_id, visitor_hash)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS planet_like_counts (
  planet_id TEXT PRIMARY KEY,
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS like_rate_limits (
  visitor_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  mutation_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) WITHOUT ROWID;

CREATE TRIGGER IF NOT EXISTS planet_likes_after_insert
AFTER INSERT ON planet_likes
BEGIN
  INSERT INTO planet_like_counts (planet_id, like_count, updated_at)
  VALUES (NEW.planet_id, 1, CURRENT_TIMESTAMP)
  ON CONFLICT (planet_id) DO UPDATE SET
    like_count = planet_like_counts.like_count + 1,
    updated_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS planet_likes_after_delete
AFTER DELETE ON planet_likes
BEGIN
  UPDATE planet_like_counts
  SET like_count = MAX(like_count - 1, 0),
      updated_at = CURRENT_TIMESTAMP
  WHERE planet_id = OLD.planet_id;
END;
