// ============================================================================
// USC AI Trust Lab — Reliability benchmark bank (REAL data)
// Built from Harshrudrawar/llm-reliability-evaluation → prompts_benchmark.json
// (184 items across the framework's 9 dimensions). Grouped paraphrase items
// (robustness, response_variance) are collapsed into one case per group so the
// scorer can compare their outputs; everything else is one case per item.
// Scored live by src/engine/reliabilityScoring.js (a port of score_results.py).
// ============================================================================

import BENCH from "./reliability_benchmark.json";

// Human labels for the nine dimensions (kept in benchmark order).
export const REL_DIMENSIONS = [
  { id: "consistency", label: "Output Consistency" },
  { id: "robustness", label: "Prompt Robustness" },
  { id: "reasoning_stability", label: "Reasoning Stability" },
  { id: "long_context", label: "Long-Context Reliability" },
  { id: "edge_case", label: "Edge-Case Handling" },
  { id: "uncertainty_calibration", label: "Uncertainty Calibration" },
  { id: "user_pressure", label: "User-Pressure Stability" },
  { id: "response_variance", label: "Response Variance" },
  { id: "parameter_sensitivity", label: "Parameter Sensitivity" },
];

const GROUPED = new Set(["robustness", "response_variance"]); // paraphrase groups

function groupBy(items, key) {
  const m = new Map();
  for (const it of items) { const k = it[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(it); }
  return m;
}

function buildCases() {
  const cases = [];
  for (const { id: dim } of REL_DIMENSIONS) {
    const items = BENCH[dim] || [];
    if (GROUPED.has(dim)) {
      for (const [gid, group] of groupBy(items, "group_id")) {
        cases.push({ id: gid, mode: "rel", relDim: dim, aspect: dim, prompts: group.map((g) => g.prompt) });
      }
    } else {
      for (const it of items) {
        cases.push({
          id: it.id, mode: "rel", relDim: dim, aspect: dim,
          prompt: it.prompt, context: it.context, questions: it.questions,
          challenge: it.challenge, answer: it.answer, expected: it.expected,
        });
      }
    }
  }
  return cases;
}

// Complete integrated benchmark (every real item, grouped where needed).
export const REL_CASES = buildCases();

// A full live run of all 184 items is hundreds of API calls, so the Full battery
// runs a representative sample per dimension by default (the complete bank above
// is still scored by the real engine — this only bounds one battery run).
export const REL_SAMPLE_PER_DIM = 3;
export const REL_BATTERY = (() => {
  const perDim = {};
  const out = [];
  for (const c of REL_CASES) {
    perDim[c.relDim] = (perDim[c.relDim] || 0) + 1;
    if (perDim[c.relDim] <= REL_SAMPLE_PER_DIM) out.push(c);
  }
  return out;
})();

