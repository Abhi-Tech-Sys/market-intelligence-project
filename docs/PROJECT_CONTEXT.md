# Market Intelligence & Movement Prediction System — Project Context

This file is the single source of truth for *why* this project is built the
way it is. Re-read this before making any major decision, and update it
whenever a decision changes.

---

## 1. Problem Statement

Predict the **probability that the NIFTY 50 index will move up or down by a
meaningful amount** over a given time horizon (1 / 5 / 20 days) — NOT the
exact future price. This reframes the task as classification (well-behaved)
instead of regression on a near-random-walk price series.

"Multiple horizons" means multiple FUTURE-DAY windows, all computed from the
same DAILY data — not multiple data granularities. This project stays on
daily data throughout; no minute-level data is used anywhere.

## 2. What Already Exists (Competitive Landscape)

Nearly all public NIFTY prediction projects follow the same pattern:
predict exact next closing price via LSTM/GRU, evaluate with RMSE/MAE only,
offer no explanation of *why*, deploy (if at all) as a bare notebook or
basic Streamlit chart. The gap: everyone optimizes the *model*, almost
nobody questions the *target variable* or adds *decision usefulness*.

## 3. What Makes This Version Different

| Existing projects | This project |
|---|---|
| Predict exact next-day price | Predict probability of up/down move over 1d / 5d / 20d |
| Single model, single output | Multi-horizon + market regime classification together |
| No explanation of *why* | Feature-importance explanation per prediction |
| Price-only features (usually) | Price + technical indicators (+ volume, advanced scope only) |
| No historical validation of usefulness | Backtested signal usefulness |
| One-shot notebook, Streamlit if anything | Real FastAPI backend + React frontend, deployed |

## 4. MVP Scope (this semester — must finish)

1. Data collection — NIFTY 50 daily OHLCV via yfinance ✅ done
2. EDA ✅ done (see section 8 for findings)
3. Feature engineering — price-derived technical indicators only (moving
   averages, RSI, MACD, momentum, rolling volatility) via the `ta` library
4. Label creation — significant move (±1.29%, from EDA) over 1d/5d/20d
5. Baseline models — Logistic Regression + Random Forest
6. Time-aware validation — `TimeSeriesSplit`, never randomly shuffled
7. Evaluation — precision/recall/confusion matrix + simple backtest
8. FastAPI backend serving predictions + React frontend dashboard
9. Deployment (Render/Vercel or similar) + report + PPT + demo

## 5. Advanced Scope (add only if MVP is solid and time remains)

- Volume-based features, restricted to the clean 2013–2026 data subset only
  (Volume is unusable pre-2013 — see section 8)
- Market regime detection (bullish/bearish/sideways/high-vol/low-vol)
- Richer explainability (SHAP values)
- Sector/NIFTY relative performance comparison
- Full backtesting module with cumulative signal performance

## 6. Explicitly Out of Scope

News sentiment/NLP, live trading/broker integration, portfolio
optimization, mobile app, individual stocks (index only), more than ~3
model types compared, Streamlit (custom FastAPI+React instead).

## 7. Long-Term (after semester, personal project — not now)

Becomes the "Market Intelligence" capability of the Personal Intelligence
System. Could extend to individual stocks, live data feeds, more advanced
models.

## 8. Data Log & EDA Findings

| Date | Source | Range | Rows | Notes |
|---|---|---|---|---|
| Superseded | GitHub raw CSV (Chinese headers) | 2010–2022 | 3,077 | Replaced — required decoding Chinese headers, hard to personally reproduce |
| Superseded | GitHub raw CSV (English headers) | 2007–2026 | 4,554 | Replaced — switched to direct-source yfinance instead of a third-party mirror |
| **Current** | **yfinance, ticker `^NSEI`** | **2007-09-17 to 2026-09-04** | **4,654** | Primary source. Cleaned: handled yfinance's two-row MultiIndex CSV header, parsed dates, flagged Volume=0 rows rather than deleting/guessing |

**EDA findings (locked in):**
- Significant-move threshold: **±1.29%** (≈1 std dev of daily returns; ~19.7% of days qualify at this threshold)
- Volatility chart confirms data integrity — correctly shows the 2008 financial crisis and March 2020 COVID crash as the two most volatile periods in the dataset
- `Volume_Missing` flag (28.6% of rows overall) is a **clean pre-2013 gap**: 100% missing 2007–2012, ~0% from 2013 onward — a real historical data-availability limitation, not a random/scattered error
- **Decision**: MVP model uses only price-derived features (no Volume needed) across the FULL 2007–2026 history, preserving the 2008 crisis as a valuable training example. Volume-based features are deferred to advanced scope, restricted to 2013–2026 only.

*(Add a new row/finding here any time a new decision is made — this is your data provenance and decision record for the report.)*
