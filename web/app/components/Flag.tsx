import { flagUrl, flagSrcSet, teamCode } from "../lib/flags";

export function Flag({
  team,
  size = 22,
  className = "",
}: {
  team: string;
  size?: number;
  className?: string;
}) {
  const url = flagUrl(team, 40);
  if (!url) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[3px] bg-ink-600 font-mono text-[8px] font-semibold text-mute ${className}`}
        style={{ width: size * 1.4, height: size, lineHeight: 1 }}
        aria-hidden
      >
        {teamCode(team)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      srcSet={flagSrcSet(team) || undefined}
      alt=""
      width={size * 1.4}
      height={size}
      loading="lazy"
      className={`inline-block rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.4)] ${className}`}
      style={{ width: size * 1.4, height: size }}
    />
  );
}
