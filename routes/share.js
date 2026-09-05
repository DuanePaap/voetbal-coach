'use strict';
const express = require('express');
const { sql } = require('../db/database');
const router = express.Router();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Public, unauthenticated — token itself (128 bits, crypto.randomBytes) is the access control.
// Link stops working the day after the match.
router.get('/:token', async (req, res) => {
  try {
    const { rows: [row] } = await sql`SELECT * FROM matches WHERE share_token = ${req.params.token}`;
    if (!row) return res.status(404).json({ error: 'Deze link is ongeldig' });

    const expiresAt = new Date(row.date + 'T00:00:00Z').getTime() + MS_PER_DAY;
    if (Date.now() >= expiresAt) return res.status(410).json({ error: 'Deze opstelling is niet meer beschikbaar' });

    const presentPlayers = JSON.parse(row.present_players || '[]');
    const dutyIds = [row.fruit_player_id, row.referee_player_id, row.linesman_player_id, row.captain_player_id].filter(Boolean);
    const visibleIds = new Set([...presentPlayers, ...dutyIds]);
    const { rows: allPlayers } = await sql`SELECT id, name, photo FROM players WHERE coach_id = ${row.coach_id}`;
    const players = allPlayers.filter(p => visibleIds.has(p.id));

    res.json({
      opponent: row.opponent,
      date: row.date,
      fieldType: row.field_type,
      formation: row.formation,
      lineup: JSON.parse(row.lineup || '[]'),
      substitutions: JSON.parse(row.substitutions || '[]'),
      positionOverrides: JSON.parse(row.position_overrides || '{}'),
      gatherTime: row.gather_time,
      matchTime: row.match_time,
      fruitPlayerId: row.fruit_player_id,
      refereePlayerId: row.referee_player_id,
      linesmanPlayerId: row.linesman_player_id,
      captainPlayerId: row.captain_player_id,
      players,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
