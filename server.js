'use strict';
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const authMiddleware = require('./middleware/auth');
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/players',  authMiddleware, require('./routes/players'));
app.use('/api/matches',  authMiddleware, require('./routes/matches'));
app.use('/api/gameplans', authMiddleware, require('./routes/gameplans'));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Niet gevonden' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Voetbal Coach draait op http://localhost:${PORT}`));
