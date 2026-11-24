// A ratchet on type errors: the project has older type errors that nobody has cleaned up yet, so "no errors" would fail every build from day one.
// This counts them and fails if there are MORE than the number recorded in security/type-error-baseline.json, so no change can add one.
// When errors are fixed, run with --update to lower the recorded number (it never raises it unless --allow-increase is also given, which needs a reason in the review).
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const baselineFile = path.join(__dirname, "..", "..", "security", "type-error-baseline.json");
const update = process.argv.includes("--update");
const allowIncrease = process.argv.includes("--allow-increase");

const run = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--noEmit", "-p", "."], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const lines = `${run.stdout || ""}\n${run.stderr || ""}`.split(/\r?\n/).filter((l) => /error TS\d+/.test(l));
// one entry per file and code, so the report is short and a new error in a different place is easy to see
const byFile = {};
for (const l of lines) { const m = /^(.+?)\(\d+,\d+\): error (TS\d+)/.exec(l); const k = m ? `${m[1].replace(/\\/g, "/")} ${m[2]}` : l; byFile[k] = (byFile[k] || 0) + 1; }
const count = lines.length;

let baseline = null;
try { baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8")); } catch { /* none yet */ }

if (update || !baseline) {
  if (baseline && count > baseline.count && !allowIncrease) { console.error(`Refusing to raise the baseline from ${baseline.count} to ${count} without --allow-increase.`); process.exit(1); }
  fs.writeFileSync(baselineFile, JSON.stringify({ count, byFile }, null, 2) + "\n");
  console.log(`Type error baseline written: ${count}`);
  process.exit(0);
}

console.log(`Type errors: ${count} (recorded baseline: ${baseline.count})`);
if (count > baseline.count) {
  const added = Object.entries(byFile).filter(([k, n]) => n > (baseline.byFile[k] || 0));
  console.error("This change adds type errors:");
  for (const [k, n] of added) console.error(`  ${k}: ${n} now, ${baseline.byFile[k] || 0} before`);
  process.exit(1);
}
if (count < baseline.count) console.log("Fewer than the baseline: run with --update to record the improvement.");
