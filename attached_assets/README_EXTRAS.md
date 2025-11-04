# Capera Extras — Hard Delete, RLS, Evidence Upload

## Files
- **401_hard_delete_orphan_elements.sql** — Hard delete elements that are not current and have no references.
- **402_rls_policies_example.sql** — Example Supabase RLS policies (assessor/candidate/admin scoping).
- **server.utils.storage.supabase.ts** — Supabase admin client.
- **server.routes.evidenceUpload.patch.ts** — Routes to get signed upload URL and (optionally) proxy upload.
- **server.routes.evidenceRecord.patch.ts** — Route to record uploaded evidence metadata.
- **client.EvidenceUploader.patch.tsx** — Drag & drop uploader using Supabase signed uploads.

## Wire the routes
In `server/routes.ts` (or your router file):
```ts
import { getSignedUploadUrl, proxyUploadEvidence } from './routes.evidenceUpload.patch'
import { postEvidenceRecord } from './routes.evidenceRecord.patch'

app.get('/api/assessments/:assessmentId/evidence/signed-url', getSignedUploadUrl)
// If you prefer proxy uploads, add multer and:
/*
import multer from 'multer'
const upload = multer()
app.post('/api/assessments/:assessmentId/evidence/proxy', upload.single('file'), proxyUploadEvidence)
*/
app.post('/api/assessments/:assessmentId/evidence/record', postEvidenceRecord)
```

Env:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
EVIDENCE_BUCKET=evidence
```

## Apply SQL
1. `401_hard_delete_orphan_elements.sql` — optional, for permanent cleanup.
2. `402_rls_policies_example.sql` — adapt if your JWT claim name differs from `app_role`.

## Frontend
Use `client.EvidenceUploader.patch.tsx` in the assessment view and pass `assessmentId`.

> If you’re not using Supabase on the client, switch to the **proxy** route. The example is included.
