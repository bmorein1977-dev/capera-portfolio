import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.post('/check', async (req, res) => {
  const { user_id, role_id, course_id, session_id } = req.body;

  const { rows: mxRows } = await pool.query(
    `SELECT * FROM training_matrix WHERE role_id=$1 AND course_id=$2`,
    [role_id, course_id]
  );
  const mx = mxRows[0] || null;

  const { rows: cRows } = await pool.query(`SELECT * FROM training_courses WHERE id=$1`, [course_id]);
  const course = cRows[0];

  const external = course?.provider_id ? true : false;
  const overCap = (course?.cost || 0) > (mx?.cost_cap || Number.MAX_SAFE_INTEGER);

  let status = mx?.status || 'NA';
  let chain = [];
  let requiresApproval = false;

  if (status === 'MANDATORY' && !external && !overCap) {
    requiresApproval = false;
  } else {
    if (status !== 'MANDATORY') chain.push('Manager');
    if (external || overCap) chain.push('L&D');
    if (overCap) chain.push('Finance');
    requiresApproval = chain.length > 0;
  }

  res.json({
    allowed: true,
    requiresApproval,
    chain,
    reason: requiresApproval ? 'Approval required by policy' : 'In-policy direct booking'
  });
});

export default router;
