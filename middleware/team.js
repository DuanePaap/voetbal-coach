'use strict';
const { sql } = require('../db/database');

// Bepaalt req.teamId voor de huidige coach. Valt stil terug op het oudste
// (standaard) team van de coach als de X-Team-Id header ontbreekt of niet
// bij deze coach hoort — nooit een 400, zodat een verouderd tabblad of een
// API-aanroep zonder header niet meteen breekt.
async function teamScope(req, res, next) {
  try {
    const requested = req.headers['x-team-id'];
    if (requested) {
      const { rows: [team] } = await sql`SELECT id FROM teams WHERE id = ${requested} AND coach_id = ${req.coach.id}`;
      if (team) {
        req.teamId = team.id;
        return next();
      }
    }
    const { rows: [fallback] } = await sql`SELECT id FROM teams WHERE coach_id = ${req.coach.id} ORDER BY created_at ASC LIMIT 1`;
    req.teamId = fallback ? fallback.id : null;
    next();
  } catch (err) {
    console.error('Team scope error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
}

module.exports = teamScope;
