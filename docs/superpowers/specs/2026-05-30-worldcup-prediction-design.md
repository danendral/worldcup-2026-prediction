# FIFA World Cup 2026 Prediction — Design

## Goal
Maximize expected total score on the DataCamp WC2026 prediction competition. Strategy: EV-optimal play biased toward chalk; treat high-multiplier knockout rounds as the only place where contrarian model picks matter. Target: top 5–10% of ~135 serious competitors (≈2705 entrants × 20% submit × 25% serious).

## Scoring (locked from challenge spec)
- Score exact: 25 | goal diff correct: 10 | total goals correct: 10
- Corners exact: 10 | off by 2: 5
- Yellow cards exact: 10 | off by 1: 5
- Red cards exact: 5
- Group-stage winner: 40
- Knockout matchup both teams: 20 | one team: 10
- Knockout winner: 20 | penalties: 5
- Round multipliers: GS/R32 ×1, R16 ×2, QF ×4, SF/3rd ×8, Final ×16

## Architecture
End-to-end Python pipeline, modular, with artifacts persisted between stages.

```
reference/data/        — fixtures, knockout slots (given)
data/raw/              — pulled: results.csv, odds.json
data/processed/        — cleaned: team_name_map, fitted features
data/artifacts/        — elo.json, goals_model.pkl, sims.parquet
src/
  ingest.py            — pull results CSV + odds API
  team_map.py          — canonicalize team names (Kaggle ↔ fixtures ↔ odds)
  elo.py               — time-decayed Elo, fit through 2026-05-30
  goals_model.py       — Dixon-Coles bivariate Poisson, fit + predict (λh, λa)
  odds_blend.py        — de-vig 1X2, blend with model probabilities
  score_optimizer.py   — pick EV-max (h,a) given goal distribution + 1X2
  bracket_sim.py       — Monte Carlo group → knockout, pick EV-max bracket
  ancillary.py         — corners/yellows/reds lookup tables
  submission.py        — assemble final DataFrames
notebook.ipynb         — orchestrates + final submission output
```

## Components

### 1. Ingest
- Pull `martj42/international_results/results.csv` (49k matches, 1872–2026).
- Filter to matches after 2014-01-01 for goal model (recent era), keep all for Elo init.
- Pull odds-api: `soccer_fifa_world_cup` h2h (all 72 group matches), `soccer_fifa_world_cup_winner` outrights (54 teams).
- Cache to `data/raw/` with timestamp.

### 2. Team name canonicalization
The same team appears with different strings across sources. Build a single canonical name map: `"United States" ↔ "USA"`, `"IR Iran" ↔ "Iran"`, etc. Hand-curated dict in `team_map.py`. Also map fixture placeholders (`"FIFA Playoff 1"`, `"UEFA Playoff B"`) to the actual qualified team or treat as "unknown" with replacement-level rating.

**FIFA Playoff teams (as of May 2026):** Confirm from FIFA fixture list; fall back to lowest-Elo replacement-level team if not yet decided.

### 3. Elo
- Initialize all teams at 1500 in 1872.
- Standard FIFA-style Elo update: K=30 for FIFA WC matches, K=20 for continental cups, K=15 for qualifiers, K=10 for friendlies.
- Goal-difference multiplier: `K * (1 + 0.5 * log(1 + |Δgoals|))` — standard eloratings.net formula.
- Home advantage: +65 Elo for the home team unless `neutral=True`.
- Time decay: not on Elo itself (Elo naturally adapts), but recent matches get higher weight in the goals model.
- Output: `data/artifacts/elo.json` — current rating per team as of 2026-05-30.

### 4. Goals model (Dixon-Coles)
- Bivariate Poisson with low-score correction.
- For each match `i`: 
  - `λ_home_i = exp(α_home + β_away + γ_home_adv + δ_elo_diff)`
  - `λ_away_i = exp(α_away + β_home + δ_elo_diff_reverse)`
  - α = team attack strength, β = team defense weakness, γ = home advantage
- Dixon-Coles τ correction inflates `P(0-0), P(1-0), P(0-1), P(1-1)` to fix Poisson's known low-score under-prediction.
- Fit on internationals 2014-01-01 through 2026-05-30 (~12 years of data).
- Time decay: weight `w_i = exp(-ξ · days_ago / 365)`, ξ=0.005 (slow decay, since team strength changes slowly).
- Output: full goal-count distribution `P(h, a)` for h,a ∈ {0..7} for any matchup.

### 5. Odds blend
- For each group-stage match, take Pinnacle (or median of bookmakers if Pinnacle absent) 1X2 odds.
- De-vig via Shin's method (more accurate than proportional for football).
- Blend `P_outcome = 0.65 · P_odds + 0.35 · P_model` for 1X2. Bookmakers are sharp; lean on them for outcome.
- Rescale goal distribution so marginal `P(home_win), P(draw), P(away_win)` matches the blended 1X2, keeping the conditional shape from Dixon-Coles. (Iterative proportional fitting on the 8×8 grid.)
- Outright winner odds → de-vigged "to win cup" probability per team. Used in bracket simulation as a prior anchor.

### 6. Score optimizer (the big edge)
For each match, given the 8×8 distribution `P(h, a)`:

```
For each candidate (h*, a*) in {0..6} × {0..6}:
    EV(h*, a*) = 25 · P(h*, a*)
              + 10 · P(h - a = h* - a*, (h,a) ≠ (h*, a*))
              + 10 · P(h + a = h* + a*, h - a ≠ h* - a*)
Pick argmax.
```

This is the single biggest free EV win. Naively picking the mode is suboptimal — picking the score whose neighborhood (same diff OR same total) captures most density is much better.

For knockout matches that go to extra time / penalties: model 90-min score (per challenge spec), so no adjustment.

### 7. Bracket simulator
Knockout slots depend on group results. Process:

1. **Group stage Monte Carlo**: simulate each group 10,000 times using the goals model. Compute P(team finishes 1st / 2nd / 3rd) per team per group.
2. **Best-3rd ranking**: simulate FIFA tiebreakers (points → GD → GF → head-to-head) to compute P(team is one of the best 4 third-place finishers from its eligible pool).
3. **Knockout slot occupancy**: each knockout slot has a distribution over teams.
4. **Pick matchup for each R32 slot**: take the most-likely (team_a, team_b) pair given joint slot occupancy. This is what we submit as `predicted_home_team` / `predicted_away_team`.
5. **For winners**: once we've committed a matchup, predict winner using goals model + odds blend if available; else model only.
6. **Round multipliers** push us to favor chalk in QF/SF/Final unless model strongly disagrees with consensus on a specific match. Heuristic: if model gives a team >15 pp higher win probability than bookmaker outright implies, deviate.
7. **Penalties**: predict True if blended P(draw at 90 min) > 0.30 AND match is knockout.

### 8. Ancillary (corners, cards)
Lookup tables from published WC2018 + WC2022 averages:
- Corners: prior μ=10.3, σ≈3.0. Adjust by predicted |goal diff|: ±0.5 per goal of mismatch (mismatches get fewer corners — game opens up less).
- Yellow cards: prior μ=3.7. Adjust by knockout vs group (+0.6 in knockout). Adjust by stage (+0.3 for QF+).
- Red cards: prior μ=0.13 → predict 0 for nearly every match. Exact bucket is the only one with points; off-by-1 doesn't exist. Predict 0 for all matches except a couple of high-tension knockout fixtures where we predict 1.

Pick the *mode* (rounded integer) for the prediction. Off-by-K bands in corner/yellow scoring mean we should still pick the mode of the integer distribution.

### 9. Submission assembly
Write `notebook.ipynb` at repo root that:
1. Loads fixtures + slots
2. Runs the pipeline (cached artifacts make this fast on re-run)
3. Produces `group_predictions` and `knockout_predictions` DataFrames matching the template schema exactly
4. Validates: no nulls, schema matches, all 72 + 32 rows present

## Testing
- Unit-test Dixon-Coles τ on a few canonical low-score cases.
- Test EV optimizer with a hand-computed example (e.g., uniform distribution → score 1-1).
- Sanity-check Elo: top 10 teams should include Argentina, France, Spain, Brazil, England, Portugal, Germany, Netherlands.
- Bracket sim: P(Spain reaches final) should roughly match (1 / odds_to_reach_final) within 5pp.

## Out of scope (per scope-(a) decision)
Player-level injury data, scraped lineups, weather, travel rest features, deep learning, ensembling multiple goal models, social media sentiment.

## Deliverables
- `notebook.ipynb` at repo root, fully runnable, all 104 prediction rows populated.
- All `src/` modules tested via inline notebook assertions.
- Git history: one commit per milestone on `main`.
