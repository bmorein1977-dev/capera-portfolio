import * as XLSX from "xlsx";
import type { IStorage } from "../storage";
import type { TrainingMatrixImportSummary } from "@shared/schema";
import { DISCIPLINE_LOCATION_CONFIGS } from "./disciplineLocationConfig";

// Column layout is consistent across all well-formed Centrica training matrix sheets:
// 0=Category, 1=Training Course, 2=(unused), 3=Internal/External+Source, 4=Vendor/Provider,
// 5=Delivery Method, 6=Estimated Hours, 7=Validity/Refresher, 8=Safety Critical Y/N, 9+=one column per job role (M/R/D)
const ROLE_COLUMNS_START = 9;

// Only sheets following the standard Category/Course/Role-columns layout are listed here.
// Sheets not in this map (e.g. malformed drafts) are reported as skipped rather than guessed at.
const SHEET_CONFIGS = DISCIPLINE_LOCATION_CONFIGS;

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
  };

  const existingCategories = await storage.getTrainingCategories();
  const categoryByName = new Map(existingCategories.map(c => [c.name.trim().toLowerCase(), c]));

  const existingTrainings = await storage.getTrainings();
  const trainingByName = new Map(existingTrainings.map(t => [t.name.trim().toLowerCase(), t]));

  const existingRoles = await storage.getJobRoles();
  const roleByName = new Map(existingRoles.map(r => [r.name.trim().toLowerCase(), r]));
  const usedCodes = new Set(existingRoles.map(r => r.code));

  // Cache of already-linked trainings per role (keyed by trainingId), to keep re-imports
  // idempotent while still picking up requirement-level changes in a revised workbook.
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
          summary.jobRolesCreated++;
        } catch (e: any) {
          summary.errors.push(`Failed to create job role "${rc.name}": ${e.message}`);
          continue;
        }
      } else {
        summary.jobRolesReused++;
      }
      roleIdByColumn.set(rc.index, role.id);
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
          isSafetyCritical: safetyCell === "Y",
          validityPeriod: parseValidityMonths(validityCell),
          estimatedHours: hoursCell || null,
          deliveryMethod: methodCell || null,
          trainingSource,
        });
        trainingByName.set(key, training);
        summary.trainingsCreated++;
      } else {
        summary.trainingsReused++;
      }

      for (const rc of roleColumns) {
        const roleId = roleIdByColumn.get(rc.index);
        if (!roleId) continue;

        const cellValue = cell(row, rc.index).toUpperCase();
        if (cellValue !== "M" && cellValue !== "R" && cellValue !== "D") continue;

        const linked = await getLinkedTrainings(roleId);
        const existingLink = linked.get(training.id);

        try {
          if (!existingLink) {
            const created = await storage.createRoleTraining({
              roleId,
              trainingId: training.id,
              requirementLevel: cellValue,
            });
            linked.set(training.id, { id: created.id, requirementLevel: created.requirementLevel });
            summary.roleTrainingLinksCreated++;
          } else if (existingLink.requirementLevel !== cellValue) {
            await storage.updateRoleTraining(existingLink.id, { requirementLevel: cellValue });
            existingLink.requirementLevel = cellValue;
            summary.roleTrainingLinksUpdated++;
          } else {
            summary.roleTrainingLinksSkipped++;
          }
        } catch (e: any) {
          summary.errors.push(`Failed to link "${courseCell}" to role ${roleId}: ${e.message}`);
        }
      }
    }

    summary.sheetsProcessed.push(rawSheetName);
  }

  return summary;
}
