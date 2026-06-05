'use strict';
const express = require('express');
const db = require('../db/database');
const router = express.Router();

router.get('/:matchId', (req, res) => {
  const match = db.prepare('SELECT id FROM matches WHERE id = ? AND coach_id = ?').get(req.params.matchId, req.coach.id);
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
  const gp = db.prepare('SELECT * FROM gameplans WHERE match_id = ?').get(req.params.matchId);
  if (!gp) return res.json({ matchId: req.params.matchId, scenarios: [] });
  res.json({ matchId: gp.match_id, scenarios: JSON.parse(gp.scenarios || '[]') });
});

router.put('/:matchId', (req, res) => {
  const match = db.prepare('SELECT id FROM matches WHERE id = ? AND coach_id = ?').get(req.params.matchId, req.coach.id);
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
  const { scenarios } = req.body;
  db.prepare(`INSERT INTO gameplans (match_id, coach_id, scenarios, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(match_id) DO UPDATE SET scenarios=excluded.scenarios, updated_at=excluded.updated_at`)
    .run(req.params.matchId, req.coach.id, JSON.stringify(scenarios || []), Date.now());
  res.json({ matchId: req.params.matchId, scenarios: scenarios || [] });
});

module.exports = router;
