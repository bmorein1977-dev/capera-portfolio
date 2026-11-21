// The Excel workbook: a front sheet (what this is, who for, when, what is inside), then one properly built sheet per table with real Excel
// tables (banded rows, filter buttons), real dates and numbers, colour for status words, data bars on counts, frozen headings and print settings.
import ExcelJS from "exceljs";
import type { Table } from "./reportData";

export interface WorkbookMeta { title: string; pagePath: string; preparedFor: string; role: string; generatedAt: Date; filters: string[] }

const INK = "FF1B2230", COPPER = "FFB4532A", PALE = "FFF4EFEA";
const GOOD = { fg: "FFD9F2E3", font: "FF14532D" }, WATCH = { fg: "FFFFF1CC", font: "FF7A4B00" }, BAD = { fg: "FFFBD5D5", font: "FF7F1D1D" };
// words that mean good, watch or bad wherever they appear in a status column
const STATUS_WORDS: Array<{ words: string[]; style: { fg: string; font: string } }> = [
  { words: ["expired", "missing", "overdue", "not yet competent", "not ready", "not cleared", "failed", "rejected", "short", "declined", "revoked", "critical"], style: BAD },
  { words: ["expiring", "pending", "due soon", "in progress", "at risk", "waiting", "planned", "watch", "on leave"], style: WATCH },
  { words: ["current", "competent", "ready", "verified", "completed", "approved", "met", "yes", "signed off", "active", "good"], style: GOOD },
];

const safeSheetName = (n: string, used: Set<string>) => {
  let s = n.replace(/[\\\/\?\*\[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "Sheet";
  let out = s, i = 2; while (used.has(out.toLowerCase())) out = `${s.slice(0, 26)} ${i++}`;
  used.add(out.toLowerCase()); return out;
};
const tableName = (n: string, i: number) => `T${i}_${n.replace(/[^A-Za-z0-9]/g, "").slice(0, 20)}`;

function cellValue(type: string, v: any) {
  if (v === null || v === undefined || v === "") return null;
  if (type === "date") { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d; }
  if (type === "percent") return typeof v === "number" ? v / 100 : null;
  if (type === "boolean") return v ? "Yes" : "No";
  if (type === "number") return typeof v === "number" ? v : Number(v);
  if (typeof v === "object") return JSON.stringify(v).slice(0, 400);
  // a string is stored as text in the file, never as a formula, so a cell that starts with = is shown as typed
  return String(v);
}

export async function buildWorkbook(tables: Table[], meta: WorkbookMeta): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Capera"; wb.lastModifiedBy = "Capera"; wb.created = meta.generatedAt; wb.modified = meta.generatedAt; wb.title = meta.title;
  const used = new Set<string>(["report"]);
  const front = wb.addWorksheet("Report", { properties: { tabColor: { argb: COPPER } }, views: [{ showGridLines: false }] });
  const sheets: Array<{ t: Table; name: string }> = tables.map(t => { const tail = t.name.includes(": ") ? t.name.split(": ").pop()! : t.name; return { t, name: safeSheetName(used.has(tail.toLowerCase().slice(0, 28)) ? t.name : tail, used) }; });

  // ---------------------------------------------------------------- the data sheets
  sheets.forEach(({ t, name }, idx) => {
    const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: t.kind === "reference" ? "FF9CA3AF" : t.kind === "figures" ? COPPER : INK } }, views: [{ state: "frozen", ySplit: 4 }] });
    ws.getCell("A1").value = t.name; ws.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: INK } };
    ws.getCell("A2").value = { text: "Back to the report sheet", hyperlink: "#'Report'!A1" }; ws.getCell("A2").font = { size: 9, underline: true, color: { argb: COPPER } };
    ws.getCell("C2").value = `${t.rows.length.toLocaleString("en-GB")} row${t.rows.length === 1 ? "" : "s"}${t.truncated ? " (the first 50,000 are shown)" : ""}. ${meta.title}, prepared ${meta.generatedAt.toLocaleString("en-GB")}.`;
    ws.getCell("C2").font = { size: 9, color: { argb: "FF6B7280" } };
    const rows = t.rows.map(r => t.columns.map(c => cellValue(c.type, r[c.key])));
    const safeRows = rows.length ? rows : [t.columns.map(() => null)];
    ws.addTable({
      name: tableName(name, idx + 1), ref: "A4", headerRow: true, totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: t.columns.map(c => ({ name: c.label, filterButton: true })), rows: safeRows as any,
    });
    // formats and widths
    t.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      const longest = Math.max(c.label.length, ...t.rows.slice(0, 400).map(r => String(r[c.key] ?? "").length));
      col.width = Math.min(60, Math.max(11, Math.ceil(longest * 1.1) + 2));
      if (c.type === "date") col.numFmt = "dd mmm yyyy";
      else if (c.type === "percent") col.numFmt = "0%";
      else if (c.type === "number") col.numFmt = Number.isInteger(t.rows[0]?.[c.key]) ? "#,##0" : "#,##0.0#";
      if (c.type === "text" && longest > 50) col.alignment = { wrapText: true, vertical: "top" };
    });
    const last = 4 + safeRows.length;
    // colour the status words
    t.columns.forEach((c, i) => {
      if (c.type !== "text" || !t.rows.length) return;
      const vals = t.rows.slice(0, 600).map(r => String(r[c.key] ?? "").toLowerCase()).filter(Boolean);
      const distinct = new Set(vals);
      if (distinct.size > 14) return;
      const hits = Array.from(distinct).filter(v => STATUS_WORDS.some(g => g.words.some(w => v === w || v.includes(w))));
      if (hits.length < Math.max(1, Math.ceil(distinct.size / 2))) return;
      const ref = `${ws.getColumn(i + 1).letter}5:${ws.getColumn(i + 1).letter}${last}`;
      ws.addConditionalFormatting({
        ref, rules: STATUS_WORDS.flatMap((g, gi) => g.words.map((w, wi) => ({
          type: "containsText" as const, operator: "containsText" as const, text: w, priority: gi * 20 + wi + 1, stopIfTrue: true,
          style: { fill: { type: "pattern" as const, pattern: "solid" as const, bgColor: { argb: g.style.fg } }, font: { color: { argb: g.style.font }, bold: true } },
        }))),
      });
    });
    // data bars on counts and percentages
    t.columns.forEach((c, i) => {
      if ((c.type !== "number" && c.type !== "percent") || t.rows.length < 3 || !/(count|total|score|percent|coverage|current|expired|missing|expiring|required|booked)/i.test(c.label)) return;
      const letter = ws.getColumn(i + 1).letter;
      ws.addConditionalFormatting({ ref: `${letter}5:${letter}${last}`, rules: [{ type: "dataBar", priority: 900 + i, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: "FFE9B8A0" } } as any] });
    });
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: "4:4", margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter = { oddHeader: `&L&B${t.name}&R${meta.title}`, oddFooter: "&LCapera, confidential&CPage &P of &N&R&D" };
  });

  // ---------------------------------------------------------------- the front sheet
  front.columns = [{ width: 3 }, { width: 34 }, { width: 16 }, { width: 70 }];
  front.getCell("B2").value = meta.title; front.getCell("B2").font = { name: "Calibri", size: 22, bold: true, color: { argb: INK } };
  front.getCell("B3").value = "Capera report"; front.getCell("B3").font = { size: 11, color: { argb: COPPER }, bold: true };
  const facts: Array<[string, string]> = [
    ["Prepared for", `${meta.preparedFor} (${meta.role})`], ["Prepared on", meta.generatedAt.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })],
    ["Page", meta.pagePath], ["Filters in force", meta.filters.length ? meta.filters.join("; ") : "None"],
    ["Data", "Live from Capera at the moment of export. Filters you apply on screen after a page has loaded are not part of this workbook; filters that change what the server returns are."],
  ];
  facts.forEach(([k, v], i) => {
    const r = 5 + i; front.getCell(`B${r}`).value = k; front.getCell(`B${r}`).font = { bold: true, color: { argb: INK } }; front.getCell(`B${r}`).alignment = { vertical: "top" };
    front.mergeCells(`C${r}:D${r}`); front.getCell(`C${r}`).value = v; front.getCell(`C${r}`).alignment = { wrapText: true, vertical: "top" };
    front.getRow(r).height = v.length > 90 ? 44 : 20;
  });
  let r = 5 + facts.length + 1;
  front.getCell(`B${r}`).value = "What is in this workbook"; front.getCell(`B${r}`).font = { size: 13, bold: true, color: { argb: INK } }; r++;
  ["Sheet", "Rows", "Source"].forEach((h, i) => { const c = front.getCell(r, 2 + i); c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } }; }); r++;
  sheets.forEach(({ t, name }) => {
    front.getCell(r, 2).value = { text: t.kind === "reference" ? `${name} (reference)` : name, hyperlink: `#'${name}'!A1` }; front.getCell(r, 2).font = { color: { argb: COPPER }, underline: true };
    front.getCell(r, 3).value = t.rows.length; front.getCell(r, 3).numFmt = "#,##0"; front.getCell(r, 3).alignment = { horizontal: "left" };
    front.getCell(r, 4).value = t.source.split("?")[0]; front.getCell(r, 4).font = { color: { argb: "FF6B7280" }, size: 9 };
    if (sheets.indexOf(sheets.find(s => s.t === t)!) % 2) for (let c = 2; c <= 4; c++) front.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALE } };
    r++;
  });
  // headline figures, when the page has a figures table
  const figs = sheets.find(s => s.t.kind === "figures");
  if (figs) {
    r += 1; front.getCell(`B${r}`).value = "Key figures"; front.getCell(`B${r}`).font = { size: 13, bold: true, color: { argb: INK } }; r++;
    for (const row of figs.t.rows.slice(0, 14)) { const isPct = typeof row.value === "number" && /percent|percentage|coverage|rate/i.test(String(row.measure)) && row.value >= 0 && row.value <= 100; front.getCell(r, 2).value = String(row.measure); front.getCell(r, 2).alignment = { wrapText: true, vertical: "top" }; front.getCell(r, 3).value = isPct ? row.value / 100 : typeof row.value === "number" ? row.value : String(row.value); if (isPct) front.getCell(r, 3).numFmt = "0.0%"; front.getCell(r, 3).alignment = { horizontal: "left", vertical: "top" }; if (String(row.measure).length > 34) front.getRow(r).height = 30; r++; }
  }
  r += 1;
  front.mergeCells(`B${r}:D${r}`);
  front.getCell(`B${r}`).value = "Confidential. This workbook may contain personal data about people. Keep it within your organisation and handle it under your data protection policy. Capera records who exported it and when.";
  front.getCell(`B${r}`).alignment = { wrapText: true, vertical: "top" }; front.getCell(`B${r}`).font = { size: 9, italic: true, color: { argb: "FF6B7280" } }; front.getRow(r).height = 40;
  front.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  front.headerFooter = { oddFooter: "&LCapera, confidential&RPrepared &D" };
  return wb;
}
