"""Corners / yellow cards / red cards predictions.

Strategy: lookup tables grounded in WC2018/2022 averages, with small
mismatch adjustments. Scoring rule pays for exact + small-band, so we
pick the integer mode of the distribution (i.e. round the expected value).

Public references:
- WC 2018: ~10.6 corners, ~3.7 yellow cards, ~0.13 red cards per match
- WC 2022: ~10.0 corners, ~4.0 yellow cards, ~0.15 red cards per match
We use combined averages.

Scoring buckets recap:
  Corners: exact = 10 pts, off-by-2 = 5 pts
  Yellow: exact = 10 pts, off-by-1 = 5 pts
  Red: exact = 5 pts (no off-by)
"""
from __future__ import annotations
import math


# Base priors (per match, both teams combined)
BASE_CORNERS = 10.3
BASE_YELLOWS = 3.8
BASE_REDS = 0.14

# Knockout-stage bumps (more cautious play, more pressure)
KNOCKOUT_CORNER_BONUS = -0.4   # slightly fewer corners (tighter games)
KNOCKOUT_YELLOW_BONUS = 0.7    # more cards under pressure
KNOCKOUT_RED_BONUS = 0.04

# Late-round bumps (QF+)
LATE_YELLOW_BONUS = 0.4

# Mismatch adjustment: large skill gap → fewer corners (game opens up less,
# weaker team parks the bus; the favorite cruises).
def _mismatch_factor(p_home: float, p_away: float) -> float:
    """Return |P_home - P_away| ∈ [0, 1] as a mismatch score."""
    return abs(p_home - p_away)


def predict_corners(p_h: float, p_a: float, knockout: bool = False) -> int:
    """Predict corners (integer)."""
    mu = BASE_CORNERS
    if knockout:
        mu += KNOCKOUT_CORNER_BONUS
    mismatch = _mismatch_factor(p_h, p_a)
    mu -= 1.5 * mismatch    # big mismatches drop ~1-1.5 corners
    return max(4, int(round(mu)))


def predict_yellow_cards(p_h: float, p_a: float, knockout: bool = False,
                         multiplier: int = 1) -> int:
    mu = BASE_YELLOWS
    if knockout:
        mu += KNOCKOUT_YELLOW_BONUS
    if multiplier >= 4:
        mu += LATE_YELLOW_BONUS
    # Tight matches (small mismatch) → more cards
    mismatch = _mismatch_factor(p_h, p_a)
    mu += 0.5 * (1 - mismatch)
    return max(1, int(round(mu)))


def predict_red_cards(knockout: bool = False, multiplier: int = 1) -> int:
    """Red cards are rare; round-to-nearest of a near-zero rate is always 0,
    but the exact bucket is the only way to score points (no off-by-1).
    We always predict 0 — match-level red cards average 0.13. Predicting 0
    is right ~88% of the time."""
    return 0


if __name__ == "__main__":
    # Sanity
    for (ph, pa, knock, mult) in [(0.50, 0.30, False, 1), (0.80, 0.10, False, 1),
                                   (0.45, 0.30, True, 2), (0.50, 0.30, True, 16)]:
        print(f"P_h={ph} P_a={pa} knock={knock} mult={mult}: "
              f"corners={predict_corners(ph,pa,knock)} "
              f"yellow={predict_yellow_cards(ph,pa,knock,mult)} "
              f"red={predict_red_cards(knock,mult)}")
