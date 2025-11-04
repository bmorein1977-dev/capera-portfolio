// client.EvidenceUploader.patch.tsx
// Drag + Drop evidence uploader supporting Supabase signed-upload flow.
import React, { useState, DragEvent } from 'react'

type Props = {
  assessmentId: string
}

export default function EvidenceUploader({ assessmentId }: Props) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return
    setBusy(true); setMsg(null)
    try {
      for (const file of Array.from(files)) {
        // 1) Ask server for a signed upload url
        const q = new URLSearchParams({ filename: file.name })
        const resp = await fetch(`/api/assessments/${assessmentId}/evidence/signed-url?` + q.toString())
        const { path, token } = await resp.json()

        // 2) Use supabase-js on client to upload to signed URL
        // @ts-ignore global supabase client should already exist in your app
        const { error } = await supabase.storage.from('evidence')
          .uploadToSignedUrl(path, token, file)

        if (error) throw error

        // 3) Tell server to record metadata (optional if you proxy-upload instead)
        await fetch(`/api/assessments/${assessmentId}/evidence/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileKey: path, filename: file.name, size: file.size, mimeType: file.type })
        })
      }
      setMsg('Uploaded successfully')
    } catch (e: any) {
      setMsg(e.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded p-6 text-center ${busy ? 'opacity-50' : ''}`}
      >
        <p>Drag & drop evidence here, or</p>
        <input
          type="file"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={busy}
        />
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  )
}
