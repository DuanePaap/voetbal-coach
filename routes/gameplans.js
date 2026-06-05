'use strict';
const express = require('express');
const { sql } = require('../db/database');
const router = express.Router();

router.get('/:matchId', async (req, res) => {
  try {
    const { rows: [match] } = await sql`SELECT id FROM matches WHERE id = ${req.params.matchId} AND coach_id = ${req.coach.id}`;
    if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });

    const { rows: [gp] } = await sql`SELECT * FROM gameplans WHERE match_id = ${req.params.matchId}`;
    if (!gp) return res.json({ matchId: req.params.matchId, scenarios: [] });
    res.json({ matchId: gp.match_id, scenarios: JSON.parse(gp.scenarios || '[]') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.put('/:matchId', async (req, res) => {
  try {
    const { rows: [match] } = await sql`SELECT id FROM matches WHERE id = ${req.params.matchId} AND coach_id = ${req.coach.id}`;
    if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });

    const { scenarios } = req.body;
    const scenariosJson = JSON.stringify(scenarios || []);
    const now = Date.now();
    await sql`
      INSERT INTO gameplans (match_id, coach_id, scenarios, updated_at)
      VALUES (${req.params.matchId}, ${req.coach.id}, ${scenariosJson}, ${now})
      ON CONFLICT (match_id) DO UPDATE SET
        scenarios  = EXCLUDED.scenarios,
        updated_at = EXCLUDED.updated_at
    `;
    res.json({ matchId: req.params.matchId, scenarios: scenarios || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
