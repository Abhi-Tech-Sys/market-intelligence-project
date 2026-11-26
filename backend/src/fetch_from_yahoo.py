import yfinance as yf
import pandas as pd
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_RAW_DIR = BACKEND_DIR / "data" / "raw"
DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)

TICKER     = "^NSEI"
START_DATE = "2007-01-01"
END_DATE   = None  # up to today

df = yf.download(TICKER, start=START_DATE, end=END_DATE, auto_adjust=True)

if df is None or len(df) == 0:
    raise RuntimeError(f"Yahoo Finance returned an empty dataset for {TICKER}. Aborting.")

# Catch-up: if today's daily bar hasn't closed on Yahoo yet, synthesize it from hourly data
try:
    t = yf.Ticker(TICKER)
    hourly = t.history(period="5d", interval="1h")
    if not hourly.empty:
        hourly_dates = hourly.index.tz_convert("Asia/Kolkata").date
        daily_dates  = {d.date() for d in df.index}
        for d in sorted(set(hourly_dates) - daily_dates):
            day_hourly = hourly[hourly_dates == d]
            if any(day_hourly.index.tz_convert("Asia/Kolkata").hour >= 15):
                new_row = pd.DataFrame(
                    {
                        ("Close",  TICKER): float(day_hourly["Close"].iloc[-1]),
                        ("High",   TICKER): float(day_hourly["High"].max()),
                        ("Low",    TICKER): float(day_hourly["Low"].min()),
                        ("Open",   TICKER): float(day_hourly["Open"].iloc[0]),
                        ("Volume", TICKER): int(day_hourly["Volume"].sum()),
                    },
                    index=[pd.Timestamp(d)],
                )
                new_row.index.name = "Date"
                df = pd.concat([df, new_row])
                print(f"Intraday catch-up: added {d} — Close {day_hourly['Close'].iloc[-1]:.2f}")
except Exception as e:
    print(f"Intraday catch-up skipped ({e}). Proceeding with standard download.")

OUT_PATH = DATA_RAW_DIR / "nifty50_yahoo_raw.csv"
df.to_csv(OUT_PATH)

print(f"Downloaded {len(df)} rows | {df.index.min().date()} to {df.index.max().date()}")
print(f"Saved → {OUT_PATH}")
