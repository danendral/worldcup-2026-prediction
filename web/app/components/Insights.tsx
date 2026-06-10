"use client";

import { useMemo } from "react";
import type { Predictions } from "../lib/types";
import { CONF_COLOR, CONF_NAME } from "../lib/flags";
import { Flag } from "./Flag";
import { pct } from "../lib/format";
import { SectionHead } from "./Contenders";

const CONF_ORDER = ["UEFA", "CONMEBOL", "CAF", "AFC", "CONCACAF", "OFC"];

// qualification-status palette (matches the Group Stage legend)
const ADVANCE = "#34d39e";
const WATCH = "#e8b542";
const OUT = "#5a6069";

export function Insights({
  data,
  onSelect,
}: {
  data: Predictions;
  onSelect: (name: string) => void;
}) {
  const { teams, groups, knockout } = data;

  // ---- confederation title share ----
  const confShare = useMemo(() => {
    const sum: Record<string, number> = {};
    for (const t of teams) sum[t.confederation] = (sum[t.confederation] || 0) + t.stages.champion;
    return CONF_ORDER.map((c) => ({ conf: c, share: sum[c] || 0 })).filter((d) => d.share > 0);
  }, [teams]);

  const europeSAmerica = confShare
    .filter((c) => c.conf === "UEFA" || c.conf === "CONMEBOL")
    .reduce((s, c) => s + c.share, 0);

  // ---- most likely finalists (probability of reaching the final) ----
  const finalists = useMemo(
    () => [...teams].sort((a, b) => b.stages.final - a.stages.final).slice(0, 6),
    [teams]
  );
  const finalMax = finalists[0]?.stages.final || 1;
  const topFinal = knockout.find((m) => m.id === 104)?.alternatives?.[0] ?? null;

  // ---- group of death: tightest gap between 2nd and 3rd qualify odds ----
  const groupOfDeath = useMemo(() => {
    let best: { group: string; gap: number; teams: typeof groups[0]["teams"] } | null = null;
    for (const g of groups) {
      const sorted = [...g.teams].sort((a, b) => b.qualify - a.qualify);
      if (sorted.length < 3) continue;
      const gap = sorted[1].qualify - sorted[2].qualify;
      if (!best || gap < best.gap) best = { group: g.group, gap, teams: sorted };
    }
    return best;
  }, [groups]);

  // ---- surest qualifier ----
  const surest = useMemo(
    () => [...teams].sort((a, b) => b.stages.qualify - a.stages.qualify)[0],
    [teams]
  );

  // ---- how open is the title race ----
  const openness = useMemo(() => {
    const ranked = [...teams].sort((a, b) => b.stages.champion - a.stages.champion);
    const favourite = ranked[0];
    const top5 = ranked.slice(0, 5).reduce((s, t) => s + t.stages.champion, 0);
    return { favourite, top5 };
  }, [teams]);

  return (
    <section
      id="insights"
      className="mx-auto max-w-[1320px] scroll-mt-20 px-5 py-16 sm:px-8"
    >
      <SectionHead
        n="02"
        title="Tournament Read"
        sub="The shape of the field before a ball is kicked — who is built to reach the final, which group is a coin-flip, and the surest things on the board."
      />

      {/* headline insight banner — confederation title share */}
      <div className="mt-8 rounded-2xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
              ◆ Where the title lives
            </span>
            <h3 className="mt-3 font-display text-[clamp(21px,2.9vw,32px)] font-900 uppercase leading-[0.98] tracking-tight text-bone">
              {pct(europeSAmerica, 0)} chance the winner
              <br className="hidden sm:block" /> comes from{" "}
              <span className="text-signal">Europe</span> or{" "}
              <span style={{ color: CONF_COLOR["CONMEBOL"] }}>South America</span>
            </h3>
            <p className="mt-3 max-w-[44ch] text-[13px] leading-relaxed text-mute">
              The other four confederations share the remaining{" "}
              {pct(1 - europeSAmerica, 0)} of championship equity between them.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-mute">
              <span>champion % by confederation</span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-ink-700">
              {confShare.map((d, i) => {
                const c = CONF_COLOR[d.conf] || "#8a8f99";
                return (
                  <div
                    key={d.conf}
                    className="bar-fill h-full"
                    style={{
                      width: `${d.share * 100}%`,
                      background: c,
                      animationDelay: `${i * 90}ms`,
                    }}
                    title={`${d.conf} · ${pct(d.share, 1)}`}
                  />
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {confShare.map((d) => {
                const c = CONF_COLOR[d.conf] || "#8a8f99";
                const region = (CONF_NAME[d.conf] || d.conf).split("—")[1]?.trim() || "";
                return (
                  <div
                    key={d.conf}
                    title={CONF_NAME[d.conf] || d.conf}
                    className="group flex cursor-default items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-[rgba(236,230,216,0.04)]"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c }} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-mute transition-colors group-hover:text-bone">
                      {d.conf}
                    </span>
                    {region && (
                      <span className="hidden truncate font-mono text-[9px] normal-case tracking-normal text-mute/0 transition-colors group-hover:text-mute lg:inline">
                        {region}
                      </span>
                    )}
                    <span className="ml-auto font-display text-[13px] font-700 text-bone tnum">
                      {pct(d.share, 1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* three-card row */}
      <div className="mt-5 grid items-stretch gap-5 lg:grid-cols-3">
        {/* most likely finalists */}
        <div className="flex flex-col rounded-2xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-signal">
              ◆ Road to the final
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-mute">
              reaches final %
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {finalists.map((t, i) => {
              const c = CONF_COLOR[t.confederation] || "#8a8f99";
              const w = (t.stages.final / finalMax) * 100;
              return (
                <button
                  key={t.name}
                  onClick={() => onSelect(t.name)}
                  className="group flex w-full items-center gap-2.5 text-left"
                >
                  <Flag team={t.name} size={15} />
                  <span className="w-[72px] shrink-0 truncate text-[12px] text-bone group-hover:text-signal">
                    {t.name}
                  </span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(236,230,216,0.05)]">
                    <div
                      className="bar-fill h-full rounded-full"
                      style={{
                        width: `${w}%`,
                        background: c,
                        animationDelay: `${i * 50}ms`,
                      }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-display text-[12px] font-700 text-bone tnum">
                    {pct(t.stages.final, 0)}
                  </span>
                </button>
              );
            })}
          </div>
          {topFinal && (
            <p className="mt-auto border-t border-[rgba(236,230,216,0.06)] pt-3 text-[11px] leading-snug text-mute/80">
              Single likeliest pairing:{" "}
              <span className="text-bone">{topFinal.home}</span> v{" "}
              <span className="text-bone">{topFinal.away}</span> ({pct(topFinal.prob, 1)})
              — final matchups are wide open.
            </p>
          )}
        </div>

        {/* group of death */}
        {groupOfDeath && (
          <div className="flex flex-col rounded-2xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-caf">
                ◆ Group of Death
              </span>
              <span className="font-display text-[13px] font-800 uppercase tracking-tight text-bone">
                Group {groupOfDeath.group}
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {groupOfDeath.teams.map((t, i) => {
                const color = i < 2 ? ADVANCE : i === 2 ? WATCH : OUT;
                const bubble = i === 1 || i === 2; // the two fighting for the last spot
                const w = (t.qualify / (groupOfDeath.teams[0].qualify || 1)) * 100;
                return (
                  <button
                    key={t.name}
                    onClick={() => onSelect(t.name)}
                    className="group flex w-full items-center gap-2.5 text-left"
                  >
                    <span className="w-3 shrink-0 text-center font-mono text-[10px] text-mute/50 tnum">
                      {i + 1}
                    </span>
                    <Flag team={t.name} size={15} />
                    <span
                      className={`w-[92px] shrink-0 truncate text-[12px] group-hover:text-signal ${
                        i < 2 ? "text-bone" : "text-mute"
                      }`}
                    >
                      {t.name}
                    </span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(236,230,216,0.05)]">
                      <div
                        className="bar-fill h-full rounded-full"
                        style={{ width: `${w}%`, background: color, animationDelay: `${i * 50}ms` }}
                      />
                    </div>
                    <span
                      className={`w-9 shrink-0 text-right font-display text-[12px] font-700 tnum ${
                        bubble ? "text-signal" : "text-mute"
                      }`}
                    >
                      {pct(t.qualify, 0)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-auto border-t border-[rgba(236,230,216,0.06)] pt-3 text-[11px] leading-snug text-mute/80">
              Just{" "}
              <span className="font-600 text-signal">{pct(groupOfDeath.gap, 1)}</span>{" "}
              separates 2nd from 3rd — the tightest fight for a qualifying spot in the
              tournament.
            </p>
          </div>
        )}

        {/* surest qualifier + drama meter */}
        <div className="grid grid-rows-2 gap-5">
          <button
            onClick={() => surest && onSelect(surest.name)}
            className="lift rounded-2xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-5 text-left hover:border-[rgba(232,181,66,0.35)]"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-mute">
              Surest qualifier
            </span>
            {surest && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Flag team={surest.name} size={22} />
                  <span className="truncate font-display text-[15px] font-800 uppercase tracking-tight text-bone">
                    {surest.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-display text-[24px] font-900 leading-none text-signal tnum">
                    {pct(surest.stages.qualify, 0)}
                  </div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-mute">
                    to R32
                  </div>
                </div>
              </div>
            )}
          </button>

          <div className="rounded-2xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-mute">
              Wide-open race
            </span>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <div>
                <div className="font-display text-[24px] font-900 leading-none text-signal tnum">
                  {pct(openness.favourite.stages.champion, 0)}
                </div>
                <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-mute">
                  favourite ceiling
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-[24px] font-900 leading-none text-bone tnum">
                  {pct(openness.top5, 0)}
                </div>
                <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-mute">
                  held by top 5
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] leading-snug text-mute/70">
              No team clears {pct(openness.favourite.stages.champion, 0)} — half the title
              equity is spread beyond the top five. It&rsquo;s a wide field.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
