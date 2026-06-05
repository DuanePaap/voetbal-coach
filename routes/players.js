'use strict';
const express = require('express');
const { randomUUID } = require('crypto');
const { sql } = require('../db/database');
const router = express.Router();

function parse(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    name: row.name,
    photo: row.photo || null,
    number: row.number || null,
    mainPosition: row.main_position || null,
    preferredPositions: JSON.parse(row.preferred_positions || '[]'),
    present: row.present === 1 || row.present === true,
  };
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM players WHERE coach_id = ${req.coach.id} ORDER BY name`;
    res.json(rows.map(parse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [row] } = await sql`SELECT * FROM players WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}`;
    if (!row) return res.status(404).json({ error: 'Speler niet gevonden' });
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, photo, number, mainPosition, preferredPositions, present } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Naam is verplicht' });
    const id = randomUUID();
    const prefJson = JSON.stringify(preferredPositions || []);
    const isPresent = present !== false ? 1 : 0;
    const { rows: [row] } = await sql`
      INSERT INTO players (id, coach_id, name, photo, number, main_position, preferred_positions, present, created_at)
      VALUES (${id}, ${req.coach.id}, ${name.trim()}, ${photo || null}, ${number || null},
              ${mainPosition || null}, ${prefJson}, ${isPresent}, ${Date.now()})
      RETURNING *
    `;
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows: [existing] } = await sql`SELECT id FROM players WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}`;
    if (!existing) return res.status(404).json({ error: 'Speler niet gevonden' });

    const { name, photo, number, mainPosition, preferredPositions, present } = req.body;
    const prefJson = JSON.stringify(preferredPositions || []);
    const isPresent = present !== false ? 1 : 0;
    const { rows: [row] } = await sql`
      UPDATE players
      SET name = ${name?.trim() || ''}, photo = ${photo || null}, number = ${number || null},
          main_position = ${mainPosition || null}, preferred_positions = ${prefJson}, present = ${isPresent}
      WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}
      RETURNING *
    `;
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await sql`DELETE FROM players WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}`;
    if (result.rowCount === 0) return res.status(404).json({ error: 'Speler niet gevonden' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
