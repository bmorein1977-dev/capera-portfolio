// client.MyAssessments.patch.tsx
// Usage: integrate into your My Assessments page component logic.
// Assumes you can obtain the current user's candidateId (e.g., from auth/session).

import React, { useEffect, useState } from 'react';

type Row = {
  candidate_id: string;
  element_id: string;
  element_title: string;
  element_code: string;
  element_priority: string | null;
  validity_months: number | null;
  is_current: boolean;
  assigned_at: string;
  last_status: 'competent' | 'not_yet_competent' | 'competent_with_minor_needs' | null;
  last_assessed_at: string | null;
  last_valid_until: string | null;
  color_status: 'red' | 'amber' | 'green' | 'gray';
};

export default function useMyAssessments(candidateId: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await fetch(`/api/my-assessments?candidateId=${candidateId}`);
        const data = await resp.json();
        if (!active) return;
        setRows(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [candidateId]);

  return { rows, loading };
}

// Example renderer for color badges
export function StatusBadge({ color }: { color: Row['color_status'] }) {
  const map: Record<Row['color_status'], string> = {
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    green: 'bg-green-100 text-green-800',
    gray: 'bg-gray-100 text-gray-800'
  };
  return <span className={`px-2 py-1 rounded ${map[color]}`}>{color.toUpperCase()}</span>;
}
