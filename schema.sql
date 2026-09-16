-- Woodhouse Program Builder — D1 schema.
--
-- One deployment holds one shared plan: every school, every session, and the
-- catalogue edits made on top of the data that ships with the app. The site
-- (Woodhouse or Roonka) is a column on a booking, not a separate database, so
-- the whole-site views can see across both.
--
-- Apply it with:
--   npx wrangler d1 execute wh-program --remote --file=./schema.sql
--
-- Every statement is IF NOT EXISTS, so running it twice is safe and it doubles
-- as the migration for an existing database.

CREATE TABLE IF NOT EXISTS bookings (
  id            TEXT PRIMARY KEY,
  site          TEXT NOT NULL,
  school_name   TEXT NOT NULL DEFAULT '',
  year_level    TEXT NOT NULL DEFAULT '',
  student_count INTEGER,
  package_tier  TEXT NOT NULL DEFAULT 'gold',
  building      TEXT NOT NULL DEFAULT '',
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  -- Groups are only ever read and written with their booking, so they live in
  -- it as JSON rather than in a table of their own.
  groups        TEXT NOT NULL DEFAULT '[]',
  notes         TEXT,
  contact       TEXT,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bookings_by_site ON bookings (site, start_date);

CREATE TABLE IF NOT EXISTS blocks (
  id                 TEXT PRIMARY KEY,
  booking_id         TEXT NOT NULL,
  date               TEXT NOT NULL,
  start_min          INTEGER NOT NULL,
  end_min            INTEGER NOT NULL,
  group_ids          TEXT NOT NULL DEFAULT '[]',
  kind               TEXT NOT NULL DEFAULT 'activity',
  activity_id        TEXT,
  title              TEXT,
  delivery           TEXT NOT NULL DEFAULT 'staff',
  staff_ids          TEXT NOT NULL DEFAULT '[]',
  training_staff_ids TEXT,
  venue_id           TEXT,
  note               TEXT,
  locked             INTEGER NOT NULL DEFAULT 0,
  colour             TEXT,
  updated_at         TEXT NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS blocks_by_date ON blocks (date);
CREATE INDEX IF NOT EXISTS blocks_by_booking ON blocks (booking_id);

-- Activities, venues and staff added in the app. The catalogue that ships with
-- the app is in the code and is never copied in here — only what's been added.
CREATE TABLE IF NOT EXISTS catalogue (
  kind       TEXT NOT NULL,          -- 'activity' | 'venue' | 'staff'
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,          -- the whole record as JSON
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);

-- Edits to the shipped catalogue, plus the revision counter. Overrides are one
-- blob because they are read and written as one.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
