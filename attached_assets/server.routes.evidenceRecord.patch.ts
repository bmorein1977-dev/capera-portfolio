// server.routes.evidenceRecord.patch.ts
import type { Request, Response } from 'express'
import { z } from 'zod'
import { db } from './storage'

export async function postEvidenceRecord(req: Request, res: Response) {
  const { assessmentId } = req.params
  const body = z.object({
    fileKey: z.string(),
    filename: z.string(),
    mimeType: z.string().optional(),
    size: z.number().optional()
  }).parse(req.body)

  const row = await db.assessmentEvidence.create({
    assessment_id: assessmentId,
    file_key: body.fileKey,
    filename: body.filename,
    mime_type: body.mimeType ?? null,
    size_bytes: body.size ?? null,
    uploaded_by: (req as any).user?.id ?? null
  })

  res.json({ ok: true, evidenceId: row.id })
}
