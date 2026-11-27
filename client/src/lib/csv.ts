// A spreadsheet file made in the browser from rows already on screen.

/** a cell that a spreadsheet would read as a formula is stored as text instead */
export function csvCell(value: unknown): string {
  const s = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const toCsv = (headings: string[], rows: unknown[][]) => [headings, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

export function downloadCsv(fileName: string, headings: string[], rows: unknown[][]) {
  // the leading mark tells Excel the file is UTF-8, so that accented names open correctly
  const blob = new Blob(["﻿" + toCsv(headings, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
