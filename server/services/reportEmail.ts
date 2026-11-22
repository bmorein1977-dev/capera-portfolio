// The infographic as an email: key figures, the main charts as bars, what it shows and what to do first.
// Email programs cannot run scripts or load pictures reliably, so this is built from plain tables and inline styles only, 560 pixels wide to sit inside
// Capera's normal email frame. It carries counts and category names only (never a person's name or contact details), exactly like the on-screen infographic,
// so the email body is safe to sit in a mailbox; the names are in the Excel workbook, which is the person's own choice to have attached.
import { escapeHtml } from "../security";
import type { Infographic } from "./reportInfographic";

const TONE: Record<string, string> = { good: "#15803d", watch: "#d97706", risk: "#dc2626", info: "#1b2230" };
const SERIES = ["#b4532a", "#1b2230", "#4b6a88", "#c9a227", "#6b8e5a", "#8a5a83", "#2f7f79", "#a3a3a3", "#d98a62", "#52606d"];
const colour = (tone: string | undefined, i: number) => (tone && tone !== "info" ? TONE[tone] : SERIES[i % SERIES.length]);
const n = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-GB") : v.toLocaleString("en-GB", { maximumFractionDigits: 1 }));

function figures(f: Infographic["keyFigures"]): string {
  if (!f.length) return "";
  const rows: string[] = [];
  for (let i = 0; i < f.length; i += 3) {
    const cells = f.slice(i, i + 3).map(x => `<td width="33%" valign="top" style="padding:0 6px 8px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f4;border-left:4px solid ${TONE[x.tone] ?? TONE.info}"><tr><td style="padding:8px 10px"><div style="font-size:22px;font-weight:bold;line-height:26px;color:${x.tone === "info" ? "#1b2230" : TONE[x.tone]}">${escapeHtml(x.value)}</div><div style="font-size:12px;color:#1f2937">${escapeHtml(x.label)}</div>${x.detail ? `<div style="font-size:11px;color:#6b7280">${escapeHtml(x.detail)}</div>` : ""}</td></tr></table></td>`);
    while (cells.length < 3) cells.push(`<td width="33%"></td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 4px">${rows.join("")}</table>`;
}

function chart(c: Infographic["charts"][number]): string {
  const total = c.data.reduce((a, b) => a + b.value, 0), max = Math.max(1, ...c.data.map(d => d.value));
  const rows = c.data.slice(0, 8).map((d, i) => {
    const w = Math.max(2, Math.round((d.value / max) * 100));
    const share = c.kind === "donut" && total > 0 ? ` <span style="color:#6b7280">${Math.round((d.value / total) * 100)}%</span>` : "";
    return `<tr><td width="38%" style="padding:2px 8px 2px 0;font-size:12px;color:#374151">${escapeHtml(d.label)}</td><td width="48%" style="padding:2px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="${w}%" style="background:${colour(d.tone, i)};height:10px;line-height:10px;font-size:1px">&nbsp;</td><td></td></tr></table></td><td width="14%" align="right" style="padding:2px 0 2px 6px;font-size:12px;font-weight:bold;color:#1b2230">${n(d.value)}${share}</td></tr>`;
  }).join("");
  return `<div style="margin:14px 0 0"><div style="font-size:13px;font-weight:bold;color:#1b2230;margin-bottom:4px">${escapeHtml(c.title)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></div>`;
}

export function renderSummaryHtml(info: Infographic): string {
  const parts: string[] = [];
  parts.push(`<div style="border-bottom:3px solid #b4532a;padding-bottom:6px;margin-bottom:4px"><div style="font-size:11px;letter-spacing:1px;color:#b4532a;font-weight:bold">CAPERA REPORT</div>${info.subtitle ? `<div style="font-size:13px;color:#52606d;margin-top:2px">${escapeHtml(info.subtitle)}</div>` : ""}</div>`);
  parts.push(figures(info.keyFigures));
  for (const c of info.charts.slice(0, 4)) parts.push(chart(c));
  if (info.insights.length) {
    parts.push(`<div style="font-size:14px;font-weight:bold;color:#1b2230;margin:18px 0 6px">What this shows</div>` + info.insights.slice(0, 6).map(i =>
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px"><tr><td width="18" valign="top" style="color:${TONE[i.tone] ?? TONE.info};font-size:14px;line-height:18px">&#9679;</td><td style="font-size:13px;line-height:18px;color:#1f2937"><b>${escapeHtml(i.title)}</b><br>${escapeHtml(i.text)}</td></tr></table>`).join(""));
  }
  if (info.nextSteps.length) {
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr><td style="background:#1b2230;padding:12px 14px;color:#ffffff"><div style="font-size:14px;font-weight:bold;margin-bottom:4px">What to do first</div><ol style="margin:0;padding-left:18px;font-size:13px;line-height:19px;color:#ffffff">${info.nextSteps.slice(0, 5).map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ol></td></tr></table>`);
  }
  parts.push(`<p style="font-size:11px;line-height:15px;color:#6b7280;margin:12px 0 0">${escapeHtml(info.footnote)} Confidential: may relate to people in your organisation.</p>`);
  return parts.join("");
}
