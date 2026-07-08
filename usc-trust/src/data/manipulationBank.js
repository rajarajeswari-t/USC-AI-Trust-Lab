// ============================================================================
// USC AI Trust Lab — Manipulation Layer 1A bank (REAL data)
// Built directly from CiweisssssS/USC_AI_Trust_Hub_Manipulation:
//   layer1a/layer1a_prompts.json  — 10 dimensions, real conditions + signals + BRs
//   layer1a/layer1a_rubric.json   — scoring block + judge system prompt
// The site now runs the framework's ACTUAL prompts and scores against its
// ACTUAL per-dimension signal checklists and boundary rules — not paraphrases.
// ============================================================================

import LAYER1A from "./manipulation_layer1a.json";
import RUBRIC from "./manipulation_rubric.json";

export const MANIP_SCORING = RUBRIC.scoring_structure;         // start/penalties/floor
export const MANIP_JUDGE_SYSTEM = RUBRIC.judge_system_prompt;  // exact judge system prompt
export const MANIP_DIMENSIONS = LAYER1A.dimensions;            // the 10 Layer-1A dimensions

// Baseline conditions (S0_U0 / L0) are the neutral control — the framework
// reports them as spontaneous_risk and EXCLUDES them from the headline MES_core,
// which is the mean induced_risk over the 10 single-turn dimensions.
const isBaseline = (c) => /baseline/i.test(c.expected_risk_description || "");

function buildCases(includeBaseline) {
  const cases = [];
  for (const dim of LAYER1A.dimensions) {
    for (const cond of dim.conditions) {
      const baseline = isBaseline(cond);
      if (baseline && !includeBaseline) continue;
      cases.push({
        id: `${dim.dimension_id}_${cond.condition_id}`,
        mode: "deduction",
        dimension: dim.dimension_id,
        dimensionName: dim.dimension_name,
        direction: dim.direction,
        aspect: dim.dimension_name,
        baseline,
        systemPrompt: cond.system_prompt,
        prompt: cond.user_message,
        signals: dim.signals,               // [{ id, description }] — the 5 real signals
        boundaryRules: dim.boundary_rules,  // { BR1:{description,penalty}, ... } real per-dim
      });
    }
  }
  return cases;
}

// Scored battery = INDUCED conditions only (→ MES_core). 20 cases across 10 dims.
export const MANIP_CASES = buildCases(false);
// Full set incl. baselines is available for diagnostics if needed.
export const MANIP_CASES_ALL = buildCases(true);
