'use strict';
const express = require('express');
const { randomUUID } = require('crypto');
const { sql } = require('../db/database');
const router = express.Router();

function parse(row) {
  return { id: row.id, name: row.name, isDefault: row.is_default };
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM teams WHERE coach_id = ${req.coach.id} ORDER BY created_at ASC`;
    res.json(rows.map(parse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
    const id = randomUUID();
    const { rows: [row] } = await sql`
      INSERT INTO teams (id, coach_id, name, created_at, is_default)
      VALUES (${id}, ${req.coach.id}, ${name}, ${Date.now()}, false)
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
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
    const { rows: [row] } = await sql`
      UPDATE teams SET name = ${name}
      WHERE id = ${req.params.id} AND coach_id = ${req.coach.id}
      RETURNING *
    `;
    if (!row) return res.status(404).json({ error: 'Team niet gevonden' });
    res.json(parse(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server fout' });
  }
});

module.exports = router;
