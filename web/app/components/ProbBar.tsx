export function ProbBar({
  value,
  color = "var(--signal)",
  delay = 0,
  track = "rgba(236,230,216,0.06)",
  height = 4,
}: {
  value: number; // 0..1
  color?: string;
  delay?: number;
  track?: string;
  height?: number;
}) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ background: track, height }}
    >
      <div
        className="bar-fill h-full rounded-full"
        style={{
          width: `${w}%`,
          background: color,
          animationDelay: `${delay}ms`,
          boxShadow: `0 0 12px ${color}40`,
        }}
      />
    </div>
  );
}
