"use client";

import { useEffect } from "react";
import type { KnockoutMatch } from "../lib/types";
import { Flag } from "./Flag";
import { ProbBar } from "./ProbBar";
import { pct } from "../lib/format";

export function MatchModal({
  m,
  onClose,
}: {
  m: KnockoutMatch;
  onClose: () => void;
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

  const homeWin = m.winner === "home";
  const dateStr = formatDate(m.date);
  const homeWinProb = m.homeWinProb ?? (homeWin ? 0.5 : 0.5);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="rise max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-t-2xl border border-[rgba(236,230,216,0.12)] bg-ink-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animationDuration: "0.4s" }}
      >
        <div className="relative border-b border-[rgba(236,230,216,0.08)] p-5">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(236,230,216,0.12)] text-mute transition-colors hover:border-bone hover:text-bone"
          >
            ✕
          </button>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
            <span className="rounded bg-signal/15 px-2 py-0.5 text-signal">{m.round}</span>
            <span>×{m.multiplier} scoring</span>
            <span className="text-mute/50">·</span>
            <span>#{m.id}</span>
          </div>

          {/* scoreboard */}
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <TeamSide team={m.home} win={homeWin} align="right" />
            <div className="text-center">
              <div className="font-display text-[40px] font-900 leading-none text-bone tnum">
                {m.hg}<span className="mx-1 text-mute/40">–</span>{m.ag}
              </div>
              <div
                className={`mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
                  m.penalties ? "text-signal" : "text-mute"
                }`}
              >
                {m.penalties ? "on penalties" : "in 90 min"}
              </div>
            </div>
            <TeamSide team={m.away} win={!homeWin} align="left" />
          </div>

          <div className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
            {dateStr} · {m.venue}
          </div>
        </div>

        <div className="p-5">
          {/* win probability */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
              <span className="text-bone">{pct(homeWinProb, 0)} {m.home}</span>
              <span>win probability</span>
              <span className="text-bone">{m.away} {pct(1 - homeWinProb, 0)}</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-700">
              <div
                className="bar-fill h-full"
                style={{ width: `${homeWinProb * 100}%`, background: "var(--signal)" }}
              />
              <div
                className="h-full flex-1"
                style={{ background: "rgba(91,141,239,0.6)" }}
              />
            </div>
          </div>

          {/* match facts */}
          <div className="grid grid-cols-4 gap-2">
            <Fact k="Corners" v={`${m.corners}`} />
            <Fact k="Yellows" v={`${m.yellows}`} />
            <Fact k="Reds" v={`${m.reds}`} />
            <Fact
              k="Matchup"
              v={m.matchupConfidence != null ? pct(m.matchupConfidence, 0) : "—"}
            />
          </div>

          {/* alternative matchups */}
          {m.alternatives && m.alternatives.length > 1 && (
            <div className="mt-5 border-t border-[rgba(236,230,216,0.06)] pt-4">
              <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
                How likely is this exact matchup?
              </h4>
              <div className="space-y-2">
                {m.alternatives.map((alt, i) => {
                  const isThis = alt.home === m.home && alt.away === m.away;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex w-[180px] items-center gap-1.5 overflow-hidden">
                        <Flag team={alt.home} size={12} />
                        <span className="truncate text-[11px] text-mute">{alt.home}</span>
                        <span className="text-mute/40">v</span>
                        <Flag team={alt.away} size={12} />
                        <span className="truncate text-[11px] text-mute">{alt.away}</span>
                      </div>
                      <div className="flex-1">
                        <ProbBar
                          value={alt.prob}
                          color={isThis ? "var(--signal)" : "rgba(138,143,153,0.7)"}
                          delay={i * 60}
                          height={6}
                        />
                      </div>
                      <span
                        className={`w-10 text-right font-display text-[12px] font-700 tnum ${
                          isThis ? "text-signal" : "text-mute"
                        }`}
                      >
                        {pct(alt.prob, 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* slots */}
          <div className="mt-5 flex items-center justify-between border-t border-[rgba(236,230,216,0.06)] pt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-mute">
            <span>{m.homeSlot}</span>
            <span className="text-mute/40">vs</span>
            <span className="text-right">{m.awaySlot}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSide({
  team,
  win,
  align,
}: {
  team: string;
  win: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2.5 ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      }`}
    >
      <Flag team={team} size={30} className="rounded-md" />
      <div>
        <div
          className={`font-display text-[16px] font-700 uppercase leading-tight tracking-tight ${
            win ? "text-signal" : "text-bone"
          }`}
        >
          {team}
        </div>
        {win && (
          <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-signal/70">
            advances
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-[rgba(236,230,216,0.06)] bg-ink-800/50 p-2.5 text-center">
      <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-mute">{k}</div>
      <div className="mt-0.5 font-display text-[16px] font-800 text-bone tnum">{v}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
