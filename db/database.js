'use strict';
const { neon } = require('@neondatabase/serverless');

// Lazy initialisation — neon() throws synchronously when no URL is provided,
// which would crash server.js before any routes are registered.
let _sql = null;
function sql(...args) {
  if (!_sql) {
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL is niet ingesteld. Maak een .env bestand aan met POSTGRES_URL=<jouw Neon connection string>.');
    }
    _sql = neon(process.env.POSTGRES_URL, { fullResults: true });
  }
  return _sql(...args);
}
// Pass the tag-function through so sql`...` keeps working everywhere
sql.query = (...a) => sql(...a);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS coaches (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL,
      name TEXT NOT NULL,
      photo TEXT,
      number INTEGER,
      main_position TEXT,
      preferred_positions TEXT NOT NULL DEFAULT '[]',
      present INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL,
      opponent TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT 'thuis',
      field_type TEXT NOT NULL DEFAULT 'half',
      formation TEXT NOT NULL DEFAULT '1-2-3-1',
      periods INTEGER NOT NULL DEFAULT 2,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      sub_moments INTEGER NOT NULL DEFAULT 2,
      share_token TEXT,
      segment_pins TEXT NOT NULL DEFAULT '[]',
      gather_time TEXT,
      match_time TEXT,
      fruit_player_id TEXT,
      referee_player_id TEXT,
      linesman_player_id TEXT,
      captain_player_id TEXT,
      present_players TEXT NOT NULL DEFAULT '[]',
      no_sub_players TEXT NOT NULL DEFAULT '[]',
      lineup TEXT NOT NULL DEFAULT '[]',
      substitutions TEXT NOT NULL DEFAULT '[]',
      position_overrides TEXT NOT NULL DEFAULT '{}',
      created_at BIGINT NOT NULL,
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    )
  `;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS sub_moments INTEGER NOT NULL DEFAULT 2`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS share_token TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS matches_share_token_idx ON matches (share_token) WHERE share_token IS NOT NULL`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS segment_pins TEXT NOT NULL DEFAULT '[]'`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS gather_time TEXT`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_time TEXT`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS fruit_player_id TEXT`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS referee_player_id TEXT`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS linesman_player_id TEXT`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS captain_player_id TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS gameplans (
      match_id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL,
      scenarios TEXT NOT NULL DEFAULT '[]',
      updated_at BIGINT NOT NULL,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS player_login_codes (
      code TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      coach_id TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at BIGINT NOT NULL DEFAULT 0
    )
  `;
}

module.exports = { sql, migrate };
