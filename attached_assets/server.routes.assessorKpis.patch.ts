// server.routes.assessorKpis.patch.ts
import type { Request, Response } from 'express'
import { z } from 'zod'
import { db } from './storage'

export async function getAssessorKpis(req: Request, res: Response) {
  const assessorId = z.string().uuid().parse(req.params.id)

  // Inline SQL mirrors 501_assessor_elements_kpis.sql but filtered to one assessor for speed.
  const rows = await db.raw(`
    WITH latest_assessment AS (
      SELECT a.*
      FROM (
        SELECT a.*,
               ROW_NUMBER() OVER (
                 PARTITION BY a.candidate_id, a.element_id
                 ORDER BY COALESCE(a.assessed_at, a.created_at, now()) DESC
               ) AS rn
        FROM assessments a
      ) a
      WHERE a.rn = 1
    ),
    assessor_elements AS (
      SELECT
        ca.assessor_id,
        cae.candidate_id,
        cae.element_id,
        e.is_current,
        e.title        AS element_title,
        e.code         AS element_code,
        e.validity_months,
        la.valid_until,
        la.status AS last_status
      FROM candidate_allocations ca
      JOIN candidate_assigned_elements cae ON cae.candidate_id = ca.candidate_id
      JOIN competency_elements e ON e.id = cae.element_id
      LEFT JOIN latest_assessment la
        ON la.candidate_id = cae.candidate_id
       AND la.element_id   = cae.element_id
      WHERE e.is_current = true
        AND ca.assessor_id = $1
    )
    SELECT
      $1::uuid AS assessor_id,
      COUNT(*) FILTER (WHERE valid_until IS NULL)                                              AS not_started,
      COUNT(*) FILTER (WHERE valid_until IS NOT NULL AND valid_until < now())                  AS expired,
      COUNT(*) FILTER (WHERE valid_until IS NOT NULL AND valid_until >= now() AND valid_until <= now() + interval '90 days') AS expiring_90,
      COUNT(*) FILTER (WHERE valid_until IS NOT NULL AND valid_until > now() + interval '90 days') AS ok;
  `, [assessorId])

  res.json(rows[0] ?? { assessor_id: assessorId, not_started: 0, expired: 0, expiring_90: 0, ok: 0 })
}
