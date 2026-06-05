'use strict';
const express = require('express');
const db = require('../db/database');
const router = express.Router();

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

function _generateCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT plc.code, plc.player_id, plc.created_at, p.name AS player_name
    FROM player_login_codes plc
    JOIN players p ON p.id = plc.player_id
    WHERE plc.coach_id = ?
    ORDER BY p.name
  `).all(req.coach.id);
  res.json(rows.map(r => ({ code: r.code, playerId: r.player_id, playerName: r.player_name, createdAt: r.created_at })));
});

router.post('/', (req, res) => {
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ error: 'Player ID verplicht' });

  const player = db.prepare('SELECT id, name FROM players WHERE id = ? AND coach_id = ?').get(playerId, req.coach.id);
  if (!player) return res.status(404).json({ error: 'Speler niet gevonden' });

  let code, attempts = 0;
  do { code = _generateCode(); attempts++; }
  while (db.prepare('SELECT code FROM player_login_codes WHERE code = ?').get(code) && attempts < 20);

  db.prepare('DELETE FROM player_login_codes WHERE player_id = ? AND coach_id = ?').run(playerId, req.coach.id);
  db.prepare('INSERT INTO player_login_codes (code, player_id, coach_id, created_at) VALUES (?, ?, ?, ?)').run(code, playerId, req.coach.id, Date.now());

  res.json({ code, playerId, playerName: player.name });
});

router.delete('/:code', (req, res) => {
  const r = db.prepare('DELETE FROM player_login_codes WHERE code = ? AND coach_id = ?').run(req.params.code.toUpperCase(), req.coach.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Code niet gevonden' });
  res.json({ ok: true });
});

module.exports = router;
