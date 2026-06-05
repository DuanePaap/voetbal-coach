'use strict';
const { sql } = require('@vercel/postgres');

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
      present_players TEXT NOT NULL DEFAULT '[]',
      no_sub_players TEXT NOT NULL DEFAULT '[]',
      lineup TEXT NOT NULL DEFAULT '[]',
      substitutions TEXT NOT NULL DEFAULT '[]',
      position_overrides TEXT NOT NULL DEFAULT '{}',
      created_at BIGINT NOT NULL,
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    )
  `;
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
}

module.exports = { sql, migrate };
