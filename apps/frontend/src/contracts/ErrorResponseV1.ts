import type { TraceV1 } from "@/contracts/TraceV1";

export type ErrorResponseV1 = {
  version: "ErrorResponse_v1";
  request_id: string;
  trace_id: string;
  trace: TraceV1;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
};
