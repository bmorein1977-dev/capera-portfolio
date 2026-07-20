import * as XLSX from "xlsx";
import type { IStorage } from "../storage";
import type {
  TrainingMatrixImportSummary,
  TrainingMatrixPendingChanges,
  PendingTrainingLinkChange,
  PendingTrainingLinkConflict,
  PendingElementLinkSuggestion,
  PendingElementLinkConflict,
  ApplyTrainingMatrixPendingRequest,
  CompetencyElement,
} from "@shared/schema";
import { DISCIPLINE_LOCATION_CONFIGS } from "./disciplineLocationConfig";

// Column layout is consistent across all well-formed Centrica training matrix sheets:
// 0=Category, 1=Training Course, 2=(unused), 3=Internal/External+Source, 4=Vendor/Provider,
// 5=Delivery Method, 6=Estimated Hours, 7=Validity/Refresher, 8=Safety Critical Y/N, 9+=one column per job role (M/R/D)
const ROLE_COLUMNS_START = 9;

// Every sheet ends with a "COMPETENCE ELEMENTS" section (see below) with a different row shape
// from the regular course rows above it - matched by name, not treated as a normal category.
const COMPETENCE_ELEMENTS_HEADER = /^competence elements?$/i;

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

function parseValidityYearsInt(raw: string): number | null {
  if (!raw) return null;
  if (/^(never|n|tbc)$/i.test(raw)) return null;
  const years = parseInt(raw, 10);
  return isNaN(years) ? null : years;
}

// Source text is always "Performance & Knowledge" in the real workbook so far, but parsed
// generically in case a future revision lists "Knowledge" or "Performance" alone.
function parseActivityType(raw: string): string | null {
  const hasKnowledge = /knowledge/i.test(raw);
  const hasPerformance = /performance/i.test(raw);
  if (hasKnowledge && hasPerformance) return "both";
  if (hasPerformance) return "performance";
  if (hasKnowledge) return "knowledge";
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
    elementLinkConflicts: [],
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

  // The matrix's own COMPETENCE ELEMENTS section (see below) gives direct per-role M/R/D for
  // competence elements by code - fetched upfront so those rows can be matched as they're read.
  const allElements = await storage.getCompetencyElements();
  const elementById = new Map(allElements.map(e => [e.id, e]));
  const elementsByCode = new Map<string, CompetencyElement>();
  for (const el of allElements) {
    const code = el.code ? extractCode(el.code) : extractCode(el.name);
    if (code && !elementsByCode.has(code)) {
      elementsByCode.set(code, el);
    }
  }

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

  const linkedElementsByRole = new Map<string, Map<string, { id: string; requirementLevel: string | null }>>();
  async function getLinkedElements(roleId: string): Promise<Map<string, { id: string; requirementLevel: string | null }>> {
    let map = linkedElementsByRole.get(roleId);
    if (!map) {
      const links = await storage.getRoleElements(roleId);
      map = new Map(links.map(l => [l.elementId, { id: l.id, requirementLevel: l.requirementLevel }]));
      linkedElementsByRole.set(roleId, map);
    }
    return map;
  }

  // Roles that appear as a column on at least one processed sheet this run - used to scope
  // the inferred element-matching pass so we never propose changes for roles this upload
  // doesn't cover.
  const touchedRoleIds = new Set<string>();

  // Role names commonly repeat across multiple discipline/site sheets (e.g. "Maintenance
  // Manager" or an apprentice role appearing on more than one sheet). Every cell value for a
  // given (role, training) or (role, element) pair is collected here FIRST, across all sheets,
  // before any comparison against the database - deciding new/changed/removed sheet-by-sheet as
  // we go would make the result depend on sheet processing order instead of the workbook's true,
  // fully-resolved state, and falsely flag "changes" on a re-upload of an unmodified file
  // whenever the same pair's value differs across two sheets that mention it.
  const cellValuesByPair = new Map<string, Map<string, Set<string>>>(); // "roleId|trainingId" -> value ("" = blank) -> sheet names
  const elementCellValuesByPair = new Map<string, Map<string, Set<string>>>(); // "roleId|elementId" -> value -> sheet names
  const elementMetaByElementId = new Map<string, { activityType: string | null; validityYears: number | null; safetyCritical: boolean }>();
  const directlyMatchedElementPairs = new Set<string>(); // "roleId|elementId" pairs decided by direct matrix data

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
    // The COMPETENCE ELEMENTS section is always the last one on a sheet, and its own rows can
    // have an empty course column (col1) depending on how Excel merged the name cell - which
    // would otherwise look identical to a new category header. Once we're in this section we
    // stay in it for the rest of the sheet rather than re-checking each row.
    let inCompetenceElementsSection = false;

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      const categoryCell = cell(row, 0);
      const courseCell = cell(row, 1);

      if (!inCompetenceElementsSection && categoryCell && !courseCell) {
        if (COMPETENCE_ELEMENTS_HEADER.test(categoryCell)) {
          inCompetenceElementsSection = true;
          currentCategoryId = null;
          continue;
        }
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

      if (inCompetenceElementsSection) {
        // The element's name lives in column 0 - sometimes replicated into columns 1-3 by a
        // merged cell, sometimes not, so column 0 is the only reliable source. Rows here are
        // never turned into Training records; they only ever propose role_elements links for
        // an existing competency element with a matching 5-digit code.
        if (!categoryCell) continue;
        const code = extractCode(categoryCell);
        if (!code) continue;
        const element = elementsByCode.get(code);
        if (!element) continue; // no matching competency element exists (yet) - nothing to propose

        const activityType = parseActivityType(cell(row, 4));
        const validityYears = parseValidityYearsInt(cell(row, 7));
        const safetyCritical = cell(row, 8).toUpperCase() === "Y";
        elementMetaByElementId.set(element.id, { activityType, validityYears, safetyCritical });

        for (const rc of roleColumns) {
          const roleId = roleIdByColumn.get(rc.index);
          if (!roleId) continue;
          const cellValue = cell(row, rc.index).toUpperCase();
          const normalizedValue = (cellValue === "M" || cellValue === "R" || cellValue === "D") ? cellValue : "";

          const pairKey = `${roleId}|${element.id}`;
          let valueMap = elementCellValuesByPair.get(pairKey);
          if (!valueMap) {
            valueMap = new Map();
            elementCellValuesByPair.set(pairKey, valueMap);
          }
          let sheetSet = valueMap.get(normalizedValue);
          if (!sheetSet) {
            sheetSet = new Set();
            valueMap.set(normalizedValue, sheetSet);
          }
          sheetSet.add(rawSheetName);
        }
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

  // Resolve every (role, element) pair found directly in COMPETENCE ELEMENTS sections - the
  // matrix's own authoritative per-role data for elements, same conflict handling as trainings.
  for (const [pairKey, valueMap] of Array.from(elementCellValuesByPair.entries())) {
    const [roleId, elementId] = pairKey.split("|");
    const role = roleById.get(roleId);
    const element = elementById.get(elementId);
    const elementName = element?.name ?? elementId;
    const code = element ? (element.code ? extractCode(element.code) : extractCode(element.name)) ?? "" : "";
    directlyMatchedElementPairs.add(pairKey);

    if (valueMap.size > 1) {
      pendingChanges.elementLinkConflicts.push({
        roleId,
        roleName: role?.name ?? roleId,
        elementId,
        elementName,
        observedValues: Array.from(valueMap.entries()).map(([value, sheets]) => ({
          value: value || null,
          sheets: Array.from(sheets),
        })),
      });
      continue;
    }

    const [value] = Array.from(valueMap.keys());
    const linked = await getLinkedElements(roleId);
    const existingLink = linked.get(elementId);
    const meta = elementMetaByElementId.get(elementId);

    if (value === "M" || value === "R" || value === "D") {
      if (!existingLink) {
        pendingChanges.elementLinkAdditions.push({
          roleElementId: null,
          roleId,
          roleName: role?.name ?? roleId,
          elementId,
          elementName,
          source: "direct",
          matchedTrainingName: null,
          matchedCode: code,
          fromLevel: null,
          toLevel: value,
          activityType: meta?.activityType ?? null,
          validityYears: meta?.validityYears ?? null,
          safetyCritical: meta?.safetyCritical ?? null,
        });
      } else if (existingLink.requirementLevel !== value) {
        pendingChanges.elementLinkChanges.push({
          roleElementId: existingLink.id,
          roleId,
          roleName: role?.name ?? roleId,
          elementId,
          elementName,
          source: "direct",
          matchedTrainingName: null,
          matchedCode: code,
          fromLevel: existingLink.requirementLevel,
          toLevel: value,
        });
      }
    } else if (existingLink) {
      pendingChanges.elementLinkRemovals.push({
        roleElementId: existingLink.id,
        roleId,
        roleName: role?.name ?? roleId,
        elementId,
        elementName,
        source: "direct",
        matchedTrainingName: null,
        matchedCode: code,
        fromLevel: existingLink.requirementLevel,
        toLevel: null,
      });
    }
  }

  // Inferred element-matching pass: for every competency element with a leading 5-digit code
  // that WASN'T already covered by direct matrix data above, find a training course with the
  // same code and propose the same per-role M/R/D as the element's role_elements link. A
  // heuristic, used only to fill gaps the matrix's own COMPETENCE ELEMENTS section doesn't cover.
  try {
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
        const pairKey = `${roleId}|${element.id}`;
        if (directlyMatchedElementPairs.has(pairKey)) continue; // direct matrix data already decided this

        const role = roleById.get(roleId);
        const trainingLinks = await getLinkedTrainings(roleId);
        const trainingLink = trainingLinks.get(matchedTraining.id);

        const existingElementLinks = await storage.getRoleElements(roleId, element.id);
        const existingElementLink = existingElementLinks[0];

        if (trainingLink) {
          if (!existingElementLink) {
            pendingChanges.elementLinkAdditions.push({
              roleElementId: null,
              roleId,
              roleName: role?.name ?? roleId,
              elementId: element.id,
              elementName: element.name,
              source: "inferred",
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
              source: "inferred",
              matchedTrainingName: matchedTraining.name,
              matchedCode: code,
              fromLevel: existingElementLink.requirementLevel,
              toLevel: trainingLink.requirementLevel,
            });
          }
        } else if (existingElementLink) {
          pendingChanges.elementLinkRemovals.push({
            roleElementId: existingElementLink.id,
            roleId,
            roleName: role?.name ?? roleId,
            elementId: element.id,
            elementName: element.name,
            source: "inferred",
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
        activityType: item.activityType ?? undefined,
        validityYears: item.validityYears ?? undefined,
        safetyCritical: item.safetyCritical ?? undefined,
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
