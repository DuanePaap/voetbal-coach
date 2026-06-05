'use strict';
const express = require('express');
const db = require('../db/database');
const { player: playerAuth } = require('../middleware/auth');
const router = express.Router();

function parseMatch(row) {
  return {
    id: row.id, opponent: row.opponent, date: row.date,
    location: row.location, fieldType: row.field_type,
    formation: row.formation, periods: row.periods,
    presentPlayers: JSON.parse(row.present_players || '[]'),
    noSubPlayers: JSON.parse(row.no_sub_players || '[]'),
    lineup: JSON.parse(row.lineup || '[]'),
    substitutions: JSON.parse(row.substitutions || '[]'),
    positionOverrides: JSON.parse(row.position_overrides || '{}'),
  };
}

router.get('/players', playerAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name, photo FROM players WHERE coach_id = ? ORDER BY name').all(req.player.coachId);
  res.json(rows);
});

router.get('/matches', playerAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM matches WHERE coach_id = ? ORDER BY date DESC').all(req.player.coachId);
  res.json(rows.map(parseMatch));
});

router.get('/matches/:id', playerAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM matches WHERE id = ? AND coach_id = ?').get(req.params.id, req.player.coachId);
  if (!row) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
  res.json(parseMatch(row));
});

router.get('/gameplans/:matchId', playerAuth, (req, res) => {
  const match = db.prepare('SELECT id FROM matches WHERE id = ? AND coach_id = ?').get(req.params.matchId, req.player.coachId);
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
  const gp = db.prepare('SELECT * FROM gameplans WHERE match_id = ?').get(req.params.matchId);
  if (!gp) return res.json({ matchId: req.params.matchId, scenarios: [] });
  res.json({ matchId: gp.match_id, scenarios: JSON.parse(gp.scenarios || '[]') });
});

module.exports = router;
