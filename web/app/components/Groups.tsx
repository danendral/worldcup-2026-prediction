"use client";

import { useState } from "react";
import type { Group, GroupMatch } from "../lib/types";
import { Flag } from "./Flag";
import { ProbBar } from "./ProbBar";
import { pct } from "../lib/format";
import { SectionHead } from "./Contenders";

// Semantic colours — these MUST match the legend. Colour encodes qualification
// status (not confederation), so the bars and the key tell the same story.
const ADVANCE = "#34d39e"; // top two — qualify directly
const WATCH = "#e8b542"; // third — best-third-place bubble
const OUT = "#5a6069"; // fourth — eliminated

function statusColor(rank: number): string {
  if (rank < 2) return ADVANCE;
  if (rank === 2) return WATCH;
  return OUT;
}

export function Groups({
  groups,
  matches,
  onSelect,
}: {
  groups: Group[];
  matches: GroupMatch[];
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section id="groups" className="mx-auto max-w-[1320px] scroll-mt-20 px-5 py-16 sm:px-8">
      <SectionHead
        n="04"
        title="Group Stage"
        sub="Probability each nation advances to the Round of 32. Top two qualify directly; eight best third-placed teams also progress. Click a group to see predicted scorelines."
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g, gi) => {
          const isOpen = open === g.group;
          const gmatches = matches
            .filter((m) => m.group === g.group)
            .sort((a, b) => a.id - b.id);
          return (
            <div
              key={g.group}
              className="lift rounded-2xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-5 hover:border-[rgba(236,230,216,0.16)]"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                    Group
                  </span>
                  <span className="font-display text-[34px] font-900 leading-none text-bone">
                    {g.group}
                  </span>
                </div>
                <button
                  onClick={() => setOpen(isOpen ? null : g.group)}
                  className="rounded-full border border-[rgba(236,230,216,0.12)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-mute transition-colors hover:border-signal hover:text-signal"
                >
                  {isOpen ? "Hide" : "Fixtures"}
                </button>
              </div>

              <div className="space-y-2.5">
                {g.teams.map((t, i) => {
                  const color = statusColor(i);
                  const advances = i < 2;
                  return (
                    <button
                      key={t.name}
                      onClick={() => onSelect(t.name)}
                      className="group block w-full text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: i < 2 ? color : "transparent",
                            boxShadow: i === 2 ? `inset 0 0 0 1px ${WATCH}` : "none",
                          }}
                        />
                        <Flag team={t.name} size={15} />
                        <span
                          className={`flex-1 truncate text-[13px] transition-colors group-hover:text-signal ${
                            advances ? "font-500 text-bone" : "text-mute"
                          }`}
                        >
                          {t.name}
                        </span>
                        <span
                          className="font-display text-[13px] font-700 tnum"
                          style={{ color: advances ? "var(--bone)" : "var(--mute, #8a8f99)" }}
                        >
                          {pct(t.qualify, 0)}
                        </span>
                      </div>
                      <div className="ml-[18px] mt-1.5">
                        <ProbBar
                          value={t.qualify}
                          color={color}
                          delay={gi * 60 + i * 40}
                          height={3}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-3 border-t border-[rgba(236,230,216,0.06)] pt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-mute">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ADVANCE }} />
                  qualify
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: WATCH }} />
                  3rd-place watch
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: OUT }} />
                  out
                </span>
              </div>

              {isOpen && (
                <div className="fade mt-4 space-y-1.5 border-t border-[rgba(236,230,216,0.06)] pt-4">
                  {gmatches.map((m) => (
                    <Fixture key={m.id} m={m} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Fixture({ m }: { m: GroupMatch }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-0.5 text-[11px]">
      <div className="flex items-center justify-end gap-1.5 overflow-hidden">
        <span
          className={`truncate ${
            m.winner === "home" ? "font-600 text-bone" : "text-mute"
          }`}
        >
          {m.home}
        </span>
        <Flag team={m.home} size={12} />
      </div>
      <span className="rounded bg-ink-700 px-2 py-0.5 font-mono text-[11px] font-500 text-signal tnum">
        {m.hg}–{m.ag}
      </span>
      <div className="flex items-center gap-1.5 overflow-hidden">
        <Flag team={m.away} size={12} />
        <span
          className={`truncate ${
            m.winner === "away" ? "font-600 text-bone" : "text-mute"
          }`}
        >
          {m.away}
        </span>
      </div>
    </div>
  );
}
