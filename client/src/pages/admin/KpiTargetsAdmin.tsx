import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Target } from "lucide-react";
import type { KpiTarget } from "@shared/schema";

// Keys must match what ExecutiveDashboard.tsx reads when computing tile colors.
const TARGET_FIELDS: Array<{ key: string; label: string; description: string }> = [
  {
    key: "competence_overall",
    label: "Overall Competence Target",
    description: "Target % for the Competence Compliance figure on the Executive Dashboard.",
  },
  {
    key: "competence_safety_critical",
    label: "Safety-Critical Competence Target",
    description: "Target % for the Safety-Critical Competence figure on the Executive Dashboard.",
  },
];

export default function KpiTargetsAdmin() {
  const { toast } = useToast();
  const { data: targets = [], isLoading } = useQuery<KpiTarget[]>({ queryKey: ['/api/kpi-targets'] });
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (targets.length === 0) return;
    setValues(prev => {
      const next = { ...prev };
      for (const t of targets) {
        if (next[t.key] === undefined) next[t.key] = String(t.targetPercentage);
      }
      return next;
    });
  }, [targets]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, label, targetPercentage }: { key: string; label: string; targetPercentage: number }) =>
      apiRequest('PATCH', `/api/kpi-targets/${key}`, { label, targetPercentage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpi-targets'] });
      toast({ title: 'Target saved' });
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const handleSave = (field: { key: string; label: string }) => {
    const raw = values[field.key];
    const parsed = Number(raw);
    if (raw === undefined || raw === '' || Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      toast({ title: 'Enter a number between 0 and 100', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ key: field.key, label: field.label, targetPercentage: parsed });
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl" data-testid="page-kpi-targets-admin">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6" />
          KPI Targets
        </h1>
        <p className="text-muted-foreground">
          Set competence compliance targets. Once set, the matching figure on the Executive Dashboard turns green when it meets the target, amber when it's within 15 points below, and red when it's 15 or more points below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competence Targets</CardTitle>
          <CardDescription>Percentages, 0-100.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {TARGET_FIELDS.map(field => (
            <div key={field.key} className="space-y-2" data-testid={`kpi-target-${field.key}`}>
              <Label htmlFor={`target-${field.key}`}>{field.label}</Label>
              <p className="text-xs text-muted-foreground">{field.description}</p>
              <div className="flex items-center gap-2 max-w-xs">
                <Input
                  id={`target-${field.key}`}
                  type="number"
                  min={0}
                  max={100}
                  disabled={isLoading}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder="Not set"
                />
                <span className="text-muted-foreground">%</span>
                <Button size="sm" onClick={() => handleSave(field)} disabled={saveMutation.isPending}>
                  Save
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
