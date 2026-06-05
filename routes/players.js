'use strict';
const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/database');
const router = express.Router();

function parse(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    name: row.name,
    photo: row.photo || null,
    number: row.number || null,
    mainPosition: row.main_position || null,
    preferredPositions: JSON.parse(row.preferred_positions || '[]'),
    present: row.present === 1,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM players WHERE coach_id = ? ORDER BY name').all(req.coach.id);
  res.json(rows.map(parse));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM players WHERE id = ? AND coach_id = ?').get(req.params.id, req.coach.id);
  if (!row) return res.status(404).json({ error: 'Speler niet gevonden' });
  res.json(parse(row));
});

router.post('/', (req, res) => {
  const { name, photo, number, mainPosition, preferredPositions, present } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Naam is verplicht' });
  const id = randomUUID();
  db.prepare(`INSERT INTO players (id, coach_id, name, photo, number, main_position, preferred_positions, present, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.coach.id, name.trim(), photo || null, number || null, mainPosition || null,
      JSON.stringify(preferredPositions || []), present !== false ? 1 : 0, Date.now());
  res.json(parse(db.prepare('SELECT * FROM players WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM players WHERE id = ? AND coach_id = ?').get(req.params.id, req.coach.id);
  if (!existing) return res.status(404).json({ error: 'Speler niet gevonden' });
  const { name, photo, number, mainPosition, preferredPositions, present } = req.body;
  db.prepare(`UPDATE players SET name=?, photo=?, number=?, main_position=?, preferred_positions=?, present=?
    WHERE id=? AND coach_id=?`)
    .run(name?.trim() || '', photo || null, number || null, mainPosition || null,
      JSON.stringify(preferredPositions || []), present !== false ? 1 : 0, req.params.id, req.coach.id);
  res.json(parse(db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM players WHERE id = ? AND coach_id = ?').run(req.params.id, req.coach.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Speler niet gevonden' });
  res.json({ ok: true });
});

module.exports = router;
