import * as XLSX from "xlsx";
import csv from "csv-parser";
import { Readable } from "stream";
import type { IStorage } from "../storage";
import type {
  User,
  LifecycleImportAction,
  LifecycleImportRow,
  LifecycleImportPreview,
  LifecycleImportApplyRow,
  LifecycleImportResult,
} from "@shared/schema";

// Business process names vary by HR system and by which report was exported, so these are
// matched as substrings against the lowercased raw value rather than an exact enum - "Voluntary
// Termination", "Termination - Involuntary" etc. should all still count. Anything not matching
// either list is treated as a "mover" (a location/org change), which is a safe default given this
// report's own scope is explicitly limited to leavers, movers and starters - there's no fourth
// category a real row could fall into.
const LEAVER_PROCESS_MARKERS = ['terminat', 'resign', 'retire', 'end contract', 'end additional job'];
const STARTER_PROCESS_MARKERS = ['hire', 'add job'];

function classifyBusinessProcess(raw: string): 'leaver' | 'starter' | 'mover' {
  const v = raw.trim().toLowerCase();
  if (LEAVER_PROCESS_MARKERS.some(m => v.includes(m))) return 'leaver';
  if (STARTER_PROCESS_MARKERS.some(m => v.includes(m))) return 'starter';
  return 'mover';
}

function parseReportDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

interface RawLifecycleRow {
  companyNumber: string;
  firstName: string;
  lastName: string;
  businessProcessName: string;
  locationNew: string | null;
  effectiveDate: string | null;
  hireDate: string | null;
}

// These Workday-style exports lead with several "Prompt - X,value" metadata lines before the
// real column header row, so the header can't be assumed to be line 1 like a normal CSV/XLSX -
// it's identified by content instead (the one row containing both signature columns) and
// everything before it is discarded.
function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join('|').toLowerCase();
  return joined.includes('employee id') && joined.includes('business process name');
}

function buildRowsFromTable(headerCells: string[], dataRows: string[][]): RawLifecycleRow[] {
  const normalizedHeaders = headerCells.map(h => h.trim().toLowerCase());
  const colIndex = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = normalizedHeaders.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxEmployeeId = colIndex('employee id');
  const idxFirstName = colIndex('first name');
  const idxLastName = colIndex('last name');
  const idxLocation = colIndex('location - new', 'location');
  const idxBusinessProcess = colIndex('business process name');
  const idxHireDate = colIndex('hire date as of event effective date', 'hire date');
  const idxEffectiveDate = colIndex('effective date');

  const cellAt = (row: string[], idx: number): string => (idx === -1 ? '' : (row[idx] ?? '').toString().trim());

  return dataRows
    .filter(row => row.some(c => (c ?? '').toString().trim() !== ''))
    .map(row => ({
      companyNumber: cellAt(row, idxEmployeeId),
      firstName: cellAt(row, idxFirstName),
      lastName: cellAt(row, idxLastName),
      businessProcessName: cellAt(row, idxBusinessProcess),
      locationNew: cellAt(row, idxLocation) || null,
      effectiveDate: parseReportDate(cellAt(row, idxEffectiveDate)),
      hireDate: parseReportDate(cellAt(row, idxHireDate)),
    }));
}

async function parseCsvBuffer(buffer: Buffer): Promise<RawLifecycleRow[]> {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r\n|\n/);
  const headerLineIndex = lines.findIndex(line => isHeaderRow(line.split(',')));
  if (headerLineIndex === -1) {
    throw new Error("Could not find the header row (expected columns including 'Employee ID' and 'Business Process Name')");
  }
  const sliced = lines.slice(headerLineIndex).join('\n');

  const parsedRows: Record<string, string>[] = await new Promise((resolve, reject) => {
    const results: Record<string, string>[] = [];
    Readable.from([sliced])
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });

  if (parsedRows.length === 0) return [];
  const headerCells = Object.keys(parsedRows[0]);
  const dataRows = parsedRows.map(r => headerCells.map(h => r[h] ?? ''));
  return buildRowsFromTable(headerCells, dataRows);
}

function parseXlsxBuffer(buffer: Buffer): RawLifecycleRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const headerRowIndex = allRows.findIndex(row => isHeaderRow(row.map(c => (c ?? '').toString())));
  if (headerRowIndex === -1) {
    throw new Error("Could not find the header row (expected columns including 'Employee ID' and 'Business Process Name')");
  }
  const headerCells = allRows[headerRowIndex].map(c => (c ?? '').toString());
  const dataRows = allRows.slice(headerRowIndex + 1).map(row => row.map(c => (c ?? '').toString()));
  return buildRowsFromTable(headerCells, dataRows);
}

export async function previewLifecycleImport(buffer: Buffer, fileName: string, storage: IStorage): Promise<LifecycleImportPreview> {
  const parseErrors: string[] = [];
  let rawRows: RawLifecycleRow[] = [];

  try {
    if (fileName.toLowerCase().endsWith('.csv')) {
      rawRows = await parseCsvBuffer(buffer);
    } else if (fileName.toLowerCase().endsWith('.xlsx')) {
      rawRows = parseXlsxBuffer(buffer);
    } else {
      throw new Error("Unsupported file format. Please upload a CSV or XLSX file.");
    }
  } catch (error: any) {
    return { rows: [], totalRows: 0, counts: emptyCounts(), parseErrors: [error.message || String(error)] };
  }

  const existingUsers = await storage.getAllUsers();
  const usersByCompanyNumber = new Map<string, User>();
  for (const u of existingUsers) {
    if (u.companyNumber) usersByCompanyNumber.set(u.companyNumber.trim(), u);
  }

  const rows: LifecycleImportRow[] = rawRows.map((raw, i) => {
    const rowNumber = i + 1;
    if (!raw.companyNumber) {
      return toRow(rowNumber, raw, null, 'skip', 'Missing employee ID - cannot match or create a user without one');
    }

    const matched = usersByCompanyNumber.get(raw.companyNumber) || null;
    const classification = classifyBusinessProcess(raw.businessProcessName);

    if (classification === 'leaver') {
      if (!matched) return toRow(rowNumber, raw, null, 'skip', 'No matching user found for this employee ID - nothing to archive');
      if (matched.isArchived) return toRow(rowNumber, raw, matched, 'skip', 'Already archived - no action needed');
      return toRow(rowNumber, raw, matched, 'leaver', `Will be archived (leaving date: ${raw.effectiveDate ? new Date(raw.effectiveDate).toLocaleDateString() : 'today'})`);
    }

    if (classification === 'starter') {
      if (!matched) return toRow(rowNumber, raw, null, 'starter', 'New employee - will be created');
      if (matched.isArchived) return toRow(rowNumber, raw, matched, 'reactivate', 'Employee ID matches a previously archived leaver - will be reactivated as a rehire');
      return toRow(rowNumber, raw, matched, 'skip', 'Employee ID already exists and is active - no action needed');
    }

    // mover
    if (!matched) return toRow(rowNumber, raw, null, 'skip', 'No matching user found for this employee ID - nothing to update');
    if (matched.isArchived) return toRow(rowNumber, raw, matched, 'skip', 'Matched user is currently archived - resolve as a rehire manually if needed');
    if (!raw.locationNew) return toRow(rowNumber, raw, matched, 'skip', 'No new location given on this row');
    return toRow(rowNumber, raw, matched, 'mover', `Will update location to "${raw.locationNew}"`);
  });

  const counts = emptyCounts();
  for (const r of rows) counts[r.suggestedAction]++;

  return { rows, totalRows: rows.length, counts, parseErrors };
}

function emptyCounts(): Record<LifecycleImportAction, number> {
  return { leaver: 0, starter: 0, mover: 0, reactivate: 0, skip: 0 };
}

function toRow(rowNumber: number, raw: RawLifecycleRow, matched: User | null, action: LifecycleImportAction, reason: string): LifecycleImportRow {
  return {
    rowNumber,
    companyNumber: raw.companyNumber,
    firstName: raw.firstName,
    lastName: raw.lastName,
    businessProcessName: raw.businessProcessName,
    locationNew: raw.locationNew,
    effectiveDate: raw.effectiveDate,
    hireDate: raw.hireDate,
    matchedUserId: matched?.id ?? null,
    matchedUserName: matched ? `${matched.firstName || ''} ${matched.lastName || ''}`.trim() || matched.email || null : null,
    matchedUserWasArchived: !!matched?.isArchived,
    suggestedAction: action,
    reason,
  };
}

export async function applyLifecycleImport(rows: LifecycleImportApplyRow[], storage: IStorage): Promise<LifecycleImportResult> {
  const result: LifecycleImportResult = { archived: 0, created: 0, moved: 0, reactivated: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      switch (row.action) {
        case 'skip':
          result.skipped++;
          break;

        case 'leaver': {
          if (!row.matchedUserId) throw new Error('No matched user to archive');
          await storage.updateUser(row.matchedUserId, {
            isArchived: true,
            leftAt: row.effectiveDate ? new Date(row.effectiveDate) : new Date(),
          });
          result.archived++;
          break;
        }

        case 'starter': {
          await storage.createUser({
            firstName: row.firstName,
            lastName: row.lastName,
            companyNumber: row.companyNumber,
            location: row.locationNew || undefined,
            startDate: row.hireDate ? new Date(row.hireDate) : (row.effectiveDate ? new Date(row.effectiveDate) : new Date()),
            role: 'candidate',
          });
          result.created++;
          break;
        }

        case 'mover': {
          if (!row.matchedUserId) throw new Error('No matched user to update');
          await storage.updateUser(row.matchedUserId, { location: row.locationNew || undefined });
          result.moved++;
          break;
        }

        case 'reactivate': {
          if (!row.matchedUserId) throw new Error('No matched user to reactivate');
          await storage.updateUser(row.matchedUserId, {
            isArchived: false,
            leftAt: null,
            location: row.locationNew || undefined,
            startDate: row.hireDate ? new Date(row.hireDate) : (row.effectiveDate ? new Date(row.effectiveDate) : undefined),
          });
          result.reactivated++;
          break;
        }
      }
    } catch (error: any) {
      result.errors.push({ rowNumber: row.rowNumber, error: error.message || String(error) });
    }
  }

  return result;
}
