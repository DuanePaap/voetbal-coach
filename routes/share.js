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
    const { rows: allPlayers } = await sql`SELECT id, name, photo FROM players WHERE coach_id = ${row.coach_id}`;
    const players = allPlayers.filter(p => presentPlayers.includes(p.id));

    res.json({
      opponent: row.opponent,
      date: row.date,
      fieldType: row.field_type,
      formation: row.formation,
      lineup: JSON.parse(row.lineup || '[]'),
      substitutions: JSON.parse(row.substitutions || '[]'),
      positionOverrides: JSON.parse(row.position_overrides || '{}'),
      players,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
