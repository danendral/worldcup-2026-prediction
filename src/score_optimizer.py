"""EV-max scoreline picker.

The scoring rule has three mutually-exclusive score buckets per match:
  - exact score: 25 pts
  - correct goal difference (wrong score): 10 pts
  - correct total goals (wrong score and wrong diff): 10 pts

So for a candidate prediction (h*, a*) with goal distribution P(h, a):
   EV(h*, a*) = 25 * P_exact
              + 10 * (P_same_diff  - P_exact)
              + 10 * (P_same_total - P_exact)

`pick_score` returns argmax (h*, a*). This routinely beats picking the
modal scoreline, since EV rewards neighborhoods rather than peaks.
"""
from __future__ import annotations
import numpy as np


def expected_points(P: np.ndarray, h_star: int, a_star: int) -> float:
    """Compute expected score-component points for predicting (h*, a*)."""
    H, A = P.shape
    p_exact = P[h_star, a_star] if h_star < H and a_star < A else 0.0
    diff_star = h_star - a_star
    total_star = h_star + a_star
    p_same_diff = 0.0
    p_same_total = 0.0
    for i in range(H):
        for j in range(A):
            if i - j == diff_star:
                p_same_diff += P[i, j]
            if i + j == total_star:
                p_same_total += P[i, j]
    # Subtract exact (avoids double-counting; the buckets are mutually exclusive)
    return 25.0 * p_exact + 10.0 * (p_same_diff - p_exact) + 10.0 * (p_same_total - p_exact)


def pick_score(P: np.ndarray, max_goals: int = 6) -> tuple[int, int, float]:
    """Return (h*, a*, EV) maximizing expected score-component points."""
    best = (-1, -1, -1.0)
    for h in range(max_goals + 1):
        for a in range(max_goals + 1):
            ev = expected_points(P, h, a)
            if ev > best[2]:
                best = (h, a, ev)
    return best


def outcome_probs(P: np.ndarray) -> tuple[float, float, float]:
    """Return (P(home_win), P(draw), P(away_win))."""
    H, A = P.shape
    ph, pd_, pa = 0.0, 0.0, 0.0
    for i in range(H):
        for j in range(A):
            if i > j: ph += P[i, j]
            elif i == j: pd_ += P[i, j]
            else: pa += P[i, j]
    return ph, pd_, pa


def winning_team(P: np.ndarray) -> str:
    """Pick 'home', 'away', or 'draw' that maximizes P(correct)."""
    ph, pd_, pa = outcome_probs(P)
    best = max(ph, pd_, pa)
    if best == ph: return "home"
    if best == pa: return "away"
    return "draw"


if __name__ == "__main__":
    # Sanity test on a constructed distribution
    P = np.zeros((8, 8))
    # toy: high prob on 2-1, some on 1-0 and 1-1
    P[2, 1] = 0.12; P[1, 0] = 0.10; P[1, 1] = 0.09; P[2, 0] = 0.07
    P[0, 0] = 0.06; P[3, 1] = 0.05; P[2, 2] = 0.04; P[1, 2] = 0.04
    P[0, 1] = 0.04; P[3, 0] = 0.03; P[3, 2] = 0.03; P[2, 3] = 0.02
    P = P / P.sum()
    h, a, ev = pick_score(P)
    print(f"Best score: {h}-{a} EV={ev:.2f}")
    # Check a few candidates
    for cand in [(1,0),(2,1),(1,1),(3,1),(2,0)]:
        print(f"  {cand[0]}-{cand[1]}: EV={expected_points(P, *cand):.2f}")
    print(f"  outcome probs: H/D/A = {outcome_probs(P)}")
    print(f"  winning_team: {winning_team(P)}")
