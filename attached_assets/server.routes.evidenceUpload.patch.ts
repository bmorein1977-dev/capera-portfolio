// server.routes.evidenceUpload.patch.ts
// Two upload modes supported:
// A) Signed upload URL (client uses supabase-js uploadToSignedUrl)
// B) Server-proxy upload (client posts file to this route, server streams to Storage)

import type { Request, Response } from 'express'
import { z } from 'zod'
import { supabaseAdmin } from './utils/storage.supabase' // adjust path if needed
import { db } from './storage' // your DB adapter

const BUCKET = process.env.EVIDENCE_BUCKET || 'evidence'

// A) Return signed upload params
export async function getSignedUploadUrl(req: Request, res: Response) {
  const { assessmentId } = req.params
  const { filename } = z.object({ filename: z.string().min(1) }).parse(req.query)

  // Create a storage path: assessments/<assessmentId>/<filename>
  const path = `assessments/${assessmentId}/${Date.now()}_${filename}`

  const { data, error } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    return res.status(500).json({ error: error?.message || 'Failed to create signed upload URL' })
  }

  // Return token and path so the client can call uploadToSignedUrl
  res.json({
    path,
    token: data.token
  })
}

// B) Proxy upload: client posts file to server, server uploads to storage
export async function proxyUploadEvidence(req: Request, res: Response) {
  const params = z.object({
    assessmentId: z.string().uuid()
  }).parse({ assessmentId: req.params.assessmentId })

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const filename = (req.file as any).originalname || 'evidence.bin'
  const contentType = (req.file as any).mimetype || 'application/octet-stream'
  const path = `assessments/${params.assessmentId}/${Date.now()}_${filename}`

  const { data, error } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .upload(path, (req.file as any).buffer, { contentType, upsert: false })

  if (error || !data) {
    return res.status(500).json({ error: error?.message || 'Upload failed' })
  }

  // Insert DB metadata
  const row = await db.assessmentEvidence.create({
    assessment_id: params.assessmentId,
    file_key: path,
    filename,
    mime_type: contentType,
    size_bytes: (req.file as any).size,
    uploaded_by: req.user?.id ?? null
  })

  res.json({ ok: true, fileKey: path, evidenceId: row.id })
}
