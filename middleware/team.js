'use strict';
const { sql } = require('../db/database');

// Een coach heeft toegang tot een team als eigenaar, of als actief lid via
// team_coaches. Geeft { id, isOwner } terug, of null als er geen toegang is.
async function resolveTeamAccess(coachId, teamId) {
  const { rows: [team] } = await sql`
    SELECT t.id, (t.coach_id = ${coachId}) AS is_owner
    FROM teams t
    WHERE t.id = ${teamId}
      AND (t.coach_id = ${coachId}
           OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = ${coachId} AND tc.active))
  `;
  return team ? { id: team.id, isOwner: team.is_owner } : null;
}

// Bepaalt req.teamId voor de huidige coach. Valt stil terug op het oudste
// team waar de coach toegang toe heeft (eigenaar of actief lid) als de
// X-Team-Id header ontbreekt of er geen toegang toe geeft — nooit een 400,
// zodat een verouderd tabblad of een API-aanroep zonder header niet meteen
// breekt, en een gedeactiveerd lid bij de eerstvolgende request automatisch
// terugvalt op een team waar hij nog wél toegang toe heeft.
async function teamScope(req, res, next) {
  try {
    const requested = req.headers['x-team-id'];
    if (requested) {
      const team = await resolveTeamAccess(req.coach.id, requested);
      if (team) {
        req.teamId = team.id;
        req.isTeamOwner = team.isOwner;
        return next();
      }
    }
    const { rows: [fallback] } = await sql`
      SELECT t.id, (t.coach_id = ${req.coach.id}) AS is_owner
      FROM teams t
      WHERE t.coach_id = ${req.coach.id}
         OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = ${req.coach.id} AND tc.active)
      ORDER BY t.created_at ASC LIMIT 1
    `;
    req.teamId = fallback ? fallback.id : null;
    req.isTeamOwner = fallback ? fallback.is_owner : false;
    next();
  } catch (err) {
    console.error('Team scope error:', err);
    res.status(500).json({ error: 'Server fout' });
  }
}

module.exports = teamScope;
module.exports.resolveTeamAccess = resolveTeamAccess;
