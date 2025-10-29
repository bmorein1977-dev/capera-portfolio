import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.post('/parse-query', async (req, res) => {
  const { text = '' } = req.body;
  const out = { query: '', date_window: {}, location: {}, constraints: {} };
  out.query = text;

  const mNov = text.toLowerCase().match(/nov(ember)?/);
  if (mNov) out.date_window = { month: 11 };

  const mCost = text.match(/(?:under|<=?)\s*(€|eur|£|gbp|\$|usd)?\s*(\d{2,5})/i);
  if (mCost) out.constraints.max_cost = Number(mCost[2]);

  const mCity = text.match(/near\s+([A-Za-z\s]+)/i);
  if (mCity) out.location.city = mCity[1].trim();

  res.json(out);
});

router.post('/recommend', async (req, res) => {
  const { role_id, location = {}, date_window = {}, constraints = {} } = req.body;
  const from = date_window.from || new Date().toISOString();
  const to = date_window.to || new Date(Date.now() + 1000*60*60*24*60).toISOString();

  const { rows: sessions } = await pool.query(`
    SELECT s.*, c.title, c.cost, c.language, v.name as venue_name, v.city, v.country, v.lat, v.lon
    FROM training_sessions s
    JOIN training_courses c ON c.id = s.course_id
    LEFT JOIN venues v ON v.id = s.venue_id
    WHERE s.start_at BETWEEN $1 AND $2 AND s.seats_remaining > 0
    ORDER BY s.start_at ASC
    LIMIT 500
  `, [from, to]);

  const results = [];
  for (const s of sessions) {
    const { rows: mxRows } = await pool.query(
      `SELECT status, cost_cap FROM training_matrix WHERE role_id=$1 AND course_id=$2`,
      [role_id, s.course_id]
    );
    const mx = mxRows[0] || { status: 'NA', cost_cap: null };
    const mandatory = mx.status === 'MANDATORY';
    const costOk = constraints.max_cost ? (Number(s.cost) || 0) <= constraints.max_cost : true;

    let score = 0;
    score += mandatory ? 100 : 0;
    score += (s.seats_remaining / Math.max(1, s.capacity)) * 10;
    score += costOk ? 5 : -20;

    results.push({
      session_id: s.id,
      course_id: s.course_id,
      title: s.title,
      start_at: s.start_at,
      city: s.city,
      country: s.country,
      cost: s.cost,
      seats_remaining: s.seats_remaining,
      capacity: s.capacity,
      rationale: [
        mandatory ? 'Mandatory per matrix' : 'Optional per matrix',
        costOk ? 'Within cost constraint' : 'Over cost constraint',
        s.seats_remaining > 0 ? 'Seats available' : 'No seats'
      ].join(' · '),
      score
    });
  }

  results.sort((a,b) => b.score - a.score);
  res.json(results.slice(0, 8));
});

export default router;
