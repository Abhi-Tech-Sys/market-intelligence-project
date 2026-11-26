import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
from pathlib import Path

SCRIPT_DIR   = Path(__file__).resolve().parent
BACKEND_DIR  = SCRIPT_DIR.parent
DATA_PATH    = BACKEND_DIR / "data" / "processed" / "nifty50_features.csv"
MODEL_PATH   = BACKEND_DIR / "models" / "rf_model_1d.joblib"
REPORTS_DIR  = BACKEND_DIR.parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLS = [
    "MA_10", "MA_20", "MA_50", "Pct_From_MA_10", "Pct_From_MA_20",
    "Pct_From_MA_50", "RSI_14", "MACD", "MACD_Signal", "MACD_Diff",
    "Momentum_10d", "Rolling_Volatility_20d",
]
TEST_SIZE_FRACTION = 0.2  # must match train_model.py

# Load data and isolate the held-out test period
df = pd.read_csv(DATA_PATH, parse_dates=["Date"])
df = df.sort_values("Date").reset_index(drop=True)

split_idx = int(len(df) * (1 - TEST_SIZE_FRACTION))
test_df   = df.iloc[split_idx:].reset_index(drop=True)

model = joblib.load(MODEL_PATH)
print(f"Backtest period: {test_df['Date'].min().date()} to {test_df['Date'].max().date()} ({len(test_df)} days)")

# Generate predictions
test_df["Prediction"] = model.predict(test_df[FEATURE_COLS])

# Strategy: hold when yesterday's signal was +1, else stay in cash
# shift(1) ensures we act on the previous day's signal — no lookahead
test_df["Position"]           = test_df["Prediction"].shift(1).fillna(0)
test_df["Strategy_Return_Pct"] = np.where(test_df["Position"] == 1, test_df["Daily_Return_Pct"], 0.0)
test_df["BuyHold_Return_Pct"]  = test_df["Daily_Return_Pct"]

# Compound daily returns into cumulative equity curves (base = 100)
test_df["Strategy_Cumulative"] = 100 * (1 + test_df["Strategy_Return_Pct"] / 100).cumprod()
test_df["BuyHold_Cumulative"]  = 100 * (1 + test_df["BuyHold_Return_Pct"]  / 100).cumprod()

strategy_final = test_df["Strategy_Cumulative"].iloc[-1]
buyhold_final  = test_df["BuyHold_Cumulative"].iloc[-1]
days_in_market = (test_df["Position"] == 1).sum()

in_market_days = test_df[test_df["Position"] == 1]
win_rate = (in_market_days["Strategy_Return_Pct"] > 0).mean() * 100 if len(in_market_days) > 0 else float("nan")

print(f"\nStrategy final value : {strategy_final:.2f}")
print(f"Buy-and-Hold final   : {buyhold_final:.2f}")
print(f"Days in market       : {days_in_market} / {len(test_df)} ({days_in_market/len(test_df):.1%})")
print(f"Win rate (in-market days): {win_rate:.1f}%")


def max_drawdown(curve):
    return ((curve - curve.cummax()) / curve.cummax() * 100).min()


print(f"\nStrategy volatility  : {test_df['Strategy_Return_Pct'].std():.3f}%")
print(f"Buy-Hold volatility  : {test_df['BuyHold_Return_Pct'].std():.3f}%")
print(f"Strategy max drawdown: {max_drawdown(test_df['Strategy_Cumulative']):.1f}%")
print(f"Buy-Hold max drawdown: {max_drawdown(test_df['BuyHold_Cumulative']):.1f}%")
print("\nNote: backtest excludes transaction costs, taxes, and slippage.")

# Save comparison chart
plt.figure(figsize=(12, 5))
plt.plot(test_df["Date"], test_df["Strategy_Cumulative"], label="Model Strategy", linewidth=1.5)
plt.plot(test_df["Date"], test_df["BuyHold_Cumulative"],  label="Buy-and-Hold",   linewidth=1.5, linestyle="--")
plt.title("Backtest: Model Strategy vs Buy-and-Hold (Test Period)")
plt.xlabel("Date")
plt.ylabel("Cumulative Value (start = 100)")
plt.legend()
plt.tight_layout()
chart_path = REPORTS_DIR / "backtest_chart.png"
plt.savefig(chart_path, dpi=150)
plt.close()
print(f"Chart saved → {chart_path}")
