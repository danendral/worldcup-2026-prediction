"""FIFA-style Elo computed from international results history.

Reference: eloratings.net methodology.
- Base K depends on match importance.
- K multiplied by goal-difference factor.
- Home advantage = +65 Elo unless neutral venue.
"""
from __future__ import annotations
import json
import math
from pathlib import Path
import pandas as pd

from .team_map import canonical_from_results

ARTIFACTS = Path("data/artifacts")
START_RATING = 1500.0
HOME_ADV = 65.0

# tournament weight (eloratings.net K)
K_BY_TOURNAMENT = {
    "FIFA World Cup": 60,
    "FIFA World Cup qualification": 40,
    "UEFA Euro": 50,
    "UEFA Euro qualification": 40,
    "Copa América": 50,
    "African Cup of Nations": 50,
    "AFC Asian Cup": 50,
    "CONCACAF Gold Cup": 40,
    "Confederations Cup": 40,
    "UEFA Nations League": 40,
    "CONCACAF Nations League": 30,
    "Friendly": 20,
}
K_DEFAULT = 30


def _k_for(tournament: str) -> int:
    if tournament in K_BY_TOURNAMENT:
        return K_BY_TOURNAMENT[tournament]
    if "qualification" in tournament.lower():
        return 35
    if "friendly" in tournament.lower():
        return 20
    return K_DEFAULT


def _goal_diff_mult(home_goals: int, away_goals: int) -> float:
    diff = abs(home_goals - away_goals)
    if diff <= 1:
        return 1.0
    if diff == 2:
        return 1.5
    # eloratings.net: (11+N)/8 for N>=3
    return (11 + diff) / 8.0


def _expected(rating_a: float, rating_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))


def _result(home_goals: int, away_goals: int) -> float:
    if home_goals > away_goals:
        return 1.0
    if home_goals < away_goals:
        return 0.0
    return 0.5


def fit_elo(results_csv: Path = Path("data/raw/results.csv"),
            as_of: str = "2026-05-30") -> dict:
    """Walk every match in order, updating ratings. Return final ratings dict."""
    df = pd.read_csv(results_csv)
    df = df[df["date"] <= as_of].copy()
    df = df.dropna(subset=["home_score", "away_score"])
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)
    df["home_team"] = df["home_team"].map(lambda x: canonical_from_results(x))
    df["away_team"] = df["away_team"].map(lambda x: canonical_from_results(x))
    df = df.sort_values("date").reset_index(drop=True)

    ratings: dict[str, float] = {}

    for row in df.itertuples(index=False):
        h, a = row.home_team, row.away_team
        rh = ratings.get(h, START_RATING)
        ra = ratings.get(a, START_RATING)
        neutral = bool(row.neutral) if str(row.neutral).lower() in ("true", "false") else (
            str(row.neutral).strip().lower() == "true"
        )
        rh_eff = rh + (0 if neutral else HOME_ADV)
        ra_eff = ra + (HOME_ADV if neutral else 0)  # neutral: no advantage; non-neutral: away gets nothing
        ra_eff = ra  # away never gets home_adv
        if neutral:
            rh_eff = rh

        exp_h = _expected(rh_eff, ra_eff)
        actual_h = _result(row.home_score, row.away_score)
        k = _k_for(str(row.tournament))
        gmult = _goal_diff_mult(row.home_score, row.away_score)
        delta = k * gmult * (actual_h - exp_h)

        ratings[h] = rh + delta
        ratings[a] = ra - delta

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    out = ARTIFACTS / "elo.json"
    out.write_text(json.dumps(ratings, indent=2, ensure_ascii=False), encoding="utf-8")
    return ratings


if __name__ == "__main__":
    import sys; sys.stdout.reconfigure(encoding="utf-8")
    ratings = fit_elo()
    print(f"Teams rated: {len(ratings)}")
    top = sorted(ratings.items(), key=lambda x: -x[1])[:20]
    print("Top 20:")
    for t, r in top:
        print(f"  {t:30s} {r:7.1f}")
