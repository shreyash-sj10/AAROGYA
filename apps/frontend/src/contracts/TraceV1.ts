export type TraceV1 = {
  version: "Trace_v1";
  schema_version: 1;
  compatibility: "backward";
  trace_id: string;
  timestamp: number;
  stages: {
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
    };
    scoring_engine: {
      input_count: number;
      output_count: number;
    };
    diversity_engine: {
      input_count: number;
      output_count: number;
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
    };
  };
};
