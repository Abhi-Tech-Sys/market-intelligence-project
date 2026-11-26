import pandas as pd
import numpy as np
from pathlib import Path

SCRIPT_DIR    = Path(__file__).resolve().parent
BACKEND_DIR   = SCRIPT_DIR.parent
RAW_PATH      = BACKEND_DIR / "data" / "raw" / "nifty50_yahoo_raw.csv"
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH      = PROCESSED_DIR / "nifty50_clean.csv"

# yfinance saves a two-row MultiIndex header (Price + Ticker rows); flatten to single names
df = pd.read_csv(RAW_PATH, header=[0, 1], index_col=0)
df.columns = df.columns.get_level_values(0)
df.columns.name = None

# Promote the index to a proper datetime column
df.index.name = "Date"
df = df.reset_index()
df["Date"] = pd.to_datetime(df["Date"])

df = df.sort_values("Date").reset_index(drop=True)
df = df.dropna(subset=["Date", "Open", "High", "Low", "Close"])

# Flag zero-volume rows (index data before ~2013 often has unreported volume)
df["Volume_Missing"] = df["Volume"] == 0
df = df[["Date", "Open", "High", "Low", "Close", "Volume", "Volume_Missing"]]

df.to_csv(OUT_PATH, index=False)
print(f"Cleaned {len(df)} rows | {df['Date'].min().date()} to {df['Date'].max().date()}")
print(f"Volume_Missing rows: {df['Volume_Missing'].sum()}")
print(f"Saved → {OUT_PATH}")
