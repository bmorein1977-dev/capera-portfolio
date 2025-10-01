import React, { useEffect, useState } from "react"
import { api } from "../lib/api"

type Props = {
  elementId: number
  mode: "knowledge" | "performance"
  open: boolean
  onClose: () => void
  onSaved?: (res:any)=>void
  defaults?: Partial<FormState>
  existingSubcats?: string[]
}

type FormState = {
  category?: string
  element?: string
  prof_level?: number
  criteria_type: "knowledge"|"performance"
  subcategory?: string
  criteria_text: string
  guidance?: string
  criticality?: string
  reassess_years?: number
  required_flag?: "M"|"O"
}

export default function CriteriaModal({elementId, mode, open, onClose, onSaved, defaults, existingSubcats}: Props){
  const [state, setState] = useState<FormState>({
    criteria_type: mode,
    subcategory: "",
    criteria_text: "",
    guidance: "",
    required_flag: "M",
    prof_level: undefined,
    criticality: "",
    reassess_years: undefined,
  })

  useEffect(()=>{ setState(s => ({...s, criteria_type: mode})) }, [mode])
  useEffect(()=>{ if (open) setState(prev => ({...prev, ...(defaults||{}), criteria_type: mode})) }, [open])

  if(!open) return null

  const save = async () => {
    const payload = {
      category: state.category || undefined,
      element: state.element || undefined,
      prof_level: state.prof_level || undefined,
      criteria_type: state.criteria_type,
      subcategory: state.subcategory || "General",
      criteria_text: state.criteria_text,
      guidance: state.guidance || undefined,
      criticality: state.criticality || undefined,
      reassess_years: state.reassess_years || undefined,
      required_flag: state.required_flag || "M",
    }
    const res = await api.post(`/framework/elements/${elementId}/criteria`, payload)
    onSaved?.(res.data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Edit Criteria</h2>
          <p className="text-sm text-neutral-600">Create a new {state.criteria_type === "knowledge" ? "knowledge" : "performance"} criteria with automatic numbering.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Type (Column D)</label>
              <select className="mt-1 w-full border rounded-lg p-2"
                value={state.criteria_type}
                onChange={e=>setState({...state, criteria_type: (e.target.value as any)})}>
                <option value="knowledge">Underpinning Knowledge</option>
                <option value="performance">Performance Criteria</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Subcategory (Column E)</label>
              <input list="subcats" className="mt-1 w-full border rounded-lg p-2"
                placeholder="e.g. General"
                value={state.subcategory || ""}
                onChange={e=>setState({...state, subcategory: e.target.value})} />
              <datalist id="subcats">
                {(existingSubcats||[]).map((s)=>(<option key={s} value={s}>{s}</option>))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Assessment Criteria (Column F) *</label>
            <textarea className="mt-1 w-full border rounded-lg p-2 min-h-[100px]"
              value={state.criteria_text}
              onChange={e=>setState({...state, criteria_text: e.target.value})} />
          </div>

          <div>
            <label className="block text-sm font-medium">Assessor Guidance (Column G, optional – assessor only)</label>
            <textarea className="mt-1 w-full border rounded-lg p-2 min-h-[90px]"
              value={state.guidance || ""}
              onChange={e=>setState({...state, guidance: e.target.value})} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Criticality (Column H)</label>
              <select className="mt-1 w-full border rounded-lg p-2"
                value={state.criticality || ""}
                onChange={e=>setState({...state, criticality: e.target.value || undefined})}>
                <option value="">Not set</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Reassessment Validity (years) (Column I)</label>
              <input type="number" min={0} className="mt-1 w-full border rounded-lg p-2"
                value={state.reassess_years ?? ""}
                onChange={e=>setState({...state, reassess_years: e.target.value? Number(e.target.value): undefined})} />
            </div>
            <div>
              <label className="block text-sm font-medium">Required (Column J)</label>
              <select className="mt-1 w-full border rounded-lg p-2"
                value={state.required_flag || "M"}
                onChange={e=>setState({...state, required_flag: (e.target.value as "M"|"O")})}>
                <option value="M">Mandatory</option>
                <option value="O">Optional</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Category (Column A)</label>
              <input className="mt-1 w-full border rounded-lg p-2"
                placeholder="e.g. HSE"
                value={state.category || ""}
                onChange={e=>setState({...state, category: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium">Element (Column B)</label>
              <input className="mt-1 w-full border rounded-lg p-2"
                placeholder="e.g. SIMOPS"
                value={state.element || ""}
                onChange={e=>setState({...state, element: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium">Proficiency Scheme (Column C)</label>
              <select className="mt-1 w-full border rounded-lg p-2"
                value={state.prof_level ?? ""}
                onChange={e=>setState({...state, prof_level: e.target.value? Number(e.target.value): undefined})}>
                <option value="">Default (1)</option>
                <option value="1">Single-level (1)</option>
                <option value="3">Three levels (3)</option>
                <option value="4">Four levels (4)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t flex items-center justify-end gap-3 bg-neutral-50">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border">Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Save Criteria</button>
        </div>
      </div>
    </div>
  )
}
