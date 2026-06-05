'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'vc-secret-change-in-production';
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Vul alle velden in' });
    if (password.length < 6) return res.status(400).json({ error: 'Wachtwoord minimaal 6 tekens' });

    const existing = db.prepare('SELECT id FROM coaches WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'Dit e-mailadres is al in gebruik' });

    const hash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    db.prepare('INSERT INTO coaches (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, email.toLowerCase().trim(), hash, name.trim(), Date.now());

    const token = jwt.sign({ id, email: email.toLowerCase().trim(), name: name.trim() }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, coach: { id, email: email.toLowerCase().trim(), name: name.trim() } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Vul e-mail en wachtwoord in' });

    const coach = db.prepare('SELECT * FROM coaches WHERE email = ?').get(email.toLowerCase().trim());
    if (!coach) return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });

    const ok = await bcrypt.compare(password, coach.password_hash);
    if (!ok) return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });

    const token = jwt.sign({ id: coach.id, email: coach.email, name: coach.name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, coach: { id: coach.id, email: coach.email, name: coach.name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/player-login', (req, res) => {
  const { code } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'Voer een logincode in' });

  const row = db.prepare(`
    SELECT plc.player_id, plc.coach_id, p.name AS player_name, p.photo AS player_photo
    FROM player_login_codes plc
    JOIN players p ON p.id = plc.player_id
    WHERE plc.code = ?
  `).get(code.toUpperCase().trim());

  if (!row) return res.status(401).json({ error: 'Ongeldige logincode' });

  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { type: 'player', id: row.player_id, coachId: row.coach_id, name: row.player_name },
    JWT_SECRET,
    { expiresIn: '365d' }
  );
  res.json({ token, player: { id: row.player_id, name: row.player_name, photo: row.player_photo, coachId: row.coach_id } });
});

module.exports = router;
