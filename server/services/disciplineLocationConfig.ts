// Shared discipline/location taxonomy used by both the training matrix import
// (server/services/trainingMatrixImport.ts, keyed by worksheet name) and the
// competence document import (server/services/competenceCriteriaImport.ts, keyed
// by top-level folder name). Keeping this in one place means both importers agree
// on what "SC&I 47-3B" vs "SC&I Easington" means, and on job roles' department/location.

export interface DisciplineLocation {
  discipline: string;
  location: string | null;
}

export const DISCIPLINE_LOCATION_CONFIGS: Record<string, DisciplineLocation> = {
  "Operations 47-3B": { discipline: "Operations", location: "47/3B" },
  "Leadership 47-3B": { discipline: "Leadership", location: "47/3B" },
  "Operations Easington": { discipline: "Operations", location: "Easington" },
  "Leadership Easington": { discipline: "Leadership", location: "Easington" },
  "SC&I 47-3B": { discipline: "SC&I", location: "47/3B" },
  "SC&I Easington": { discipline: "SC&I", location: "Easington" },
  "Electrical 47-3B": { discipline: "Electrical", location: "47/3B" },
  "Electrical Easington": { discipline: "Electrical", location: "Easington" },
  "Mechanical 47-3B": { discipline: "Mechanical", location: "47/3B" },
  "Mechanical Easington": { discipline: "Mechanical", location: "Easington" },
  "Apprentices": { discipline: "Apprentices", location: null },
  "Wells Specific": { discipline: "Wells", location: null },
  "TA's & Engineers": { discipline: "Technical Authorities & Engineers", location: null },
};
