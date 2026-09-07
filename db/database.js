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
      blocked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at BIGINT NOT NULL
    )
  `;
  await sql`ALTER TABLE coaches ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at BIGINT NOT NULL,
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS teams_one_default_per_coach ON teams (coach_id) WHERE is_default`;
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
  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS team_id TEXT`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE players ADD CONSTRAINT players_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
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
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_id TEXT`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE matches ADD CONSTRAINT matches_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
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
  await sql`ALTER TABLE gameplans ADD COLUMN IF NOT EXISTS team_id TEXT`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE gameplans ADD CONSTRAINT gameplans_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
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
    CREATE TABLE IF NOT EXISTS team_coaches (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      email TEXT NOT NULL,
      coach_id TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      added_at BIGINT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS team_coaches_team_email_idx ON team_coaches (team_id, email)`;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at BIGINT NOT NULL DEFAULT 0
    )
  `;

  // Backfill: elke coach zonder team krijgt een standaardteam, en bestaande
  // spelers/wedstrijden/gameplans zonder team_id worden daaraan gekoppeld.
  // Set-based (geen JS-lus) en race-veilig bij gelijktijdige cold starts:
  // de partial unique index laat een verliezende gelijktijdige INSERT stil
  // mislukken, en de UPDATEs raken alleen nog-NULL rijen.
  await sql`
    INSERT INTO teams (id, coach_id, name, created_at, is_default)
    SELECT c.id || '-default', c.id, 'Team 1', ${Date.now()}, true
    FROM coaches c
    WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.coach_id = c.id)
    ON CONFLICT (coach_id) WHERE is_default DO NOTHING
  `;
  await sql`
    UPDATE players p SET team_id = t.id FROM teams t
    WHERE t.coach_id = p.coach_id AND t.is_default AND p.team_id IS NULL
  `;
  await sql`
    UPDATE matches m SET team_id = t.id FROM teams t
    WHERE t.coach_id = m.coach_id AND t.is_default AND m.team_id IS NULL
  `;
  await sql`
    UPDATE gameplans g SET team_id = t.id FROM teams t
    WHERE t.coach_id = g.coach_id AND t.is_default AND g.team_id IS NULL
  `;
}

module.exports = { sql, migrate };
