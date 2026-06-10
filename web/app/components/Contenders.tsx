"use client";

import { useMemo, useState } from "react";
import type { Team } from "../lib/types";
import { CONF_COLOR, CONF_NAME } from "../lib/flags";
import { Flag } from "./Flag";
import { pct } from "../lib/format";

const CONFS = ["All", "UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"];

export function Contenders({
  teams,
  onSelect,
}: {
  teams: Team[];
  onSelect: (name: string) => void;
}) {
  const [conf, setConf] = useState("All");
  const [hover, setHover] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = conf === "All" ? teams : teams.filter((t) => t.confederation === conf);
    return [...list].sort((a, b) => b.stages.champion - a.stages.champion).slice(0, 16);
  }, [teams, conf]);

  const max = filtered[0]?.stages.champion || 1;

  // dark horses: outside top 8 by champion %, ranked by champion %
  const darkHorses = useMemo(
    () =>
      [...teams]
        .sort((a, b) => b.stages.champion - a.stages.champion)
        .slice(8, 11),
    [teams]
  );

  return (
    <section id="contenders" className="mx-auto max-w-[1320px] scroll-mt-20 px-5 py-16 sm:px-8">
      <SectionHead
        n="03"
        title="Championship Probability"
        sub="Likelihood of lifting the trophy across all simulated tournaments. Hover a bar for the full path."
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* bar chart */}
        <div className="rounded-2xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            {CONFS.map((c) => (
              <button
                key={c}
                onClick={() => setConf(c)}
                title={c === "All" ? "All confederations" : CONF_NAME[c] || c}
                className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
                  conf === c
                    ? "border-signal bg-signal text-ink-900"
                    : "border-[rgba(236,230,216,0.12)] text-mute hover:border-[rgba(236,230,216,0.3)] hover:text-bone"
                }`}
              >
                {c}
              </button>
            ))}
            {conf !== "All" && (
              <span
                className="fade ml-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mute"
                style={{ animationDuration: "0.3s" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: CONF_COLOR[conf] || "#8a8f99" }}
                />
                {(CONF_NAME[conf] || conf).split("—")[1]?.trim() || conf}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {filtered.map((t, i) => {
              const w = (t.stages.champion / max) * 100;
              const c = CONF_COLOR[t.confederation] || "#8a8f99";
              const active = hover === t.name;
              return (
                <button
                  key={t.name}
                  onMouseEnter={() => setHover(t.name)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect(t.name)}
                  className="group grid w-full grid-cols-[120px_1fr_52px] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-ink-700/50 sm:grid-cols-[150px_1fr_56px]"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-4 shrink-0 font-mono text-[10px] text-mute/50 tnum">
                      {i + 1}
                    </span>
                    <Flag team={t.name} size={16} />
                    <span className="truncate text-[12px] font-500 text-bone">{t.name}</span>
                  </div>
                  <div className="relative h-5 overflow-hidden rounded bg-[rgba(236,230,216,0.04)]">
                    <div
                      className="bar-fill h-full rounded transition-all duration-200"
                      style={{
                        width: `${w}%`,
                        background: `linear-gradient(90deg, ${c}cc, ${c})`,
                        animationDelay: `${i * 35}ms`,
                        boxShadow: active ? `0 0 16px ${c}80` : "none",
                        opacity: hover && !active ? 0.4 : 1,
                      }}
                    />
                  </div>
                  <span
                    className="text-right font-display text-[14px] font-700 tnum"
                    style={{ color: active ? c : "var(--bone)" }}
                  >
                    {pct(t.stages.champion)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* dark horses */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] font-800 uppercase tracking-wide text-bone">
              Dark Horses
            </span>
            <span className="h-px flex-1 bg-[rgba(236,230,216,0.1)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-mute">
              outside the favourites
            </span>
          </div>

          {darkHorses.map((t) => {
            const c = CONF_COLOR[t.confederation] || "#8a8f99";
            return (
              <button
                key={t.name}
                onClick={() => onSelect(t.name)}
                className="lift group block w-full rounded-xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-4 text-left hover:border-[rgba(232,181,66,0.35)] hover:bg-ink-800"
                style={{ borderLeftColor: c, borderLeftWidth: 3 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flag team={t.name} size={22} />
                    <div>
                      <div className="font-display text-[15px] font-700 uppercase tracking-tight text-bone">
                        {t.name}
                      </div>
                      <div
                        className="font-mono text-[9px] uppercase tracking-[0.14em]"
                        style={{ color: c }}
                      >
                        {t.confederation} · Group {t.group}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-[20px] font-800 leading-none text-signal tnum">
                      {pct(t.stages.champion)}
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-mute">
                      champ
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[rgba(236,230,216,0.06)] pt-3">
                  <MiniProb k="QF" v={t.stages.qf} />
                  <MiniProb k="SF" v={t.stages.sf} />
                  <MiniProb k="Final" v={t.stages.final} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MiniProb({ k, v }: { k: string; v: number }) {
  return (
    <div>
      <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-mute">{k}</div>
      <div className="mt-0.5 font-display text-[13px] font-700 text-bone tnum">{pct(v)}</div>
    </div>
  );
}

export function SectionHead({
  n,
  title,
  sub,
}: {
  n: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] font-500 text-signal/70">{n}</span>
        <h2 className="font-display text-[clamp(26px,4vw,40px)] font-900 uppercase leading-none tracking-tightest text-bone">
          {title}
        </h2>
      </div>
      <p className="max-w-[60ch] text-[13px] leading-relaxed text-mute">{sub}</p>
    </div>
  );
}
