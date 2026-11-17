"""
fetch_from_yahoo.py
====================

WHAT THIS SCRIPT DOES:
Downloads NIFTY 50 daily historical data DIRECTLY from Yahoo Finance,
using the official NIFTY 50 ticker symbol "^NSEI". This is our single
source of truth for data — no third-party mirrors, no unclear provenance.

WHY THIS IS THE RIGHT APPROACH:
- No unknown middleman — you know exactly where the data came from
- You control the date range yourself
- Always up to date — re-run this any time to refresh
- No login or API key required

IMPORTANT: This script must be run on YOUR OWN COMPUTER, not in a
restricted sandbox — it needs to reach the internet
(query1.finance.yahoo.com), which some restricted environments block.

RUN THIS SCRIPT WITH (from the market-intelligence-project/backend folder,
with your venv activated):
    python src/fetch_from_yahoo.py
"""

import yfinance as yf
from pathlib import Path

# ---------------------------------------------------------------------------
# STEP 0: Make file paths independent of where this script is RUN FROM
# ---------------------------------------------------------------------------
# Without this, "data/raw/..." is interpreted relative to your current
# terminal location — so running from the project root vs from inside
# backend/ gives two different (wrong, in one case) folders. Using the
# script's OWN location as the anchor means it always works, no matter
# which folder you're standing in when you run it.
SCRIPT_DIR = Path(__file__).resolve().parent      # .../backend/src
BACKEND_DIR = SCRIPT_DIR.parent                    # .../backend
DATA_RAW_DIR = BACKEND_DIR / "data" / "raw"
DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)    # create it if missing

# ---------------------------------------------------------------------------
# STEP 1: Define what to download
# ---------------------------------------------------------------------------
# "^NSEI" is Yahoo Finance's official ticker symbol for the NIFTY 50 index.
# The ^ prefix is how Yahoo Finance denotes an INDEX rather than a company
# stock (e.g. ^GSPC for the S&P 500).
TICKER = "^NSEI"
START_DATE = "2007-01-01"  # go back as far as Yahoo Finance has data
END_DATE = None            # None = up to today, automatically

# ---------------------------------------------------------------------------
# STEP 2: Download
# ---------------------------------------------------------------------------
# auto_adjust=True correctly handles dividend/split adjustments. This
# barely matters for an index like NIFTY 50 (indices don't pay dividends
# or split the way individual stocks do), but it's still the correct
# default to use.
df = yf.download(TICKER, start=START_DATE, end=END_DATE, auto_adjust=True)

# Validation: ensure Yahoo Finance returned real data before overwriting existing files
if df is None or len(df) == 0:
    raise RuntimeError(
        f"Yahoo Finance returned an empty dataset for {TICKER}. "
        f"Aborted write to avoid corrupting existing data."
    )

# ---------------------------------------------------------------------------
# STEP 3: Save the raw download
# ---------------------------------------------------------------------------
# This IS your raw source now — fetched straight from Yahoo Finance.
OUT_PATH = DATA_RAW_DIR / "nifty50_yahoo_raw.csv"
df.to_csv(OUT_PATH)

# ---------------------------------------------------------------------------
# STEP 4: Print a summary so you can see exactly what you got
# ---------------------------------------------------------------------------
print(f"Rows downloaded: {len(df)}")
print(f"Date range: {df.index.min().date()} to {df.index.max().date()}")
print(f"\nSaved to: {OUT_PATH}")
print("\nFirst 3 rows:")
print(df.head(3))
print("\nLast 3 rows:")
print(df.tail(3))
