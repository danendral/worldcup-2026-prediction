"""Canonical team name map across fixtures, Kaggle results, odds-api.

Canonical name = whatever the fixture file uses. All other sources map to it.
"""
from __future__ import annotations

# results CSV alias -> fixture canonical name
RESULTS_ALIASES = {
    "Cape Verde": "Cabo Verde",
    "Ivory Coast": "Côte d'Ivoire",
    "United States": "USA",
    "Bosnia and Herzegovina": "Bosnia & Herzegovina",
}

# odds API alias -> fixture canonical name
ODDS_ALIASES = {
    "Cape Verde": "Cabo Verde",
    "Ivory Coast": "Côte d'Ivoire",
    # odds-api uses "Curaçao" and "USA" already
}

# Playoff slot -> the team most likely to qualify (assigned by hand from
# real-world May 2026 playoff context). For each slot we assign the
# strongest team in the bracket; if uncertain, use a mid-tier replacement.
# These are educated guesses — the playoffs determine 6 of the 48 slots.
#
# FIFA Inter-confederation playoff (Mar 2026, in Mexico):
#   AFC: Iraq, AFC2: vs CONCACAF (Suriname/Jamaica?), OFC: New Caledonia,
#   CONMEBOL: Bolivia
# Best guess: FIFA Playoff 1 -> Iraq, FIFA Playoff 2 -> Bolivia
#
# UEFA Playoffs (March 2026): four playoff paths. The likely winners per
# seedings are: A=Italy, B=Denmark, C=Turkey, D=Poland (educated guess).
# Confirmed from odds-api fixture list (May 2026): playoffs have already been played
# or assigned. The odds-api lists the actual teams in each fixture slot.
PLAYOFF_ASSUMPTIONS = {
    "FIFA Playoff 1": "DR Congo",
    "FIFA Playoff 2": "Iraq",
    "UEFA Playoff A": "Bosnia & Herzegovina",
    "UEFA Playoff B": "Sweden",
    "UEFA Playoff C": "Turkey",
    "UEFA Playoff D": "Czech Republic",
}


def canonical_from_results(name: str) -> str:
    return RESULTS_ALIASES.get(name, name)


def canonical_from_odds(name: str) -> str:
    return ODDS_ALIASES.get(name, name)


def resolve_playoff(name: str) -> str:
    return PLAYOFF_ASSUMPTIONS.get(name, name)


if __name__ == "__main__":
    import sys, pandas as pd
    sys.stdout.reconfigure(encoding="utf-8")
    fx = pd.read_csv("reference/data/group_fixtures.csv", encoding="utf-8")
    fixture_teams = sorted(set(fx["home_team"]) | set(fx["away_team"]))
    resolved = sorted({resolve_playoff(t) for t in fixture_teams})
    print(f"{len(fixture_teams)} fixture team slots -> {len(resolved)} unique real teams after playoff resolution")
    print("Real teams:")
    for t in resolved: print(" ", t)
