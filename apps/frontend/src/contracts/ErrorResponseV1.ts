export type ErrorResponseV1 = {
  version: "v1";
  schema_version?: 1;
  compatibility?: "backward";
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
