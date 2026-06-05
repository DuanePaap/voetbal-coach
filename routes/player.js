'use strict';
const express = require('express');
const { sql } = require('../db/database');
const { player: playerAuth } = require('../middleware/auth');
const router = express.Router();

function parseMatch(row) {
  return {
    id: row.id, opponent: row.opponent, date: row.date,
    location: row.location, fieldType: row.field_type,
    formation: row.formation, periods: row.periods,
    presentPlayers:   JSON.parse(row.present_players   || '[]'),
    noSubPlayers:     JSON.parse(row.no_sub_players     || '[]'),
    lineup:           JSON.parse(row.lineup             || '[]'),
    substitutions:    JSON.parse(row.substitutions      || '[]'),
    positionOverrides:JSON.parse(row.position_overrides || '{}'),
  };
}

router.get('/players', playerAuth, async (req, res) => {
  try {
    const { rows } = await sql`SELECT id, name, photo FROM players WHERE coach_id = ${req.player.coachId} ORDER BY name`;
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.get('/matches', playerAuth, async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM matches WHERE coach_id = ${req.player.coachId} ORDER BY date DESC`;
    res.json(rows.map(parseMatch));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.get('/matches/:id', playerAuth, async (req, res) => {
  try {
    const { rows: [row] } = await sql`SELECT * FROM matches WHERE id = ${req.params.id} AND coach_id = ${req.player.coachId}`;
    if (!row) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });
    res.json(parseMatch(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.get('/gameplans/:matchId', playerAuth, async (req, res) => {
  try {
    const { rows: [match] } = await sql`SELECT id FROM matches WHERE id = ${req.params.matchId} AND coach_id = ${req.player.coachId}`;
    if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });

    const { rows: [gp] } = await sql`SELECT * FROM gameplans WHERE match_id = ${req.params.matchId}`;
    if (!gp) return res.json({ matchId: req.params.matchId, scenarios: [] });
    res.json({ matchId: gp.match_id, scenarios: JSON.parse(gp.scenarios || '[]') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
