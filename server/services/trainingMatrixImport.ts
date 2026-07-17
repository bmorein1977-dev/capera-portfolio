import * as XLSX from "xlsx";
import type { IStorage } from "../storage";
import type {
  TrainingMatrixImportSummary,
  TrainingMatrixPendingChanges,
  PendingTrainingLinkChange,
  PendingTrainingLinkConflict,
  PendingElementLinkSuggestion,
  ApplyTrainingMatrixPendingRequest,
} from "@shared/schema";
import { DISCIPLINE_LOCATION_CONFIGS } from "./disciplineLocationConfig";

// Column layout is consistent across all well-formed Centrica training matrix sheets:
// 0=Category, 1=Training Course, 2=(unused), 3=Internal/External+Source, 4=Vendor/Provider,
// 5=Delivery Method, 6=Estimated Hours, 7=Validity/Refresher, 8=Safety Critical Y/N, 9+=one column per job role (M/R/D)
const ROLE_COLUMNS_START = 9;

// Only sheets following the standard Category/Course/Role-columns layout are listed here.
// Sheets not in this map (e.g. malformed drafts) are reported as skipped rather than guessed at.
const SHEET_CONFIGS = DISCIPLINE_LOCATION_CONFIGS;

// Competence elements and training courses that share a leading 5-digit code (e.g. "03164")
// are the same real-world requirement, per the source documents. Codes are unique and numeric-
// only by convention - anything else (dashes, letters, wrong length) is not a code and should
// never be treated as a match.
const CODE_PATTERN = /^(\d{5})/;

function extractCode(name: string): string | null {
  const match = name.trim().match(CODE_PATTERN);
  return match ? match[1] : null;
}

function cell(row: string[], index: number): string {
  return (row[index] ?? "").toString().trim();
}

function parseValidityMonths(raw: string): number | null {
  if (!raw) return null;
  if (/^(never|n|tbc)$/i.test(raw)) return null;
  const years = parseFloat(raw);
  if (!isNaN(years)) return Math.round(years * 12);
  return null;
}

function generateJobRoleCode(name: string, usedCodes: Set<string>): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "ROLE";
  let code = base;
  let suffix = 2;
  while (usedCodes.has(code)) {
    code = `${base}-${suffix}`;
    suffix++;
  }
  usedCodes.add(code);
  return code;
}

export async function importTrainingMatrix(fileBuffer: Buffer, storage: IStorage): Promise<TrainingMatrixImportSummary> {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  const pendingChanges: TrainingMatrixPendingChanges = {
    trainingLinkChanges: [],
    trainingLinkRemovals: [],
    trainingLinkConflicts: [],
    elementLinkAdditions: [],
    elementLinkChanges: [],
    elementLinkRemovals: [],
  };

  const summary: TrainingMatrixImportSummary = {
    sheetsProcessed: [],
    sheetsSkipped: [],
    categoriesCreated: 0,
    categoriesReused: 0,
    trainingsCreated: 0,
    trainingsReused: 0,
    jobRolesCreated: 0,
    jobRolesReused: 0,
    roleTrainingLinksCreated: 0,
    roleTrainingLinksUpdated: 0,
    roleTrainingLinksSkipped: 0,
    errors: [],
    pendingChanges,
  };

  const existingCategories = await storage.getTrainingCategories();
  const categoryByName = new Map(existingCategories.map(c => [c.name.trim().toLowerCase(), c]));

  const existingTrainings = await storage.getTrainings();
  const trainingByName = new Map(existingTrainings.map(t => [t.name.trim().toLowerCase(), t]));
  const trainingById = new Map(existingTrainings.map(t => [t.id, t]));

  const existingRoles = await storage.getJobRoles();
  const roleByName = new Map(existingRoles.map(r => [r.name.trim().toLowerCase(), r]));
  const roleById = new Map(existingRoles.map(r => [r.id, r]));
  const usedCodes = new Set(existingRoles.map(r => r.code));

  // Cache of already-linked trainings per role (keyed by trainingId), to keep re-imports
  // idempotent while still picking up requirement-level changes in a revised workbook. Only
  // ever mutated for auto-applied changes (new links) - changed/removed links are held in
  // pendingChanges instead, so this cache always reflects the CONFIRMED database state.
  const linkedTrainingsByRole = new Map<string, Map<string, { id: string; requirementLevel: string | null }>>();
  async function getLinkedTrainings(roleId: string): Promise<Map<string, { id: string; requirementLevel: string | null }>> {
    let map = linkedTrainingsByRole.get(roleId);
    if (!map) {
      const links = await storage.getRoleTrainings(roleId);
      map = new Map(links.map(l => [l.trainingId, { id: l.id, requirementLevel: l.requirementLevel }]));
      linkedTrainingsByRole.set(roleId, map);
    }
    return map;
  }

  // Roles that appear as a column on at least one processed sheet this run - used to scope
  // the element-matching pass so we never propose changes for roles this upload doesn't cover.
  const touchedRoleIds = new Set<string>();

  // Role names commonly repeat across multiple discipline/site sheets (e.g. "Maintenance
  // Manager" or an apprentice role appearing on more than one sheet). Every cell value for a
  // given (role, training) pair is collected here FIRST, across all sheets, before any
  // comparison against the database - deciding new/changed/removed sheet-by-sheet as we go
  // would make the result depend on sheet processing order instead of the workbook's true,
  // fully-resolved state, and falsely flag "changes" on a re-upload of an unmodified file
  // whenever the same pair's value differs across two sheets that mention it.
  const cellValuesByPair = new Map<string, Map<string, Set<string>>>(); // "roleId|trainingId" -> value ("" = blank) -> sheet names

  for (const rawSheetName of workbook.SheetNames) {
    const trimmedName = rawSheetName.trim();
    const config = SHEET_CONFIGS[trimmedName];
    if (!config) {
      summary.sheetsSkipped.push(rawSheetName);
      continue;
    }

    const sheet = workbook.Sheets[rawSheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    if (rows.length < 3) {
      summary.sheetsSkipped.push(rawSheetName);
      continue;
    }

    const headerRow = rows[1];
    const roleColumns: Array<{ index: number; name: string }> = [];
    for (let col = ROLE_COLUMNS_START; col < headerRow.length; col++) {
      const roleName = cell(headerRow, col);
      if (roleName) {
        roleColumns.push({ index: col, name: roleName });
      }
    }

    const roleIdByColumn = new Map<number, string>();
    for (const rc of roleColumns) {
      const key = rc.name.toLowerCase();
      let role = roleByName.get(key);
      if (!role) {
        const code = generateJobRoleCode(rc.name, usedCodes);
        try {
          role = await storage.createJobRole({
            name: rc.name,
            code,
            department: config.discipline,
            location: config.location,
          });
          roleByName.set(key, role);
          roleById.set(role.id, role);
          summary.jobRolesCreated++;
        } catch (e: any) {
          summary.errors.push(`Failed to create job role "${rc.name}": ${e.message}`);
          continue;
        }
      } else {
        summary.jobRolesReused++;
      }
      roleIdByColumn.set(rc.index, role.id);
      touchedRoleIds.add(role.id);
    }

    let currentCategoryId: string | null = null;

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      const categoryCell = cell(row, 0);
      const courseCell = cell(row, 1);

      if (categoryCell && !courseCell) {
        const key = categoryCell.toLowerCase();
        let category = categoryByName.get(key);
        if (!category) {
          category = await storage.createTrainingCategory({ name: categoryCell });
          categoryByName.set(key, category);
          summary.categoriesCreated++;
        } else {
          summary.categoriesReused++;
        }
        currentCategoryId = category.id;
        continue;
      }

      if (!courseCell) continue;

      if (!currentCategoryId) {
        const key = "uncategorized";
        let category = categoryByName.get(key);
        if (!category) {
          category = await storage.createTrainingCategory({ name: "Uncategorized" });
          categoryByName.set(key, category);
          summary.categoriesCreated++;
        }
        currentCategoryId = category.id;
      }

      const sourceCell = cell(row, 3);
      const vendorCell = cell(row, 4);
      const methodCell = cell(row, 5);
      const hoursCell = cell(row, 6);
      const validityCell = cell(row, 7);
      const safetyCell = cell(row, 8).toUpperCase();

      const trainingSource = [sourceCell, vendorCell].filter(Boolean).join(" / ") || null;

      const key = courseCell.toLowerCase();
      let training = trainingByName.get(key);
      if (!training) {
        training = await storage.createTraining({
          categoryId: currentCategoryId,
          name: courseCell,
          code: extractCode(courseCell),
          isSafetyCritical: safetyCell === "Y",
          validityPeriod: parseValidityMonths(validityCell),
          estimatedHours: hoursCell || null,
          deliveryMethod: methodCell || null,
          trainingSource,
        });
        trainingByName.set(key, training);
        trainingById.set(training.id, training);
        summary.trainingsCreated++;
      } else {
        summary.trainingsReused++;
      }

      for (const rc of roleColumns) {
        const roleId = roleIdByColumn.get(rc.index);
        if (!roleId) continue;

        const cellValue = cell(row, rc.index).toUpperCase();
        const normalizedValue = (cellValue === "M" || cellValue === "R" || cellValue === "D") ? cellValue : "";

        const pairKey = `${roleId}|${training.id}`;
        let valueMap = cellValuesByPair.get(pairKey);
        if (!valueMap) {
          valueMap = new Map();
          cellValuesByPair.set(pairKey, valueMap);
        }
        let sheetSet = valueMap.get(normalizedValue);
        if (!sheetSet) {
          sheetSet = new Set();
          valueMap.set(normalizedValue, sheetSet);
        }
        sheetSet.add(rawSheetName);
      }
    }

    summary.sheetsProcessed.push(rawSheetName);
  }

  // Resolve every (role, training) pair now that all sheets have been scanned. A pair with more
  // than one distinct value across the sheets that mention it is a genuine inconsistency in the
  // source workbook - surfaced as a conflict rather than guessed at.
  for (const [pairKey, valueMap] of Array.from(cellValuesByPair.entries())) {
    const [roleId, trainingId] = pairKey.split("|");
    const role = roleById.get(roleId);
    const training = trainingById.get(trainingId);
    const trainingName = training?.name ?? trainingId;

    if (valueMap.size > 1) {
      pendingChanges.trainingLinkConflicts.push({
        roleId,
        roleName: role?.name ?? roleId,
        trainingId,
        trainingName,
        observedValues: Array.from(valueMap.entries()).map(([value, sheets]) => ({
          value: value || null,
          sheets: Array.from(sheets),
        })),
      });
      continue;
    }

    const [value] = Array.from(valueMap.keys());
    const linked = await getLinkedTrainings(roleId);
    const existingLink = linked.get(trainingId);

    if (value === "M" || value === "R" || value === "D") {
      try {
        if (!existingLink) {
          // Pure addition - can't affect anyone's existing compliance status, safe to apply directly.
          const created = await storage.createRoleTraining({ roleId, trainingId, requirementLevel: value });
          linked.set(trainingId, { id: created.id, requirementLevel: created.requirementLevel });
          summary.roleTrainingLinksCreated++;
        } else if (existingLink.requirementLevel !== value) {
          // Requirement level changed on an existing link - hold for review, it can flip
          // whether real people are currently compliant.
          pendingChanges.trainingLinkChanges.push({
            roleTrainingId: existingLink.id,
            roleId,
            roleName: role?.name ?? roleId,
            trainingId,
            trainingName,
            fromLevel: existingLink.requirementLevel,
            toLevel: value,
          });
        } else {
          summary.roleTrainingLinksSkipped++;
        }
      } catch (e: any) {
        summary.errors.push(`Failed to link "${trainingName}" to role ${roleId}: ${e.message}`);
      }
    } else if (existingLink) {
      // Blank/other in every sheet that mentions this course for this role, but a link
      // currently exists - the matrix explicitly no longer requires it for this role.
      pendingChanges.trainingLinkRemovals.push({
        roleTrainingId: existingLink.id,
        roleId,
        roleName: role?.name ?? roleId,
        trainingId,
        trainingName,
        fromLevel: existingLink.requirementLevel,
        toLevel: null,
      });
    }
  }

  // Element-matching pass: for every competency element with a leading 5-digit code, find a
  // training course with the same code and propose the same per-role M/R/D as the element's
  // role_elements link. Only ever a suggestion - only trainings/roles touched by this upload
  // are considered, and only the CONFIRMED (already-applied) training links are used as the
  // source of truth, never a pending/unapproved training change.
  try {
    const allElements = await storage.getCompetencyElements();
    const elementsByCode = new Map<string, typeof allElements[number]>();
    for (const el of allElements) {
      const code = el.code ? extractCode(el.code) : extractCode(el.name);
      if (code && !elementsByCode.has(code)) {
        elementsByCode.set(code, el);
      }
    }

    const allTrainings = await storage.getTrainings();
    const trainingsByCode = new Map<string, typeof allTrainings[number]>();
    for (const t of allTrainings) {
      const code = t.code ?? extractCode(t.name);
      if (code && !trainingsByCode.has(code)) {
        trainingsByCode.set(code, t);
      }
    }

    for (const [code, element] of Array.from(elementsByCode.entries())) {
      const matchedTraining = trainingsByCode.get(code);
      if (!matchedTraining) continue;

      for (const roleId of Array.from(touchedRoleIds)) {
        const role = roleById.get(roleId);
        const trainingLinks = await getLinkedTrainings(roleId);
        const trainingLink = trainingLinks.get(matchedTraining.id);

        const existingElementLinks = await storage.getRoleElements(roleId, element.id);
        const existingElementLink = existingElementLinks[0];

        if (trainingLink) {
          // Matched training requires this role - propose the same level for the element.
          if (!existingElementLink) {
            pendingChanges.elementLinkAdditions.push({
              roleElementId: null,
              roleId,
              roleName: role?.name ?? roleId,
              elementId: element.id,
              elementName: element.name,
              matchedTrainingName: matchedTraining.name,
              matchedCode: code,
              fromLevel: null,
              toLevel: trainingLink.requirementLevel,
            });
          } else if (existingElementLink.requirementLevel !== trainingLink.requirementLevel) {
            pendingChanges.elementLinkChanges.push({
              roleElementId: existingElementLink.id,
              roleId,
              roleName: role?.name ?? roleId,
              elementId: element.id,
              elementName: element.name,
              matchedTrainingName: matchedTraining.name,
              matchedCode: code,
              fromLevel: existingElementLink.requirementLevel,
              toLevel: trainingLink.requirementLevel,
            });
          }
        } else if (existingElementLink) {
          // Element is currently linked to this role, but the matched training's matrix data
          // (for a role this upload does cover) no longer requires it.
          pendingChanges.elementLinkRemovals.push({
            roleElementId: existingElementLink.id,
            roleId,
            roleName: role?.name ?? roleId,
            elementId: element.id,
            elementName: element.name,
            matchedTrainingName: matchedTraining.name,
            matchedCode: code,
            fromLevel: existingElementLink.requirementLevel,
            toLevel: null,
          });
        }
      }
    }
  } catch (e: any) {
    summary.errors.push(`Element matching failed: ${e.message}`);
  }

  return summary;
}

export async function applyTrainingMatrixPendingChanges(
  approved: ApplyTrainingMatrixPendingRequest,
  storage: IStorage
): Promise<{ applied: { trainingLinksUpdated: number; trainingLinksRemoved: number; elementLinksAdded: number; elementLinksUpdated: number; elementLinksRemoved: number }; errors: string[] }> {
  const errors: string[] = [];
  let trainingLinksUpdated = 0;
  let trainingLinksRemoved = 0;
  let elementLinksAdded = 0;
  let elementLinksUpdated = 0;
  let elementLinksRemoved = 0;

  for (const item of approved.trainingLinkChanges ?? []) {
    try {
      await storage.updateRoleTraining(item.roleTrainingId, { requirementLevel: item.toLevel ?? undefined });
      trainingLinksUpdated++;
    } catch (e: any) {
      errors.push(`Failed to update training requirement for "${item.trainingName}" / ${item.roleName}: ${e.message}`);
    }
  }

  for (const item of approved.trainingLinkRemovals ?? []) {
    try {
      // Archived, not deleted - preserves history and any evidence tied to this requirement.
      await storage.deleteRoleTraining(item.roleTrainingId);
      trainingLinksRemoved++;
    } catch (e: any) {
      errors.push(`Failed to remove training requirement for "${item.trainingName}" / ${item.roleName}: ${e.message}`);
    }
  }

  for (const item of approved.elementLinkAdditions ?? []) {
    try {
      await storage.createRoleElement({
        roleId: item.roleId,
        elementId: item.elementId,
        requirementLevel: item.toLevel ?? "M",
      });
      elementLinksAdded++;
    } catch (e: any) {
      errors.push(`Failed to link element "${item.elementName}" to ${item.roleName}: ${e.message}`);
    }
  }

  for (const item of approved.elementLinkChanges ?? []) {
    if (!item.roleElementId) continue;
    try {
      await storage.updateRoleElement(item.roleElementId, { requirementLevel: item.toLevel ?? undefined });
      elementLinksUpdated++;
    } catch (e: any) {
      errors.push(`Failed to update element requirement for "${item.elementName}" / ${item.roleName}: ${e.message}`);
    }
  }

  for (const item of approved.elementLinkRemovals ?? []) {
    if (!item.roleElementId) continue;
    try {
      // Archived, not deleted - preserves history and any evidence tied to this requirement.
      await storage.deleteRoleElement(item.roleElementId);
      elementLinksRemoved++;
    } catch (e: any) {
      errors.push(`Failed to remove element requirement for "${item.elementName}" / ${item.roleName}: ${e.message}`);
    }
  }

  return {
    applied: { trainingLinksUpdated, trainingLinksRemoved, elementLinksAdded, elementLinksUpdated, elementLinksRemoved },
    errors,
  };
}
