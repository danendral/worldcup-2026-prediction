# FIFA World Cup 2026 — Prediction Pipeline

An end-to-end statistical pipeline for the [DataCamp World Cup 2026 Prediction Competition](https://www.datacamp.com/) — a single-notebook submission that forecasts every one of the 104 tournament matches (72 group + 32 knockout) before kickoff.

The pipeline is small (~1.3k LOC of Python) and deliberately classical: Elo + Dixon-Coles bivariate Poisson + bookmaker blend + Monte-Carlo bracket simulation + an **EV-optimal scoreline picker** tuned to the competition's scoring rule.

## The Problem

Predict, for each match:

| Field | Group stage | Knockout |
| --- | --- | --- |
| `predicted_home_goals`, `predicted_away_goals` | ✓ | ✓ |
| `winning_team` (H/D/A) | ✓ | — |
| `predicted_home_team`, `predicted_away_team` | given | ✓ (must predict who reaches each slot) |
| `match_winner` (H/A) | — | ✓ |
| `penalties` (bool) | — | ✓ |
| `corners`, `yellow_cards`, `red_cards` | ✓ | ✓ |

The submission is a single Jupyter notebook (`notebook.ipynb`) producing two DataFrames that match the contest schema exactly.

## Scoring (and why it shapes the model)

Per-match points are summed and multiplied by a round multiplier:

| Bucket | Points |
| --- | --- |
| Exact score | **25** |
| Correct goal difference (wrong score) | 10 |
| Correct total goals (wrong score & wrong diff) | 10 |
| Corners exact / off-by-2 | 10 / 5 |
| Yellow cards exact / off-by-1 | 10 / 5 |
| Red cards exact | 5 |
| Group-stage `winning_team` | **40** |
| Knockout matchup: both teams / one team | 20 / 10 |
| Knockout `match_winner` | 20 |
| Knockout `penalties` correct | 5 |

| Round | Multiplier |
| --- | --- |
| Group stage / Round of 32 | ×1 |
| Round of 16 | ×2 |
| Quarter-final | ×4 |
| Semi-final / Third-place | ×8 |
| **Final** | **×16** |

Two consequences drive every design decision:

1. **The scoring rule is asymmetric and overlapping.** Predicting the *modal* scoreline is suboptimal. The right target is the scoreline whose *neighborhood* (same diff OR same total) captures the most probability mass. A single function — `score_optimizer.py` — converts a goal distribution into the EV-maximizing pick. This is the single biggest free edge in the contest.
2. **Knockout rounds compound.** One wrong Round-of-32 matchup eliminates four downstream picks worth ×2, ×4, ×8 — and possibly ×16. Bracket simulation isn't a flourish; it's the second-biggest edge.

## The Algorithm

```
                                  ┌──────────────────────────────┐
 results.csv (~50k matches)  ───► │  Elo (time-weighted)         │ ──► elo.json
 (martj42/international_results)  └──────────────────────────────┘
                                                │
                                                ▼
                                  ┌──────────────────────────────┐
 results.csv (post-2014)     ───► │  Dixon-Coles biv. Poisson    │ ──► goals_model.json
                                  │  λ = exp(α + β + γ + θ·Δelo) │
                                  │  + low-score correction τ    │
                                  └──────────────────────────────┘
                                                │  P(home_goals, away_goals)
                                                ▼
 the-odds-api.com h2h        ──► ┌──────────────────────────────┐
 + outrights                     │  Odds blend                  │
                                 │  de-vig (Shin's) → 1X2       │
                                 │  blend 65% odds / 35% model  │
                                 │  IPF rescale 8×8 grid        │
                                 └──────────────────────────────┘
                                                │
                                ┌───────────────┴───────────────┐
                                ▼                                ▼
                  ┌──────────────────────┐         ┌──────────────────────┐
                  │  EV-optimal score    │         │  Bracket simulator   │
                  │  picker              │         │  (group MC + best-3rd│
                  │  argmax over (h,a)   │         │  → R32 occupancy)    │
                  └──────────────────────┘         └──────────────────────┘
                                │                                │
                                └──────────────► submission ◄────┘
                                                 (2 DataFrames, 104 rows)
```

### 1. Elo (`src/elo.py`)

Standard FIFA-style Elo on the full match history (1872–2026). K-factor by tournament importance (WC: 30, continental: 20, qualifiers: 15, friendlies: 10) with a goal-difference multiplier `1 + 0.5·log(1 + |Δgoals|)` and a +65 home-advantage bonus on non-neutral grounds. Elo is treated as a *feature* fed into the goals model, not as a standalone predictor.

### 2. Goals model (`src/goals_model.py`) — Dixon-Coles

Bivariate Poisson with low-score correction:

```
λ_home = exp(α_home + β_away + γ·home_adv + θ·Δelo)
λ_away = exp(α_away + β_home              − θ·Δelo)
P(h, a) = Poisson(h; λ_home) · Poisson(a; λ_away) · τ(h, a)
```

`τ(h, a)` inflates the four low-score cells `{(0,0), (1,0), (0,1), (1,1)}` to correct Poisson's well-known under-prediction of nil-nils and one-all draws. Fit on internationals from 2014-01-01 onward with exponential time-weighting `w_i = exp(-ξ · weeks_ago)`, ξ = 0.005 (half-life ≈ 2.6 years — international team strength changes slowly).

### 3. Odds blend (`src/odds_blend.py`)

Bookmakers are sharp on 1X2 outcomes; our model has the right shape on the goal distribution. We use both:

1. De-vig consensus h2h odds via Shin's method (more accurate than proportional for football margins).
2. Blend `P_1X2 = 0.65·P_odds + 0.35·P_model`.
3. Iterative proportional fitting (IPF) on the 8×8 score grid so the marginals `(P_H, P_D, P_A)` match the blended 1X2 while preserving the conditional goal-shape from Dixon-Coles.

### 4. EV-optimal score picker (`src/score_optimizer.py`) — **the big edge**

Given the 8×8 distribution `P(h, a)`, for each candidate `(h*, a*)`:

```
EV(h*, a*) = 25·P_exact
           + 10·(P_same_diff − P_exact)        # diff bucket only fires if score is wrong
           + 10·(P_same_total − P_exact)       # total bucket only fires if diff is also wrong
```

Then `argmax`. This routinely picks scorelines that are *not* the mode — e.g. it prefers `2-1` over `1-0` in a match where `1-0` is modal but `{2-1, 1-0, 3-2}` collectively dominate the same-diff and same-total bands.

### 5. Bracket simulator (`src/bracket_sim.py`)

Monte Carlo, 3,000–5,000 trials:

1. Simulate every group match using the blended goal distribution.
2. Apply FIFA tiebreakers (points → GD → GF) and resolve the four best third-place qualifiers.
3. Propagate winners through the knockout tree.
4. Aggregate: for each R32 slot, take the modal (team_home, team_away) pair under the simulation — de-duped so no team appears in two R32 slots.
5. For each R32 matchup committed in step 4, re-predict the match independently using the goals model (no odds blend, since pre-tournament odds for knockout legs don't exist yet).

The simulation also drives the `penalties` flag: predict `True` when blended `P(draw at 90 min) > 0.28` — roughly 38% of knockout legs.

### 6. Ancillary markets (`src/ancillary.py`)

Lookup tables seeded from WC2018 + WC2022 averages:

- **Corners**: μ ≈ 10.3, adjusted by `|goal diff|` (mismatches → fewer corners; game opens up less).
- **Yellow cards**: μ ≈ 3.7, +0.6 in knockout, +0.3 from QF onward.
- **Red cards**: μ ≈ 0.13 → predict 0 for nearly every match. There is no off-by-1 bucket, so 0 is dominant by expected value.

## Repository Layout

```
reference/data/        fixtures + knockout slot definitions (given, read-only)
data/raw/              pulled: results.csv, odds.json                    (gitignored)
data/artifacts/        fitted: elo.json, goals_model.json                (gitignored)
src/
  ingest.py            pull results CSV + odds API
  team_map.py          canonicalize team names across sources
  elo.py               Elo fit
  goals_model.py       Dixon-Coles fit + score_distribution()
  odds_blend.py        de-vig + IPF blend
  score_optimizer.py   EV-max scoreline picker
  bracket_sim.py       Monte Carlo group → knockout
  ancillary.py         corners / yellows / reds
  submission.py        assemble final DataFrames
notebook.ipynb         the actual submission
docs/superpowers/specs/2026-05-30-worldcup-prediction-design.md
                       full design document
```

## Running It

```bash
# One-shot: fetch data, fit models, generate predictions
python -m src.submission

# Individual stages
python -m src.ingest          # pull results CSV + odds (cached)
python -m src.elo             # fit Elo
python -m src.goals_model     # fit Dixon-Coles  (~3 min)
python -m src.bracket_sim     # standalone bracket simulation

# Run the submission notebook end-to-end
python -c "import nbformat; from nbclient import NotebookClient; \
nb=nbformat.read('notebook.ipynb', as_version=4); \
NotebookClient(nb, timeout=900).execute(); \
nbformat.write(nb, 'notebook.ipynb')"
```

Requires Python 3.11+, `numpy`, `pandas`, `scipy`, `nbformat`, `nbclient`. Odds-API access needs a free `THE_ODDS_API_KEY` from [the-odds-api.com](https://the-odds-api.com) (one full pull uses ~10 of the 500 free monthly credits).

## Key Design Decisions

| Decision | Value | Rationale |
| --- | --- | --- |
| Time decay ξ | 0.005 / week (~2.6 yr half-life) | International strength changes slowly. |
| Goals-model fit window | 2014-01-01 onward | Last three World Cup cycles. |
| Odds/model blend weight | 0.65 / 0.35 on 1X2 | Bookmakers sharp on outcome; model owns the goal shape. |
| Penalties threshold | `P(draw at 90 min) > 0.28` | Implies pens for ~38% of knockout legs — historically realistic. |
| Group `winning_team` pick | Independent argmax of (H/D/A) | 40-point bucket has its own EV; need not match the predicted scoreline. |
| Red cards | Always 0 | No off-by-1 bucket; mode dominates EV. |

## What This Project Is Not

- **Not** a deep-learning model. The data isn't there (~3k–4k internationals/year, most low-information friendlies). A well-specified statistical model beats an under-specified neural one on this sample size.
- **Not** using player-level data, lineups, injuries, weather, or travel. All deliberately out of scope to keep the pipeline tight and reproducible.
- **Not** an ensemble. One well-tuned Dixon-Coles + an odds anchor outperforms a naive ensemble that doesn't think about EV.

## Results

> _The competition closes 2026-06-11 09:00 UTC. Final standing and a post-mortem will be added here once results are public._

## License

MIT. See [LICENSE](LICENSE).
