export function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}
