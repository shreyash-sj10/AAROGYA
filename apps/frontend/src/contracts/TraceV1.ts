export type TraceV1 = {
  version: "Trace_v1";
  schema_version: 1;
  compatibility: "backward";
  trace_id: string;
  timestamp: number;
  refinement_loop?: {
    round: number;
    triggered_questions: string[];
    reason: string;
    impact_on_confidence: number;
  };
  stages: {
    interpretation_layer: {
      ml_used: boolean;
      ml_confidence: number;
      ml_contribution_weight: number;
    };
    candidate_generator: {
      input_count: number;
      output_count: number;
    };
    constraint_engine: {
      input_count: number;
      output_count: number;
      rejected: number;
      rules: Array<{
        rule_id: string;
        action: "reject" | "penalize";
        reason: string;
      }>;
      p0_rules_checked: number;
      p0_violations: number;
      p0_violated_rule_ids: string[];
    };
    scoring_engine: {
      input_count: number;
      output_count: number;
    };
    diversity_engine: {
      input_count: number;
      output_count: number;
      historical_matches_count?: number;
      diversity_penalty_applied?: number;
    };
    optimizer: {
      input_count: number;
      output_count: number;
      combinations_evaluated: number;
      selected_score: number;
    };
    reliability_engine: {
      input_count: number;
      output_count: number;
      relaxation_level?: number;
      relaxed_priorities?: string[];
      confidence_eval?: {
        relaxation_impact: number;
        pool_quality: number;
        score_confidence: number;
        penalty_impact: number;
        diversity_impact: number;
      };
    };
  };
};
