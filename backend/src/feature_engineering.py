import pandas as pd
import numpy as np
from pathlib import Path
from ta.trend import MACD
from ta.momentum import RSIIndicator, ROCIndicator

SCRIPT_DIR  = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
IN_PATH     = BACKEND_DIR / "data" / "processed" / "nifty50_clean.csv"
OUT_PATH    = BACKEND_DIR / "data" / "processed" / "nifty50_features.csv"

# A move larger than ±1.29% (1 std-dev of daily returns from EDA) counts as "significant"
SIGNIFICANT_MOVE_THRESHOLD_PCT = 1.29
HORIZONS = {"1d": 1, "5d": 5, "20d": 20}

df = pd.read_csv(IN_PATH, parse_dates=["Date"])
df = df.sort_values("Date").reset_index(drop=True)

# Moving averages — short, medium, and long-term trend baselines
df["MA_10"] = df["Close"].rolling(10).mean()
df["MA_20"] = df["Close"].rolling(20).mean()
df["MA_50"] = df["Close"].rolling(50).mean()

# Percentage distance from each moving average (normalised, scale-invariant)
df["Pct_From_MA_10"] = (df["Close"] - df["MA_10"]) / df["MA_10"] * 100
df["Pct_From_MA_20"] = (df["Close"] - df["MA_20"]) / df["MA_20"] * 100
df["Pct_From_MA_50"] = (df["Close"] - df["MA_50"]) / df["MA_50"] * 100

# RSI — measures overbought/oversold momentum (0–100 scale)
df["RSI_14"] = RSIIndicator(close=df["Close"], window=14).rsi()

# MACD — trend direction and momentum shift signals
macd = MACD(close=df["Close"])
df["MACD"]        = macd.macd()
df["MACD_Signal"] = macd.macd_signal()
df["MACD_Diff"]   = macd.macd_diff()

# 10-day rate of change — raw price momentum
df["Momentum_10d"] = ROCIndicator(close=df["Close"], window=10).roc()

# Rolling volatility — distinguishes calm vs crisis market regimes
df["Daily_Return_Pct"]       = df["Close"].pct_change() * 100
df["Rolling_Volatility_20d"] = df["Daily_Return_Pct"].rolling(20).std()

# Build labels: 1 = significant UP, -1 = significant DOWN, 0 = no big move
for label_name, horizon_days in HORIZONS.items():
    future_close  = df["Close"].shift(-horizon_days)
    future_return = (future_close - df["Close"]) / df["Close"] * 100

    df[f"Label_{label_name}"] = np.select(
        [future_return > SIGNIFICANT_MOVE_THRESHOLD_PCT,
         future_return < -SIGNIFICANT_MOVE_THRESHOLD_PCT],
        [1, -1],
        default=0,
    )
    # Last N rows have no future data yet — mark as NaN, not 0
    df.loc[df.index[-horizon_days:], f"Label_{label_name}"] = np.nan

# Drop warm-up rows where indicators couldn't yet be computed (first ~50 rows)
# Keep rows where labels are NaN — those are the latest days the API predicts on
feature_cols = [
    "MA_10", "MA_20", "MA_50", "Pct_From_MA_10", "Pct_From_MA_20",
    "Pct_From_MA_50", "RSI_14", "MACD", "MACD_Signal", "MACD_Diff",
    "Momentum_10d", "Rolling_Volatility_20d",
]
before = len(df)
df = df.dropna(subset=feature_cols).reset_index(drop=True)

df.to_csv(OUT_PATH, index=False)
print(f"Rows: {before} → {len(df)} (dropped {before - len(df)} warm-up rows)")
print(f"Date range: {df['Date'].min().date()} to {df['Date'].max().date()}")
print(f"Saved → {OUT_PATH}")
