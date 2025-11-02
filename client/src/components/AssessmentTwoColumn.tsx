import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface AssessmentTwoColumnProps {
  elementId: string;
  levelId?: string;
  role?: 'assessor' | 'candidate';
}

interface CriteriaItem {
  number: string;
  text: string;
  required: boolean;
  guidance_number?: string;
  assessor_guidance?: string;
}

interface Section {
  title: string;
  items: CriteriaItem[];
}

interface AssessmentData {
  category: string | null;
  element: string;
  criticality: string;
  reassess_years: number;
  proficiency_scheme: number;
  sections: {
    knowledge: Section[];
    performance: Section[];
  };
}

export default function AssessmentTwoColumn({ elementId, levelId, role = 'assessor' }: AssessmentTwoColumnProps) {
  const { data, isLoading } = useQuery<AssessmentData>({
    queryKey: ['/api/competence-elements', elementId, 'print', { role, format: 'json', levelId }],
    queryFn: async () => {
      const params = new URLSearchParams({ role, format: 'json' });
      if (levelId) params.append('levelId', levelId);
      const response = await fetch(`/api/competence-elements/${elementId}/print?${params}`);
      if (!response.ok) throw new Error('Failed to fetch assessment data');
      return response.json();
    },
    enabled: !!elementId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">No assessment data available</div>;
  }

  return (
    <div className="space-y-4" data-testid="assessment-two-column">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold" data-testid="text-element-name">{data.element}</h2>
        <div className="flex gap-3 text-sm text-muted-foreground">
          {data.criticality && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
              Criticality: {data.criticality}
            </span>
          )}
          {data.reassess_years > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
              Reassessment: {data.reassess_years} years
            </span>
          )}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
            Scheme: {data.proficiency_scheme}-level
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Knowledge Criteria Column */}
        <section className="space-y-4" data-testid="section-knowledge">
          <h3 className="text-lg font-semibold">Knowledge Criteria</h3>
          {data.sections.knowledge.length === 0 ? (
            <p className="text-sm text-muted-foreground">No knowledge criteria</p>
          ) : (
            data.sections.knowledge.map((sub, idx) => (
              <div key={`knowledge-${idx}`} className="space-y-2">
                <div className="font-semibold text-sm">{sub.title}</div>
                {sub.items.map((item, itemIdx) => (
                  <div key={`k-${idx}-${itemIdx}`} className="space-y-1" data-testid={`criteria-${item.number}`}>
                    <div className="text-sm">
                      <span className="font-semibold">{item.number}</span> — {item.text}
                      {item.required && <span className="ml-2 text-xs text-muted-foreground">(M)</span>}
                      {!item.required && <span className="ml-2 text-xs text-muted-foreground">(O)</span>}
                    </div>
                    {item.assessor_guidance && (
                      <div className="ml-5 text-sm text-muted-foreground" data-testid={`guidance-${item.guidance_number}`}>
                        <span className="font-semibold">{item.guidance_number}</span> — {item.assessor_guidance}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </section>

        {/* Performance Criteria Column */}
        <section className="space-y-4" data-testid="section-performance">
          <h3 className="text-lg font-semibold">Performance Criteria</h3>
          {data.sections.performance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No performance criteria</p>
          ) : (
            data.sections.performance.map((sub, idx) => (
              <div key={`performance-${idx}`} className="space-y-2">
                <div className="font-semibold text-sm">{sub.title}</div>
                {sub.items.map((item, itemIdx) => (
                  <div key={`p-${idx}-${itemIdx}`} className="space-y-1" data-testid={`criteria-${item.number}`}>
                    <div className="text-sm">
                      <span className="font-semibold">{item.number}</span> — {item.text}
                      {item.required && <span className="ml-2 text-xs text-muted-foreground">(M)</span>}
                      {!item.required && <span className="ml-2 text-xs text-muted-foreground">(O)</span>}
                    </div>
                    {item.assessor_guidance && (
                      <div className="ml-5 text-sm text-muted-foreground" data-testid={`guidance-${item.guidance_number}`}>
                        <span className="font-semibold">{item.guidance_number}</span> — {item.assessor_guidance}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
