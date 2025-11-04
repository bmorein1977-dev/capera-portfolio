// server.routes.myAssessments.patch.ts
import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from './storage'; // your adapter must expose a 'raw' method

export async function getMyAssessments(req: Request, res: Response) {
  const candidateId = z.string().uuid().parse(req.query.candidateId);
  const rows = await db.raw(
    `select * from candidate_elements_with_status where candidate_id = $1 order by element_title asc`,
    [candidateId]
  );
  res.json(rows);
}
