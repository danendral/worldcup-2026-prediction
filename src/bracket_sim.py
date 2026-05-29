"""Monte Carlo simulation of the entire tournament.

Pipeline:
1. Simulate each group N times → P(team finishes 1st / 2nd / 3rd) per group.
2. Tiebreakers: points, then goal difference, then goals for, then random
   (FIFA's later tiebreakers like fair play / head-to-head are hard to
   model; random tiebreak among ties is a fine proxy).
3. Identify the 8 best third-placed teams per FIFA rules (top-3 from each
   group → ranked across all 12 groups, top 8 advance).
4. Build knockout slot occupancy distributions: for each slot, P(team T is in this slot).
5. Simulate the knockout path forward through R32 → R16 → ... → Final.
6. For each knockout match_id, return:
     - distribution over (home_team, away_team) — pick mode for matchup
     - given that matchup, P(home wins), P(draw at 90 min) for penalties

We blend in bookmaker outright probabilities to anchor team strengths
at the tournament-level (gentle prior, not override).
"""
from __future__ import annotations
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

from .goals_model import lambdas, score_distribution
from .odds_blend import consensus_h2h_probs, outright_probs, blend_outcome, ipf_score_grid
from .team_map import resolve_playoff

RNG = np.random.default_rng(20260611)


def _resolve_fixture_team(name: str) -> str:
    return resolve_playoff(name)


def simulate_match(model: dict, home: str, away: str,
                   neutral: bool = True,
                   odds_p: tuple[float, float, float] | None = None,
                   blend_w: float = 0.65,
                   rng: np.random.Generator | None = None) -> tuple[int, int]:
    """Sample (home_goals, away_goals) from the (possibly odds-blended) DC distribution."""
    rng = rng or RNG
    P = score_distribution(model, home, away, neutral=neutral)
    if odds_p is not None:
        H_, A_ = P.shape
        # current 1X2 marginals
        ph = sum(P[i, j] for i in range(H_) for j in range(A_) if i > j)
        pd_ = sum(P[i, i] for i in range(H_))
        pa = 1 - ph - pd_
        # blend toward odds
        bh, bd, ba = blend_outcome((odds_p[0], odds_p[1], odds_p[2]), (ph, pd_, pa), w=blend_w)
        P = ipf_score_grid(P, bh, bd, ba)
    flat = P.flatten()
    idx = rng.choice(len(flat), p=flat / flat.sum())
    H_ = P.shape[0]
    return int(idx // H_), int(idx % H_)


def simulate_group(model: dict, teams: list[str],
                   match_odds: dict[tuple[str, str], dict] | None = None,
                   rng: np.random.Generator | None = None) -> list[dict]:
    """Simulate the 6 matches of a 4-team group, return standings sorted."""
    rng = rng or RNG
    standings = {t: {"P": 0, "GF": 0, "GA": 0, "GD": 0, "team": t} for t in teams}
    # All pairs, each plays once
    pairs = [(teams[i], teams[j]) for i in range(4) for j in range(i + 1, 4)]
    for h, a in pairs:
        odds_p = None
        if match_odds is not None:
            row = match_odds.get((h, a))
            if row is not None:
                odds_p = (row["P_h"], row["P_d"], row["P_a"])
        hg, ag = simulate_match(model, h, a, neutral=True, odds_p=odds_p, rng=rng)
        standings[h]["GF"] += hg; standings[h]["GA"] += ag
        standings[a]["GF"] += ag; standings[a]["GA"] += hg
        if hg > ag: standings[h]["P"] += 3
        elif hg < ag: standings[a]["P"] += 3
        else:
            standings[h]["P"] += 1; standings[a]["P"] += 1
    for s in standings.values():
        s["GD"] = s["GF"] - s["GA"]
    # Sort by P, GD, GF, random
    order = sorted(standings.values(),
                   key=lambda s: (-s["P"], -s["GD"], -s["GF"], rng.random()))
    return order


def simulate_tournament(model: dict, group_fixtures: pd.DataFrame,
                        knockout_slots: pd.DataFrame,
                        match_odds: dict[tuple[str, str], dict] | None = None,
                        rng: np.random.Generator | None = None) -> dict:
    """Run one full tournament simulation. Returns:
       { 'group_finish': {team: rank_in_group (1/2/3/4)},
         'group_of': {team: group_letter},
         'knockout_teams': {match_id: (home_team, away_team, home_won, drew_in_90)} }
    """
    rng = rng or RNG
    # Build groups from fixtures
    groups_def: dict[str, list[str]] = defaultdict(list)
    for _, row in group_fixtures.drop_duplicates(subset=["group", "home_team", "away_team"]).iterrows():
        for t in [_resolve_fixture_team(row["home_team"]), _resolve_fixture_team(row["away_team"])]:
            if t not in groups_def[row["group"]]:
                groups_def[row["group"]].append(t)
    # Ensure 4 per group
    for g, ts in groups_def.items():
        assert len(ts) == 4, f"group {g} has {len(ts)} teams: {ts}"

    group_finish: dict[str, int] = {}
    group_of: dict[str, str] = {}
    group_records: dict[str, dict] = {}
    for g, ts in sorted(groups_def.items()):
        order = simulate_group(model, ts, match_odds=match_odds, rng=rng)
        for rank, s in enumerate(order, start=1):
            group_finish[s["team"]] = rank
            group_of[s["team"]] = g
            group_records[s["team"]] = s

    # Best 3rd-placed teams: rank all 12 third-place finishers by (P, GD, GF)
    third_placers = [s for t, s in group_records.items() if group_finish[t] == 3]
    third_sorted = sorted(third_placers,
                          key=lambda s: (-s["P"], -s["GD"], -s["GF"], rng.random()))
    best_third_teams = [s["team"] for s in third_sorted[:8]]
    best_third_groups = {group_of[t] for t in best_third_teams}

    # Build slot -> team resolution
    slot_team: dict[str, str] = {}
    for t, r in group_finish.items():
        g = group_of[t]
        if r == 1: slot_team[f"Winner Group {g}"] = t
        elif r == 2: slot_team[f"Runner-up Group {g}"] = t

    # Best-3rd slots: pattern "Best 3rd (Groups X/Y/Z/W/V)"
    # FIFA rules: depending on which 8 groups produce best-3rd, slot mapping is from a lookup table.
    # We approximate: for each "Best 3rd (Groups X/Y/Z/W/V)" slot, pick the best-ranked
    # third-place team whose group is in that set AND who hasn't been assigned yet.
    used_thirds: set[str] = set()
    # Process slots in match_id order to mirror the official table's intent.
    for _, krow in knockout_slots.iterrows():
        for slot_field in ("slot_home", "slot_away"):
            slot = krow[slot_field]
            if not slot.startswith("Best 3rd"):
                continue
            # parse groups
            inside = slot[slot.index("(") + 1: slot.index(")")].replace("Groups ", "")
            allowed_groups = set(inside.split("/"))
            # Pick best third-ranked team from third_sorted whose group is in allowed_groups
            for s in third_sorted:
                if s["team"] in used_thirds:
                    continue
                if group_of[s["team"]] not in allowed_groups:
                    continue
                if s["team"] not in best_third_teams:
                    continue
                slot_team[slot] = s["team"]
                used_thirds.add(s["team"])
                break

    # If a slot was unfilled (rare combo), pick the best remaining third-placer
    for _, krow in knockout_slots.iterrows():
        for slot_field in ("slot_home", "slot_away"):
            slot = krow[slot_field]
            if slot.startswith("Best 3rd") and slot not in slot_team:
                for s in third_sorted:
                    if s["team"] in best_third_teams and s["team"] not in used_thirds:
                        slot_team[slot] = s["team"]
                        used_thirds.add(s["team"])
                        break

    # Knockout simulation
    knockout_teams: dict[int, tuple[str, str, bool, bool]] = {}
    # We'll fill match-by-match, resolving Winner Match X / Loser Match X
    for _, krow in knockout_slots.iterrows():
        mid = int(krow["match_id"])
        sh = krow["slot_home"]; sa = krow["slot_away"]
        # Resolve home team
        if sh.startswith("Winner Match"):
            ref = int(sh.split()[-1])
            h_team = knockout_teams[ref][0] if knockout_teams[ref][2] else knockout_teams[ref][1]
        elif sh.startswith("Loser Match"):
            ref = int(sh.split()[-1])
            h_team = knockout_teams[ref][1] if knockout_teams[ref][2] else knockout_teams[ref][0]
        else:
            h_team = slot_team.get(sh)
        if sa.startswith("Winner Match"):
            ref = int(sa.split()[-1])
            a_team = knockout_teams[ref][0] if knockout_teams[ref][2] else knockout_teams[ref][1]
        elif sa.startswith("Loser Match"):
            ref = int(sa.split()[-1])
            a_team = knockout_teams[ref][1] if knockout_teams[ref][2] else knockout_teams[ref][0]
        else:
            a_team = slot_team.get(sa)
        if h_team is None or a_team is None:
            # Fallback: should not happen
            knockout_teams[mid] = ("?", "?", True, False)
            continue
        if h_team not in model["idx"] or a_team not in model["idx"]:
            knockout_teams[mid] = (h_team, a_team, True, False)
            continue
        hg, ag = simulate_match(model, h_team, a_team, neutral=True, rng=rng)
        if hg > ag:
            home_won = True; drew = False
        elif hg < ag:
            home_won = False; drew = False
        else:
            # Penalties → 50/50
            home_won = bool(rng.random() < 0.5)
            drew = True
        knockout_teams[mid] = (h_team, a_team, home_won, drew)
    return {
        "group_finish": group_finish,
        "group_of": group_of,
        "slot_team": slot_team,
        "knockout_teams": knockout_teams,
    }


def aggregate_simulations(model: dict, group_fixtures: pd.DataFrame,
                          knockout_slots: pd.DataFrame, n_sims: int = 5000,
                          match_odds: dict | None = None, seed: int = 20260611):
    """Run N sims. Return aggregate stats:
       - knockout_team_pair_counts: {match_id: Counter[(home, away)]}
       - knockout_home_wins: {match_id: int}
       - knockout_draws_90: {match_id: int}
       - final_winners: Counter[team]
    """
    rng = np.random.default_rng(seed)
    pair_counts: dict[int, Counter] = defaultdict(Counter)
    home_wins: dict[int, int] = defaultdict(int)
    drew_90: dict[int, int] = defaultdict(int)
    final_winners: Counter = Counter()
    for _ in range(n_sims):
        out = simulate_tournament(model, group_fixtures, knockout_slots,
                                  match_odds=match_odds, rng=rng)
        for mid, (h, a, hw, d) in out["knockout_teams"].items():
            pair_counts[mid][(h, a)] += 1
            if hw: home_wins[mid] += 1
            if d: drew_90[mid] += 1
        # Final (match 104) winner team
        final = out["knockout_teams"].get(104)
        if final:
            h, a, hw, _ = final
            final_winners[h if hw else a] += 1
    return {
        "pair_counts": dict(pair_counts),
        "home_wins": dict(home_wins),
        "drew_90": dict(drew_90),
        "final_winners": final_winners,
        "n_sims": n_sims,
    }


if __name__ == "__main__":
    import sys; sys.stdout.reconfigure(encoding="utf-8")
    model = json.loads(Path("data/artifacts/goals_model.json").read_text(encoding="utf-8"))
    gfx = pd.read_csv("reference/data/group_fixtures.csv", encoding="utf-8")
    ks = pd.read_csv("reference/data/knockout_slots.csv", encoding="utf-8")
    h2h = consensus_h2h_probs()
    # Note: h2h is keyed on canonical (e.g. Bosnia & Herzegovina) -- need to convert
    # since match_odds uses fixture canonical names which post-playoff-resolution
    # match the odds-API team names already. Good.
    print("Running 1000-sim trial...")
    agg = aggregate_simulations(model, gfx, ks, n_sims=1000, match_odds=h2h)
    print(f"Sims complete. n_sims = {agg['n_sims']}")
    print("\nTop 10 final-winner probabilities:")
    for t, c in agg["final_winners"].most_common(10):
        print(f"  {t:30s} {c/agg['n_sims']*100:5.1f}%")
    print("\nSample R32 matchups (top pair per slot):")
    for mid in range(73, 83):
        pair, count = agg["pair_counts"][mid].most_common(1)[0]
        pct = count / agg['n_sims'] * 100
        hw_pct = agg["home_wins"][mid] / agg['n_sims'] * 100
        print(f"  m{mid}: {pair[0]:25s} vs {pair[1]:25s} ({pct:.0f}%) | P(home_wins)={hw_pct:.0f}%")
