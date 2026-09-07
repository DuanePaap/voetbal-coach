'use strict';
const express = require('express');
const { randomUUID } = require('crypto');
const { sql } = require('../db/database');
const { resolveTeamAccess } = require('../middleware/team');
const router = express.Router();

function parse(row) {
  return { id: row.id, name: row.name, isDefault: row.is_default, isOwner: row.is_owner };
}

function sanitizeEmail(email) {
  const trimmed = (email || '').toLowerCase().trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

function parseCoachRow(row) {
  return { id: row.id, email: row.email, name: row.coach_name || null, active: row.active, addedAt: row.added_at };
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await sql`
      SELECT t.*, (t.coach_id = ${req.coach.id}) AS is_owner
      FROM teams t
      WHERE t.coach_id = ${req.coach.id}
         OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = ${req.coach.id} AND tc.active)
      ORDER BY t.created_at ASC
    `;
    res.json(rows.map(parse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
    const id = randomUUID();
    const { rows: [row] } = await sql`
      INSERT INTO teams (id, coach_id, name, created_at, is_default)
      VALUES (${id}, ${req.coach.id}, ${name}, ${Date.now()}, false)
      RETURNING *, true AS is_owner
    `;
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

// Naam wijzigen mag elk teamlid (eigenaar of actieve co-coach) — alleen
// coaches toevoegen/beheren is aan de eigenaar voorbehouden (zie hieronder).
router.put('/:id', async (req, res) => {
  try {
    const access = await resolveTeamAccess(req.coach.id, req.params.id);
    if (!access) return res.status(404).json({ error: 'Team niet gevonden' });

    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
    const { rows: [row] } = await sql`
      UPDATE teams SET name = ${name} WHERE id = ${req.params.id} RETURNING *, ${access.isOwner} AS is_owner
    `;
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

// ── Coaches beheer (alleen de eigenaar) ─────────────────────────────────
async function _requireOwner(req, res) {
  const access = await resolveTeamAccess(req.coach.id, req.params.id);
  if (!access) { res.status(404).json({ error: 'Team niet gevonden' }); return null; }
  if (!access.isOwner) { res.status(403).json({ error: 'Alleen de teameigenaar kan coaches beheren' }); return null; }
  return access;
}

router.get('/:id/coaches', async (req, res) => {
  try {
    if (!(await _requireOwner(req, res))) return;
    const { rows } = await sql`
      SELECT tc.id, tc.email, tc.active, tc.added_at, c.name AS coach_name
      FROM team_coaches tc
      LEFT JOIN coaches c ON c.id = tc.coach_id
      WHERE tc.team_id = ${req.params.id}
      ORDER BY tc.added_at ASC
    `;
    res.json(rows.map(parseCoachRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/:id/coaches', async (req, res) => {
  try {
    if (!(await _requireOwner(req, res))) return;
    const email = sanitizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Ongeldig e-mailadres' });
    if (email === req.coach.email) return res.status(400).json({ error: 'Je bent al eigenaar van dit team' });

    const { rows: [existingCoach] } = await sql`SELECT id, name FROM coaches WHERE email = ${email}`;
    const coachId = existingCoach ? existingCoach.id : null;
    const id = randomUUID();
    const { rows: [row] } = await sql`
      INSERT INTO team_coaches (id, team_id, email, coach_id, active, added_at)
      VALUES (${id}, ${req.params.id}, ${email}, ${coachId}, true, ${Date.now()})
      ON CONFLICT (team_id, email) DO UPDATE SET active = true, coach_id = EXCLUDED.coach_id
      RETURNING id, email, active, added_at
    `;
    res.json(parseCoachRow({ ...row, coach_name: existingCoach?.name || null }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.put('/:id/coaches/:coachRowId', async (req, res) => {
  try {
    if (!(await _requireOwner(req, res))) return;
    const active = !!req.body.active;
    const { rows: [row] } = await sql`
      UPDATE team_coaches SET active = ${active}
      WHERE id = ${req.params.coachRowId} AND team_id = ${req.params.id}
      RETURNING id, email, active, added_at
    `;
    if (!row) return res.status(404).json({ error: 'Coach niet gevonden' });
    res.json(parseCoachRow(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.delete('/:id/coaches/:coachRowId', async (req, res) => {
  try {
    if (!(await _requireOwner(req, res))) return;
    const result = await sql`DELETE FROM team_coaches WHERE id = ${req.params.coachRowId} AND team_id = ${req.params.id}`;
    if (result.rowCount === 0) return res.status(404).json({ error: 'Coach niet gevonden' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
