'use strict';
const express = require('express');
const { sql } = require('../db/database');
const router = express.Router();

router.get('/login-bg', async (req, res) => {
  try {
    const { rows } = await sql`SELECT value, updated_at FROM settings WHERE key = 'login_bg_image'`;
    if (!rows.length || !rows[0].value) return res.json({ image: null });
    res.json({ image: rows[0].value, updatedAt: rows[0].updated_at });
  } catch (err) {
    console.error('Admin get login-bg error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/login-bg', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Geen afbeelding opgegeven' });
    if (!image.startsWith('data:image/')) return res.status(400).json({ error: 'Ongeldig afbeeldingsformaat' });
    const now = Date.now();
    await sql`
      INSERT INTO settings (key, value, updated_at) VALUES ('login_bg_image', ${image}, ${now})
      ON CONFLICT (key) DO UPDATE SET value = ${image}, updated_at = ${now}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin upload login-bg error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.delete('/login-bg', async (req, res) => {
  try {
    await sql`DELETE FROM settings WHERE key = 'login_bg_image'`;
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin delete login-bg error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
