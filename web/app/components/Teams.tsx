"use client";

import { useMemo, useState } from "react";
import type { Team } from "../lib/types";
import { CONF_COLOR } from "../lib/flags";
import { Flag } from "./Flag";
import { pct } from "../lib/format";
import { SectionHead } from "./Contenders";

const CONFS = ["All", "UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"];

export function Teams({
  teams,
  onSelect,
}: {
  teams: Team[];
  onSelect: (name: string) => void;
}) {
  const [conf, setConf] = useState("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let list = conf === "All" ? teams : teams.filter((t) => t.confederation === conf);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => b.stages.champion - a.stages.champion);
  }, [teams, conf, q]);

  return (
    <section id="teams" className="mx-auto max-w-[1320px] scroll-mt-20 px-5 py-16 sm:px-8">
      <SectionHead
        n="06"
        title="All 48 Teams"
        sub="Every nation's projected route — qualify, reach, and championship odds. Click any team for the full stage-by-stage breakdown and most-likely path."
      />

      <div className="mt-7 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CONFS.map((c) => (
            <button
              key={c}
              onClick={() => setConf(c)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
                conf === c
                  ? "border-signal bg-signal text-ink-900"
                  : "border-[rgba(236,230,216,0.12)] text-mute hover:border-[rgba(236,230,216,0.3)] hover:text-bone"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search team…"
            className="w-44 rounded-full border border-[rgba(236,230,216,0.12)] bg-ink-800/60 px-4 py-1.5 font-mono text-[11px] text-bone outline-none transition-colors placeholder:text-mute/60 focus:border-signal"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((t, i) => {
          const c = CONF_COLOR[t.confederation] || "#8a8f99";
          return (
            <button
              key={t.name}
              onClick={() => onSelect(t.name)}
              className="lift group rounded-xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-4 text-left hover:border-[rgba(232,181,66,0.4)] hover:bg-ink-800"
            >
              <div className="flex items-center justify-between">
                <Flag team={t.name} size={26} />
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em]"
                  style={{ background: `${c}1a`, color: c }}
                >
                  {t.confederation}
                </span>
              </div>
              <div className="mt-3 truncate font-display text-[16px] font-700 uppercase tracking-tight text-bone group-hover:text-signal">
                {t.name}
              </div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-mute">
                Group {t.group}
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-[rgba(236,230,216,0.06)] pt-3">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-mute">
                    Champion
                  </div>
                  <div className="font-display text-[18px] font-800 leading-none text-signal tnum">
                    {pct(t.stages.champion)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-mute">
                    Qualify
                  </div>
                  <div className="font-display text-[14px] font-700 leading-none text-bone tnum">
                    {pct(t.stages.qualify, 0)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="mt-10 text-center font-mono text-[12px] uppercase tracking-[0.16em] text-mute">
          No teams match “{q}”
        </div>
      )}
    </section>
  );
}
