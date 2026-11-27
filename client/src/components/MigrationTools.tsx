import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Download } from "lucide-react";

const COLUMNS = ["File", "Email", "Competence Category", "Competence Element", "Title", "Evidence Type", "Description", "Original Date", "Fingerprint (SHA-256)", "Source Reference"];
const EXAMPLE = ["files/joe-bloggs-simops.pdf", "joe.bloggs@example.com", "HSE", "SIMOPS", "SIMOPS observation record", "Observation record", "Observed on a live permit", "2023-06-15", "", "OLD-12345"];

const FileChoice = ({ label, accept, file, onChange, testId }: { label: string; accept: string; file: File | null; onChange: (f: File | null) => void; testId: string }) => (
  <label className="flex flex-wrap items-center gap-2 text-sm">
    <span className="font-medium">{label}</span>
    <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] ?? null)} data-testid={testId} className="text-sm file:mr-2 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5" />
    {file && <span className="text-muted-foreground">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span>}
  </label>
);

/** a workbook made in the browser: cells are stored as text, so nothing in the data can run as a formula */
async function saveWorkbook(fileName: string, sheets: Array<{ name: string; rows: Record<string, unknown>[]; headings: string[] }>) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const s of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet([s.headings, ...s.rows.map((r) => s.headings.map((h) => String(r[h] ?? "")))]);
    sheet["!cols"] = s.headings.map((h) => ({ wch: Math.min(60, Math.max(14, h.length + 2)) }));
    XLSX.utils.book_append_sheet(book, sheet, s.name);
  }
  XLSX.writeFile(book, fileName);
}

export default function MigrationTools() {
  const { toast } = useToast();
  const failed = (title: string, e: any) => toast({ title, description: e.message, variant: "destructive" });

  // ------------------------------------------------------------ evidence files
  const [batch, setBatch] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState<"" | "check" | "load">("");
  const send = async (dryRun: boolean) => {
    if (!batch) return;
    if (!dryRun && !confirm(`Load ${result?.toLoad ?? ""} evidence files into Capera?`)) return;
    setBusy(dryRun ? "check" : "load");
    try {
      const form = new FormData();
      form.append("dryRun", String(dryRun));
      form.append("batch", batch);
      setResult(await api("POST", "/api/admin/migration/evidence", form));
    } catch (e: any) { failed(dryRun ? "The batch could not be checked" : "The batch could not be loaded", e); } finally { setBusy(""); }
  };
  const saveResult = () => saveWorkbook("Capera evidence load report.xlsx", [{
    name: "Rows", headings: ["Row", "File", "Email", "Standard", "Source reference", "Result", "Problems", "Notes", "Size (bytes)", "Fingerprint (SHA-256)"],
    rows: result.detail.map((d: any) => ({ Row: d.row, File: d.file, Email: d.email, Standard: d.standard, "Source reference": d.sourceRef, Result: result.dryRun ? `would ${d.action}` : d.action, Problems: d.problems.join(" "), Notes: d.warnings.join(" "), "Size (bytes)": d.size, "Fingerprint (SHA-256)": d.fingerprint })),
  }, { name: "Files not listed", headings: ["File"], rows: result.unlistedFiles.map((f: string) => ({ File: f })) }]);

  // ------------------------------------------------------------ reconciliation
  const [records, setRecords] = useState<File | null>(null);
  const [evidence, setEvidence] = useState<File | null>(null);
  const [report, setReport] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const run = async () => {
    if (!records) return;
    setRunning(true);
    setReport(null);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await records.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
      if (!rows.length) throw new Error("The records spreadsheet has no rows");
      const form = new FormData();
      form.append("records", JSON.stringify(rows));
      if (evidence) form.append("batch", evidence);
      setReport(await api("POST", "/api/admin/migration/reconcile", form));
    } catch (e: any) { failed("The report could not be made", e); } finally { setRunning(false); }
  };
  const yes = (v: boolean) => (v ? "Yes" : "No");
  const verdict = (a: any) => (!a.passed ? "Not passed" : a.unexplained ? `Passed, with ${a.unexplained} still to settle` : "Passed");
  const saveReport = () => saveWorkbook(`Capera reconciliation ${report.generatedAt.slice(0, 10)}.xlsx`, [
    { name: "Summary", headings: ["Measure", "Old system", "Matched", "Explained differences", "Unexplained differences"], rows: [
      ...report.totals.map((t: any) => ({ Measure: t.measure, "Old system": t.oldSystem, Matched: t.matched, "Explained differences": t.explained, "Unexplained differences": t.unexplained })),
      { Measure: "" }, { Measure: "Result", "Old system": verdict(report.acceptance) },
      { Measure: "Items in the extract that are missing from Capera", "Old system": report.acceptance.missingFromCapera },
      { Measure: "People and standards with an unexplained safety-critical difference", "Old system": report.acceptance.unexplainedSafetyCritical },
      { Measure: "Records shown as imported but not in the extract", "Old system": report.acceptance.importedButNotInExtract },
      { Measure: "Rows that could not be compared", "Old system": report.acceptance.rowsNotCompared },
      { Measure: "Report made", "Old system": new Date(report.generatedAt).toLocaleString("en-GB") },
      { Measure: "Signed off by (data owner)" }, { Measure: "Signed off by (standards owner)" }, { Measure: "Date" },
    ] },
    { name: "Differences", headings: ["Explained", "Safety critical", "Type", "Row", "Source reference", "Person", "Email", "Item", "Old system", "Capera", "Why"],
      rows: report.differences.map((d: any) => ({ Explained: yes(d.explained), "Safety critical": yes(d.safetyCritical), Type: d.kind, Row: d.row ?? "", "Source reference": d.sourceRef, Person: d.person, Email: d.email, Item: d.item, "Old system": d.oldSystem, Capera: d.capera, Why: d.explanation })) },
    { name: "Status comparison", headings: ["Agrees", "Safety critical", "Person", "Email", "Standard", "Old system", "How known", "Capera", "Capera expiry", "Why they differ"],
      rows: report.statuses.map((s: any) => ({ Agrees: yes(s.agrees), "Safety critical": yes(s.safetyCritical), Person: s.person, Email: s.email, Standard: s.standard, "Old system": s.oldSystem, "How known": s.oldSystemBasis, Capera: s.capera, "Capera expiry": s.caperaExpiry, "Why they differ": s.explanation })) },
    { name: "Sample to trace", headings: ["Row", "Source reference", "Person", "Item", "Detail", "Traced to source (yes/no)", "Checked by"],
      rows: report.sample.map((s: any) => ({ Row: s.row, "Source reference": s.sourceRef, Person: s.person, Item: s.item, Detail: s.detail })) },
  ]);

  return (
    <div className="mt-6 grid gap-6">
      <Card data-testid="card-evidence-batch">
        <CardHeader>
          <CardTitle>Load evidence files in bulk</CardTitle>
          <CardDescription>
            For moving evidence from a previous system. Load the people and their records first. Put the files in a zip with a list named manifest.xlsx or manifest.csv saying whose each file is and which standard it supports. Up to 100 MB and 2,000 rows a batch, 10 MB a file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="gap-2" onClick={() => saveWorkbook("manifest.xlsx", [{ name: "Files", headings: COLUMNS, rows: [Object.fromEntries(COLUMNS.map((c, i) => [c, EXAMPLE[i]]))] }])} data-testid="button-manifest-template">
            <Download className="h-4 w-4" />Download the list template
          </Button>
          <div><FileChoice label="Zip file" accept=".zip" file={batch} onChange={(f) => { setBatch(f); setResult(null); }} testId="input-evidence-batch" /></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!batch || !!busy} onClick={() => send(true)} data-testid="button-check-batch">{busy === "check" ? "Checking..." : "Check the batch (changes nothing)"}</Button>
            <Button disabled={!batch || !!busy || !result || !result.dryRun || !result.toLoad} onClick={() => send(false)} data-testid="button-load-batch">{busy === "load" ? "Loading..." : "Load the files"}</Button>
          </div>
          {result && (
            <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="panel-batch-result">
              <p className="font-medium">
                {result.dryRun ? `Checked ${result.rows} rows: ${result.toLoad} ready to load` : `Loaded ${result.loaded} of ${result.rows} rows`}, {result.alreadyThere} already there, {result.withProblems} with problems.{result.dryRun ? " Nothing has been changed." : ""}
              </p>
              {result.unlistedFiles.length > 0 && <p className="text-muted-foreground">{result.unlistedFiles.length} file(s) in the zip are not in the list and are not loaded.</p>}
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {result.detail.filter((d: any) => d.problems.length || d.warnings.length).map((d: any) => (
                  <li key={d.row}><span className="font-medium">Row {d.row} {d.file}:</span> <span className="text-destructive">{d.problems.join(" ")}</span> <span className="text-muted-foreground">{d.warnings.join(" ")}</span></li>
                ))}
              </ul>
              <Button size="sm" variant="outline" onClick={saveResult} data-testid="button-save-batch-report">Save this report</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-reconciliation">
        <CardHeader>
          <CardTitle>Reconciliation report</CardTitle>
          <CardDescription>
            Compares the old system's records with what Capera holds now: people, results, training, evidence files and where each person stands. Use the records template with the complete extract: any record shown as imported that it leaves out is reported. It changes nothing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><FileChoice label="Records spreadsheet" accept=".xlsx,.xls,.csv" file={records} onChange={(f) => { setRecords(f); setReport(null); }} testId="input-reconcile-records" /></div>
          <div><FileChoice label="Evidence zip (optional)" accept=".zip" file={evidence} onChange={(f) => { setEvidence(f); setReport(null); }} testId="input-reconcile-evidence" /></div>
          <Button disabled={!records || running} onClick={run} data-testid="button-run-reconciliation">{running ? "Comparing..." : "Run the report"}</Button>
          {report && (
            <div className="space-y-3 rounded-md border p-3 text-sm" data-testid="panel-reconciliation">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <Badge className={!report.acceptance.passed ? "bg-red-700 hover:bg-red-700" : report.acceptance.unexplained ? "bg-amber-700 hover:bg-amber-700" : "bg-green-700 hover:bg-green-700"} data-testid="badge-reconciliation-result">{verdict(report.acceptance)}</Badge>
                {report.acceptance.unexplainedSafetyCritical} unexplained safety-critical, {report.acceptance.missingFromCapera} missing from Capera, {report.acceptance.unexplained} unexplained in all, {report.acceptance.importedButNotInExtract} imported records not in the extract, {report.acceptance.rowsNotCompared} rows not compared.
              </p>
              <p className="text-muted-foreground">It passes when no safety-critical difference is unexplained, nothing in the extract is missing from Capera, no record shown as imported is left out of the extract, and every row could be compared. Other unexplained differences still need settling.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="border-b"><th className="py-1 pr-3">Measure</th><th className="pr-3">Old system</th><th className="pr-3">Matched</th><th className="pr-3">Explained</th><th>Unexplained</th></tr></thead>
                  <tbody>{report.totals.map((t: any) => <tr key={t.measure} className="border-b last:border-0"><td className="py-1 pr-3">{t.measure}</td><td className="pr-3">{t.oldSystem}</td><td className="pr-3">{t.matched}</td><td className="pr-3">{t.explained}</td><td className={t.unexplained ? "font-medium text-destructive" : ""}>{t.unexplained}</td></tr>)}</tbody>
                </table>
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {report.differences.slice(0, 100).map((d: any, i: number) => (
                  <li key={i}><span className={d.explained ? "text-muted-foreground" : "font-medium text-destructive"}>{d.explained ? "Explained" : "Unexplained"}{d.safetyCritical ? ", safety critical" : ""}:</span> {d.person || d.email}, {d.item}. Old system: {d.oldSystem}. Capera: {d.capera}. {d.explanation}</li>
                ))}
              </ul>
              {report.differences.length > 100 && <p className="text-muted-foreground">The first 100 are shown. The saved report has all {report.differences.length}.</p>}
              <Button size="sm" variant="outline" onClick={saveReport} data-testid="button-save-reconciliation">Save the report (Excel)</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
