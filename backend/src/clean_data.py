"""
clean_data.py
=============

WHAT THIS SCRIPT DOES:
Takes the raw NIFTY 50 CSV (downloaded via fetch_from_yahoo.py) and turns
it into a clean, analysis-ready CSV. This is step 1 of the ML pipeline:
Data Collection + Preprocessing.

WHY THIS STEP IS NEEDED (a yfinance quirk to understand):
When yfinance downloads a SINGLE ticker, it still returns data with a
"MultiIndex" column structure internally — basically, two layers of column
names stacked on top of each other: one layer for the field name (Close,
High, Low, Open, Volume) and one layer for the ticker symbol (^NSEI,
repeated for every column since we only downloaded one ticker).

When that gets saved to CSV, you end up with TWO header rows instead of
one:
    Price,Close,High,Low,Open,Volume
    Ticker,^NSEI,^NSEI,^NSEI,^NSEI,^NSEI
    Date,,,,,
    2007-09-17,4494.64...,...

This is harmless but not directly usable — pandas needs to be told
explicitly that the first TWO rows are both header rows, then we flatten
them into normal single-row column names, since the "Ticker" row is
redundant here (every column has the same ticker, ^NSEI — we only asked
for one).

RUN THIS SCRIPT WITH (from the project root, with venv activated):
    python backend/src/clean_data.py
"""

import pandas as pd
import numpy as np
from pathlib import Path

# ---------------------------------------------------------------------------
# STEP 0: Robust paths, independent of where you run this from
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent          # .../backend/src
BACKEND_DIR = SCRIPT_DIR.parent                        # .../backend
RAW_PATH = BACKEND_DIR / "data" / "raw" / "nifty50_yahoo_raw.csv"
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH = PROCESSED_DIR / "nifty50_clean.csv"


# ---------------------------------------------------------------------------
# STEP 1: Load the raw file, correctly handling the two-row header
# ---------------------------------------------------------------------------
# header=[0, 1] tells pandas: "the column names are split across rows 0
# AND 1 — combine them into one MultiIndex column structure."
# index_col=0 tells pandas: "the very first column (Date) should become
# the row index, not a regular data column" — this matches how yfinance
# originally structured the data before we saved it.
df = pd.read_csv(RAW_PATH, header=[0, 1], index_col=0)


# ---------------------------------------------------------------------------
# STEP 2: Flatten the two-layer column names into simple single names
# ---------------------------------------------------------------------------
# Right now, df.columns looks like a list of pairs, e.g.
# [("Close", "^NSEI"), ("High", "^NSEI"), ...]. We only care about the
# first element of each pair (the field name) since the ticker is the
# same (^NSEI) for every column — so we just take that first level.
df.columns = df.columns.get_level_values(0)
df.columns.name = None  # clears a leftover "Price" label artifact from
                         # the original MultiIndex, purely cosmetic


# ---------------------------------------------------------------------------
# STEP 3: Turn the index (currently holding dates as text) into a proper
# Date column with real datetime values
# ---------------------------------------------------------------------------
df.index.name = "Date"
df = df.reset_index()                    # Date becomes a normal column again
df["Date"] = pd.to_datetime(df["Date"])  # text -> real datetime objects


# ---------------------------------------------------------------------------
# STEP 4: Sort chronologically (oldest first) — should already be sorted,
# but we enforce it explicitly rather than assuming
# ---------------------------------------------------------------------------
df = df.sort_values("Date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# STEP 5: Drop rows with missing critical price data
# ---------------------------------------------------------------------------
# If Date or any core price is missing, the row is unusable.
df = df.dropna(subset=["Date", "Open", "High", "Low", "Close"])


# ---------------------------------------------------------------------------
# STEP 6: Investigate and flag zero-Volume rows (don't silently hide them)
# ---------------------------------------------------------------------------
# Like the earlier dataset we explored, a chunk of rows here also show
# Volume = 0 (visible in the very first 3 rows you saw printed just now).
# This is almost certainly missing/unrecorded volume data for the index
# in its earlier years, not a genuine zero-trading day. Rather than delete
# these rows (which would throw away perfectly good price data) or quietly
# guess a value, we flag them so later steps can decide how to handle
# Volume-based features specifically.
df["Volume_Missing"] = df["Volume"] == 0


# ---------------------------------------------------------------------------
# STEP 7: Reorder columns for readability
# ---------------------------------------------------------------------------
df = df[["Date", "Open", "High", "Low", "Close", "Volume", "Volume_Missing"]]


# ---------------------------------------------------------------------------
# STEP 8: Save the cleaned file
# ---------------------------------------------------------------------------
df.to_csv(OUT_PATH, index=False)


# ---------------------------------------------------------------------------
# STEP 9: Print a summary so you can SEE what happened, not just trust it
# ---------------------------------------------------------------------------
print(f"Rows after cleaning: {len(df)}")
print(f"Date range: {df['Date'].min().date()} to {df['Date'].max().date()}")
print(f"Rows flagged Volume_Missing: {df['Volume_Missing'].sum()} "
      f"({df['Volume_Missing'].mean():.1%})")
print("\nFirst 3 rows:")
print(df.head(3))
print("\nLast 3 rows:")
print(df.tail(3))
print("\nMissing values per column:")
print(df.isna().sum())
print("\nDuplicate dates:", df["Date"].duplicated().sum())
print(f"\nSaved to: {OUT_PATH}")
