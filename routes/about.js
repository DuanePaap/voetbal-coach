'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { sql } = require('../db/database');
const { ADMIN_EMAIL } = require('../middleware/auth');
const { sendContactFormEmail } = require('../services/email');
const router = express.Router();

// Strenger dan de algemene auth-limiter — dit formulier is publiek en
// ongeauthenticeerd, dus het meest voor de hand liggende doelwit voor spam.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Te veel verzoeken, probeer het later opnieuw' },
});

function sanitizeEmail(email) {
  const trimmed = (email || '').toLowerCase().trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await sql`SELECT value FROM settings WHERE key = 'about_content'`;
    res.json({ content: rows[0]?.value || '' });
  } catch (err) {
    console.error('Get about error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/contact', contactLimiter, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = sanitizeEmail(req.body.email);
    const message = (req.body.message || '').trim();
    if (!name || !email || !message) return res.status(400).json({ error: 'Vul alle velden in' });
    if (message.length > 5000) return res.status(400).json({ error: 'Bericht is te lang' });

    await sendContactFormEmail(ADMIN_EMAIL, name, email, message);
    res.json({ ok: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Versturen is mislukt, probeer het later opnieuw' });
  }
});

module.exports = router;
