"""
feature_engineering.py
=======================

WHAT THIS SCRIPT DOES:
Takes the cleaned NIFTY 50 price data and produces the two things a model
actually needs:
  1. FEATURES — numeric signals computed from price history (moving
     averages, RSI, MACD, momentum, volatility) that the model will learn
     patterns from.
  2. LABELS — the actual target we're trying to predict: for each day, did
     a "significant" move happen over the next 1 / 5 / 20 days?

WHY WE ONLY USE PRICE-DERIVED FEATURES (no Volume):
EDA showed Volume is missing/unreliable before 2013 (see
docs/PROJECT_CONTEXT.md section 8). Rather than throw away 2007-2012 data
(which includes the valuable 2008 crisis as a training example) or build a
model with inconsistent features across time, we use ONLY features
computable from Open/High/Low/Close — these work for the full history.

RUN THIS SCRIPT WITH (from the project root, venv activated):
    python backend/src/feature_engineering.py
"""

import pandas as pd
import numpy as np
from pathlib import Path
from ta.trend import MACD
from ta.momentum import RSIIndicator, ROCIndicator

# ---------------------------------------------------------------------------
# STEP 0: Robust paths + config
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
IN_PATH = BACKEND_DIR / "data" / "processed" / "nifty50_clean.csv"
OUT_PATH = BACKEND_DIR / "data" / "processed" / "nifty50_features.csv"

# This is the ±1.29% threshold we found in EDA (1 standard deviation of
# daily returns). A move bigger than this counts as "significant."
SIGNIFICANT_MOVE_THRESHOLD_PCT = 1.29

# The future-day horizons we predict movement over.
HORIZONS = {"1d": 1, "5d": 5, "20d": 20}


# ---------------------------------------------------------------------------
# STEP 1: Load the cleaned data
# ---------------------------------------------------------------------------
df = pd.read_csv(IN_PATH, parse_dates=["Date"])
df = df.sort_values("Date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# STEP 2: Moving averages
# ---------------------------------------------------------------------------
# A moving average smooths out day-to-day noise to show the underlying
# trend. We compute a few different windows (short/medium/long) because
# the RELATIONSHIP between them (e.g. is the 10-day average above or below
# the 50-day average?) is often more informative than either alone — this
# is literally how "golden cross" / "death cross" trading signals work.
df["MA_10"] = df["Close"].rolling(window=10).mean()
df["MA_20"] = df["Close"].rolling(window=20).mean()
df["MA_50"] = df["Close"].rolling(window=50).mean()

# How far is today's price from each moving average, as a percentage?
# This is often more useful to a model than the raw moving average value,
# since it's already "normalized" (comparable across different price
# levels/years, unlike raw price which grew 5x+ over this dataset).
df["Pct_From_MA_10"] = (df["Close"] - df["MA_10"]) / df["MA_10"] * 100
df["Pct_From_MA_20"] = (df["Close"] - df["MA_20"]) / df["MA_20"] * 100
df["Pct_From_MA_50"] = (df["Close"] - df["MA_50"]) / df["MA_50"] * 100


# ---------------------------------------------------------------------------
# STEP 3: RSI (Relative Strength Index)
# ---------------------------------------------------------------------------
# RSI measures whether a stock/index has been recently "overbought" (RSI
# high, often >70) or "oversold" (RSI low, often <30) based on the size of
# recent up-moves vs down-moves. Ranges from 0-100. We use the `ta`
# library's implementation rather than writing the formula by hand — it's
# a well-tested standard implementation, no need to reinvent it.
rsi = RSIIndicator(close=df["Close"], window=14)
df["RSI_14"] = rsi.rsi()


# ---------------------------------------------------------------------------
# STEP 4: MACD (Moving Average Convergence Divergence)
# ---------------------------------------------------------------------------
# MACD compares a fast-moving average to a slow-moving average to signal
# momentum shifts. We keep both the main MACD line and its "signal line" —
# when MACD crosses above/below its signal line is a classic momentum
# signal the model can learn to recognize.
macd = MACD(close=df["Close"])
df["MACD"] = macd.macd()
df["MACD_Signal"] = macd.macd_signal()
df["MACD_Diff"] = macd.macd_diff()  # the gap between the two — often the
                                     # most directly useful of the three


# ---------------------------------------------------------------------------
# STEP 5: Momentum (Rate of Change)
# ---------------------------------------------------------------------------
# Simply: how much has price changed over the last N days? A straightforward
# but genuinely useful momentum signal.
roc_10 = ROCIndicator(close=df["Close"], window=10)
df["Momentum_10d"] = roc_10.roc()


# ---------------------------------------------------------------------------
# STEP 6: Rolling volatility
# ---------------------------------------------------------------------------
# Same calculation as in the EDA notebook — the 20-day rolling standard
# deviation of daily returns. High volatility periods (like 2008, 2020)
# behave very differently from calm periods, so this helps the model
# distinguish "normal market" from "crisis market" conditions.
df["Daily_Return_Pct"] = df["Close"].pct_change() * 100
df["Rolling_Volatility_20d"] = df["Daily_Return_Pct"].rolling(window=20).std()


# ---------------------------------------------------------------------------
# STEP 7: Create the movement labels (the actual prediction targets)
# ---------------------------------------------------------------------------
# For each horizon (1d, 5d, 20d), we look FORWARD from each day to see
# what actually happened, then label it:
#    1  = significant UP move   (future return > +threshold)
#   -1  = significant DOWN move (future return < -threshold)
#    0  = not significant       (future return within the threshold band)
#
# IMPORTANT — this is NOT data leakage, even though it looks forward:
# labels are allowed to use future information, because a label is the
# ANSWER we're training the model to predict, not an input the model sees.
# The model will only ever be given today's FEATURES (which use no future
# data) and asked to guess the label. What WOULD be leakage is accidentally
# using future data inside a FEATURE — we've avoided that throughout.
for label_name, horizon_days in HORIZONS.items():
    future_close = df["Close"].shift(-horizon_days)
    future_return_pct = (future_close - df["Close"]) / df["Close"] * 100

    conditions = [
        future_return_pct > SIGNIFICANT_MOVE_THRESHOLD_PCT,
        future_return_pct < -SIGNIFICANT_MOVE_THRESHOLD_PCT,
    ]
    choices = [1, -1]
    df[f"Label_{label_name}"] = np.select(conditions, choices, default=0)

    # The LAST `horizon_days` rows have no real future data to compute a
    # label from (shift(-N) produces NaN there) — np.select would have
    # silently labeled these as 0 ("not significant"), which is WRONG,
    # it's actually "unknown". We explicitly overwrite these with NaN so
    # they get excluded from model training later, rather than quietly
    # feeding the model incorrect labels.
    df.loc[df.index[-horizon_days:], f"Label_{label_name}"] = np.nan


# ---------------------------------------------------------------------------
# STEP 8: Drop rows that can't be used
# ---------------------------------------------------------------------------
# Rolling calculations (MA_50 especially) need 50 prior days to produce a
# real value — the first 49 rows will have NaN for MA_50. We drop any row
# with NaN in a feature or label column, since a model can't learn from
# incomplete rows. This naturally removes the very start of the dataset
# (where indicators haven't "warmed up" yet) and the very end (where
# labels don't exist yet because we can't see the future beyond today).
feature_cols = [
    "MA_10", "MA_20", "MA_50", "Pct_From_MA_10", "Pct_From_MA_20",
    "Pct_From_MA_50", "RSI_14", "MACD", "MACD_Signal", "MACD_Diff",
    "Momentum_10d", "Rolling_Volatility_20d",
]
label_cols = [f"Label_{name}" for name in HORIZONS]

before = len(df)
df = df.dropna(subset=feature_cols + label_cols).reset_index(drop=True)
after = len(df)


# ---------------------------------------------------------------------------
# STEP 9: Save
# ---------------------------------------------------------------------------
df.to_csv(OUT_PATH, index=False)


# ---------------------------------------------------------------------------
# STEP 10: Print a summary so you can SEE what happened
# ---------------------------------------------------------------------------
print(f"Rows before dropping NaN warm-up/end rows: {before}")
print(f"Rows after: {after} (dropped {before - after})")
print(f"Date range: {df['Date'].min().date()} to {df['Date'].max().date()}")
print(f"\nFeature columns: {feature_cols}")
print(f"\nLabel distribution per horizon:")
for name in HORIZONS:
    print(f"\n  Label_{name}:")
    print(df[f"Label_{name}"].value_counts(normalize=True).mul(100).round(1))
print(f"\nSaved to: {OUT_PATH}")
