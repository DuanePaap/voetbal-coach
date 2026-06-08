'use strict';
const express = require('express');
const path = require('path');
const { migrate, sql } = require('./db/database');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const authMiddleware = require('./middleware/auth');
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/players',   authMiddleware,              require('./routes/players'));
app.use('/api/matches',   authMiddleware,              require('./routes/matches'));
app.use('/api/gameplans', authMiddleware,              require('./routes/gameplans'));
app.use('/api/codes',     authMiddleware,              require('./routes/codes'));
app.use('/api/player',                                 require('./routes/player'));
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

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Niet gevonden' });
  }
});

// Run DB migrations (idempotent — safe to run on every cold start)
migrate().catch(err => console.error('Migration error:', err));

// Export app for Vercel; listen only when run directly
module.exports = app;
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Voetbal Coach draait op http://localhost:${PORT}`));
}
