import React, { useEffect, useState } from "react"
import { api } from "../lib/api"

export default function AssessmentTwoColumn({elementId}:{elementId:number}){
  const [data, setData] = useState<any>(null)
  useEffect(()=>{
    api.get(`/framework/elements/${elementId}/print?format=json&role=assessor`).then(r=> setData(r.data))
  }, [elementId])
  if(!data) return <div className="text-sm text-neutral-500">Loading assessment…</div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <section>
        <h3 className="font-semibold mb-2">Knowledge Criteria</h3>
        {data.sections.knowledge.map((sub:any) => (
          <div key={sub.title} className="mb-4">
            <div className="font-semibold">{sub.title}</div>
            {sub.items.map((it:any) => (
              <div key={it.number} className="mt-1">
                <span className="font-semibold">{it.number}</span> — {it.text}
                {it.assessor_guidance && <div className="ml-5 text-sm"><b>{it.guidance_number}</b> — {it.assessor_guidance}</div>}
              </div>
            ))}
          </div>
        ))}
      </section>

      <section>
        <h3 className="font-semibold mb-2">Performance Criteria</h3>
        {data.sections.performance.map((sub:any) => (
          <div key={sub.title} className="mb-4">
            <div className="font-semibold">{sub.title}</div>
            {sub.items.map((it:any) => (
              <div key={it.number} className="mt-1">
                <span className="font-semibold">{it.number}</span> — {it.text}
                {it.assessor_guidance && <div className="ml-5 text-sm"><b>{it.guidance_number}</b> — {it.assessor_guidance}</div>}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
