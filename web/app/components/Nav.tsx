"use client";

import { useEffect, useState } from "react";
import { Flag } from "./Flag";
import { pct } from "../lib/format";

const SECTIONS = [
  { id: "overview", n: "01", label: "Overview" },
  { id: "insights", n: "02", label: "Insights" },
  { id: "contenders", n: "03", label: "Contenders" },
  { id: "groups", n: "04", label: "Groups" },
  { id: "bracket", n: "05", label: "Bracket" },
  { id: "teams", n: "06", label: "Teams" },
];

export function Nav({ pick, pickProb }: { pick?: string; pickProb?: number }) {
  const [active, setActive] = useState("overview");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      obs.disconnect();
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[rgba(236,230,216,0.08)] bg-[rgba(10,11,13,0.78)] backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="#overview" className="group flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(232,181,66,0.4)] bg-[rgba(232,181,66,0.08)]">
            <span className="font-display text-[15px] font-900 leading-none text-signal">
              26
            </span>
          </div>
          <div className="leading-none">
            <div className="font-display text-[13px] font-800 uppercase tracking-[0.08em] text-bone">
              World Cup<span className="text-signal"> 2026</span>
            </div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-mute">
              Prediction Engine
            </div>
          </div>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`group relative rounded px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                active === s.id ? "text-bone" : "text-mute hover:text-bone"
              }`}
            >
              <span className="mr-1.5 text-[9px] text-signal/70">{s.n}</span>
              {s.label}
              <span
                className={`absolute inset-x-3 -bottom-0.5 h-px origin-left bg-signal transition-transform duration-300 ${
                  active === s.id ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"
                }`}
              />
            </a>
          ))}
        </nav>

        {pick ? (
          <a
            href="#overview"
            className="lift flex items-center gap-2 rounded-full border border-[rgba(232,181,66,0.3)] bg-[rgba(232,181,66,0.06)] py-1.5 pl-2.5 pr-3 hover:border-[rgba(232,181,66,0.55)]"
            title="Highest championship probability across all simulations"
          >
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-mute sm:inline">
              Model pick
            </span>
            <span className="hidden h-3 w-px bg-[rgba(236,230,216,0.18)] sm:inline-block" />
            <Flag team={pick} size={15} />
            <span className="font-display text-[12px] font-700 uppercase tracking-tight text-bone">
              {pick}
            </span>
            {pickProb != null && (
              <span className="font-display text-[12px] font-800 text-signal tnum">
                {pct(pickProb, 0)}
              </span>
            )}
          </a>
        ) : null}
      </div>
    </header>
  );
}
