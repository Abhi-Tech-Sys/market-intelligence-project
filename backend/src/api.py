"""
api.py
======

WHAT THIS SCRIPT DOES:
Starts a FastAPI web server that exposes the trained models over HTTP —
this is what the React frontend will call to get real predictions,
instead of the frontend needing to know anything about Python, pandas, or
the models themselves. This is the standard way real applications
separate "the model" from "the app people actually use."

RUN THIS SCRIPT WITH (from the project root, venv activated):
    uvicorn backend.src.api:app --reload --app-dir .

Then open http://127.0.0.1:8000/docs in your browser — FastAPI
auto-generates an interactive page where you can test every endpoint
directly, no frontend needed yet. This is how we verify the backend
works BEFORE building any UI on top of it.
"""

import pandas as pd
import joblib
import subprocess
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# STEP 0: Robust paths + config
# ---------------------------------------------------------------------------
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

LABEL_MEANING = {1: "Significant UP move expected",
                  0: "No significant move expected",
                  -1: "Significant DOWN move expected"}


# ---------------------------------------------------------------------------
# STEP 1: Create the FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Market Intelligence API",
    description="Predicts NIFTY 50 movement probability across multiple horizons.",
    version="1.0.0",
)

# CORS (Cross-Origin Resource Sharing): by default, browsers block a
# webpage running on one address (e.g. your React app on localhost:5173)
# from calling an API on a different address (this backend on
# localhost:8000) — CORS middleware explicitly allows it. Without this,
# the React frontend we build later would fail to connect, with a
# confusing browser-only error that never appears here in the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://market-intelligence-theta-six.vercel.app/"],  # for development; in production, restrict this
                            # to your actual deployed frontend's URL
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# STEP 2: Load data and models ONCE at startup (not per-request)
# ---------------------------------------------------------------------------
# Loading a model from disk takes real time — doing it on every single API
# request would make the API slow and wasteful. Instead, we load
# everything once when the server starts, and keep it in memory for every
# request to reuse.
try:
    features_df = pd.read_csv(FEATURES_PATH, parse_dates=["Date"])
    features_df = features_df.sort_values("Date").reset_index(drop=True)
except FileNotFoundError:
    features_df = None
    print(f"WARNING: features file not found at {FEATURES_PATH}. "
          f"Run feature_engineering.py first.")

models = {}
for horizon in HORIZONS:
    model_path = MODELS_DIR / f"rf_model_{horizon}.joblib"
    if model_path.exists():
        models[horizon] = joblib.load(model_path)
    else:
        print(f"WARNING: model not found at {model_path}. "
              f"Run train_model.py first.")


# ---------------------------------------------------------------------------
# STEP 3: Root endpoint — simple health check
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    """Quick check that the API is running at all."""
    return {
        "status": "running",
        "models_loaded": list(models.keys()),
        "data_loaded": features_df is not None,
    }


# ---------------------------------------------------------------------------
# STEP 4: Main prediction endpoint
# ---------------------------------------------------------------------------
@app.get("/predict")
def predict_all_horizons():
    """
    Returns the prediction for ALL THREE horizons (1d, 5d, 20d), based on
    the most recent day of data available. This is the main endpoint the
    dashboard will call.
    """
    if features_df is None:
        raise HTTPException(status_code=500, detail="Feature data not loaded on server.")
    if len(models) == 0:
        raise HTTPException(status_code=500, detail="No trained models loaded on server.")

    # The most recent row = "today" (or the latest day we have data for) —
    # this is what we're actually predicting FROM.
    latest_row = features_df.iloc[[-1]]  # double brackets keep it a
                                          # DataFrame, not a Series —
                                          # models expect DataFrame input
    latest_date = latest_row["Date"].iloc[0]
    X_latest = latest_row[FEATURE_COLS]

    predictions = {}
    for horizon, model in models.items():
        pred_class = int(model.predict(X_latest)[0])

        # predict_proba gives the model's confidence for EACH class, not
        # just its single final answer — this is what lets the dashboard
        # show something like "68% chance of up" instead of just "up".
        proba = model.predict_proba(X_latest)[0]
        class_order = model.classes_  # the order predict_proba's columns
                                        # correspond to — NOT guaranteed to
                                        # be [-1, 0, 1], must check this
                                        # explicitly rather than assume
        proba_dict = {
            LABEL_MEANING[int(cls)]: round(float(p) * 100, 1)
            for cls, p in zip(class_order, proba)
        }

        # Basic explainability: top 3 features driving THIS model overall
        # (global feature importance, not per-prediction — SHAP-based
        # per-prediction explanation is advanced/later scope per the PRD)
        importances = pd.Series(model.feature_importances_, index=FEATURE_COLS)
        top_features = importances.sort_values(ascending=False).head(3)
        top_features_list = [
            {"feature": name, "importance": round(float(val), 3)}
            for name, val in top_features.items()
        ]

        predictions[horizon] = {
            "prediction": LABEL_MEANING[pred_class],
            "prediction_code": pred_class,
            "probabilities": proba_dict,
            "top_contributing_features": top_features_list,
        }

    return {
        "based_on_data_through": str(latest_date.date()),
        "predictions": predictions,
    }


# ---------------------------------------------------------------------------
# STEP 5: Latest market snapshot endpoint
# ---------------------------------------------------------------------------
@app.get("/latest-data")
def latest_data():
    """
    Returns the raw latest price/indicator data — useful for the dashboard
    to show "here's what the market actually looks like right now"
    alongside the prediction.
    """
    if features_df is None:
        raise HTTPException(status_code=500, detail="Feature data not loaded on server.")

    latest_row = features_df.iloc[-1]
    return {
        "date": str(latest_row["Date"].date()),
        "close": round(float(latest_row["Close"]), 2),
        "daily_return_pct": round(float(latest_row["Daily_Return_Pct"]), 2),
        "rsi_14": round(float(latest_row["RSI_14"]), 1),
        "rolling_volatility_20d": round(float(latest_row["Rolling_Volatility_20d"]), 2),
    }


# ---------------------------------------------------------------------------
# STEP 6: Refresh data endpoint — this is what makes "Refresh" in the UI
# actually pull NEW data, instead of just re-showing the same frozen answer
# ---------------------------------------------------------------------------
@app.post("/refresh-data")
def refresh_data():
    """
    Re-runs the data pipeline (fetch -> clean -> feature engineering) to
    pull in the latest trading days, then reloads the result into memory
    so /predict and /latest-data immediately reflect the new data —
    WITHOUT needing to restart the whole server manually.

    WHY WE USE subprocess HERE (running the scripts as separate processes)
    rather than importing and calling their logic directly: those scripts
    were written and tested as standalone, independently runnable steps
    (each with its own clear "run this file directly" purpose, matching
    how you've been running and verifying them one at a time throughout
    this project). Re-using them via subprocess means we get the exact
    same tested behavior here, with no risk of subtly rewriting their
    logic differently inside the API and introducing a new bug.

    WHY WE DON'T RETRAIN THE MODEL HERE: retraining is a much heavier,
    slower operation, and doesn't need to happen every time new data
    arrives — a model trained on years of history doesn't meaningfully
    change from one extra day of data. Retraining periodically (e.g.
    monthly) by manually re-running train_model.py is the realistic,
    correct approach — this endpoint only refreshes the DATA the already
    -trained model predicts from.
    """
    global features_df

    python_exe = sys.executable  # use the SAME Python (and venv) this
                                  # server is already running under —
                                  # never assume a bare "python" command
                                  # would resolve to the right environment
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
            # A script failed — stop immediately and report exactly what
            # went wrong, rather than silently continuing with stale or
            # partial data.
            raise HTTPException(
                status_code=500,
                detail=f"{script.name} failed:\n{result.stderr[-1000:]}",
            )

    # Reload the freshly-regenerated features file into memory so
    # subsequent /predict calls immediately use the new data.
    features_df = pd.read_csv(FEATURES_PATH, parse_dates=["Date"])
    features_df = features_df.sort_values("Date").reset_index(drop=True)

    latest_date = features_df["Date"].iloc[-1]
    return {
        "status": "success",
        "message": "Data refreshed successfully.",
        "new_latest_date": str(latest_date.date()),
        "steps_run": logs,
    }
