import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const { query = '', tag = '', modality = '', provider_id } = req.query;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (query) {
    conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
    values.push(`%${query}%`); idx++;
  }
  if (tag) {
    conditions.push(`$${idx} = ANY(tags)`); values.push(tag); idx++;
  }
  if (modality) {
    conditions.push(`modality = $${idx}`); values.push(modality); idx++;
  }
  if (provider_id) {
    conditions.push(`provider_id = $${idx}`); values.push(provider_id); idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM training_courses ${where} ORDER BY title LIMIT 200`, values);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(`SELECT * FROM training_courses WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

export default router;
