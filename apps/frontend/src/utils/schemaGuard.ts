import { z } from "zod";

export function schemaGuard<T>(schema: z.ZodType<T>, payload: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
    };
  }

  return {
    success: false,
    errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
  };
}
