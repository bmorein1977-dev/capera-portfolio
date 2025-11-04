// server.routes.assessorCandidates.patch.ts
import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from './storage'; // must expose 'raw'

export async function getAssessorCandidates(req: Request, res: Response) {
  const assessorId = z.string().uuid().parse(req.params.id);
  // If you applied 106_assessor_visibility_view.sql from the adapted fix pack:
  const rows = await db.raw(
    `select * from assessor_candidate_elements where assessor_id = $1 order by candidate_id, element_title`,
    [assessorId]
  );
  res.json(rows);
}
