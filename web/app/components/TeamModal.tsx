"use client";

import { useEffect } from "react";
import type { Team, KnockoutMatch } from "../lib/types";
import { CONF_COLOR } from "../lib/flags";
import { Flag } from "./Flag";
import { ProbBar } from "./ProbBar";
import { pct } from "../lib/format";

const STAGES: { key: keyof Team["stages"]; label: string }[] = [
  { key: "qualify", label: "Group Stage" },
  { key: "r32", label: "Round of 32" },
  { key: "r16", label: "Round of 16" },
  { key: "qf", label: "Quarter-finals" },
  { key: "sf", label: "Semi-finals" },
  { key: "final", label: "Final" },
  { key: "champion", label: "Champion" },
];

const ROUND_LABEL: Record<string, string> = {
  "Round of 32": "R32",
  "Round of 16": "R16",
  "Quarter-finals": "QF",
  "Semi-finals": "SF",
  Final: "Final",
};

export function TeamModal({
  team,
  knockout,
  onClose,
  onPickTeam,
}: {
  team: Team;
  knockout: KnockoutMatch[];
  onClose: () => void;
  onPickTeam: (name: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const c = CONF_COLOR[team.confederation] || "#8a8f99";

  // most-likely path: knockout matches (in the deterministic bracket) the team appears in
  const path = knockout
    .filter((m) => m.round !== "Third-place" && (m.home === team.name || m.away === team.name))
    .sort((a, b) => a.id - b.id)
    .map((m) => {
      const isHome = m.home === team.name;
      const opp = isHome ? m.away : m.home;
      const won = (isHome && m.winner === "home") || (!isHome && m.winner === "away");
      return { m, opp, won };
    });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="rise max-h-[92vh] w-full max-w-[820px] overflow-y-auto rounded-t-2xl border border-[rgba(236,230,216,0.12)] bg-ink-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animationDuration: "0.4s" }}
      >
        {/* header */}
        <div
          className="relative overflow-hidden border-b border-[rgba(236,230,216,0.08)] p-6"
          style={{ background: `linear-gradient(135deg, ${c}18, transparent 70%)` }}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(236,230,216,0.12)] text-mute transition-colors hover:border-bone hover:text-bone"
          >
            ✕
          </button>
          <div className="flex items-center gap-4">
            <Flag team={team.name} size={44} className="rounded-md" />
            <div>
              <h3 className="font-display text-[30px] font-900 uppercase leading-none tracking-tight text-bone">
                {team.name}
              </h3>
              <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
                <span style={{ color: c }}>{team.confederation}</span>
                <span className="text-mute">Group {team.group}</span>
                {team.elo > 0 && <span className="text-mute">Elo {team.elo}</span>}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-display text-[34px] font-900 leading-none text-signal tnum">
                {pct(team.stages.champion)}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-mute">
                title odds
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* probability by stage */}
          <div>
            <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
              Probability by stage
            </h4>
            <div className="space-y-3">
              {STAGES.map((s, i) => {
                const v = team.stages[s.key];
                return (
                  <div key={s.key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[12px] text-bone">{s.label}</span>
                      <span className="font-display text-[13px] font-700 text-bone tnum">
                        {pct(v)}
                      </span>
                    </div>
                    <ProbBar value={v} color={c} delay={i * 60} height={5} />
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2 border-t border-[rgba(236,230,216,0.06)] pt-4">
              {(["1", "2", "3", "4"] as const).map((r) => (
                <div key={r} className="text-center">
                  <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-mute">
                    {r === "1" ? "Win grp" : r === "4" ? "Last" : `${r}${r === "2" ? "nd" : "rd"}`}
                  </div>
                  <div className="mt-0.5 font-display text-[13px] font-700 text-bone tnum">
                    {pct(team.groupFinish[r] || 0, 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* most likely path */}
          <div>
            <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
              Most-likely path
            </h4>
            {path.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(236,230,216,0.12)] p-4 text-[12px] text-mute">
                Not projected to reach the knockout stage in the single most-likely
                bracket. See stage odds for the probabilistic view.
              </div>
            ) : (
              <div className="space-y-2">
                {path.map(({ m, opp, won }) => (
                  <button
                    key={m.id}
                    onClick={() => onPickTeam(opp)}
                    className="lift flex w-full items-center gap-3 rounded-lg border border-[rgba(236,230,216,0.08)] bg-ink-800/50 p-3 text-left hover:border-[rgba(236,230,216,0.2)]"
                  >
                    <span className="w-10 shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-signal/70">
                      {ROUND_LABEL[m.round]}
                    </span>
                    <Flag team={opp} size={16} />
                    <span className="flex-1 truncate text-[12px] text-bone">{opp}</span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[8px] font-600 uppercase tracking-[0.1em] ${
                        won
                          ? "bg-[rgba(45,212,167,0.15)] text-conmebol"
                          : "bg-[rgba(224,88,79,0.15)] text-caf"
                      }`}
                    >
                      {won ? "Adv" : "Out"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 font-mono text-[8px] uppercase leading-relaxed tracking-[0.1em] text-mute/60">
              Path follows the deterministic most-likely bracket. Click an opponent to
              jump to their breakdown.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
