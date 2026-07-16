import JSZip from "jszip";
import type { IStorage } from "../storage";
import type { CompetenceDocumentImportSummary, ElementCriteriaType } from "@shared/schema";
import { DISCIPLINE_LOCATION_CONFIGS } from "./disciplineLocationConfig";

interface ParsedCriterion {
  type: ElementCriteriaType;
  subcategoryNumber: number;
  criteriaNumber: number;
  criteriaText: string;
  subcategoryName: string | null;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Extracts each Word table row as an array of cell texts. Word splits visible text across many
// <w:r> runs (spellcheck/revision markers), so <w:t> tags within a cell must be concatenated -
// searching for whole phrases directly in the XML is unreliable, but this cell-boundary
// extraction is exactly what a real .docx table row/cell structure guarantees.
async function extractDocxRows(buffer: Buffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new Error("Not a valid .docx file (missing word/document.xml)");
  }
  const xml = await docXmlFile.async("string");

  const rowMatches = Array.from(xml.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g));
  return rowMatches.map(rowMatch => {
    const cellMatches = Array.from(rowMatch[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g));
    return cellMatches.map(cellMatch => {
      const texts = Array.from(cellMatch[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)).map(t => t[1]);
      return decodeXmlEntities(texts.join(""));
    });
  });
}

// Row shape confirmed against a real Centrica assessment standard document:
//   Section header:    3 cells, cell[0] === "Code"                 -> enters a Safety/Knowledge/Performance section
//   Subcategory header: 1 cell, non-boilerplate                    -> names the subcategory for criteria that follow
//   Criteria row:       3 cells, cell[0] matches "S. 1.0" etc.      -> one criterion
//   Anything else (method-legend rows, "Assessor Comments", the reference table at the end) is ignored.
const CODE_PATTERN = /^([SKP])\.\s*(\d+)\.(\d+)$/;
const TYPE_BY_LETTER: Record<string, ElementCriteriaType> = { S: "safety", K: "knowledge", P: "performance" };
const BOILERPLATE_SUBCATEGORY_PREFIXES = ["Assessor Comments", "Additional Assessment Evidence"];

export function parseCompetenceCriteriaDocument(rows: string[][]): ParsedCriterion[] {
  const criteria: ParsedCriterion[] = [];
  let currentSubcategoryName: string | null = null;
  let enteredSections = false;

  for (const row of rows) {
    const cells = row.map(c => c.trim());

    if (cells.length === 3 && cells[0] === "Code") {
      enteredSections = true;
      currentSubcategoryName = null;
      continue;
    }

    if (!enteredSections) continue;

    if (cells.length === 3) {
      const match = cells[0].match(CODE_PATTERN);
      if (match) {
        const [, letter, subNum, critNum] = match;
        criteria.push({
          type: TYPE_BY_LETTER[letter],
          subcategoryNumber: parseInt(subNum, 10),
          criteriaNumber: parseInt(critNum, 10),
          criteriaText: cells[1],
          subcategoryName: currentSubcategoryName,
        });
      }
      continue;
    }

    if (cells.length === 1 && cells[0]) {
      const isBoilerplate = BOILERPLATE_SUBCATEGORY_PREFIXES.some(p => cells[0].startsWith(p));
      if (!isBoilerplate) {
        currentSubcategoryName = cells[0];
      }
    }
  }

  return criteria;
}

function generateCode(name: string, usedCodes: Set<string>): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "ITEM";
  let code = base;
  let suffix = 2;
  while (usedCodes.has(code)) {
    code = `${base}-${suffix}`;
    suffix++;
  }
  usedCodes.add(code);
  return code;
}

export interface CompetenceDocumentFile {
  relativePath: string; // e.g. "SC&I 47-3B/03164PAT PS03 Emergency Shutdown.docx"
  buffer: Buffer;
}

export async function importCompetenceDocuments(
  files: CompetenceDocumentFile[],
  storage: IStorage
): Promise<CompetenceDocumentImportSummary> {
  const summary: CompetenceDocumentImportSummary = {
    filesProcessed: [],
    filesSkipped: [],
    elementsCreated: 0,
    elementsReused: 0,
    subcategoriesCreated: 0,
    subcategoriesReused: 0,
    criteriaCreated: 0,
    criteriaUpdated: 0,
    roleElementLinksCreated: 0,
    roleElementLinksSkipped: 0,
    errors: [],
  };

  const existingCategories = await storage.getCompetencyCategories();
  const categoryByName = new Map(existingCategories.map(c => [c.name.trim().toLowerCase(), c]));
  const usedCategoryCodes = new Set(existingCategories.map(c => c.code));

  const existingElements = await storage.getCompetencyElements();
  const elementByName = new Map(existingElements.map(e => [e.name.trim().toLowerCase(), e]));
  const usedElementCodes = new Set(existingElements.map(e => e.code).filter((c): c is string => !!c));

  const allJobRoles = await storage.getJobRoles();

  const linkedElementIdsByRole = new Map<string, Set<string>>();
  async function getLinkedElementIds(roleId: string): Promise<Set<string>> {
    let set = linkedElementIdsByRole.get(roleId);
    if (!set) {
      const links = await storage.getRoleElements(roleId);
      set = new Set(links.map(l => l.elementId));
      linkedElementIdsByRole.set(roleId, set);
    }
    return set;
  }

  for (const file of files) {
    const parts = file.relativePath.split("/").filter(Boolean);
    const fileName = parts[parts.length - 1];

    if (!fileName || !fileName.toLowerCase().endsWith(".docx")) {
      summary.filesSkipped.push({ path: file.relativePath, reason: "Not a .docx file" });
      continue;
    }

    if (parts.length < 2) {
      summary.filesSkipped.push({ path: file.relativePath, reason: "File is not inside a discipline/site folder" });
      continue;
    }

    const folderName = parts[0].trim();
    const config = DISCIPLINE_LOCATION_CONFIGS[folderName];
    if (!config) {
      summary.filesSkipped.push({
        path: file.relativePath,
        reason: `Unrecognized folder "${folderName}" - rename it to match an existing discipline/site (e.g. "SC&I 47-3B")`,
      });
      continue;
    }

    const matchingRoles = allJobRoles.filter(r => r.department === config.discipline && r.location === config.location);
    if (matchingRoles.length === 0) {
      summary.filesSkipped.push({
        path: file.relativePath,
        reason: `No job roles found for ${config.discipline} / ${config.location ?? "no site"} - import the training matrix sheet for this discipline/site first`,
      });
      continue;
    }

    const elementName = fileName.replace(/\.docx$/i, "").trim();

    try {
      const rows = await extractDocxRows(file.buffer);
      const parsedCriteria = parseCompetenceCriteriaDocument(rows);

      if (parsedCriteria.length === 0) {
        summary.filesSkipped.push({ path: file.relativePath, reason: "No recognizable Safety/Knowledge/Performance criteria found" });
        continue;
      }

      const categoryKey = config.discipline.toLowerCase();
      let category = categoryByName.get(categoryKey);
      if (!category) {
        const code = generateCode(config.discipline, usedCategoryCodes);
        category = await storage.createCompetencyCategory({ name: config.discipline, code });
        categoryByName.set(categoryKey, category);
      }

      const elementKey = elementName.toLowerCase();
      let element = elementByName.get(elementKey);
      if (!element) {
        const code = generateCode(elementName, usedElementCodes);
        element = await storage.createCompetencyElement({
          categoryId: category.id,
          name: elementName,
          code,
        });
        elementByName.set(elementKey, element);
        summary.elementsCreated++;
      } else {
        summary.elementsReused++;
      }

      const existingSubcats = await storage.getCompetenceSubcategories(element.id);
      const subcatByKey = new Map(existingSubcats.map(s => [`${s.type}::${s.name.trim().toLowerCase()}`, s]));
      const preExistingSubcatKeys = new Set(subcatByKey.keys());
      const touchedSubcatKeys = new Set<string>();

      const existingCriteria = await storage.getCompetenceCriteria({ elementId: element.id });
      const existingCriteriaCodes = new Set(existingCriteria.map(c => c.code));

      for (const criterion of parsedCriteria) {
        let subcategoryId: string | null = null;

        if (criterion.subcategoryName) {
          const key = `${criterion.type}::${criterion.subcategoryName.trim().toLowerCase()}`;
          let subcat = subcatByKey.get(key);
          if (!subcat) {
            subcat = await storage.createCompetenceSubcategory({
              elementId: element.id,
              name: criterion.subcategoryName,
              type: criterion.type,
              order: criterion.subcategoryNumber,
            });
            subcatByKey.set(key, subcat);
          }
          if (!touchedSubcatKeys.has(key)) {
            touchedSubcatKeys.add(key);
            if (preExistingSubcatKeys.has(key)) summary.subcategoriesReused++;
            else summary.subcategoriesCreated++;
          }
          subcategoryId = subcat.id;
        }

        const letterPrefix = criterion.type === "safety" ? "S" : criterion.type === "knowledge" ? "K" : "P";
        const code = `${letterPrefix} ${criterion.subcategoryNumber}.${criterion.criteriaNumber}`;
        const alreadyExisted = existingCriteriaCodes.has(code);

        await storage.upsertImportedCompetenceCriteria({
          elementId: element.id,
          subcategoryId,
          levelId: null,
          type: criterion.type,
          code,
          criteriaText: criterion.criteriaText,
          subcategoryNumber: criterion.subcategoryNumber,
          criteriaNumber: criterion.criteriaNumber,
          required: true,
        });

        existingCriteriaCodes.add(code);
        if (alreadyExisted) summary.criteriaUpdated++;
        else summary.criteriaCreated++;
      }

      for (const role of matchingRoles) {
        const linkedIds = await getLinkedElementIds(role.id);
        if (linkedIds.has(element.id)) {
          summary.roleElementLinksSkipped++;
          continue;
        }
        await storage.createRoleElement({ roleId: role.id, elementId: element.id, required: true });
        linkedIds.add(element.id);
        summary.roleElementLinksCreated++;
      }

      summary.filesProcessed.push(file.relativePath);
    } catch (e: any) {
      summary.errors.push(`${file.relativePath}: ${e.message}`);
    }
  }

  return summary;
}
