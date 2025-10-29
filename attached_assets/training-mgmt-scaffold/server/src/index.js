import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import coursesRouter from './routes/courses.js';
import sessionsRouter from './routes/sessions.js';
import policyRouter from './routes/policy.js';
import bookingsRouter from './routes/bookings.js';
import approvalsRouter from './routes/approvals.js';
import aiRouter from './routes/ai.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/courses', coursesRouter);
app.use('/sessions', sessionsRouter);
app.use('/policy', policyRouter);
app.use('/bookings', bookingsRouter);
app.use('/approvals', approvalsRouter);
app.use('/ai', aiRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
