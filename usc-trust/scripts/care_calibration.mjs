#!/usr/bin/env node
// ============================================================================
// USC AI Trust Lab — Care judge calibration helper
// The Care literature review requires human calibration of the LLM judge
// before leaderboard use (automated judges inflate empathy/safety scores).
//
//   node scripts/care_calibration.mjs sample <run.json> [--per-aspect 2] > calibration.csv
//     Stratified sample (by aspect, gated vs not) from a Runner JSON export.
//     One row per test × domain with the judge level and full transcript, plus
//     empty rater1 / rater2 / judge2 columns for clinicians or trained raters.
//
//   node scripts/care_calibration.mjs agree <calibration.csv>
//     Exact agreement, within-1 agreement and quadratic-weighted kappa for
//     judge↔rater1, judge↔rater2, rater1↔rater2 and judge2↔raters, plus the
//     judge's mean inflation over the human mean, overall and per domain.
// ============================================================================

import { readFileSync } from "node:fs";

const LEVELS = [-1, 0, 1, 2];
const DOMAINS = ["epistemic", "relational", "agency"];

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function sample(path, perAspect) {
  const run = JSON.parse(readFileSync(path, "utf8"));
  const rows = (run.perTest || []).filter((r) => r.pillarId === "care" && !r.errored);
  const strata = new Map();
  for (const r of rows) {
    const key = `${r.careAspect || r.aspect}|${r.gated ? "gated" : "ok"}`;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(r);
  }
  const picked = [];
  for (const list of strata.values()) picked.push(...list.slice(0, perAspect));
  const header = ["test_id", "aspect", "gated", "domain", "judge_level", "judge_evidence", "critical_failures", "transcript", "rater1", "rater2", "judge2"];
  const out = [header.join(",")];
  for (const r of picked) {
    const transcript = r.transcript || (r.variants || []).map((v) => `[${v.cue_id}]\n${v.transcript}`).join("\n\n");
    for (const d of DOMAINS) {
      out.push([r.testId, r.careAspect || r.aspect, r.gated ? "yes" : "no", d, r.domains?.[d] ?? "",
        r.evidence?.[d] ?? "", (r.criticalFailures || []).map((c) => c.id).join(" "), transcript, "", "", ""].map(csvEscape).join(","));
    }
  }
  process.stdout.write(out.join("\n") + "\n");
  console.error(`Sampled ${picked.length} Care cases (${picked.length * 3} domain rows) from ${rows.length}.`);
}

function qwk(a, b) {
  const n = a.length; if (!n) return NaN;
  const k = LEVELS.length; const idx = (v) => LEVELS.indexOf(v);
  const O = Array.from({ length: k }, () => Array(k).fill(0));
  const ha = Array(k).fill(0), hb = Array(k).fill(0);
  for (let i = 0; i < n; i++) { O[idx(a[i])][idx(b[i])]++; ha[idx(a[i])]++; hb[idx(b[i])]++; }
  let num = 0, den = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const w = ((i - j) ** 2) / ((k - 1) ** 2);
    num += w * O[i][j]; den += w * (ha[i] * hb[j]) / n;
  }
  return den === 0 ? 1 : 1 - num / den;
}

function pairStats(rows, x, y) {
  const pairs = rows.map((r) => [Number(r[x]), Number(r[y])]).filter(([p, q]) => r_ok(p) && r_ok(q));
  const a = pairs.map((p) => p[0]), b = pairs.map((p) => p[1]);
  return {
    n: pairs.length,
    exact: pairs.length ? pairs.filter(([p, q]) => p === q).length / pairs.length : NaN,
    within1: pairs.length ? pairs.filter(([p, q]) => Math.abs(p - q) <= 1).length / pairs.length : NaN,
    qwk: qwk(a, b),
  };
}
const r_ok = (v) => Number.isFinite(v) && LEVELS.includes(v);
const f = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

function agree(path) {
  const rows = parseCsv(readFileSync(path, "utf8")).map((r) => ({ ...r, judge: r.judge_level }));
  for (const r of rows) {
    const h = [Number(r.rater1), Number(r.rater2)].filter(r_ok);
    r.human_mean = h.length ? h.reduce((s, v) => s + v, 0) / h.length : NaN;
    r.human_round = h.length ? Math.round(r.human_mean) : NaN;
  }
  const report = (label, subset) => {
    console.log(`\n== ${label} (${subset.length} rows) ==`);
    for (const [x, y] of [["judge", "rater1"], ["judge", "rater2"], ["rater1", "rater2"], ["judge2", "human_round"], ["judge", "human_round"]]) {
      const s = pairStats(subset, x, y);
      if (s.n) console.log(`${(x + " vs " + y).padEnd(24)} n=${String(s.n).padEnd(4)} exact=${f(s.exact)}  within1=${f(s.within1)}  QWK=${f(s.qwk)}`);
    }
    const inf = subset.filter((r) => r_ok(Number(r.judge)) && Number.isFinite(r.human_mean));
    if (inf.length) console.log(`judge inflation (judge − human mean): ${f(inf.reduce((s, r) => s + Number(r.judge) - r.human_mean, 0) / inf.length)} levels`);
  };
  report("ALL DOMAINS", rows);
  for (const d of DOMAINS) report(d, rows.filter((r) => r.domain === d));
}

const [cmd, file, ...rest] = process.argv.slice(2);
if (cmd === "sample" && file) {
  const i = rest.indexOf("--per-aspect");
  sample(file, i >= 0 ? Number(rest[i + 1]) || 2 : 2);
} else if (cmd === "agree" && file) {
  agree(file);
} else {
  console.error("Usage:\n  node scripts/care_calibration.mjs sample <run.json> [--per-aspect 2] > calibration.csv\n  node scripts/care_calibration.mjs agree <calibration.csv>");
  process.exit(1);
}
