# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DataCamp WC 2026 prediction competition entry. Submit one notebook with 104 match predictions (72 group + 32 knockout) before 2026-06-11 09:00 UTC. Scoring is autograded: exact score (25), goal-diff (10), total goals (10), corners (10/5), yellow cards (10/5), red cards (5), group-stage winner (40), knockout matchup (20/10), knockout winner (20), penalties (5), all × round multiplier (×1 to ×16 for Final).

## Strategy locked in (see `docs/superpowers/specs/2026-05-30-worldcup-prediction-design.md`)

EV-maximizing pipeline biased toward chalk. The single biggest edge over naive submissions is the **EV-optimal score picker** (`src/score_optimizer.py`) — picking the score whose neighborhood captures the most probability mass under the asymmetric scoring rule, not the modal scoreline. The second-biggest edge is **bracket simulation** (`src/bracket_sim.py`) for knockout matchups, since each R32 mistake cascades through all higher-multiplier rounds.

## Commands

```bash
# End-to-end: pulls data, fits models, generates submission
python -m src.submission

# Run final notebook (publishes to DataCamp from notebook.ipynb at root)
python -c "import nbformat; from nbclient import NotebookClient; nb=nbformat.read('notebook.ipynb',as_version=4); NotebookClient(nb,timeout=900).execute(); nbformat.write(nb,'notebook.ipynb')"

# Individual stages
python -m src.ingest          # pull results CSV + odds API
python -m src.elo             # fit Elo from results
python -m src.goals_model     # fit Dixon-Coles (~3 min)
python -m src.bracket_sim     # 1000-sim trial
```

## Architecture

- `reference/data/` — given fixtures (read-only)
- `data/raw/` — pulled artifacts (gitignored): `results.csv` (~50k matches from martj42/international_results), `odds.json` (the-odds-api.com)
- `data/artifacts/` — fitted models (gitignored): `elo.json`, `goals_model.json`
- `src/ingest.py` — pull raw data
- `src/team_map.py` — canonicalize team names across fixtures, results, odds. **Important**: playoff slots (e.g. "UEFA Playoff A") map to actual qualified teams (Bosnia & Herzegovina, etc.) inferred from the odds-API match list
- `src/elo.py` — FIFA-style Elo with K-factor by tournament importance and goal-diff multiplier
- `src/goals_model.py` — Dixon-Coles bivariate Poisson; λ = exp(α_attack + β_defense + γ·home_adv + θ·elo_diff) with low-score correction τ
- `src/odds_blend.py` — de-vig proportional, blend 65% odds / 35% model on 1X2 outcomes; iterative proportional fitting on the 8×8 score grid to preserve goal-shape while matching odds marginals
- `src/score_optimizer.py` — EV-max scoreline picker. Per scoring rule, EV(h,a) = 25·P_exact + 10·(P_same_diff - P_exact) + 10·(P_same_total - P_exact)
- `src/bracket_sim.py` — Monte Carlo: simulate groups → resolve best-3rd qualification → simulate knockouts forward. Returns per-slot matchup distributions
- `src/ancillary.py` — lookup tables for corners/yellows/reds. Reds always predicted 0 (mean=0.13, no off-by-1 bucket)
- `src/submission.py` — assembles final DataFrames matching template schema
- `notebook.ipynb` — the submission, at repo root (DataCamp requires this filename)

## Key decisions & rationale

- **Time decay ξ=0.005/week**: half-life ~2.6 years. International team strength changes slowly.
- **Goals-model fit window**: 2014-01-01 onward — captures last 3 World Cup cycles.
- **Bookmaker blend w=0.65**: bookmakers are sharper than our model on 1X2, but we still use our model's goal-distribution shape.
- **Penalties threshold**: predict True if P(90-min draw) > 0.28 (~38% of knockout matches predicted to go to pens).
- **Group `winning_team`** is picked independently of `predicted_home_goals/away_goals` (40 pts is its own bucket; the argmax of H/D/A maximizes its expected value).

## Environment

- `.env` holds `THE_ODDS_API_KEY` (free tier from the-odds-api.com; ~10 of 500 monthly credits used).
- Windows PowerShell. Use `python -W ignore` to suppress scipy deprecation warnings.
- All file I/O uses `encoding="utf-8"` because team names include `Côte d'Ivoire`, `Curaçao`.

## Submission deadline

2026-06-11 09:00 UTC. Notebook must be published from DataCamp UI (user action, not automated).
