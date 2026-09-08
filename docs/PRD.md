# PRD: Market Intelligence & Movement Prediction System

**Course:** Machine Learning
**Owner:** [Student]
**Status:** Data + EDA done, feature engineering next
**Related:** Future "Predict" capability of the Personal AI Intelligence System

---

## 1. Problem Statement

Predict the probability of a significant up/down movement in the NIFTY 50
index over multiple future-day horizons (1d / 5d / 20d) — not the exact
future price.

## 2. Goals (V1 — must ship for course submission)

- [x] Clean, verified NIFTY 50 daily OHLCV dataset (yfinance, 2007–present)
- [x] EDA: trend, returns distribution, volatility, data-quality checks
- [ ] Feature engineering: price-derived technical indicators (moving
      averages, RSI, MACD, momentum, rolling volatility) via `ta`
- [ ] Movement labels: significant move (±1.29%) over 1d / 5d / 20d horizons
- [ ] Baseline models: Logistic Regression + Random Forest
- [ ] Time-aware validation (`TimeSeriesSplit`, never randomly shuffled)
- [ ] Evaluation beyond accuracy: precision/recall, confusion matrix,
      simple backtest
- [ ] FastAPI backend serving predictions + explanation
- [ ] React frontend dashboard
- [ ] Deployed (backend + frontend hosted, one live URL)
- [ ] Report + PPT + live demo

## 3. Non-Goals (explicitly NOT in V1)

- Predicting exact price (regression on raw price)
- Individual stocks — index only (NIFTY 50)
- Volume-based features (deferred — see PROJECT_CONTEXT.md section 8)
- News/sentiment scraping, NLP
- Live trading / broker integration, portfolio optimization
- More than ~3 model types compared
- Streamlit (using FastAPI + React instead)

## 4. What Already Exists / Competitive Note

See `docs/PROJECT_CONTEXT.md` for the full competitive landscape research
and uniqueness reasoning.

## 5. Tech Stack

- Backend: Python, pandas, numpy, yfinance, `ta`, scikit-learn, FastAPI
- Frontend: React (Vite + Tailwind CSS)
- Deployment: Render/Railway (backend) + Vercel (frontend), or similar

## 6. Data

Source: Yahoo Finance via `yfinance`, ticker `^NSEI`, 2007-09-17 to present
(4,654 rows). Full provenance and EDA findings in
`docs/PROJECT_CONTEXT.md`.

## 7. Success Criteria

- Pipeline runs end-to-end: fetch → clean → features → train → API → UI,
  with no manual patching
- Model clearly outperforms a naive baseline on held-out, time-aware test
  data
- Every prediction shown in the app includes a plain-language explanation
- Report documents what makes this different from existing public projects

## 8. Later / Personal Upgrade (not this semester)

Multi-horizon shown simultaneously in one view, market regime detection,
richer SHAP-based explainability, sector/NIFTY relative comparison, live
daily-refreshed data, volume-based features (2013+ only), extension to
individual stocks.
