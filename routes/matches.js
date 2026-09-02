'use strict';
const express = require('express');
const { randomUUID, randomBytes } = require('crypto');
const { sql } = require('../db/database');
const router = express.Router();

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parse(row) {
  if (!row) return null;
  return {
    id: row.id,
    coachId: row.coach_id,
    opponent: row.opponent,
    date: row.date,
    location: row.location,
    fieldType: row.field_type,
    formation: row.formation,
    periods: row.periods,
    duration: row.duration_minutes,
    subMoments: row.sub_moments,
    presentPlayers:   JSON.parse(row.present_players   || '[]'),
    noSubPlayers:     JSON.parse(row.no_sub_players     || '[]'),
    lineup:           JSON.parse(row.lineup             || '[]'),
    substitutions:    JSON.parse(row.substitutions      || '[]'),
    positionOverrides:JSON.parse(row.position_overrides || '{}'),
  };
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM matches WHERE coach_id = ${req.coach.id} ORDER BY date DESC`;
    res.json(rows.map(parse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [row] } = await sql`SELECT * FROM matches WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}`;
    if (!row) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { opponent, date, location, fieldType, formation, periods, duration, subMoments, presentPlayers } = req.body;
    if (!opponent?.trim() || !date) return res.status(400).json({ error: 'Tegenstander en datum zijn verplicht' });
    const id = randomUUID();
    const durationVal = clampInt(duration, 60, 10, 150);
    const subMomentsVal = clampInt(subMoments, 2, 1, 10);
    const { rows: [row] } = await sql`
      INSERT INTO matches (id, coach_id, opponent, date, location, field_type, formation, periods,
        duration_minutes, sub_moments, present_players, no_sub_players, lineup, substitutions, position_overrides, created_at)
      VALUES (${id}, ${req.coach.id}, ${opponent.trim()}, ${date},
              ${location || 'thuis'}, ${fieldType || 'half'}, ${formation || '1-2-3-1'}, ${periods || 2},
              ${durationVal}, ${subMomentsVal},
              ${JSON.stringify(presentPlayers || [])}, ${'[]'}, ${'[]'}, ${'[]'}, ${'{}'},
              ${Date.now()})
      RETURNING *
    `;
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows: [existing] } = await sql`SELECT id FROM matches WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}`;
    if (!existing) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });

    const { opponent, date, location, fieldType, formation, periods, duration, subMoments,
            presentPlayers, noSubPlayers, lineup, substitutions, positionOverrides } = req.body;
    const durationVal = clampInt(duration, 60, 10, 150);
    const subMomentsVal = clampInt(subMoments, 2, 1, 10);

    const { rows: [row] } = await sql`
      UPDATE matches
      SET opponent          = ${opponent?.trim() || ''},
          date              = ${date},
          location          = ${location || 'thuis'},
          field_type        = ${fieldType || 'half'},
          formation         = ${formation || '1-2-3-1'},
          periods           = ${periods || 2},
          duration_minutes  = ${durationVal},
          sub_moments       = ${subMomentsVal},
          present_players   = ${JSON.stringify(presentPlayers   || [])},
          no_sub_players    = ${JSON.stringify(noSubPlayers     || [])},
          lineup            = ${JSON.stringify(lineup           || [])},
          substitutions     = ${JSON.stringify(substitutions    || [])},
          position_overrides= ${JSON.stringify(positionOverrides|| {})}
      WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}
      RETURNING *
    `;
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

// Generate (or return the existing) public share token for this match, used to build a
// no-login WhatsApp-shareable link. Idempotent — repeated calls return the same token.
router.post('/:id/share', async (req, res) => {
  try {
    const { rows: [existing] } = await sql`SELECT share_token FROM matches WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}`;
    if (!existing) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
    if (existing.share_token) return res.json({ token: existing.share_token });

    const token = randomBytes(16).toString('hex');
    await sql`UPDATE matches SET share_token = ${token} WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}`;
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await sql`DELETE FROM matches WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}`;
    if (result.rowCount === 0) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
