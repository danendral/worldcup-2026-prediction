"""Blend bookmaker 1X2 odds with the Dixon-Coles goal model.

- De-vig odds via proportional method (Shin is marginally better but
  proportional is fine for our purposes and avoids edge cases).
- Take the median across bookmakers as the consensus implied probability.
- Blend: P_final = w * P_odds + (1-w) * P_model, w = 0.65.
- Rescale the 8x8 goal distribution to match the blended 1X2 marginals
  via iterative proportional fitting (preserves the score-shape from DC
  but anchors the outcome to the market).
"""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np

from .team_map import canonical_from_odds

RAW = Path("data/raw")

# Bookmakers to prefer (sharper books first). If none present, use median over all.
PREFERRED = ["Pinnacle", "Marathon Bet", "Betfair", "1xBet", "Unibet"]


def _devig_proportional(prices: list[float]) -> list[float]:
    """prices = decimal odds. Returns fair probabilities summing to 1."""
    raw = [1.0 / p for p in prices]
    s = sum(raw)
    return [r / s for r in raw]


def load_h2h() -> list[dict]:
    return json.loads((RAW / "odds.json").read_text())["h2h"]


def consensus_h2h_probs() -> dict[tuple[str, str], dict]:
    """Return {(home, away): {'P_h': , 'P_d': , 'P_a': , 'commence_time': , 'n_bookies': }}"""
    h2h = load_h2h()
    out = {}
    for ev in h2h:
        home_raw = ev["home_team"]
        away_raw = ev["away_team"]
        home = canonical_from_odds(home_raw)
        away = canonical_from_odds(away_raw)

        probs_h, probs_d, probs_a = [], [], []
        for bm in ev.get("bookmakers", []):
            for mk in bm.get("markets", []):
                if mk["key"] != "h2h":
                    continue
                price_by_name = {o["name"]: o["price"] for o in mk["outcomes"]}
                # Outcomes are home_team, away_team, "Draw"
                if home_raw in price_by_name and away_raw in price_by_name and "Draw" in price_by_name:
                    fair = _devig_proportional([
                        price_by_name[home_raw],
                        price_by_name["Draw"],
                        price_by_name[away_raw],
                    ])
                    probs_h.append(fair[0]); probs_d.append(fair[1]); probs_a.append(fair[2])
        if not probs_h:
            continue
        out[(home, away)] = {
            "P_h": float(np.median(probs_h)),
            "P_d": float(np.median(probs_d)),
            "P_a": float(np.median(probs_a)),
            "commence_time": ev["commence_time"],
            "n_bookies": len(probs_h),
        }
    return out


def outright_probs() -> dict[str, float]:
    """De-vigged P(team wins WC) from outright market."""
    bundle = json.loads((RAW / "odds.json").read_text())
    out_events = bundle["outrights"]
    if not out_events:
        return {}
    ev = out_events[0]
    # Median across bookmakers per team
    by_team_prices: dict[str, list[float]] = {}
    for bm in ev.get("bookmakers", []):
        for mk in bm.get("markets", []):
            if mk["key"] != "outrights":
                continue
            # one bookie's de-vigged probs
            prices = [(o["name"], o["price"]) for o in mk["outcomes"]]
            raw = [1.0 / p for _, p in prices]
            s = sum(raw)
            fair = [r / s for r in raw]
            for (name, _), p in zip(prices, fair):
                by_team_prices.setdefault(canonical_from_odds(name), []).append(p)
    return {team: float(np.median(ps)) for team, ps in by_team_prices.items()}


def blend_outcome(p_odds: tuple[float, float, float],
                  p_model: tuple[float, float, float],
                  w: float = 0.65) -> tuple[float, float, float]:
    """Linear blend of (H, D, A) probs."""
    out = tuple(w * po + (1 - w) * pm for po, pm in zip(p_odds, p_model))
    s = sum(out)
    return tuple(x / s for x in out)


def ipf_score_grid(P: np.ndarray,
                   target_h: float, target_d: float, target_a: float,
                   iters: int = 50, tol: float = 1e-8) -> np.ndarray:
    """Iterative proportional fitting: adjust P so home-win/draw/away-win
    marginals match the targets, preserving conditional shape."""
    P = P.copy()
    H, A = P.shape
    # Build masks
    mask_home = np.zeros_like(P, dtype=bool)
    mask_draw = np.zeros_like(P, dtype=bool)
    mask_away = np.zeros_like(P, dtype=bool)
    for i in range(H):
        for j in range(A):
            if i > j: mask_home[i, j] = True
            elif i == j: mask_draw[i, j] = True
            else: mask_away[i, j] = True

    for _ in range(iters):
        ph = P[mask_home].sum()
        pd_ = P[mask_draw].sum()
        pa = P[mask_away].sum()
        if max(abs(ph - target_h), abs(pd_ - target_d), abs(pa - target_a)) < tol:
            break
        if ph > 0: P[mask_home] *= (target_h / ph)
        if pd_ > 0: P[mask_draw] *= (target_d / pd_)
        if pa > 0: P[mask_away] *= (target_a / pa)
        P = P / P.sum()
    return P


if __name__ == "__main__":
    import sys; sys.stdout.reconfigure(encoding="utf-8")
    h2h_probs = consensus_h2h_probs()
    print(f"Group-stage matches with odds: {len(h2h_probs)}")
    for k, v in list(h2h_probs.items())[:5]:
        print(f"  {k[0]} vs {k[1]}: H={v['P_h']:.2f} D={v['P_d']:.2f} A={v['P_a']:.2f} (n={v['n_bookies']})")
    out = outright_probs()
    print(f"\nOutright market teams: {len(out)}")
    top = sorted(out.items(), key=lambda x: -x[1])[:15]
    for t, p in top:
        print(f"  {t:30s} {p*100:5.2f}%")
    print(f"  ...sum of all outright probs = {sum(out.values()):.3f}")
