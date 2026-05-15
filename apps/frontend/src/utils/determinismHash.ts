/**
 * Stable JSON + SHA-256 for trace explorer / determinism strip (browser crypto).
 */

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort((a, b) => a.localeCompare(b));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256HexUtf8(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function canonicalMealFingerprints(plan: {
  meal_plan?: Array<{ recipe_id?: string; name?: string; quantity?: { value?: number; unit?: string } }>;
}): unknown {
  const meals = Array.isArray(plan.meal_plan) ? plan.meal_plan : [];
  return meals.map((m) => ({
    recipe_id: m.recipe_id ?? "",
    name: m.name ?? "",
    quantity: m.quantity ?? {},
  }));
}

export function stripVolatileMeta<T extends { meta?: Record<string, unknown> }>(payload: T): T {
  const next = JSON.parse(JSON.stringify(payload)) as T;
  if (next.meta && typeof next.meta === "object") {
    const m = { ...next.meta };
    delete m.latency_ms;
    delete m.served_latency_ms;
    next.meta = m;
  }
  return next;
}

export function canonicalTraceForHash(trace: unknown): unknown {
  if (!trace || typeof trace !== "object") {
    return trace;
  }
  const t = JSON.parse(JSON.stringify(trace)) as Record<string, unknown>;
  return t;
}

export async function hashPayload(label: string, payload: unknown): Promise<{ label: string; hash: string }> {
  const body = stableStringify(payload);
  const hash = await sha256HexUtf8(body);
  return { label, hash };
}
