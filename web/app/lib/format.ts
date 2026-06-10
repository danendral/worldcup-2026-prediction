export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function pctInt(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}
