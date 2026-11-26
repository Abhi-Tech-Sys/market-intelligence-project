import os
import pandas as pd
import joblib
import subprocess
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Paths resolved relative to this file so the server works from any working directory
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
FEATURES_PATH = BACKEND_DIR / "data" / "processed" / "nifty50_features.csv"
MODELS_DIR = BACKEND_DIR / "models"

FEATURE_COLS = [
    "MA_10", "MA_20", "MA_50", "Pct_From_MA_10", "Pct_From_MA_20",
    "Pct_From_MA_50", "RSI_14", "MACD", "MACD_Signal", "MACD_Diff",
    "Momentum_10d", "Rolling_Volatility_20d",
]
HORIZONS = ["1d", "5d", "20d"]

LABEL_MEANING = {
    1:  "Significant UP move expected",
    0:  "No significant move expected",
    -1: "Significant DOWN move expected",
}

app = FastAPI(
    title="Market Intelligence API",
    description="Predicts NIFTY 50 movement probability across multiple horizons.",
    version="1.0.0",
)

# Prevent browsers and CDNs from caching prediction and data endpoints
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path in ["/predict", "/latest-data", "/refresh-data", "/health", "/"]:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        return response

app.add_middleware(NoCacheMiddleware)

# CORS — allows the Vercel frontend and local dev to reach this API
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
extra_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

cors_origins = [
    "https://market-intelligence-theta-six.vercel.app",
    "https://market-intelligence-project.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
] + extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data and models once at startup — not per request
try:
    features_df = pd.read_csv(FEATURES_PATH, parse_dates=["Date"])
    features_df = features_df.sort_values("Date").reset_index(drop=True)
except FileNotFoundError:
    features_df = None
    print(f"WARNING: Features file not found at {FEATURES_PATH}. Run feature_engineering.py first.")

models = {}
for horizon in HORIZONS:
    model_path = MODELS_DIR / f"rf_model_{horizon}.joblib"
    if model_path.exists():
        models[horizon] = joblib.load(model_path)
    else:
        print(f"WARNING: Model not found at {model_path}. Run train_model.py first.")


@app.get("/")
def root():
    return {
        "status": "running",
        "models_loaded": list(models.keys()),
        "data_loaded": features_df is not None,
    }


@app.get("/health", status_code=200)
def health():
    """Lightweight keep-alive endpoint for external uptime monitors."""
    return {"status": "ok"}


@app.get("/predict")
def predict_all_horizons():
    """Returns predictions for all three horizons based on the latest available market data."""
    if features_df is None:
        raise HTTPException(status_code=500, detail="Feature data not loaded on server.")
    if not models:
        raise HTTPException(status_code=500, detail="No trained models loaded on server.")

    latest_row = features_df.iloc[[-1]]
    latest_date = latest_row["Date"].iloc[0]
    X_latest = latest_row[FEATURE_COLS]

    predictions = {}
    for horizon, model in models.items():
        pred_class = int(model.predict(X_latest)[0])
        proba = model.predict_proba(X_latest)[0]
        proba_dict = {
            LABEL_MEANING[int(cls)]: round(float(p) * 100, 1)
            for cls, p in zip(model.classes_, proba)
        }

        importances = pd.Series(model.feature_importances_, index=FEATURE_COLS)
        top_features = [
            {"feature": name, "importance": round(float(val), 3)}
            for name, val in importances.sort_values(ascending=False).head(3).items()
        ]

        predictions[horizon] = {
            "prediction": LABEL_MEANING[pred_class],
            "prediction_code": pred_class,
            "probabilities": proba_dict,
            "top_contributing_features": top_features,
        }

    return {
        "based_on_data_through": str(latest_date.date()),
        "predictions": predictions,
    }


@app.get("/latest-data")
def latest_data():
    """Returns the latest price snapshot and dynamically computed 52-week fundamentals."""
    if features_df is None:
        raise HTTPException(status_code=500, detail="Feature data not loaded on server.")

    latest_row = features_df.iloc[-1]
    last_year = features_df.tail(252)
    high_52w = round(float(last_year["Close"].max()), 2)
    low_52w  = round(float(last_year["Close"].min()), 2)

    close_1y_ago = float(last_year.iloc[0]["Close"])
    return_1y = round(((float(latest_row["Close"]) - close_1y_ago) / close_1y_ago) * 100, 2)
    pe_ratio = round(float(latest_row["Close"]) / 1150.0, 1)

    return {
        "date":                  str(latest_row["Date"].date()),
        "close":                 round(float(latest_row["Close"]), 2),
        "daily_return_pct":      round(float(latest_row["Daily_Return_Pct"]), 2),
        "rsi_14":                round(float(latest_row["RSI_14"]), 1),
        "rolling_volatility_20d": round(float(latest_row["Rolling_Volatility_20d"]), 2),
        "high_52w":              high_52w,
        "low_52w":               low_52w,
        "return_1y":             return_1y,
        "pe_ratio":              pe_ratio,
    }


@app.get("/chart-data")
def chart_data(days: int = 60):
    """Returns historical NIFTY 50 closing prices and moving averages for on-page charting."""
    if features_df is None:
        raise HTTPException(status_code=500, detail="Feature data not loaded on server.")

    tail_df = features_df.tail(min(max(days, 15), 180))
    points = [
        {
            "date":  str(row["Date"].date()),
            "close": round(float(row["Close"]), 2),
            "ma_10": round(float(row["MA_10"]), 2) if "MA_10" in row and not pd.isna(row["MA_10"]) else None,
            "ma_50": round(float(row["MA_50"]), 2) if "MA_50" in row and not pd.isna(row["MA_50"]) else None,
        }
        for _, row in tail_df.iterrows()
    ]
    return {"days": len(points), "points": points}


@app.post("/refresh-data")
def refresh_data():
    """
    Re-runs the full data pipeline (fetch → clean → features) and reloads
    the result in memory so predictions immediately reflect the latest data.
    """
    global features_df

    python_exe = sys.executable
    scripts = [
        SCRIPT_DIR / "fetch_from_yahoo.py",
        SCRIPT_DIR / "clean_data.py",
        SCRIPT_DIR / "feature_engineering.py",
    ]

    logs = []
    for script in scripts:
        result = subprocess.run(
            [python_exe, str(script)],
            capture_output=True, text=True, cwd=str(BACKEND_DIR),
        )
        logs.append({"script": script.name, "returncode": result.returncode})
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"{script.name} failed:\n{result.stderr[-1000:]}",
            )

    features_df = pd.read_csv(FEATURES_PATH, parse_dates=["Date"])
    features_df = features_df.sort_values("Date").reset_index(drop=True)

    return {
        "status": "success",
        "message": "Data refreshed successfully.",
        "new_latest_date": str(features_df["Date"].iloc[-1].date()),
        "steps_run": logs,
    }
