import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Search, Link2, Link2Off } from "lucide-react";
import type { JobRole, Training, TrainingCategory, RoleTraining, TrainingRequirementGroup } from "@shared/schema";

const REQUIREMENT_LEVEL_LABELS: Record<string, string> = {
  M: "Mandatory",
  R: "Role Specific",
  D: "Discretionary",
};

interface ManageTrainingsDialogProps {
  role: JobRole;
  isOpen: boolean;
  onClose: () => void;
}

export function ManageTrainingsDialog({ role, isOpen, onClose }: ManageTrainingsDialogProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedForGrouping, setSelectedForGrouping] = useState<Set<string>>(new Set());
  const [isNamingGroup, setIsNamingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");

  const { data: categories = [] } = useQuery<TrainingCategory[]>({
    queryKey: ["/api/training-categories"],
  });

  const { data: allTrainings = [] } = useQuery<Training[]>({
    queryKey: ["/api/trainings"],
  });

  const { data: assignedTrainings = [], isLoading: loadingAssigned } = useQuery<Array<RoleTraining & { training: Training }>>({
    queryKey: ["/api/role-trainings", { roleId: role.id }],
    enabled: isOpen,
  });

  const { data: groups = [] } = useQuery<TrainingRequirementGroup[]>({
    queryKey: ["/api/training-requirement-groups", { roleId: role.id }],
    enabled: isOpen,
  });

  const assignedMap = new Map(assignedTrainings.map(rt => [rt.trainingId, rt]));
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const groupById = new Map(groups.map(g => [g.id, g]));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/role-trainings", { roleId: role.id }] });
  };
  const invalidateGroups = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/training-requirement-groups", { roleId: role.id }] });
  };

  const assignMutation = useMutation({
    mutationFn: async (trainingId: string) => {
      const response = await apiRequest("POST", "/api/role-trainings", { roleId: role.id, trainingId });
      return await response.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Training Assigned", description: "The training has been assigned to this role." });
    },
    onError: (error: any) => {
      toast({ title: "Assignment Failed", description: error.message || "Failed to assign training", variant: "destructive" });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (roleTrainingId: string) => {
      const response = await apiRequest("DELETE", `/api/role-trainings/${roleTrainingId}`);
      if (!response.ok) throw new Error("Failed to unassign training");
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Training Unassigned", description: "The training has been removed from this role." });
    },
    onError: (error: any) => {
      toast({ title: "Unassignment Failed", description: error.message || "Failed to unassign training", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ roleTrainingId, requirementLevel }: { roleTrainingId: string; requirementLevel: string }) => {
      const response = await apiRequest("PATCH", `/api/role-trainings/${roleTrainingId}`, { requirementLevel });
      return await response.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Updated", description: "Requirement level updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update requirement level", variant: "destructive" });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (label: string) => {
      const groupResponse = await apiRequest("POST", "/api/training-requirement-groups", { roleId: role.id, label: label || null });
      const group = await groupResponse.json();
      await Promise.all(
        Array.from(selectedForGrouping).map(roleTrainingId =>
          apiRequest("PATCH", `/api/role-trainings/${roleTrainingId}`, { groupId: group.id })
        )
      );
      return group;
    },
    onSuccess: () => {
      invalidate();
      invalidateGroups();
      setSelectedForGrouping(new Set());
      setIsNamingGroup(false);
      setNewGroupLabel("");
      toast({ title: "Alternatives Grouped", description: "Completing any one of these now satisfies the requirement." });
    },
    onError: (error: any) => {
      toast({ title: "Grouping Failed", description: error.message || "Failed to group trainings", variant: "destructive" });
    },
  });

  const ungroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const response = await apiRequest("DELETE", `/api/training-requirement-groups/${groupId}`);
      if (!response.ok) throw new Error("Failed to ungroup");
    },
    onSuccess: () => {
      invalidate();
      invalidateGroups();
      toast({ title: "Ungrouped", description: "Each training is now its own separate requirement again." });
    },
    onError: (error: any) => {
      toast({ title: "Ungroup Failed", description: error.message || "Failed to ungroup", variant: "destructive" });
    },
  });

  const toggleForGrouping = (roleTrainingId: string) => {
    setSelectedForGrouping(prev => {
      const next = new Set(prev);
      if (next.has(roleTrainingId)) next.delete(roleTrainingId); else next.add(roleTrainingId);
      return next;
    });
  };

  const availableTrainings = allTrainings
    .filter(t => !assignedMap.has(t.id))
    .filter(t => !selectedCategory || t.categoryId === selectedCategory)
    .filter(t => !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Assigned trainings that share a groupId are alternatives - clustered together. Everything
  // else (groupId null) is its own standalone requirement, rendered as before.
  const groupedAssigned = new Map<string, Array<RoleTraining & { training: Training }>>();
  const standaloneAssigned: Array<RoleTraining & { training: Training }> = [];
  for (const rt of assignedTrainings) {
    if (rt.groupId) {
      if (!groupedAssigned.has(rt.groupId)) groupedAssigned.set(rt.groupId, []);
      groupedAssigned.get(rt.groupId)!.push(rt);
    } else {
      standaloneAssigned.push(rt);
    }
  }

  const renderAssignedRow = (rt: RoleTraining & { training: Training }, inGroup: boolean) => (
    <div
      key={rt.id}
      className={`border rounded p-2 hover-elevate group ${inGroup ? "bg-background" : ""}`}
      data-testid={`assigned-training-${rt.trainingId}`}
    >
      <div className="flex items-start gap-2">
        {!inGroup && (
          <Checkbox
            checked={selectedForGrouping.has(rt.id)}
            onCheckedChange={() => toggleForGrouping(rt.id)}
            className="mt-1"
            data-testid={`checkbox-group-select-${rt.trainingId}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{rt.training.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {categoryById.get(rt.training.categoryId)?.name}
          </div>
          {rt.training.isSafetyCritical && (
            <Badge variant="outline" className="mt-1 text-xs text-red-600 dark:text-red-400">
              Safety Critical
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => unassignMutation.mutate(rt.id)}
          disabled={unassignMutation.isPending}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`button-unassign-training-${rt.trainingId}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 pt-2 border-t space-y-1">
        <label className="text-xs text-muted-foreground">Requirement</label>
        <Select
          value={rt.requirementLevel ?? "M"}
          onValueChange={(value) => updateMutation.mutate({ roleTrainingId: rt.id, requirementLevel: value })}
          disabled={updateMutation.isPending}
        >
          <SelectTrigger className="h-8 text-xs" data-testid={`select-training-requirement-${rt.trainingId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(REQUIREMENT_LEVEL_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label} ({value})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="dialog-manage-trainings">
        <DialogHeader>
          <DialogTitle>Manage Trainings for {role.name}</DialogTitle>
          <DialogDescription>
            Assign training courses to this job role and set whether each is Mandatory, Role
            Specific, or Discretionary. Select two or more standalone trainings below and click
            "Group as Alternatives" if completing any one of them should satisfy the requirement
            (e.g. an initial course and its refresher).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-md">
            <div className="bg-muted px-4 py-2 font-semibold border-b">
              Available Trainings ({availableTrainings.length})
            </div>
            <div className="p-2 space-y-2 border-b">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Search trainings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-trainings"
                />
              </div>
              <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? "" : v)}>
                <SelectTrigger data-testid="select-training-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {availableTrainings.length > 0 ? (
                <div className="space-y-1">
                  {availableTrainings.map(training => (
                    <div
                      key={training.id}
                      className="flex items-center justify-between gap-2 p-2 rounded border hover-elevate group"
                      data-testid={`available-training-${training.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{training.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {categoryById.get(training.categoryId)?.name}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => assignMutation.mutate(training.id)}
                        disabled={assignMutation.isPending}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-assign-training-${training.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No matching trainings
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-md">
            <div className="bg-muted px-4 py-2 font-semibold border-b flex items-center justify-between gap-2">
              <span>Assigned Trainings ({assignedTrainings.length})</span>
              {selectedForGrouping.size >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7"
                  onClick={() => setIsNamingGroup(true)}
                  data-testid="button-group-selected"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Group as Alternatives ({selectedForGrouping.size})
                </Button>
              )}
            </div>
            <div className="p-2 max-h-[28rem] overflow-y-auto">
              {loadingAssigned ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
              ) : assignedTrainings.length > 0 ? (
                <div className="space-y-3">
                  {Array.from(groupedAssigned.entries()).map(([groupId, members]) => (
                    <div key={groupId} className="border-2 border-dashed rounded-md p-2 space-y-2" data-testid={`training-group-${groupId}`}>
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Link2 className="h-3.5 w-3.5" />
                          {groupById.get(groupId)?.label || "Alternatives"} - any one satisfies this requirement
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 text-xs"
                          onClick={() => ungroupMutation.mutate(groupId)}
                          disabled={ungroupMutation.isPending}
                          data-testid={`button-ungroup-${groupId}`}
                        >
                          <Link2Off className="h-3.5 w-3.5" />
                          Ungroup
                        </Button>
                      </div>
                      {members.map(rt => renderAssignedRow(rt, true))}
                    </div>
                  ))}
                  {standaloneAssigned.map(rt => renderAssignedRow(rt, false))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No trainings assigned yet
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isNamingGroup} onOpenChange={(open) => !open && setIsNamingGroup(false)}>
        <DialogContent data-testid="dialog-name-group">
          <DialogHeader>
            <DialogTitle>Group as Alternatives</DialogTitle>
            <DialogDescription>
              Completing any one of the {selectedForGrouping.size} selected trainings will satisfy
              this requirement. Give the group a short label (optional).
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newGroupLabel}
            onChange={(e) => setNewGroupLabel(e.target.value)}
            placeholder="e.g. Basic Offshore Safety Induction (any one)"
            data-testid="input-group-label"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsNamingGroup(false)}>Cancel</Button>
            <Button
              onClick={() => createGroupMutation.mutate(newGroupLabel.trim())}
              disabled={createGroupMutation.isPending}
              data-testid="button-confirm-group"
            >
              {createGroupMutation.isPending ? "Grouping…" : "Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
