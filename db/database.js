'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'voetbal_coach.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS coaches (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    coach_id TEXT NOT NULL,
    name TEXT NOT NULL,
    photo TEXT,
    number INTEGER,
    main_position TEXT,
    preferred_positions TEXT NOT NULL DEFAULT '[]',
    present INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    coach_id TEXT NOT NULL,
    opponent TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'thuis',
    field_type TEXT NOT NULL DEFAULT 'half',
    formation TEXT NOT NULL DEFAULT '1-2-3-1',
    periods INTEGER NOT NULL DEFAULT 2,
    present_players TEXT NOT NULL DEFAULT '[]',
    no_sub_players TEXT NOT NULL DEFAULT '[]',
    lineup TEXT NOT NULL DEFAULT '[]',
    substitutions TEXT NOT NULL DEFAULT '[]',
    position_overrides TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gameplans (
    match_id TEXT PRIMARY KEY,
    coach_id TEXT NOT NULL,
    scenarios TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
  );
`);

module.exports = db;
