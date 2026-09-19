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

// Overzicht van wat een coach zelf heeft aangemaakt (coach_id = "aangemaakt door",
// blijft correct ook voor teams die met een andere coach gedeeld worden — zie de
// meerdere-coaches-per-team feature).
router.get('/coaches/:id/overview', async (req, res) => {
  try {
    const { rows: [target] } = await sql`SELECT id FROM coaches WHERE id = ${req.params.id}`;
    if (!target) return res.status(404).json({ error: 'Coach niet gevonden' });

    const [teams, players, matches] = await Promise.all([
      sql`SELECT id, name, is_default, created_at FROM teams WHERE coach_id = ${req.params.id} ORDER BY created_at ASC`,
      sql`
        SELECT p.id, p.name, p.team_id, t.name AS team_name, p.created_at
        FROM players p LEFT JOIN teams t ON t.id = p.team_id
        WHERE p.coach_id = ${req.params.id} ORDER BY p.name ASC
      `,
      sql`
        SELECT m.id, m.opponent, m.date, m.team_id, t.name AS team_name, m.created_at
        FROM matches m LEFT JOIN teams t ON t.id = m.team_id
        WHERE m.coach_id = ${req.params.id} ORDER BY m.date DESC
      `,
    ]);

    res.json({
      teams: teams.rows.map(r => ({ id: r.id, name: r.name, isDefault: r.is_default, createdAt: r.created_at })),
      players: players.rows.map(r => ({ id: r.id, name: r.name, teamId: r.team_id, teamName: r.team_name, createdAt: r.created_at })),
      matches: matches.rows.map(r => ({ id: r.id, opponent: r.opponent, date: r.date, teamId: r.team_id, teamName: r.team_name, createdAt: r.created_at })),
    });
  } catch (err) {
    console.error('Admin coach overview error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

// "Over Tactix26" — vrije tekst-content voor de publieke about-pagina, zelfde
// opslag-patroon als login_bg_image hierboven.
router.get('/about', async (req, res) => {
  try {
    const { rows } = await sql`SELECT value FROM settings WHERE key = 'about_content'`;
    res.json({ content: rows[0]?.value || '' });
  } catch (err) {
    console.error('Admin get about error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/about', async (req, res) => {
  try {
    const content = String(req.body.content ?? '');
    const now = Date.now();
    await sql`
      INSERT INTO settings (key, value, updated_at) VALUES ('about_content', ${content}, ${now})
      ON CONFLICT (key) DO UPDATE SET value = ${content}, updated_at = ${now}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin save about error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
