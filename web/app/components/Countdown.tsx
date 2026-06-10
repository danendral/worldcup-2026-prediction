"use client";

import { useEffect, useState } from "react";

function diff(toIso: string) {
  const target = new Date(toIso).getTime();
  const now = Date.now();
  const ms = Math.max(0, target - now);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { d, h, m, s, done: ms === 0 };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ kickoff }: { kickoff: string }) {
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    setT(diff(kickoff));
    const id = setInterval(() => setT(diff(kickoff)), 1000);
    return () => clearInterval(id);
  }, [kickoff]);

  const units = t
    ? [
        { v: t.d, l: "Days" },
        { v: t.h, l: "Hrs" },
        { v: t.m, l: "Min" },
        { v: t.s, l: "Sec" },
      ]
    : [
        { v: 0, l: "Days" },
        { v: 0, l: "Hrs" },
        { v: 0, l: "Min" },
        { v: 0, l: "Sec" },
      ];

  if (t?.done) {
    return (
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-conmebol">
        ● Tournament underway
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-mute">
        Kickoff in
      </span>
      <div className="flex items-center gap-1.5 tnum">
        {units.map((u, i) => (
          <div key={u.l} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center">
              <span className="font-display text-[18px] font-700 leading-none text-bone">
                {u.l === "Days" ? u.v : pad(u.v)}
              </span>
              <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-mute">
                {u.l}
              </span>
            </div>
            {i < units.length - 1 && (
              <span className="font-display text-[16px] font-500 text-signal/40">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
