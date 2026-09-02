'use strict';
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./jwtSecret');
const ADMIN_EMAIL = 'duane@smoothmedia.nl';

function coachAuth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) return res.status(401).json({ error: 'Niet ingelogd' });
  try {
    const payload = jwt.verify(hdr.slice(7), getJwtSecret());
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
    const payload = jwt.verify(hdr.slice(7), getJwtSecret());
    if (payload.type !== 'player') return res.status(403).json({ error: 'Geen toegang' });
    req.player = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Ongeldige of verlopen sessie' });
  }
}

function adminAuth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) return res.status(401).json({ error: 'Niet ingelogd' });
  try {
    const payload = jwt.verify(hdr.slice(7), getJwtSecret());
    if (payload.type && payload.type !== 'coach') return res.status(403).json({ error: 'Geen toegang' });
    if (payload.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Geen admin rechten' });
    req.coach = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Ongeldige of verlopen sessie' });
  }
}

module.exports = coachAuth;
module.exports.player = playerAuth;
module.exports.admin  = adminAuth;
