import type { Predictions } from "../lib/types";
import { pct } from "../lib/format";
import { Flag } from "./Flag";
import { Countdown } from "./Countdown";
import { CONF_COLOR } from "../lib/flags";

export function Hero({ data }: { data: Predictions }) {
  const { summary, meta, teams } = data;
  const top3 = teams.slice(0, 3);
  // The crowned champion is consistent everywhere (headline, title race, bracket).
  const champ = teams.find((t) => t.name === summary.champion) ?? teams[0];
  // Title race = the same probabilistic ranking the headline uses, so the whole
  // hero tells one consistent story (no competing "winner" methodologies).
  const titleRace = teams.slice(0, 5);
  const raceMax = titleRace[0]?.stages.champion || 1;

  return (
    <section id="overview" className="relative mx-auto max-w-[1320px] px-5 pb-12 pt-8 sm:px-8">
      {/* status strip */}
      <div className="rise mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(236,230,216,0.08)] pb-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-conmebol" />
          {meta.matchesPredicted} / 104 matches resolved
          <span className="text-mute/40">·</span>
          <span className="text-mute/70">
            {meta.nSims.toLocaleString()} Monte Carlo tournaments
          </span>
        </div>
        <Countdown kickoff={meta.kickoff} />
      </div>

      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        {/* LEFT — headline */}
        <div>
          <div
            className="rise mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
            style={{
              borderColor: "rgba(232,181,66,0.3)",
              background: "rgba(232,181,66,0.06)",
              animationDelay: "60ms",
            }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
              ★ Projected Champion
            </span>
          </div>

          <h1
            className="rise font-display text-[clamp(40px,7vw,86px)] font-900 uppercase leading-[0.9] tracking-tightest text-bone"
            style={{ animationDelay: "120ms" }}
          >
            FIFA World Cup
            <br />
            <span className="text-mute/50">2026</span> Forecast
          </h1>

          <p
            className="rise mt-6 max-w-[52ch] text-[15px] leading-relaxed text-mute"
            style={{ animationDelay: "200ms" }}
          >
            A probabilistic projection of all <span className="text-bone">104 matches</span> —
            time-decayed Elo, a Dixon–Coles bivariate Poisson goal model, and a 65/35
            bookmaker blend, run across{" "}
            <span className="text-bone">{meta.nSims.toLocaleString()}</span> simulated
            tournaments.
          </p>

          {/* champion line */}
          <div
            className="rise mt-9 flex items-end gap-5"
            style={{ animationDelay: "280ms" }}
          >
            <Flag team={champ.name} size={52} className="rounded-md" />
            <div>
              <div className="font-display text-[clamp(30px,5vw,52px)] font-800 uppercase leading-none tracking-tight text-bone">
                {champ.name}
              </div>
              <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
                Group {champ.group} · {champ.confederation}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="shimmer-text font-display text-[clamp(40px,6vw,64px)] font-900 leading-none tracking-tightest tnum">
                {pct(summary.championProb)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                to lift the trophy
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — title race (consistent with the headline) */}
        <div
          className="rise relative overflow-hidden rounded-2xl border border-[rgba(236,230,216,0.1)] bg-gradient-to-b from-ink-800 to-ink-900 p-7"
          style={{ animationDelay: "340ms" }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--signal)" }}
          />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
                ◆ Title Race
              </span>
              <span className="rounded border border-[rgba(236,230,216,0.12)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-mute">
                champion %
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {titleRace.map((t, i) => {
                const c = CONF_COLOR[t.confederation] || "#8a8f99";
                const w = (t.stages.champion / raceMax) * 100;
                return (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className="w-3 shrink-0 font-mono text-[10px] text-mute/50 tnum">
                      {i + 1}
                    </span>
                    <Flag team={t.name} size={16} />
                    <span className="w-[78px] shrink-0 truncate font-display text-[13px] font-700 uppercase tracking-tight text-bone">
                      {t.name}
                    </span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[rgba(236,230,216,0.05)]">
                      <div
                        className="bar-fill h-full rounded-full"
                        style={{
                          width: `${w}%`,
                          background: `linear-gradient(90deg, ${c}aa, ${c})`,
                          animationDelay: `${380 + i * 70}ms`,
                        }}
                      />
                    </div>
                    <span
                      className="w-12 shrink-0 text-right font-display text-[14px] font-800 tnum"
                      style={{ color: i === 0 ? "var(--signal)" : "var(--bone)" }}
                    >
                      {pct(t.stages.champion, 1)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-[rgba(236,230,216,0.08)] pt-5">
              <MiniStat k="Field" v="48" sub="teams" />
              <MiniStat k="KO → pens" v={`${summary.knockoutsToPens}`} sub="/ 31" />
              <MiniStat k="Sims" v={`${(meta.nSims / 1000).toFixed(0)}k`} />
            </div>
            <div className="mt-4 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-mute/70">
              Probability of lifting the trophy across {meta.nSims.toLocaleString()} sims —
              the same favourite our submitted single-path{" "}
              <a href="#bracket" className="text-signal/80 underline-offset-2 hover:underline">
                bracket
              </a>{" "}
              carries to the final.
            </div>
          </div>
        </div>
      </div>

      {/* top-3 contender strip */}
      <div
        className="rise mt-12 grid gap-3 sm:grid-cols-3"
        style={{ animationDelay: "420ms" }}
      >
        {top3.map((t, i) => (
          <div
            key={t.name}
            className="lift group flex items-center gap-4 rounded-xl border border-[rgba(236,230,216,0.08)] bg-ink-800/40 p-4 hover:border-[rgba(232,181,66,0.4)] hover:bg-ink-800"
          >
            <span className="font-display text-[34px] font-900 leading-none text-mute/25 tnum">
              {i + 1}
            </span>
            <Flag team={t.name} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[16px] font-700 uppercase tracking-tight text-bone">
                {t.name}
              </div>
              <div
                className="font-mono text-[9px] uppercase tracking-[0.16em]"
                style={{ color: CONF_COLOR[t.confederation] }}
              >
                {t.confederation}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-[20px] font-800 leading-none text-signal tnum">
                {pct(t.stages.champion)}
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-mute">
                champion
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniStat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-mute">{k}</div>
      <div className="mt-1 font-display text-[20px] font-800 leading-none text-bone tnum">
        {v}
        {sub && <span className="ml-1 text-[12px] font-500 text-mute">{sub}</span>}
      </div>
    </div>
  );
}
