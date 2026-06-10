"""Export a single predictions.json the web app consumes.

This is a *driver* over the existing model code — it does NOT change any model.
It re-runs the Monte Carlo bracket simulation while tracking extra aggregates
the standard pipeline discards (per-team round-reach counts, group-finish
distributions, R32 matchup distributions), then bundles them with the
deterministic 104-match predictions from ``submission.build_all``.

Run:  python -m src.export_web   [--sims N]   [--out PATH]
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

from .bracket_sim import simulate_tournament
from .odds_blend import consensus_h2h_probs, outright_probs
from .submission import build_all
from .team_map import resolve_playoff

ARTIFACTS = Path("data/artifacts")
DEFAULT_OUT = Path("web/public/data/predictions.json")

# Rounds a team can be said to have "reached", in order. A team reaches round R
# if it appears in (i.e. is a participant of) a match of round R in a given sim.
ROUND_KEYS = ["r32", "r16", "qf", "sf", "final", "champion"]
ROUND_LABELS = {
    "qualify": "Group Qualify",
    "r32": "Round of 32",
    "r16": "Round of 16",
    "qf": "Quarter-finals",
    "sf": "Semi-finals",
    "final": "Final",
    "champion": "Champion",
}
# match_id ranges per knockout round (from knockout_slots.csv)
ROUND_OF_MATCH = {}
for _mid in range(73, 89):
    ROUND_OF_MATCH[_mid] = "r32"
for _mid in range(89, 97):
    ROUND_OF_MATCH[_mid] = "r16"
for _mid in range(97, 101):
    ROUND_OF_MATCH[_mid] = "qf"
for _mid in (101, 102):
    ROUND_OF_MATCH[_mid] = "sf"
ROUND_OF_MATCH[104] = "final"  # 103 is the third-place playoff; ignore for reach metrics


def _confederation_map(fixtures: pd.DataFrame) -> dict:
    """Hard-coded confederation per real (post-playoff) team. Used only for
    UI grouping/filters; not part of any model."""
    conf = {
        # CONMEBOL
        "Brazil": "CONMEBOL", "Argentina": "CONMEBOL", "Uruguay": "CONMEBOL",
        "Colombia": "CONMEBOL", "Ecuador": "CONMEBOL", "Paraguay": "CONMEBOL",
        # UEFA
        "Spain": "UEFA", "France": "UEFA", "England": "UEFA", "Germany": "UEFA",
        "Portugal": "UEFA", "Netherlands": "UEFA", "Belgium": "UEFA",
        "Croatia": "UEFA", "Switzerland": "UEFA", "Austria": "UEFA",
        "Norway": "UEFA", "Scotland": "UEFA", "Turkey": "UEFA", "Sweden": "UEFA",
        "Czech Republic": "UEFA", "Bosnia & Herzegovina": "UEFA",
        # CONCACAF
        "Mexico": "CONCACAF", "USA": "CONCACAF", "Canada": "CONCACAF",
        "Panama": "CONCACAF", "Haiti": "CONCACAF",
        # CAF
        "Morocco": "CAF", "Senegal": "CAF", "Egypt": "CAF", "Ghana": "CAF",
        "Côte d'Ivoire": "CAF", "Tunisia": "CAF", "Algeria": "CAF",
        "Cabo Verde": "CAF", "South Africa": "CAF", "DR Congo": "CAF",
        # AFC
        "Japan": "AFC", "South Korea": "AFC", "Iran": "AFC", "Australia": "AFC",
        "Saudi Arabia": "AFC", "Qatar": "AFC", "Uzbekistan": "AFC",
        "Jordan": "AFC", "Iraq": "AFC",
        # OFC
        "New Zealand": "OFC", "Curaçao": "CONCACAF",
    }
    return conf


def _group_of_team(fixtures: pd.DataFrame) -> dict:
    """Map each real team -> its group letter."""
    g_of = {}
    seen = fixtures.drop_duplicates(subset=["group", "home_team", "away_team"])
    for _, row in seen.iterrows():
        for raw in (row["home_team"], row["away_team"]):
            t = resolve_playoff(raw)
            g_of[t] = row["group"]
    return g_of


def aggregate_full(model: dict, gfx: pd.DataFrame, ks: pd.DataFrame,
                   n_sims: int, match_odds: dict, seed: int = 20260611) -> dict:
    """Run N sims, tracking per-team reach/group-finish/champion counts and
    R32 matchup pair distributions. Mirrors aggregate_simulations but richer."""
    rng = np.random.default_rng(seed)
    reach = defaultdict(lambda: defaultdict(int))      # team -> round_key -> count
    qualify = defaultdict(int)                          # team -> times finished top-2
    group_finish = defaultdict(lambda: defaultdict(int))  # team -> rank(1..4) -> count
    champion = Counter()
    pair_counts = defaultdict(Counter)                 # match_id -> Counter[(h,a)]
    home_wins = defaultdict(int)
    drew_90 = defaultdict(int)

    for _ in range(n_sims):
        out = simulate_tournament(model, gfx, ks, match_odds=match_odds, rng=rng)
        # Group standings
        for team, rank in out["group_finish"].items():
            group_finish[team][rank] += 1
            if rank <= 2:
                qualify[team] += 1
        # Knockout participation -> reach metrics
        reached_this_sim = defaultdict(set)  # team -> set of round_keys reached
        for mid, (h, a, hw, d) in out["knockout_teams"].items():
            pair_counts[mid][(h, a)] += 1
            if hw:
                home_wins[mid] += 1
            if d:
                drew_90[mid] += 1
            rkey = ROUND_OF_MATCH.get(mid)
            if rkey:
                reached_this_sim[h].add(rkey)
                reached_this_sim[a].add(rkey)
        for team, rounds in reached_this_sim.items():
            for rk in rounds:
                reach[team][rk] += 1
        # Champion
        final = out["knockout_teams"].get(104)
        if final:
            h, a, hw, _ = final
            champ = h if hw else a
            champion[champ] += 1
            reach[champ]["champion"] += 1

    return {
        "reach": reach, "qualify": qualify, "group_finish": group_finish,
        "champion": champion, "pair_counts": pair_counts,
        "home_wins": home_wins, "drew_90": drew_90, "n_sims": n_sims,
    }


def _round_label(rnd: str) -> str:
    return {
        "Round of 32": "Round of 32", "Round of 16": "Round of 16",
        "Quarter-final": "Quarter-finals", "Semi-final": "Semi-finals",
        "Third-place playoff": "Third-place", "Final": "Final",
    }.get(rnd, rnd)


def build_payload(n_sims: int) -> dict:
    model = json.loads((ARTIFACTS / "goals_model.json").read_text(encoding="utf-8"))
    gfx = pd.read_csv("reference/data/group_fixtures.csv", encoding="utf-8")
    ks = pd.read_csv("reference/data/knockout_slots.csv", encoding="utf-8")
    h2h = consensus_h2h_probs()

    print(f"Building deterministic 104-match predictions (n_sims={n_sims}) …")
    group_pred, knock_pred = build_all(n_sims=n_sims)

    print(f"Running enriched aggregation ({n_sims} sims) for stage probabilities …")
    agg = aggregate_full(model, gfx, ks, n_sims=n_sims, match_odds=h2h)
    N = agg["n_sims"]

    conf = _confederation_map(gfx)
    g_of = _group_of_team(gfx)
    try:
        outrights = outright_probs()  # bookmaker outright odds, de-vigged (optional)
    except Exception:
        outrights = {}

    # ---- Teams ----
    all_teams = sorted(g_of.keys())
    teams = []
    for t in all_teams:
        stages = {
            "qualify": round(agg["qualify"].get(t, 0) / N, 4),
            "r32": round(agg["reach"][t].get("r32", 0) / N, 4),
            "r16": round(agg["reach"][t].get("r16", 0) / N, 4),
            "qf": round(agg["reach"][t].get("qf", 0) / N, 4),
            "sf": round(agg["reach"][t].get("sf", 0) / N, 4),
            "final": round(agg["reach"][t].get("final", 0) / N, 4),
            "champion": round(agg["champion"].get(t, 0) / N, 4),
        }
        gf = agg["group_finish"][t]
        teams.append({
            "name": t,
            "group": g_of.get(t, "?"),
            "confederation": conf.get(t, "—"),
            "elo": round(model.get("raw_elo", {}).get(t, 0.0), 1),
            "stages": stages,
            "groupFinish": {str(r): round(gf.get(r, 0) / N, 4) for r in (1, 2, 3, 4)},
        })
    teams.sort(key=lambda x: -x["stages"]["champion"])

    # ---- Groups ----
    groups = {}
    for t in teams:
        g = t["group"]
        groups.setdefault(g, []).append({
            "name": t["name"], "confederation": t["confederation"],
            "qualify": t["stages"]["qualify"], "champion": t["stages"]["champion"],
            "winGroup": t["groupFinish"]["1"],
        })
    groups_out = []
    for g in sorted(groups.keys()):
        members = sorted(groups[g], key=lambda x: -x["qualify"])
        groups_out.append({"group": g, "teams": members})

    # ---- Group matches ----
    group_matches = []
    for _, r in group_pred.iterrows():
        group_matches.append({
            "id": int(r["match_id"]), "group": r["group"],
            "home": resolve_playoff(r["home_team"]), "away": resolve_playoff(r["away_team"]),
            "homeSlot": r["home_team"], "awaySlot": r["away_team"],
            "date": r["date_utc"], "venue": r["venue"],
            "hg": int(r["predicted_home_goals"]), "ag": int(r["predicted_away_goals"]),
            "corners": int(r["corners"]), "yellows": int(r["yellow_cards"]),
            "reds": int(r["red_cards"]), "winner": r["winning_team"],
        })

    # ---- Knockout matches (with matchup confidence from sims) ----
    knockout = []
    for _, r in knock_pred.iterrows():
        mid = int(r["match_id"])
        counter = agg["pair_counts"].get(mid, Counter())
        total = sum(counter.values()) or 1
        h_team = r["predicted_home_team"]; a_team = r["predicted_away_team"]
        # confidence in this exact matchup occurring
        matchup_conf = round(counter.get((h_team, a_team), 0) / total, 4) if counter else None
        # alternative matchups for this slot (top 4)
        alts = [{"home": p[0], "away": p[1], "prob": round(c / total, 4)}
                for p, c in counter.most_common(4)]
        hw = agg["home_wins"].get(mid, 0)
        knockout.append({
            "id": mid, "round": _round_label(r["round"]), "multiplier": int(r["multiplier"]),
            "date": r["date_utc"], "venue": r["venue"],
            "homeSlot": r["slot_home"], "awaySlot": r["slot_away"],
            "home": h_team, "away": a_team,
            "hg": int(r["predicted_home_goals"]), "ag": int(r["predicted_away_goals"]),
            "corners": int(r["corners"]), "yellows": int(r["yellow_cards"]),
            "reds": int(r["red_cards"]),
            "winner": r["match_winner"], "penalties": bool(r["penalties"]),
            "homeWinProb": round(hw / total, 4) if counter else None,
            "matchupConfidence": matchup_conf, "alternatives": alts,
        })

    # ---- Final / champion summary ----
    # WEB DISPLAY RULE (does NOT touch the DataCamp submission in submission.py):
    # crown the higher *title-odds* finalist so the headline champion, the
    # contenders ranking, and the bracket's final winner are always the same
    # team. The chalk bracket in submission.py resolves each match by its
    # single-match point estimate, which can hand a near-coin-flip final to the
    # slightly-favoured side even when the other finalist is the stronger team
    # across all simulated paths (e.g. a 49.2/50.8 final). For the web we present
    # one consistent champion: whichever finalist has the higher tournament
    # title odds.
    final_row = knock_pred[knock_pred["match_id"] == 104].iloc[0]
    fh = final_row["predicted_home_team"]
    fa = final_row["predicted_away_team"]
    title_odds = {t["name"]: t["stages"]["champion"] for t in teams}
    if title_odds.get(fh, 0.0) >= title_odds.get(fa, 0.0):
        champ, runner, champ_side = fh, fa, "home"
    else:
        champ, runner, champ_side = fa, fh, "away"
    # Reflect the crowned finalist on the bracket's final card so the bracket
    # visual ends on the same champion the headline shows.
    for _m in knockout:
        if _m["id"] == 104:
            _m["winner"] = champ_side
    champ_prob = title_odds.get(champ, teams[0]["stages"]["champion"])
    top_contenders = teams[:5]
    pens_count = int(knock_pred[knock_pred["round"] != "Third-place playoff"]["penalties"].sum())

    payload = {
        "meta": {
            "title": "FIFA World Cup 2026",
            "model": "Time-decayed Elo · Dixon-Coles bivariate Poisson · 65/35 bookmaker blend",
            "nSims": N,
            "asOf": model.get("as_of", ""),
            "kickoff": "2026-06-11T16:00:00Z",
            "window": "Jun 11 – Jul 19, 2026",
            "host": "USA · Canada · Mexico",
            "matchesPredicted": 104,
        },
        "summary": {
            # Single, consistent champion across the whole site = the higher
            # title-odds finalist (see the WEB DISPLAY RULE above). Headline,
            # contenders ranking and bracket final all resolve to this team.
            "champion": champ,
            "championProb": champ_prob,
            "bracketChampion": champ, "bracketRunnerUp": runner,
            "runnerUp": runner,
            "finalScore": f"{int(final_row['predicted_home_goals'])}–{int(final_row['predicted_away_goals'])}",
            "finalPenalties": bool(final_row["penalties"]),
            "topContenders": [{"name": t["name"], "group": t["group"],
                               "confederation": t["confederation"],
                               "champion": t["stages"]["champion"],
                               "final": t["stages"]["final"],
                               "sf": t["stages"]["sf"]} for t in top_contenders],
            "knockoutsToPens": pens_count,
            "stageOrder": ROUND_KEYS,
            "stageLabels": ROUND_LABELS,
        },
        "teams": teams,
        "groups": groups_out,
        "groupMatches": group_matches,
        "knockout": knockout,
    }
    return payload


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--sims", type=int, default=3000)
    ap.add_argument("--out", type=str, default=str(DEFAULT_OUT))
    args = ap.parse_args()

    payload = build_payload(args.sims)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✓ Wrote {out}  ({out.stat().st_size/1024:.0f} KB)")
    print(f"  Champion: {payload['summary']['champion']} "
          f"({payload['summary']['championProb']*100:.1f}%)")
    print(f"  Teams: {len(payload['teams'])}  Groups: {len(payload['groups'])}  "
          f"Knockout: {len(payload['knockout'])}")


if __name__ == "__main__":
    main()
