"""Dixon-Coles bivariate Poisson goals model.

Parameterization (per Dixon & Coles 1997):
  λ_home = exp(α_home + β_away + γ + θ·elo_diff_h)
  λ_away = exp(α_away + β_home + θ·elo_diff_a)

Where:
  α_i = team i attack strength (centered to sum 0)
  β_i = team i defense strength (centered to sum 0; higher = leakier)
  γ   = home advantage (when non-neutral)
  θ   = scaling on Elo difference (lets ratings inform unobserved/rare teams)
  ξ   = time decay (exp(-ξ * weeks_ago))
  τ   = Dixon-Coles low-score correction param

Fit by maximum (weighted) likelihood on internationals 2014-01-01 to as_of.
"""
from __future__ import annotations
import json
import math
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import gammaln

from .team_map import canonical_from_results

ARTIFACTS = Path("data/artifacts")

# Tournament weights for goals model (relevance of match type to WC predictions)
TOURNAMENT_WEIGHTS = {
    "FIFA World Cup": 1.0,
    "FIFA World Cup qualification": 0.9,
    "UEFA Euro": 1.0,
    "UEFA Euro qualification": 0.85,
    "Copa América": 1.0,
    "African Cup of Nations": 0.9,
    "AFC Asian Cup": 0.9,
    "UEFA Nations League": 0.85,
    "Confederations Cup": 0.9,
    "CONCACAF Gold Cup": 0.8,
    "CONCACAF Nations League": 0.75,
    "Friendly": 0.5,
}
DEFAULT_TW = 0.7


def _tournament_weight(t: str) -> float:
    if t in TOURNAMENT_WEIGHTS:
        return TOURNAMENT_WEIGHTS[t]
    tl = t.lower()
    if "friendly" in tl:
        return 0.5
    if "qualification" in tl:
        return 0.75
    return DEFAULT_TW


def _dc_tau(h: int, a: int, lh: float, la: float, rho: float) -> float:
    """Dixon-Coles low-score correction factor."""
    if h == 0 and a == 0:
        return 1 - lh * la * rho
    if h == 0 and a == 1:
        return 1 + lh * rho
    if h == 1 and a == 0:
        return 1 + la * rho
    if h == 1 and a == 1:
        return 1 - rho
    return 1.0


def _log_poisson(k: int, lam: float) -> float:
    # log P(K=k | Poisson(lam))
    lam = max(lam, 1e-9)
    return -lam + k * math.log(lam) - gammaln(k + 1)


def _build_dataset(
    results_csv: Path,
    elo: dict[str, float],
    fixture_teams: set[str],
    as_of: str = "2026-05-30",
    since: str = "2014-01-01",
):
    df = pd.read_csv(results_csv)
    df = df[(df["date"] >= since) & (df["date"] <= as_of)].copy()
    df = df.dropna(subset=["home_score", "away_score"])
    df["home_team"] = df["home_team"].map(canonical_from_results)
    df["away_team"] = df["away_team"].map(canonical_from_results)
    # Keep only matches involving at least one team likely to play at WC (broad inclusion to learn team strengths)
    # but require both teams to have an Elo (which all teams with any match history do)
    df = df[df["home_team"].isin(elo) & df["away_team"].isin(elo)].copy()
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)
    df["neutral"] = df["neutral"].astype(str).str.strip().str.lower() == "true"

    asof_ts = pd.to_datetime(as_of)
    df["weeks_ago"] = (asof_ts - pd.to_datetime(df["date"])).dt.days / 7.0
    df["tw"] = df["tournament"].map(_tournament_weight)

    # Team -> index. Only include teams with >= MIN_MATCHES so the optimizer doesn't blow up.
    counts = pd.concat([df["home_team"], df["away_team"]]).value_counts()
    MIN_MATCHES = 8
    keep_teams = set(counts[counts >= MIN_MATCHES].index) | fixture_teams
    df = df[df["home_team"].isin(keep_teams) & df["away_team"].isin(keep_teams)].copy()
    teams = sorted(keep_teams & (set(df["home_team"]) | set(df["away_team"])))
    idx = {t: i for i, t in enumerate(teams)}
    n = len(teams)

    elo_arr = np.array([elo.get(t, 1500.0) for t in teams])
    elo_arr = (elo_arr - elo_arr.mean()) / 400.0  # scale: 400 Elo ≈ 1 unit

    h_idx = df["home_team"].map(idx).to_numpy()
    a_idx = df["away_team"].map(idx).to_numpy()
    hs = df["home_score"].to_numpy()
    as_ = df["away_score"].to_numpy()
    neut = df["neutral"].to_numpy()
    weeks = df["weeks_ago"].to_numpy()
    tw = df["tw"].to_numpy()

    return teams, idx, elo_arr, h_idx, a_idx, hs, as_, neut, weeks, tw


def fit_goals_model(
    results_csv: Path = Path("data/raw/results.csv"),
    elo_path: Path = ARTIFACTS / "elo.json",
    fixture_teams: set[str] | None = None,
    as_of: str = "2026-05-30",
    since: str = "2014-01-01",
    xi: float = 0.005,  # weekly decay rate; half-life ≈ 138 weeks ≈ 2.6 yrs
) -> dict:
    elo = json.loads(elo_path.read_text(encoding="utf-8"))
    fixture_teams = fixture_teams or set()

    teams, idx, elo_arr, h_idx, a_idx, hs, as_, neut, weeks, tw = _build_dataset(
        results_csv, elo, fixture_teams, as_of=as_of, since=since
    )
    n = len(teams)

    # Sample weight: time decay × tournament weight
    w = np.exp(-xi * weeks) * tw
    w = w / w.mean()

    # Param vector layout: [alpha_0..n-1, beta_0..n-1, gamma, theta, rho]
    # We constrain alpha and beta to sum to 0 via reparameterization at the end of fit (centered).
    def unpack(p):
        a = p[:n]
        b = p[n:2 * n]
        gamma = p[2 * n]
        theta = p[2 * n + 1]
        rho = p[2 * n + 2]
        return a, b, gamma, theta, rho

    def neg_log_lik(p):
        a, b, gamma, theta, rho = unpack(p)
        # log lambda
        log_lh = a[h_idx] + b[a_idx] + theta * (elo_arr[h_idx] - elo_arr[a_idx])
        log_lh = log_lh + np.where(neut, 0.0, gamma)
        log_la = a[a_idx] + b[h_idx] + theta * (elo_arr[a_idx] - elo_arr[h_idx])
        # clip to avoid overflow
        log_lh = np.clip(log_lh, -3, 3)
        log_la = np.clip(log_la, -3, 3)
        lh = np.exp(log_lh)
        la = np.exp(log_la)
        # log Poisson
        ll = (-lh + hs * log_lh - gammaln(hs + 1)) + (-la + as_ * log_la - gammaln(as_ + 1))
        # Dixon-Coles correction (only for low scores)
        low = (hs <= 1) & (as_ <= 1)
        if rho != 0 and low.any():
            lh_l = lh[low]; la_l = la[low]; h_l = hs[low]; a_l = as_[low]
            tau = np.ones_like(lh_l)
            mask = (h_l == 0) & (a_l == 0); tau = np.where(mask, 1 - lh_l * la_l * rho, tau)
            mask = (h_l == 0) & (a_l == 1); tau = np.where(mask, 1 + lh_l * rho, tau)
            mask = (h_l == 1) & (a_l == 0); tau = np.where(mask, 1 + la_l * rho, tau)
            mask = (h_l == 1) & (a_l == 1); tau = np.where(mask, 1 - rho, tau)
            tau = np.clip(tau, 1e-6, None)
            ll[low] = ll[low] + np.log(tau)
        return -(w * ll).sum()

    p0 = np.concatenate([
        np.zeros(n),       # alpha
        np.zeros(n),       # beta
        np.array([0.3]),   # gamma
        np.array([0.4]),   # theta (Elo coef)
        np.array([-0.05]), # rho
    ])

    res = minimize(neg_log_lik, p0, method="L-BFGS-B",
                   options={"maxiter": 1500, "maxfun": 100000, "ftol": 1e-9, "gtol": 1e-6})
    a, b, gamma, theta, rho = unpack(res.x)
    # Center attack/defense (identifiability)
    a = a - a.mean()
    b = b - b.mean()

    model = {
        "teams": teams,
        "idx": idx,
        "alpha": a.tolist(),
        "beta": b.tolist(),
        "gamma": float(gamma),
        "theta": float(theta),
        "rho": float(rho),
        "elo_scaled": elo_arr.tolist(),
        "raw_elo": {t: float(elo[t]) for t in teams},
        "as_of": as_of,
        "nll": float(res.fun),
        "n_matches": int(len(hs)),
        "converged": bool(res.success),
    }
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS / "goals_model.json").write_text(
        json.dumps(model, ensure_ascii=False), encoding="utf-8"
    )
    return model


def lambdas(model: dict, home: str, away: str, neutral: bool = True) -> tuple[float, float]:
    """Return (λ_home, λ_away). Both teams must be in model['teams']."""
    teams = model["teams"]
    idx = model["idx"]
    a = model["alpha"]; b = model["beta"]
    gamma = model["gamma"]; theta = model["theta"]
    elo_s = model["elo_scaled"]

    if home not in idx or away not in idx:
        raise KeyError(f"Unknown team(s): {home}, {away}")
    ih, ia = idx[home], idx[away]
    log_lh = a[ih] + b[ia] + theta * (elo_s[ih] - elo_s[ia]) + (0 if neutral else gamma)
    log_la = a[ia] + b[ih] + theta * (elo_s[ia] - elo_s[ih])
    return math.exp(log_lh), math.exp(log_la)


def score_distribution(model: dict, home: str, away: str,
                       neutral: bool = True, max_goals: int = 7) -> np.ndarray:
    """Return (max_goals+1, max_goals+1) matrix P[h][a]."""
    lh, la = lambdas(model, home, away, neutral=neutral)
    rho = model["rho"]
    H = max_goals + 1
    P = np.zeros((H, H))
    # Poisson PMFs
    log_h = np.array([_log_poisson(k, lh) for k in range(H)])
    log_a = np.array([_log_poisson(k, la) for k in range(H)])
    base = np.exp(log_h[:, None] + log_a[None, :])
    # Dixon-Coles low-score correction
    base[0, 0] *= max(1 - lh * la * rho, 1e-6)
    base[0, 1] *= max(1 + lh * rho, 1e-6)
    base[1, 0] *= max(1 + la * rho, 1e-6)
    base[1, 1] *= max(1 - rho, 1e-6)
    # Normalize
    base = base / base.sum()
    return base


if __name__ == "__main__":
    import sys; sys.stdout.reconfigure(encoding="utf-8")
    import pandas as pd
    from .team_map import resolve_playoff
    fx = pd.read_csv("reference/data/group_fixtures.csv", encoding="utf-8")
    fixture_teams = {resolve_playoff(t) for t in set(fx["home_team"]) | set(fx["away_team"])}
    m = fit_goals_model(fixture_teams=fixture_teams)
    print(f"Fit on {m['n_matches']} matches, converged={m['converged']}, nll={m['nll']:.1f}")
    print(f"gamma (home adv) = {m['gamma']:.3f}, theta (elo) = {m['theta']:.3f}, rho (DC) = {m['rho']:.3f}")
    # Sample matchups
    for h, a in [("Spain", "France"), ("Argentina", "Brazil"), ("Mexico", "South Africa"),
                 ("USA", "Iran"), ("Germany", "Japan")]:
        if h in m["idx"] and a in m["idx"]:
            lh, la = lambdas(m, h, a, neutral=True)
            P = score_distribution(m, h, a, neutral=True)
            ph = P[np.triu_indices_from(P, k=1)].sum()  # actually wrong indexing for outcomes; do explicit
            pw_home = sum(P[i, j] for i in range(P.shape[0]) for j in range(P.shape[1]) if i > j)
            pd_ = sum(P[i, i] for i in range(P.shape[0]))
            pw_away = 1 - pw_home - pd_
            print(f"  {h} vs {a}: λ=({lh:.2f},{la:.2f}) P(H/D/A)=({pw_home:.2f},{pd_:.2f},{pw_away:.2f})")
