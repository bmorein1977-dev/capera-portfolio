// client.useAssessorKpis.patch.ts
import { useEffect, useState } from 'react'

type Kpis = {
  assessor_id: string
  not_started: number
  expired: number
  expiring_90: number
  ok: number
}

export default function useAssessorKpis(assessorId: string) {
  const [data, setData] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const resp = await fetch(`/assessors/${assessorId}/kpis`)
        const json = await resp.json()
        if (!active) return
        setData(json)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [assessorId])

  return { data, loading }
}
