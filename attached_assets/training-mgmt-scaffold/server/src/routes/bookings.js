import { Router } from 'express';
import { pool } from '../db.js';
import fetch from 'node-fetch';

const router = Router();

router.post('/', async (req, res) => {
  const { user_id, session_id, role_id } = req.body;

  const { rows: sRows } = await pool.query('SELECT course_id FROM training_sessions WHERE id=$1', [session_id]);
  if (!sRows[0]) return res.status(400).json({ error: 'Invalid session' });
  const course_id = sRows[0].course_id;

  const pcRes = await (await fetch('http://localhost:' + (process.env.PORT || 4000) + '/policy/check', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ user_id, role_id, course_id, session_id })
  })).json();

  const status = pcRes.requiresApproval ? 'PENDING_APPROVAL' : 'BOOKED';
  const { rows } = await pool.query(
    `INSERT INTO bookings (id, user_id, session_id, status, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, now())
     RETURNING *`,
    [user_id, session_id, status]
  );

  if (pcRes.requiresApproval && pcRes.chain?.length) {
    let step = 1;
    for (const role of pcRes.chain) {
      await pool.query(
        `INSERT INTO approvals (id, booking_id, step, approver_role, state)
         VALUES (gen_random_uuid(), $1, $2, $3, 'PENDING')`,
        [rows[0].id, step++, role]
      );
    }
  }

  res.json({ booking: rows[0], policy: pcRes });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(`SELECT * FROM bookings WHERE id=$1`, [id]);
  if (!rows[0]) return res.status(404).json({ error:'Not found' });
  res.json(rows[0]);
});

export default router;
