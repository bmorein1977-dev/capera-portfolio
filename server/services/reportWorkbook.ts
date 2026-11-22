// The Excel workbook, written straight to the .xlsx format with JSZip (already part of Capera), so there is no spreadsheet library to carry.
// A front sheet (what this is, who for, when, what is inside), then one sheet per table with real Excel tables (banded rows, filter buttons), real dates and
// numbers, colour for status words, data bars on counts, frozen headings and print settings.
import JSZip from "jszip";
import type { Table } from "./reportData";

export interface WorkbookMeta { title: string; pagePath: string; preparedFor: string; role: string; generatedAt: Date; filters: string[] }

// ------------------------------------------------------------------------------------------------------------ small helpers
const esc = (s: unknown) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (n: number) => { let s = ""; for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const serial = (d: Date) => d.getTime() / 86400000 + 25569; // Excel counts days from 1900
const uniqueSheetName = (n: string, used: Set<string>) => {
  const base = n.replace(/[\\\/\?\*\[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "Sheet";
  let out = base, i = 2; while (used.has(out.toLowerCase())) out = `${base.slice(0, 26)} ${i++}`;
  used.add(out.toLowerCase()); return out;
};
const tableName = (n: string, i: number) => `T${i}_${n.replace(/[^A-Za-z0-9]/g, "").slice(0, 20)}`;

// words that mean bad, watch or good wherever they appear in a status column; bad first and stop at the first fit, so "Not ready" is never "ready"
const STATUS = [
  { dxf: 0, words: ["expired", "missing", "overdue", "no record", "not yet competent", "not ready", "not cleared", "failed", "rejected", "short", "declined", "revoked", "critical"] },
  { dxf: 1, words: ["expiring", "pending", "due soon", "in progress", "at risk", "waiting", "planned", "watch", "on leave"] },
  { dxf: 2, words: ["current", "competent", "ready", "verified", "completed", "approved", "met", "yes", "signed off", "active", "good"] },
];

// ------------------------------------------------------------------------------------------------------------ styles
// the index of each cell format below is used by name in the sheets
const S = { def: 0, title: 1, small: 2, link: 3, headDark: 4, label: 5, wrapTop: 6, date: 7, pct0: 8, int: 9, dec: 10, pct1: 11, pale: 12, note: 13, sub: 14, head2: 15, numLeft: 16, pctLeft: 17 };
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd\\ mmm\\ yyyy"/><numFmt numFmtId="165" formatCode="#,##0.0#"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts>
<fonts count="9">
<font><sz val="11"/><color rgb="FF1B2230"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="18"/><color rgb="FF1B2230"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="9"/><color rgb="FF6B7280"/><name val="Calibri"/><family val="2"/></font>
<font><u/><sz val="10"/><color rgb="FFB4532A"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF1B2230"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="9"/><color rgb="FF6B7280"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFB4532A"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="13"/><color rgb="FF1B2230"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1B2230"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4EFEA"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="18">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="3">
<dxf><font><b/><color rgb="FF7F1D1D"/></font><fill><patternFill><bgColor rgb="FFFBD5D5"/></patternFill></fill></dxf>
<dxf><font><b/><color rgb="FF7A4B00"/></font><fill><patternFill><bgColor rgb="FFFFF1CC"/></patternFill></fill></dxf>
<dxf><font><b/><color rgb="FF14532D"/></font><fill><patternFill><bgColor rgb="FFD9F2E3"/></patternFill></fill></dxf>
</dxfs>
<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

// ------------------------------------------------------------------------------------------------------------ strings and cells
class Strings {
  private map = new Map<string, number>(); list: string[] = []; count = 0;
  id(s: string) { this.count++; let i = this.map.get(s); if (i === undefined) { i = this.list.length; this.list.push(s); this.map.set(s, i); } return i; }
  xml() { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.count}" uniqueCount="${this.list.length}">${this.list.map(s => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`; }
}
type Cell = { r: number; c: number; v: string | number | Date | null; s?: number };

function sheetCells(sst: Strings, cells: Cell[]): string {
  const rows = new Map<number, Cell[]>();
  for (const c of cells) { if (!rows.has(c.r)) rows.set(c.r, []); rows.get(c.r)!.push(c); }
  return Array.from(rows.keys()).sort((a, b) => a - b).map(r => {
    const cs = rows.get(r)!.sort((a, b) => a.c - b.c).map(c => {
      const ref = `${colName(c.c)}${r}`, st = c.s ? ` s="${c.s}"` : "";
      if (c.v === null || c.v === undefined || c.v === "") return c.s ? `<c r="${ref}"${st}/>` : "";
      if (c.v instanceof Date) return `<c r="${ref}"${st}><v>${serial(c.v)}</v></c>`;
      if (typeof c.v === "number") return Number.isFinite(c.v) ? `<c r="${ref}"${st}><v>${c.v}</v></c>` : "";
      return `<c r="${ref}"${st} t="s"><v>${sst.id(c.v)}</v></c>`; // text is always stored as text, so a cell that starts with = is shown as typed and never run
    }).join("");
    return `<row r="${r}">${cs}</row>`;
  }).join("");
}

const toCell = (type: string, v: any): { v: string | number | Date | null; s?: number } => {
  if (v === null || v === undefined || v === "") return { v: null };
  if (type === "date") { const d = new Date(v); return Number.isNaN(d.getTime()) ? { v: String(v) } : { v: d, s: S.date }; }
  if (type === "percent") return typeof v === "number" ? { v: v / 100, s: S.pct0 } : { v: null };
  if (type === "boolean") return { v: v ? "Yes" : "No" };
  if (type === "number") { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? { v: n, s: Number.isInteger(n) ? S.int : S.dec } : { v: String(v) }; }
  if (typeof v === "object") return { v: JSON.stringify(v).slice(0, 400) };
  return { v: String(v) };
};

const NS = `xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;

// ------------------------------------------------------------------------------------------------------------ the workbook
export async function buildWorkbook(tables: Table[], meta: WorkbookMeta): Promise<Buffer> {
  const sst = new Strings();
  const used = new Set<string>(["report"]);
  const sheets = tables.map(t => { const tail = t.name.includes(": ") ? t.name.split(": ").pop()! : t.name; return { t, name: uniqueSheetName(used.has(tail.toLowerCase().slice(0, 28)) ? t.name : tail, used) }; });
  const sheetXml: string[] = []; const tableXml: string[] = [];

  // ------------------------------------------------ the front sheet (sheet 1)
  {
    const cells: Cell[] = []; const merges: string[] = []; const links: string[] = []; const heights = new Map<number, number>();
    cells.push({ r: 2, c: 2, v: meta.title, s: S.title }, { r: 3, c: 2, v: "Capera report", s: S.sub });
    const facts: Array<[string, string]> = [
      ["Prepared for", `${meta.preparedFor} (${meta.role})`], ["Prepared on", meta.generatedAt.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })],
      ["Page", meta.pagePath], ["Filters in force", meta.filters.length ? meta.filters.join("; ") : "None"],
      ["Data", "Live from Capera at the moment of export. Filters you apply on screen after a page has loaded are not part of this workbook; filters that change what the server returns are."],
    ];
    facts.forEach(([k, v], i) => { const r = 5 + i; cells.push({ r, c: 2, v: k, s: S.label }, { r, c: 3, v, s: S.wrapTop }); merges.push(`C${r}:D${r}`); if (v.length > 90) heights.set(r, 44); });
    let r = 5 + facts.length + 1;
    cells.push({ r, c: 2, v: "What is in this workbook", s: S.head2 }); r++;
    cells.push({ r, c: 2, v: "Sheet", s: S.headDark }, { r, c: 3, v: "Rows", s: S.headDark }, { r, c: 4, v: "Source", s: S.headDark }); r++;
    sheets.forEach(({ t, name }) => {
      cells.push({ r, c: 2, v: t.kind === "reference" ? `${name} (reference)` : name, s: S.link }, { r, c: 3, v: t.rows.length, s: S.numLeft }, { r, c: 4, v: t.source.split("?")[0], s: S.small });
      links.push(`<hyperlink ref="B${r}" location="'${name.replace(/'/g, "''")}'!A1" display="${esc(name)}"/>`);
      r++;
    });
    const figs = sheets.find(s => s.t.kind === "figures");
    if (figs) {
      r += 1; cells.push({ r, c: 2, v: "Key figures", s: S.head2 }); r++;
      for (const row of figs.t.rows.slice(0, 14)) {
        const isPct = typeof row.value === "number" && /percent|percentage|coverage|rate/i.test(String(row.measure)) && row.value >= 0 && row.value <= 100;
        cells.push({ r, c: 2, v: String(row.measure), s: S.wrapTop });
        cells.push(isPct ? { r, c: 3, v: row.value / 100, s: S.pctLeft } : typeof row.value === "number" ? { r, c: 3, v: row.value, s: S.numLeft } : { r, c: 3, v: String(row.value), s: S.wrapTop });
        if (String(row.measure).length > 34) heights.set(r, 30);
        r++;
      }
    }
    r += 1;
    cells.push({ r, c: 2, v: "Confidential. This workbook may contain personal data about people. Keep it within your organisation and handle it under your data protection policy. Capera records who exported it and when.", s: S.note });
    merges.push(`B${r}:D${r}`); heights.set(r, 40);
    const rowsXml = sheetCells(sst, cells).replace(/<row r="(\d+)">/g, (_m, n) => (heights.has(+n) ? `<row r="${n}" ht="${heights.get(+n)}" customHeight="1">` : `<row r="${n}">`));
    sheetXml.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ${NS}><sheetPr><tabColor rgb="FFB4532A"/><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0" tabSelected="1"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="3" customWidth="1"/><col min="2" max="2" width="36" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="4" width="72" customWidth="1"/></cols><sheetData>${rowsXml}</sheetData><mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>${links.length ? `<hyperlinks>${links.join("")}</hyperlinks>` : ""}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToHeight="0"/><headerFooter><oddFooter>&amp;LCapera, confidential&amp;RPrepared &amp;D</oddFooter></headerFooter></worksheet>`);
  }

  // ------------------------------------------------ one sheet per table
  sheets.forEach(({ t, name }, idx) => {
    const cells: Cell[] = [];
    cells.push({ r: 1, c: 1, v: t.name, s: S.title });
    cells.push({ r: 2, c: 1, v: "Back to the report sheet", s: S.link });
    cells.push({ r: 2, c: 3, v: `${t.rows.length.toLocaleString("en-GB")} row${t.rows.length === 1 ? "" : "s"}${t.truncated ? " (the first 50,000 are shown)" : ""}. ${meta.title}, prepared ${meta.generatedAt.toLocaleString("en-GB")}.`, s: S.small });
    // headings must be unique and not empty for an Excel table
    const heads: string[] = []; t.columns.forEach((c, i) => { let h = (c.label || `Column ${i + 1}`).replace(/[\r\n]+/g, " ").slice(0, 120); const base = h; let n = 2; while (heads.includes(h)) h = `${base} (${n++})`; heads.push(h); });
    // rows of facts about each column (job role, location...) sit above the heading row; the table itself starts at the heading row
    const above = t.above ?? [];
    const HR = 4 + above.length;
    above.forEach((a, ai) => a.cells.forEach((v, ci) => { if (v === null || v === undefined || v === "") return; const x = a.percent && ci > 0 ? toCell("percent", v) : { v: String(v), s: ci === 0 ? S.label : undefined }; cells.push({ r: 4 + ai, c: ci + 1, v: x.v, s: x.s }); }));
    heads.forEach((h, i) => cells.push({ r: HR, c: i + 1, v: h }));
    const body = t.rows.length ? t.rows : [{} as Record<string, any>];
    body.forEach((row, ri) => t.columns.forEach((c, ci) => { const x = toCell(c.type, row[c.key]); cells.push({ r: HR + 1 + ri, c: ci + 1, v: x.v, s: x.s }); }));
    const last = HR + body.length, lastCol = colName(t.columns.length);
    const cols = t.columns.map((c, i) => {
      const longest = Math.max(heads[i].length, ...above.map(a => String(a.cells[i] ?? "").length), ...t.rows.slice(0, 400).map(r => String(r[c.key] ?? "").length));
      return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(11, Math.ceil(longest * 1.1) + 3))}" customWidth="1"/>`;
    }).join("");
    // colour for status words, and data bars on counts
    let cf = ""; let priority = 1;
    t.columns.forEach((c, i) => {
      const L = colName(i + 1), range = `${L}${HR + 1}:${L}${last}`;
      if (t.colourFrom !== undefined) return; // a grid is coloured as one block below
      if (c.type === "text" && t.rows.length) {
        const vals = t.rows.slice(0, 600).map(r => String(r[c.key] ?? "").toLowerCase()).filter(Boolean); const distinct = Array.from(new Set(vals));
        const hits = distinct.filter(v => STATUS.some(g => g.words.some(w => v === w || v.includes(w))));
        if (distinct.length > 0 && distinct.length <= 14 && hits.length >= Math.max(1, Math.ceil(distinct.length / 2))) {
          cf += `<conditionalFormatting sqref="${range}">${STATUS.flatMap(g => g.words.map(w => `<cfRule type="containsText" dxfId="${g.dxf}" priority="${priority++}" stopIfTrue="1" operator="containsText" text="${esc(w)}"><formula>NOT(ISERROR(SEARCH("${esc(w)}",${L}${HR + 1})))</formula></cfRule>`)).join("")}</conditionalFormatting>`;
        }
      }
      if ((c.type === "number" || c.type === "percent") && t.rows.length >= 3 && /(count|total|score|percent|coverage|current|expired|missing|expiring|required|booked)/i.test(heads[i])) {
        cf += `<conditionalFormatting sqref="${range}"><cfRule type="dataBar" priority="${priority++}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FFE9B8A0"/></dataBar></cfRule></conditionalFormatting>`;
      }
    });
    if (t.colourFrom !== undefined && t.rows.length && t.colourFrom <= t.columns.length) {
      const L = colName(t.colourFrom), range = `${L}${HR + 1}:${lastCol}${last}`;
      cf += `<conditionalFormatting sqref="${range}">${STATUS.flatMap(g => g.words.map(w => `<cfRule type="containsText" dxfId="${g.dxf}" priority="${priority++}" stopIfTrue="1" operator="containsText" text="${esc(w)}"><formula>NOT(ISERROR(SEARCH("${esc(w)}",${L}${HR + 1})))</formula></cfRule>`)).join("")}</conditionalFormatting>`;
    }
    const tn = tableName(name, idx + 1);
    tableXml.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${idx + 1}" name="${tn}" displayName="${tn}" ref="A${HR}:${lastCol}${last}" totalsRowShown="0"><autoFilter ref="A${HR}:${lastCol}${last}"/><tableColumns count="${heads.length}">${heads.map((h, i) => `<tableColumn id="${i + 1}" name="${esc(h)}"/>`).join("")}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`);
    const tab = t.kind === "reference" ? "FF9CA3AF" : t.kind === "figures" ? "FFB4532A" : "FF1B2230";
    sheetXml.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ${NS}><sheetPr><tabColor rgb="${tab}"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastCol}${last}"/><sheetViews><sheetView workbookViewId="0">${t.freezeCols ? `<pane xSplit="${t.freezeCols}" ySplit="${HR}" topLeftCell="${colName(t.freezeCols + 1)}${HR + 1}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="${colName(t.freezeCols + 1)}${HR + 1}" sqref="${colName(t.freezeCols + 1)}${HR + 1}"/>` : `<pane ySplit="${HR}" topLeftCell="A${HR + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${HR + 1}" sqref="A${HR + 1}"/>`}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${sheetCells(sst, cells)}</sheetData>${cf}<hyperlinks><hyperlink ref="A2" location="'Report'!A1" display="Back to the report sheet"/></hyperlinks><pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/><headerFooter><oddHeader>&amp;L&amp;B${esc(t.name)}&amp;R${esc(meta.title)}</oddHeader><oddFooter>&amp;LCapera, confidential&amp;CPage &amp;P of &amp;N&amp;R&amp;D</oddFooter></headerFooter><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`);
  });

  // ------------------------------------------------ package it
  const zip = new JSZip();
  const n = sheetXml.length;
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetXml.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}${tableXml.map((_, i) => `<Override PartName="/xl/tables/table${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.title)}</dc:title><dc:creator>Capera</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${meta.generatedAt.toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${meta.generatedAt.toISOString()}</dcterms:modified></cp:coreProperties>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Capera</Application></Properties>`);
  const names = ["Report", ...sheets.map(s => s.name)];
  const titleRows = sheets.map((_, i) => `<definedName name="_xlnm.Print_Titles" localSheetId="${i + 1}">'${names[i + 1].replace(/'/g, "''")}'!$${4 + (sheets[i].t.above?.length ?? 0)}:$${4 + (sheets[i].t.above?.length ?? 0)}</definedName>`).join("");
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook ${NS}><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000" activeTab="0"/></bookViews><sheets>${names.map((nm, i) => `<sheet name="${esc(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${titleRows ? `<definedNames>${titleRows}</definedNames>` : ""}</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetXml.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  sheetXml.forEach((x, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, x));
  tableXml.forEach((x, i) => {
    zip.file(`xl/tables/table${i + 1}.xml`, x);
    zip.file(`xl/worksheets/_rels/sheet${i + 2}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${i + 1}.xml"/></Relationships>`);
  });
  zip.file("xl/styles.xml", STYLES);
  zip.file("xl/sharedStrings.xml", sst.xml());
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
