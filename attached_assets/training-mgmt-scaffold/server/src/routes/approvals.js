import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const { assignee_role = 'Manager', state = 'PENDING' } = req.query;
  const { rows } = await pool.query(
    `SELECT * FROM approvals WHERE approver_role=$1 AND state=$2 ORDER BY step ASC`,
    [assignee_role, state]
  );
  res.json(rows);
});

router.post('/:id/decision', async (req, res) => {
  const { id } = req.params;
  const { state = 'APPROVED', comment = '' } = req.body;

  const { rows: aRows } = await pool.query(`SELECT * FROM approvals WHERE id=$1`, [id]);
  const approval = aRows[0];
  if (!approval) return res.status(404).json({ error: 'Approval not found' });

  await pool.query(`UPDATE approvals SET state=$1, decided_at=now(), comment=$2 WHERE id=$3`,
    [state, comment, id]);

  if (state === 'APPROVED') {
    const { rows: pend } = await pool.query(
      `SELECT COUNT(*)::int AS pending FROM approvals WHERE booking_id=$1 AND state='PENDING'`,
      [approval.booking_id]
    );
    if (pend[0].pending === 0) {
      await pool.query(`UPDATE bookings SET status='BOOKED' WHERE id=$1 AND status='PENDING_APPROVAL'`, [approval.booking_id]);
    }
  } else if (state === 'REJECTED') {
    await pool.query(`UPDATE bookings SET status='CANCELLED' WHERE id=$1`, [approval.booking_id]);
  }

  res.json({ ok: true });
});

export default router;
