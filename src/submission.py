"""Assemble final predictions:
- Group stage: 72 rows with predicted_home_goals, predicted_away_goals, corners,
  yellow_cards, red_cards, winning_team.
- Knockout: 32 rows with predicted_home_team, predicted_away_team,
  predicted_home_goals, predicted_away_goals, corners, yellow_cards, red_cards,
  match_winner, penalties.
"""
from __future__ import annotations
import json

from pathlib import Path

import numpy as np
import pandas as pd

from .goals_model import score_distribution
from .odds_blend import consensus_h2h_probs, blend_outcome, ipf_score_grid
from .score_optimizer import pick_score, outcome_probs, winning_team
from .ancillary import predict_corners, predict_yellow_cards, predict_red_cards
from .bracket_sim import aggregate_simulations
from .team_map import resolve_playoff

ARTIFACTS = Path("data/artifacts")


def _blended_score_dist(model: dict, home: str, away: str,
                        odds_row: dict | None,
                        blend_w: float = 0.65) -> np.ndarray:
    P = score_distribution(model, home, away, neutral=True)
    if odds_row is not None:
        ph, pd_, pa = outcome_probs(P)
        bh, bd, ba = blend_outcome((odds_row["P_h"], odds_row["P_d"], odds_row["P_a"]),
                                   (ph, pd_, pa), w=blend_w)
        P = ipf_score_grid(P, bh, bd, ba)
    return P


def build_group_predictions(model: dict, fixtures_df: pd.DataFrame,
                            h2h_probs: dict) -> pd.DataFrame:
    rows = fixtures_df.copy()
    pred_h, pred_a, corners, yel, red, winner = [], [], [], [], [], []
    for _, row in rows.iterrows():
        # Resolve playoffs
        h = resolve_playoff(row["home_team"])
        a = resolve_playoff(row["away_team"])
        odds_row = h2h_probs.get((h, a))
        P = _blended_score_dist(model, h, a, odds_row, blend_w=0.65)
        h_star, a_star, _ = pick_score(P)
        ph, _pd, pa = outcome_probs(P)
        w = winning_team(P)
        pred_h.append(h_star); pred_a.append(a_star)
        corners.append(predict_corners(ph, pa, knockout=False))
        yel.append(predict_yellow_cards(ph, pa, knockout=False, multiplier=1))
        red.append(predict_red_cards(knockout=False, multiplier=1))
        winner.append(w)
    rows["predicted_home_goals"] = pred_h
    rows["predicted_away_goals"] = pred_a
    rows["corners"] = corners
    rows["yellow_cards"] = yel
    rows["red_cards"] = red
    rows["winning_team"] = winner
    return rows


def _r32_from_modal_slots(sim_agg: dict, knockout_slots: pd.DataFrame) -> dict[int, tuple[str, str]]:
    """Resolve all R32 matchups from the modal slot→team mapping.

    modal_slot_team is derived from the most-common complete group finishing order
    per group across all simulations — one consistent world-state, so the same team
    can never appear in two slots simultaneously.
    """
    slot_team = sim_agg["modal_slot_team"]
    bracket: dict[int, tuple[str, str]] = {}
    for _, krow in knockout_slots.iterrows():
        if krow["round"] != "Round of 32":
            continue
        mid = int(krow["match_id"])
        h = slot_team.get(krow["slot_home"], "?")
        a = slot_team.get(krow["slot_away"], "?")
        bracket[mid] = (h, a)
    return bracket


def build_knockout_predictions(model: dict, knockout_slots: pd.DataFrame,
                               sim_agg: dict, h2h_probs: dict) -> pd.DataFrame:
    """Given simulation aggregates, pick the most-likely matchup for each
    knockout slot, then re-derive the match-level prediction using the
    goals model on that pair (no odds blend; group-stage results haven't
    happened yet, so odds for knockout matches don't exist)."""
    rows = knockout_slots.copy()
    # We process in order, tracking used teams ONLY within Round of 32
    # (since each team can only appear in one R32 slot). For later rounds,
    # teams are derived from winners and can re-appear naturally.

    pred_h_team, pred_a_team = [], []
    pred_h_goals, pred_a_goals = [], []
    corners_l, yel_l, red_l = [], [], []
    match_winner_l, penalties_l = [], []

    # Resolve all R32 matchups from the modal group standings — one consistent
    # world-state, guaranteed no duplicate teams across slots.
    r32_bracket = _r32_from_modal_slots(sim_agg, rows)

    # Track predicted winner for each match_id (for downstream rounds)
    predicted_winner: dict[int, str] = {}
    predicted_loser: dict[int, str] = {}

    for _, krow in rows.iterrows():
        mid = int(krow["match_id"])
        rnd = krow["round"]
        mult = int(krow["multiplier"])
        knockout = True

        if rnd == "Round of 32":
            h, a = r32_bracket.get(mid, ("?", "?"))
            pred_h_team.append(h); pred_a_team.append(a)
        else:
            # Resolve from predicted winners of upstream matches
            sh = krow["slot_home"]; sa = krow["slot_away"]
            def resolve(slot: str) -> str:
                if slot.startswith("Winner Match"):
                    ref = int(slot.split()[-1])
                    return predicted_winner.get(ref, "?")
                if slot.startswith("Loser Match"):
                    ref = int(slot.split()[-1])
                    return predicted_loser.get(ref, "?")
                return "?"
            h = resolve(sh); a = resolve(sa)
            pred_h_team.append(h); pred_a_team.append(a)

        h_team = pred_h_team[-1]; a_team = pred_a_team[-1]
        if (h_team in model["idx"] and a_team in model["idx"]):
            P = score_distribution(model, h_team, a_team, neutral=True)
            h_star, a_star, _ = pick_score(P)
            ph, p_draw, pa = outcome_probs(P)
            w_str = winning_team(P)
            # match_winner is "home" or "away" (no draw for knockouts)
            # If model says draw is most likely, fall back to higher of home/away
            if w_str == "draw":
                w_str = "home" if ph >= pa else "away"
            # Penalties must agree with the predicted scoreline: a knockout tie
            # is decided by penalties iff the displayed score is level. Deriving
            # the flag from (h_star, a_star) keeps the card self-consistent (no
            # "1-1 / 90′" contradictions) — see render in web Bracket/MatchModal.
            pen = bool(h_star == a_star)
        else:
            # Fallback
            P = None; h_star = 1; a_star = 0
            ph, pa = 0.5, 0.5
            w_str = "home"; pen = False

        pred_h_goals.append(h_star); pred_a_goals.append(a_star)
        corners_l.append(predict_corners(ph, pa, knockout=True))
        yel_l.append(predict_yellow_cards(ph, pa, knockout=True, multiplier=mult))
        red_l.append(predict_red_cards(knockout=True, multiplier=mult))
        match_winner_l.append(w_str); penalties_l.append(pen)

        # Track winner/loser by match_id for downstream rounds
        winner_team = h_team if w_str == "home" else a_team
        loser_team = a_team if w_str == "home" else h_team
        predicted_winner[mid] = winner_team
        predicted_loser[mid] = loser_team

    rows["predicted_home_team"] = pred_h_team
    rows["predicted_away_team"] = pred_a_team
    rows["predicted_home_goals"] = pred_h_goals
    rows["predicted_away_goals"] = pred_a_goals
    rows["corners"] = corners_l
    rows["yellow_cards"] = yel_l
    rows["red_cards"] = red_l
    rows["match_winner"] = match_winner_l
    rows["penalties"] = penalties_l
    return rows


def build_all(n_sims: int = 5000) -> tuple[pd.DataFrame, pd.DataFrame]:
    model = json.loads((ARTIFACTS / "goals_model.json").read_text(encoding="utf-8"))
    gfx = pd.read_csv("reference/data/group_fixtures.csv", encoding="utf-8")
    ks = pd.read_csv("reference/data/knockout_slots.csv", encoding="utf-8")
    h2h = consensus_h2h_probs()

    group_pred = build_group_predictions(model, gfx, h2h)
    print(f"Running {n_sims} bracket simulations…")
    sim_agg = aggregate_simulations(model, gfx, ks, n_sims=n_sims, match_odds=h2h)
    knock_pred = build_knockout_predictions(model, ks, sim_agg, h2h)
    return group_pred, knock_pred


if __name__ == "__main__":
    import sys; sys.stdout.reconfigure(encoding="utf-8")
    g, k = build_all(n_sims=3000)
    print("\nGroup predictions sample:")
    print(g[["match_id","home_team","away_team","predicted_home_goals","predicted_away_goals","winning_team","corners","yellow_cards"]].head(10).to_string())
    print("\nKnockout predictions sample:")
    print(k[["match_id","round","predicted_home_team","predicted_away_team","predicted_home_goals","predicted_away_goals","match_winner","penalties"]].head(20).to_string())
    print("\nFinal match prediction:")
    print(k[k["match_id"]==104].to_string())
