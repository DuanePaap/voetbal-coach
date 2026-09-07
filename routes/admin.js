'use strict';
const express = require('express');
const { sql } = require('../db/database');
const { ADMIN_EMAIL } = require('../middleware/auth');
const router = express.Router();

function sanitizeEmail(email) {
  const trimmed = (email || '').toLowerCase().trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

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

// Coach account management — het admin-account zelf (ADMIN_EMAIL) mag hier nooit
// via bewerkt/geblokkeerd/verwijderd worden, ook niet als iemand het id raadt.
router.get('/coaches', async (req, res) => {
  try {
    const { rows } = await sql`SELECT id, email, name, blocked, created_at FROM coaches ORDER BY created_at ASC`;
    res.json(rows.map(r => ({
      id: r.id,
      email: r.email,
      name: r.name,
      blocked: r.blocked,
      createdAt: r.created_at,
      isAdmin: r.email === ADMIN_EMAIL,
    })));
  } catch (err) {
    console.error('Admin list coaches error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.put('/coaches/:id/email', async (req, res) => {
  try {
    const { rows: [target] } = await sql`SELECT email FROM coaches WHERE id = ${req.params.id}`;
    if (!target) return res.status(404).json({ error: 'Coach niet gevonden' });
    if (target.email === ADMIN_EMAIL) return res.status(403).json({ error: 'Het admin-account kan niet gewijzigd worden' });

    const email = sanitizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Ongeldig e-mailadres' });
    if (email === ADMIN_EMAIL) return res.status(400).json({ error: 'Dit e-mailadres is gereserveerd' });

    const { rows: [existing] } = await sql`SELECT id FROM coaches WHERE email = ${email} AND id != ${req.params.id}`;
    if (existing) return res.status(409).json({ error: 'Dit e-mailadres is al in gebruik' });

    await sql`UPDATE coaches SET email = ${email} WHERE id = ${req.params.id}`;
    res.json({ ok: true, email });
  } catch (err) {
    console.error('Admin update coach email error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.put('/coaches/:id/block', async (req, res) => {
  try {
    const { rows: [target] } = await sql`SELECT email FROM coaches WHERE id = ${req.params.id}`;
    if (!target) return res.status(404).json({ error: 'Coach niet gevonden' });
    if (target.email === ADMIN_EMAIL) return res.status(403).json({ error: 'Het admin-account kan niet gewijzigd worden' });

    const blocked = !!req.body.blocked;
    await sql`UPDATE coaches SET blocked = ${blocked} WHERE id = ${req.params.id}`;
    res.json({ ok: true, blocked });
  } catch (err) {
    console.error('Admin block coach error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.delete('/coaches/:id', async (req, res) => {
  try {
    const { rows: [target] } = await sql`SELECT email FROM coaches WHERE id = ${req.params.id}`;
    if (!target) return res.status(404).json({ error: 'Coach niet gevonden' });
    if (target.email === ADMIN_EMAIL) return res.status(403).json({ error: 'Het admin-account kan niet verwijderd worden' });

    await sql`DELETE FROM coaches WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin delete coach error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
