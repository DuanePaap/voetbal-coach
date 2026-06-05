'use strict';
const express = require('express');
const { sql } = require('../db/database');
const router = express.Router();

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function _generateCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await sql`
      SELECT plc.code, plc.player_id, plc.created_at, p.name AS player_name
      FROM player_login_codes plc
      JOIN players p ON p.id = plc.player_id
      WHERE plc.coach_id = ${req.coach.id}
      ORDER BY p.name
    `;
    res.json(rows.map(r => ({ code: r.code, playerId: r.player_id, playerName: r.player_name, createdAt: r.created_at })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'Player ID verplicht' });

    const { rows: [player] } = await sql`SELECT id, name FROM players WHERE id = ${playerId} AND coach_id = ${req.coach.id}`;
    if (!player) return res.status(404).json({ error: 'Speler niet gevonden' });

    // Generate a unique code
    let code;
    let attempts = 0;
    do {
      code = _generateCode();
      const { rows: [existing] } = await sql`SELECT code FROM player_login_codes WHERE code = ${code}`;
      if (!existing) break;
      attempts++;
    } while (attempts < 20);

    await sql`DELETE FROM player_login_codes WHERE player_id = ${playerId} AND coach_id = ${req.coach.id}`;
    await sql`INSERT INTO player_login_codes (code, player_id, coach_id, created_at) VALUES (${code}, ${playerId}, ${req.coach.id}, ${Date.now()})`;

    res.json({ code, playerId, playerName: player.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.delete('/:code', async (req, res) => {
  try {
    const codeUpper = req.params.code.toUpperCase();
    const result = await sql`DELETE FROM player_login_codes WHERE code = ${codeUpper} AND coach_id = ${req.coach.id}`;
    if (result.rowCount === 0) return res.status(404).json({ error: 'Code niet gevonden' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
