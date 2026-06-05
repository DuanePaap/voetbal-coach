'use strict';
const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/database');
const router = express.Router();

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
    presentPlayers: JSON.parse(row.present_players || '[]'),
    noSubPlayers: JSON.parse(row.no_sub_players || '[]'),
    lineup: JSON.parse(row.lineup || '[]'),
    substitutions: JSON.parse(row.substitutions || '[]'),
    positionOverrides: JSON.parse(row.position_overrides || '{}'),
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM matches WHERE coach_id = ? ORDER BY date DESC').all(req.coach.id);
  res.json(rows.map(parse));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM matches WHERE id = ? AND coach_id = ?').get(req.params.id, req.coach.id);
  if (!row) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
  res.json(parse(row));
});

router.post('/', (req, res) => {
  const { opponent, date, location, fieldType, formation, periods, presentPlayers } = req.body;
  if (!opponent?.trim() || !date) return res.status(400).json({ error: 'Tegenstander en datum zijn verplicht' });
  const id = randomUUID();
  db.prepare(`INSERT INTO matches (id, coach_id, opponent, date, location, field_type, formation, periods,
    present_players, no_sub_players, lineup, substitutions, position_overrides, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.coach.id, opponent.trim(), date, location || 'thuis', fieldType || 'half',
      formation || '1-2-3-1', periods || 2, JSON.stringify(presentPlayers || []),
      '[]', '[]', '[]', '{}', Date.now());
  res.json(parse(db.prepare('SELECT * FROM matches WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM matches WHERE id = ? AND coach_id = ?').get(req.params.id, req.coach.id);
  if (!existing) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
  const { opponent, date, location, fieldType, formation, periods, presentPlayers, noSubPlayers, lineup, substitutions, positionOverrides } = req.body;
  db.prepare(`UPDATE matches SET opponent=?, date=?, location=?, field_type=?, formation=?, periods=?,
    present_players=?, no_sub_players=?, lineup=?, substitutions=?, position_overrides=?
    WHERE id=? AND coach_id=?`)
    .run(opponent?.trim() || '', date, location || 'thuis', fieldType || 'half', formation || '1-2-3-1',
      periods || 2, JSON.stringify(presentPlayers || []), JSON.stringify(noSubPlayers || []),
      JSON.stringify(lineup || []), JSON.stringify(substitutions || []), JSON.stringify(positionOverrides || {}),
      req.params.id, req.coach.id);
  res.json(parse(db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM matches WHERE id = ? AND coach_id = ?').run(req.params.id, req.coach.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
  res.json({ ok: true });
});

module.exports = router;
