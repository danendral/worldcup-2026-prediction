"use client";

import { useMemo, useState } from "react";
import type { KnockoutMatch } from "../lib/types";
import { Flag } from "./Flag";
import { SectionHead } from "./Contenders";

const ROUNDS = [
  { key: "Round of 32", label: "Round of 32", mult: "×1" },
  { key: "Round of 16", label: "Round of 16", mult: "×2" },
  { key: "Quarter-finals", label: "Quarter-finals", mult: "×4" },
  { key: "Semi-finals", label: "Semi-finals", mult: "×8" },
  { key: "Final", label: "Final", mult: "×16" },
];

export function Bracket({
  matches,
  onSelect,
}: {
  matches: KnockoutMatch[];
  onSelect: (m: KnockoutMatch) => void;
}) {
  const [pathTeam, setPathTeam] = useState<string | null>(null);

  const byRound = useMemo(() => {
    const map: Record<string, KnockoutMatch[]> = {};
    for (const r of ROUNDS) {
      map[r.key] = matches
        .filter((m) => m.round === r.key)
        .sort((a, b) => a.id - b.id);
    }
    return map;
  }, [matches]);

  const finalMatch = byRound["Final"]?.[0];
  const champ = finalMatch
    ? finalMatch.winner === "home"
      ? finalMatch.home
      : finalMatch.away
    : "";

  // teams a hovered match's winner appears in (their forward path)
  const teamMatchIds = useMemo(() => {
    const m: Record<string, Set<number>> = {};
    for (const k of matches) {
      (m[k.home] ??= new Set()).add(k.id);
      (m[k.away] ??= new Set()).add(k.id);
    }
    return m;
  }, [matches]);

  const litIds = pathTeam ? teamMatchIds[pathTeam] : null;

  return (
    <section id="bracket" className="mx-auto max-w-[1320px] scroll-mt-20 px-5 py-16 sm:px-8">
      <SectionHead
        n="05"
        title="Knockout Bracket"
        sub="Our submitted bracket — one path built by taking the most-likely result at every tie, carried through to the same champion the title race favours. Hover a tie to trace a run; click for the full match read-out."
      />

      <div className="mt-8 overflow-x-auto pb-4">
        <div className="flex min-w-[1180px] gap-5">
          {ROUNDS.map((r) => {
            const ms = byRound[r.key] || [];
            const isFinalCol = r.key === "Final";
            return (
              <div
                key={r.key}
                className="flex flex-1 flex-col"
                style={{ minWidth: isFinalCol ? 210 : 200 }}
              >
                <div className="mb-4 flex items-center justify-between border-b border-[rgba(236,230,216,0.1)] pb-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
                    {r.label}
                  </span>
                  <span className="font-mono text-[10px] font-500 text-signal/70">
                    {r.mult}
                  </span>
                </div>

                <div
                  className={`flex flex-1 flex-col ${
                    isFinalCol ? "justify-center" : "justify-around"
                  } gap-3`}
                >
                  {isFinalCol && finalMatch ? (
                    <FinalCard
                      m={finalMatch}
                      champ={champ}
                      onClick={() => onSelect(finalMatch)}
                      onHover={(t) => setPathTeam(t)}
                      lit={litIds?.has(finalMatch.id) ?? false}
                      dim={!!litIds && !litIds.has(finalMatch.id)}
                    />
                  ) : (
                    ms.map((m) => (
                      <BracketCard
                        key={m.id}
                        m={m}
                        onClick={() => onSelect(m)}
                        onHover={(t) => setPathTeam(t)}
                        lit={litIds?.has(m.id) ?? false}
                        dim={!!litIds && !litIds.has(m.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-[0.14em] text-mute">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-signal" /> predicted winner
        </span>
        <span>● hover to trace a path</span>
        <span>● click for match detail · scroll horizontally →</span>
      </div>
    </section>
  );
}

function BracketCard({
  m,
  onClick,
  onHover,
  lit,
  dim,
}: {
  m: KnockoutMatch;
  onClick: () => void;
  onHover: (t: string | null) => void;
  lit: boolean;
  dim: boolean;
}) {
  const winnerTeam = m.winner === "home" ? m.home : m.away;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(winnerTeam)}
      onMouseLeave={() => onHover(null)}
      className={`lift group relative w-full rounded-lg border bg-ink-800/60 p-2.5 text-left ${
        lit
          ? "border-signal shadow-[0_0_0_1px_var(--signal),0_8px_24px_-12px_rgba(232,181,66,0.6)]"
          : "border-[rgba(236,230,216,0.1)] hover:border-[rgba(236,230,216,0.28)]"
      }`}
      style={{ opacity: dim ? 0.32 : 1 }}
    >
      <TeamRow team={m.home} goals={m.hg} win={m.winner === "home"} />
      <div className="my-1 h-px bg-[rgba(236,230,216,0.06)]" />
      <TeamRow team={m.away} goals={m.ag} win={m.winner === "away"} />
      <div className="mt-1.5 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.1em] text-mute">
        <span>#{m.id}</span>
        <span className={m.penalties ? "text-signal" : ""}>
          {m.penalties ? "pens" : "90′"}
        </span>
      </div>
    </button>
  );
}

function TeamRow({
  team,
  goals,
  win,
}: {
  team: string;
  goals: number;
  win: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-sm"
        style={{ background: win ? "var(--signal)" : "transparent" }}
      />
      <Flag team={team} size={13} />
      <span
        className={`flex-1 truncate text-[12px] ${
          win ? "font-600 text-bone" : "text-mute"
        }`}
      >
        {team}
      </span>
      <span
        className={`font-display text-[13px] font-700 tnum ${
          win ? "text-signal" : "text-mute"
        }`}
      >
        {goals}
      </span>
    </div>
  );
}

function FinalCard({
  m,
  champ,
  onClick,
  onHover,
  lit,
}: {
  m: KnockoutMatch;
  champ: string;
  onClick: () => void;
  onHover: (t: string | null) => void;
  lit: boolean;
  dim: boolean;
}) {
  const runner = m.winner === "home" ? m.away : m.home;
  const champGoals = m.winner === "home" ? m.hg : m.ag;
  const runnerGoals = m.winner === "home" ? m.ag : m.hg;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(champ)}
      onMouseLeave={() => onHover(null)}
      className={`lift relative overflow-hidden rounded-xl border bg-gradient-to-b from-[rgba(232,181,66,0.12)] to-ink-900 p-5 text-center ${
        lit ? "border-signal" : "border-[rgba(232,181,66,0.5)]"
      }`}
    >
      <div
        className="pointer-events-none absolute -top-12 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--signal)" }}
      />
      <div className="relative">
        <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-signal">
          ♛ Champion
        </div>
        <div className="mt-3 flex items-center justify-center gap-2.5">
          <Flag team={champ} size={26} />
          <span className="font-display text-[24px] font-900 uppercase leading-none tracking-tight text-bone">
            {champ}
          </span>
        </div>
        <div className="mt-3 font-display text-[28px] font-800 text-signal tnum">
          {champGoals}–{runnerGoals}
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mute">
          {m.penalties ? "on penalties" : "in 90 minutes"}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 border-t border-[rgba(236,230,216,0.08)] pt-3">
          <Flag team={runner} size={15} />
          <span className="text-[12px] text-mute">{runner}</span>
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-mute/60">
            runner-up
          </span>
        </div>
      </div>
    </button>
  );
}
