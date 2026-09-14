"""
backtest.py
===========

WHAT THIS SCRIPT DOES:
Takes the trained 1-day-horizon Random Forest model and simulates a
simple trading rule over the TEST period (data the model never saw during
training) to answer the real question a person cares about: "if I had
actually followed this model's signal historically, what would have
happened compared to just holding the index the whole time?"

WHY THIS MATTERS (and most existing NIFTY prediction projects skip this):
A model can have "decent accuracy" on paper and still be useless — or
even harmful — as an actual signal to act on. Backtesting is the honest
reality check that connects model metrics to real-world usefulness. This
is one of the key things that makes this project different from typical
student projects, which usually stop at reporting accuracy/RMSE.

THE SIMPLE STRATEGY WE SIMULATE (1-day horizon):
  - If the model predicts "1" (significant up move) -> hold NIFTY 50 for
    that next day
  - If the model predicts "0" or "-1" -> stay in cash (no position) that
    day, to keep this simple and avoid needing to model short-selling
    mechanics/costs
This is deliberately simple — a real trading strategy would need to
account for transaction costs, slippage, taxes, etc. We're demonstrating
the SIGNAL's usefulness, not building an actual trading system (that's
explicitly out of scope per the PRD).

RUN THIS SCRIPT WITH (from the project root, venv activated):
    python backend/src/backtest.py
"""

import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
from pathlib import Path

# ---------------------------------------------------------------------------
# STEP 0: Robust paths + config
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_PATH = BACKEND_DIR / "data" / "processed" / "nifty50_features.csv"
MODEL_PATH = BACKEND_DIR / "models" / "rf_model_1d.joblib"
REPORTS_DIR = BACKEND_DIR.parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLS = [
    "MA_10", "MA_20", "MA_50", "Pct_From_MA_10", "Pct_From_MA_20",
    "Pct_From_MA_50", "RSI_14", "MACD", "MACD_Signal", "MACD_Diff",
    "Momentum_10d", "Rolling_Volatility_20d",
]
TEST_SIZE_FRACTION = 0.2  # MUST match train_model.py's split exactly, so
                           # we're backtesting on the same held-out period
                           # the model was actually evaluated on


# ---------------------------------------------------------------------------
# STEP 1: Load data and the trained model
# ---------------------------------------------------------------------------
df = pd.read_csv(DATA_PATH, parse_dates=["Date"])
df = df.sort_values("Date").reset_index(drop=True)

split_idx = int(len(df) * (1 - TEST_SIZE_FRACTION))
test_df = df.iloc[split_idx:].reset_index(drop=True)

model = joblib.load(MODEL_PATH)
print(f"Loaded model from: {MODEL_PATH}")
print(f"Backtest period: {test_df['Date'].min().date()} to {test_df['Date'].max().date()} ({len(test_df)} days)")


# ---------------------------------------------------------------------------
# STEP 2: Generate predictions for every day in the test period
# ---------------------------------------------------------------------------
X_test = test_df[FEATURE_COLS]
test_df["Prediction"] = model.predict(X_test)


# ---------------------------------------------------------------------------
# STEP 3: Simulate the strategy
# ---------------------------------------------------------------------------
# Strategy_Return on a given day = that day's actual return IF we were
# "in" the market (predicted 1 the day before), else 0 (we sat out).
#
# IMPORTANT — avoiding lookahead bias here: we use YESTERDAY's prediction
# to decide whether we're in the market TODAY. shift(1) moves each
# prediction forward by one day, so day t's position is based on what the
# model predicted using day (t-1)'s features — never using same-day
# information we wouldn't actually have had in advance.
test_df["Position"] = test_df["Prediction"].shift(1).fillna(0)
test_df["Strategy_Return_Pct"] = np.where(
    test_df["Position"] == 1,
    test_df["Daily_Return_Pct"],
    0.0,
)

# Buy-and-hold comparison: what if you just held the index the whole time,
# no signal, no trading at all?
test_df["BuyHold_Return_Pct"] = test_df["Daily_Return_Pct"]


# ---------------------------------------------------------------------------
# STEP 4: Compute cumulative returns
# ---------------------------------------------------------------------------
# Converting daily % returns into a cumulative growth curve: start both
# at 100 ("if you'd put in 100 rupees"), compound each day's return.
test_df["Strategy_Cumulative"] = (
    100 * (1 + test_df["Strategy_Return_Pct"] / 100).cumprod()
)
test_df["BuyHold_Cumulative"] = (
    100 * (1 + test_df["BuyHold_Return_Pct"] / 100).cumprod()
)


# ---------------------------------------------------------------------------
# STEP 5: Summary statistics
# ---------------------------------------------------------------------------
strategy_final = test_df["Strategy_Cumulative"].iloc[-1]
buyhold_final = test_df["BuyHold_Cumulative"].iloc[-1]

days_in_market = (test_df["Position"] == 1).sum()
total_days = len(test_df)

# Win rate: of the days the strategy was actually in the market, what %
# were positive-return days?
in_market_days = test_df[test_df["Position"] == 1]
win_rate = (in_market_days["Strategy_Return_Pct"] > 0).mean() * 100 if len(in_market_days) > 0 else float("nan")

print(f"\n{'='*60}")
print("BACKTEST RESULTS (1-day horizon strategy vs Buy-and-Hold)")
print(f"{'='*60}")
print(f"Starting value (both): 100")
print(f"Strategy final value:  {strategy_final:.2f}")
print(f"Buy-and-Hold final value: {buyhold_final:.2f}")
print(f"\nDays in market (strategy): {days_in_market} / {total_days} ({days_in_market/total_days:.1%})")
print(f"Win rate on days in market: {win_rate:.1f}%")

# -----------------------------------------------------------------------
# Risk comparison — returns alone don't tell the whole story
# -----------------------------------------------------------------------
# A strategy that's in cash most of the time SHOULD be much less risky
# than being fully invested the whole time, even if it also earns less.
# This is a fair, honest way to describe what the strategy actually
# achieved, rather than judging it purely on final returns.
strategy_volatility = test_df["Strategy_Return_Pct"].std()
buyhold_volatility = test_df["BuyHold_Return_Pct"].std()

def max_drawdown(cumulative_series):
    running_max = cumulative_series.cummax()
    drawdown = (cumulative_series - running_max) / running_max * 100
    return drawdown.min()

strategy_max_dd = max_drawdown(test_df["Strategy_Cumulative"])
buyhold_max_dd = max_drawdown(test_df["BuyHold_Cumulative"])

print(f"\n--- Risk comparison ---")
print(f"Strategy daily volatility:   {strategy_volatility:.3f}%")
print(f"Buy-and-Hold daily volatility: {buyhold_volatility:.3f}%")
print(f"Strategy max drawdown:      {strategy_max_dd:.1f}%")
print(f"Buy-and-Hold max drawdown:  {buyhold_max_dd:.1f}%")


# ---------------------------------------------------------------------------
# STEP 6: Plot and save the comparison chart
# ---------------------------------------------------------------------------
plt.figure(figsize=(12, 5))
plt.plot(test_df["Date"], test_df["Strategy_Cumulative"], label="Model Strategy", linewidth=1.5)
plt.plot(test_df["Date"], test_df["BuyHold_Cumulative"], label="Buy-and-Hold", linewidth=1.5, linestyle="--")
plt.title("Backtest: Model Strategy vs Buy-and-Hold (Test Period)")
plt.xlabel("Date")
plt.ylabel("Cumulative Value (start = 100)")
plt.legend()
plt.tight_layout()

chart_path = REPORTS_DIR / "backtest_chart.png"
plt.savefig(chart_path, dpi=150)
print(f"\nChart saved to: {chart_path}")
# NOTE: plt.show() is intentionally omitted — it opens a blocking popup
# window and pauses the script until you close it, which looks like a
# freeze/crash if you're not expecting it. Just open the saved PNG file
# directly instead (backend/reports/backtest_chart.png) if you want to
# view it in a normal image viewer.
plt.close()


# ---------------------------------------------------------------------------
# HONEST NOTE — read this before putting these numbers in your report
# ---------------------------------------------------------------------------
# This backtest IGNORES real-world costs: brokerage fees, taxes (STT),
# bid-ask spread, and slippage. In reality, being "in the market" only
# ~10-20% of days (since the model rarely predicts a significant move)
# means MANY small trades, and each one has a real cost that would eat
# into these returns. State this limitation explicitly in your report —
# it's a sign of rigor, not a weakness, to name what a backtest does NOT
# account for.
print("\nNOTE: This backtest excludes transaction costs, taxes, and "
      "slippage. Real-world results would be lower. See script comments "
      "for details — mention this limitation explicitly in your report.")
