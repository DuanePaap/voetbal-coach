'use strict';
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { migrate, sql } = require('./db/database');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Te veel pogingen, probeer het later opnieuw' },
});

const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Te veel verzoeken, probeer het later opnieuw' },
});

const authMiddleware = require('./middleware/auth');
const teamScope = require('./middleware/team');
app.use('/api/auth',      authLimiter,                 require('./routes/auth'));
app.use('/api/teams',     authMiddleware,              require('./routes/teams'));
app.use('/api/players',   authMiddleware, teamScope,   require('./routes/players'));
app.use('/api/matches',   authMiddleware, teamScope,   require('./routes/matches'));
app.use('/api/gameplans', authMiddleware, teamScope,   require('./routes/gameplans'));
app.use('/api/codes',     authMiddleware, teamScope,   require('./routes/codes'));
app.use('/api/player',                                 require('./routes/player'));
app.use('/api/share',     shareLimiter,                require('./routes/share'));
app.use('/api/admin',     authMiddleware.admin,        require('./routes/admin'));

// Public: login background image (no auth — used by the login page)
app.get('/api/login-image', async (req, res) => {
  try {
    const { rows } = await sql`SELECT value FROM settings WHERE key = 'login_bg_image'`;
    if (!rows.length || !rows[0].value) return res.json({ image: null });
    res.json({ image: rows[0].value });
  } catch {
    res.json({ image: null });
  }
});

app.all('*', (req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Niet gevonden' });
  }
});

// Global error handler — must have 4 args so Express treats it as an error handler.
// Catches body-parser errors (payload too large, malformed JSON) and uncaught route errors.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = status === 413 ? 'Bestand te groot (max 10 MB)' : (err.message || 'Server fout');
  res.status(status).json({ error: message });
});

// Run DB migrations (idempotent — safe to run on every cold start). Eén retry
// bij een mislukte poging, want een transiënte Neon-verbindingsfout op de
// eerste statement zou anders deze warme container blijvend zonder de nieuwe
// tabellen/kolommen laten draaien totdat hij ververst wordt.
function runMigrations(retriesLeft = 1) {
  migrate().catch(err => {
    console.error('Migration error:', err);
    if (retriesLeft > 0) setTimeout(() => runMigrations(retriesLeft - 1), 2000);
  });
}
runMigrations();

// Export app for Vercel; listen only when run directly
module.exports = app;
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Voetbal Coach draait op http://localhost:${PORT}`));
}
