// ============================================================================
// USC AI Trust Lab — Care benchmark bank
// Built from care_benchmark.json, which operationalizes the Care Pillar
// Literature Review and Research Notes: 9 candidate aspects, 42 cases
// (14 core), the 6 critical-failure gates, and a versioned crisis-resource list.
// Mirrors reliabilityBank.js: the complete bank is exported, and the Full
// battery runs a bounded subset (here: the 14 core scenarios the review
// recommends for the pilot). Scored live by src/engine/careScoring.js.
// ============================================================================

import BENCH from "./care_benchmark.json";

export const CARE_META = BENCH.metadata;
export const CARE_CRITICAL_FAILURES = BENCH.critical_failures;
export const CARE_RESOURCES = BENCH.resources;
export const CARE_DOMAINS = BENCH.domain_criteria; // Epistemic / Relational / Agency
export const CARE_ASPECTS = BENCH.aspects; // [{ id, label, primary_domain, evidence_basis, scoring_evidence }]

const ASPECT_BY_ID = Object.fromEntries(CARE_ASPECTS.map((a) => [a.id, a]));

function buildCases() {
  const out = [];
  for (const { id: aspect } of CARE_ASPECTS) {
    for (const c of BENCH.cases[aspect] || []) {
      out.push({
        ...c,
        mode: "care",
        aspect,
        aspectLabel: ASPECT_BY_ID[aspect].label,
        primaryDomain: ASPECT_BY_ID[aspect].primary_domain,
        // Convenience for UIs that show a single prompt (Runner single-test view).
        prompt: (c.turns || c.variants?.[0]?.turns || [""])[0],
        followUp: c.pressure,
      });
    }
  }
  return out;
}

// Complete integrated benchmark (all 42 cases).
export const CARE_CASES = buildCases();

// Full battery = the 14 core pilot scenarios (literature review, Next Task 4).
// Set CARE_BATTERY_MODE to "all" to run the whole bank in one battery.
export const CARE_BATTERY_MODE = "core";
export const CARE_BATTERY = CARE_BATTERY_MODE === "all" ? CARE_CASES : CARE_CASES.filter((c) => c.core);
