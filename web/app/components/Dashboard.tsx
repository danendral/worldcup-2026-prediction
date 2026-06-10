"use client";

import { useCallback, useState } from "react";
import type { Predictions, KnockoutMatch } from "../lib/types";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Insights } from "./Insights";
import { Contenders } from "./Contenders";
import { Groups } from "./Groups";
import { Bracket } from "./Bracket";
import { Teams } from "./Teams";
import { TeamModal } from "./TeamModal";
import { MatchModal } from "./MatchModal";

export function Dashboard({ data }: { data: Predictions }) {
  const [teamName, setTeamName] = useState<string | null>(null);
  const [match, setMatch] = useState<KnockoutMatch | null>(null);

  const selectTeam = useCallback((name: string) => {
    setMatch(null);
    setTeamName(name);
  }, []);

  const selectMatch = useCallback((m: KnockoutMatch) => {
    setTeamName(null);
    setMatch(m);
  }, []);

  const team = teamName ? data.teams.find((t) => t.name === teamName) ?? null : null;

  return (
    <>
      <Nav pick={data.summary.champion} pickProb={data.summary.championProb} />
      <main>
        <Hero data={data} />
        <Insights data={data} onSelect={selectTeam} />
        <Contenders teams={data.teams} onSelect={selectTeam} />
        <Groups groups={data.groups} matches={data.groupMatches} onSelect={selectTeam} />
        <Bracket matches={data.knockout} onSelect={selectMatch} />
        <Teams teams={data.teams} onSelect={selectTeam} />
      </main>

      <footer className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-3 border-t border-[rgba(236,230,216,0.08)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
            FIFA World Cup 2026 · Prediction Engine · v1.0
          </div>
          <div className="max-w-[52ch] font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-mute/60">
            {data.meta.model} · {data.meta.nSims.toLocaleString()} sims · as of {data.meta.asOf}
          </div>
        </div>
      </footer>

      {team && (
        <TeamModal
          team={team}
          knockout={data.knockout}
          onClose={() => setTeamName(null)}
          onPickTeam={selectTeam}
        />
      )}
      {match && <MatchModal m={match} onClose={() => setMatch(null)} />}
    </>
  );
}
