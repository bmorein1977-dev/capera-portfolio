import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { X, ChevronsUpDown } from 'lucide-react';
import type { ComplianceExplorerFilters, ComplianceExplorerResult, ComplianceRow, JobRole, ContractCompany } from '@shared/schema';

const ANY = '__any__';

// Shared by every "filter the workforce" report (Compliance Explorer, Competence Detail) so they
// all offer identical filters and stay in sync if the filter set ever changes.
export function useComplianceFilters() {
  const [location, setLocation] = useState(ANY);
  const [jobRoleId, setJobRoleId] = useState(ANY);
  const [secondaryJobRoleId, setSecondaryJobRoleId] = useState(ANY);
  const [teamShift, setTeamShift] = useState(ANY);
  const [employmentType, setEmploymentType] = useState(ANY);
  const [contractCompanyId, setContractCompanyId] = useState(ANY);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);

  // Unfiltered pull, used to source the Location/Team-Shift dropdown options and the People
  // picker's full list from what's actually on user records - both location/team-shift are free
  // text with inconsistent conventions between records (not the structured locations/teams
  // tables, which are unreliable - see Role Transition Planning's location-matching fix from
  // earlier this session), so the option list has to come from real data rather than a reference
  // table.
  const { data: optionsSource } = useQuery<ComplianceExplorerResult>({
    queryKey: ['/api/reports/compliance-explorer', {}],
  });
  const { data: jobRoles } = useQuery<JobRole[]>({ queryKey: ['/api/job-roles'] });
  const { data: contractCompanies } = useQuery<ContractCompany[]>({ queryKey: ['/api/org/contract-companies'] });

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    optionsSource?.people.forEach(p => { if (p.location) set.add(p.location); });
    return Array.from(set).sort();
  }, [optionsSource]);
  const teamShiftOptions = useMemo(() => {
    const set = new Set<string>();
    optionsSource?.people.forEach(p => { if (p.teamShift) set.add(p.teamShift); });
    return Array.from(set).sort();
  }, [optionsSource]);
  const allPeopleSorted = useMemo(() => {
    return [...(optionsSource?.people || [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [optionsSource]);

  const filters: ComplianceExplorerFilters = useMemo(() => ({
    location: location !== ANY ? location : undefined,
    jobRoleId: jobRoleId !== ANY ? jobRoleId : undefined,
    secondaryJobRoleId: secondaryJobRoleId !== ANY ? secondaryJobRoleId : undefined,
    teamShift: teamShift !== ANY ? teamShift : undefined,
    employmentType: employmentType !== ANY ? employmentType : undefined,
    contractCompanyId: contractCompanyId !== ANY ? contractCompanyId : undefined,
    candidateIds: selectedPeople.length > 0 ? selectedPeople : undefined,
  }), [location, jobRoleId, secondaryJobRoleId, teamShift, employmentType, contractCompanyId, selectedPeople]);

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined);

  const clearFilters = () => {
    setLocation(ANY); setJobRoleId(ANY); setSecondaryJobRoleId(ANY);
    setTeamShift(ANY); setEmploymentType(ANY); setContractCompanyId(ANY);
    setSelectedPeople([]);
  };

  return {
    location, setLocation, jobRoleId, setJobRoleId, secondaryJobRoleId, setSecondaryJobRoleId,
    teamShift, setTeamShift, employmentType, setEmploymentType, contractCompanyId, setContractCompanyId,
    selectedPeople, setSelectedPeople,
    locationOptions, teamShiftOptions, allPeopleSorted, jobRoles, contractCompanies,
    filters, hasActiveFilters, clearFilters,
  };
}

export type ComplianceFilterState = ReturnType<typeof useComplianceFilters>;

// Combines the "search by name" and "pick specific people" requests into one control - typing
// filters the list (cmdk's built-in fuzzy match against the value string), clicking toggles that
// person in/out of a multi-select.
function PeoplePicker({ people, selected, onChange }: { people: ComplianceRow[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const selectedPeople = people.filter(p => selected.includes(p.userId));

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <div className="sm:col-span-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            data-testid="button-people-picker"
          >
            <span className="truncate text-muted-foreground">
              {selected.length === 0 ? 'Search and select people…' : `${selected.length} ${selected.length === 1 ? 'person' : 'people'} selected`}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by name or email..." data-testid="input-people-search" />
            <CommandList>
              <CommandEmpty>No one found.</CommandEmpty>
              <CommandGroup>
                {people.map(p => (
                  <CommandItem
                    key={p.userId}
                    value={`${p.name} ${p.email || ''}`}
                    onSelect={() => toggle(p.userId)}
                    data-testid={`option-person-${p.userId}`}
                  >
                    <Checkbox checked={selected.includes(p.userId)} className="mr-2 pointer-events-none" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate">{p.name}</span>
                      {p.jobRoleName && <span className="text-xs text-muted-foreground truncate">{p.jobRoleName}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedPeople.map(p => (
            <Badge key={p.userId} variant="secondary" className="gap-1 pr-1">
              {p.name}
              <button
                type="button"
                onClick={() => toggle(p.userId)}
                className="ml-1 rounded-full hover-elevate"
                data-testid={`button-remove-person-${p.userId}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function ComplianceFilterBar({ state }: { state: ComplianceFilterState }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <PeoplePicker people={state.allPeopleSorted} selected={state.selectedPeople} onChange={state.setSelectedPeople} />

          <Select value={state.location} onValueChange={state.setLocation}>
            <SelectTrigger data-testid="select-location"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any location</SelectItem>
              {state.locationOptions.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={state.jobRoleId} onValueChange={state.setJobRoleId}>
            <SelectTrigger data-testid="select-job-role"><SelectValue placeholder="Job role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any job role</SelectItem>
              {(state.jobRoles || []).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={state.secondaryJobRoleId} onValueChange={state.setSecondaryJobRoleId}>
            <SelectTrigger data-testid="select-secondary-job-role"><SelectValue placeholder="Secondary job role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any secondary role</SelectItem>
              {(state.jobRoles || []).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={state.teamShift} onValueChange={state.setTeamShift}>
            <SelectTrigger data-testid="select-team-shift"><SelectValue placeholder="Team / shift" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any team / shift</SelectItem>
              {state.teamShiftOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={state.employmentType} onValueChange={state.setEmploymentType}>
            <SelectTrigger data-testid="select-employment-type"><SelectValue placeholder="Employment type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Employee or contractor</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={state.contractCompanyId} onValueChange={state.setContractCompanyId}>
            <SelectTrigger data-testid="select-contract-company"><SelectValue placeholder="Contract company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any contract company</SelectItem>
              {(state.contractCompanies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {state.hasActiveFilters && (
            <Button variant="ghost" onClick={state.clearFilters} className="justify-self-start" data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-1" /> Clear filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
