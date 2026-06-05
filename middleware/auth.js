'use strict';
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'vc-secret-change-in-production';

function coachAuth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) return res.status(401).json({ error: 'Niet ingelogd' });
  try {
    const payload = jwt.verify(hdr.slice(7), JWT_SECRET);
    if (payload.type && payload.type !== 'coach') return res.status(403).json({ error: 'Geen toegang' });
    req.coach = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Ongeldige of verlopen sessie' });
  }
}

function playerAuth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) return res.status(401).json({ error: 'Niet ingelogd' });
  try {
    const payload = jwt.verify(hdr.slice(7), JWT_SECRET);
    if (payload.type !== 'player') return res.status(403).json({ error: 'Geen toegang' });
    req.player = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Ongeldige of verlopen sessie' });
  }
}

module.exports = coachAuth;
module.exports.player = playerAuth;
