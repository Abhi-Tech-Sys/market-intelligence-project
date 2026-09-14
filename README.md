# Market Intelligence & Movement Prediction System

A machine learning system that predicts the **probability of a significant
up/down movement** in the NIFTY 50 index over multiple future-day horizons
— instead of guessing an exact future price like most similar projects do.

> Full reasoning behind design decisions lives in [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md).
> Full spec/scope lives in [`docs/PRD.md`](docs/PRD.md).

## Project structure

```
market-intelligence-project/
├── backend/
│   ├── src/              # Data fetching, cleaning, features, model, API
│   └── data/
│       ├── raw/           # Original downloaded data — never edit directly
│       └── processed/      # Cleaned, feature-engineered data
├── frontend/
│   └── src/                 # React dashboard
├── docs/                     # PRD, project context, decisions
└── notebooks/                # EDA and experimentation
```

## Data source

Direct pull from Yahoo Finance via `yfinance`, ticker `^NSEI` (NIFTY 50
index), 2007-01-01 to present. See `docs/PROJECT_CONTEXT.md` for full
provenance notes.

## Pipeline (in order)

1. `backend/src/fetch_from_yahoo.py` — pull raw data from Yahoo Finance **(next: run this)**
2. `backend/src/clean_data.py` — clean, type, sort the data *(to write, once we see the raw format)*
3. `notebooks/01_eda.ipynb` — trends, distributions, define "significant move" threshold *(coming)*
4. `backend/src/feature_engineering.py` — technical indicators + movement labels *(coming)*
5. `backend/src/train_model.py` — train + time-aware validate *(coming)*
6. `backend/src/api.py` — FastAPI endpoint serving predictions *(coming)*
7. `frontend/` — React dashboard *(coming)*

## Status

- [x] Data collection (run fetch_from_yahoo.py)
- [x] Data cleaning
- [x] EDA
- [ ] Feature engineering
- [ ] Baseline model
- [ ] Time-aware validation
- [ ] FastAPI backend
- [ ] React frontend
- [ ] Deployment
- [ ] Report + PPT
