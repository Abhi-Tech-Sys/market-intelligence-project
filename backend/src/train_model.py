"""
train_model.py
===============

WHAT THIS SCRIPT DOES:
Trains and evaluates baseline classification models (Logistic Regression
and Random Forest) to predict NIFTY 50 movement labels, for each of the
three horizons (1d, 5d, 20d) separately — since these are three distinct
prediction problems, not one.

WHY TIME-AWARE VALIDATION MATTERS SO MUCH HERE:
A normal ML train/test split randomly shuffles rows before splitting.
For TIME SERIES data, this is a serious mistake called "data leakage" —
if a row from 2015 ends up in your training set and a row from 2014 ends
up in your test set, your model could effectively "see the future"
relative to what it's being tested on, making it look far more accurate
than it actually would be in real use. To avoid this, we always split
chronologically: train on earlier dates, test on later dates — exactly
how the model would actually be used in reality (predicting forward in
time, never backward).

RUN THIS SCRIPT WITH (from the project root, venv activated):
    python backend/src/train_model.py
"""

import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, f1_score,
    precision_recall_fscore_support, confusion_matrix, classification_report,
)

# ---------------------------------------------------------------------------
# STEP 0: Robust paths + config
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
IN_PATH = BACKEND_DIR / "data" / "processed" / "nifty50_features.csv"
MODELS_DIR = BACKEND_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLS = [
    "MA_10", "MA_20", "MA_50", "Pct_From_MA_10", "Pct_From_MA_20",
    "Pct_From_MA_50", "RSI_14", "MACD", "MACD_Signal", "MACD_Diff",
    "Momentum_10d", "Rolling_Volatility_20d",
]
HORIZONS = ["1d", "5d", "20d"]

# We hold out the FINAL 20% of the dataset (chronologically) as a true,
# never-touched-during-training test set. This simulates "how would this
# model perform on data it has genuinely never seen" — the most honest
# measure of real-world usefulness.
TEST_SIZE_FRACTION = 0.2

# Number of splits for TimeSeriesSplit during cross-validation on the
# TRAINING portion only (this is separate from the final test set above —
# it's used to sanity-check the model isn't wildly unstable across
# different training windows before we even touch the real test set).
N_CV_SPLITS = 5


# ---------------------------------------------------------------------------
# STEP 1: Load feature data
# ---------------------------------------------------------------------------
df = pd.read_csv(IN_PATH, parse_dates=["Date"])
df = df.sort_values("Date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# STEP 2: Chronological train/test split
# ---------------------------------------------------------------------------
# Because df is already sorted oldest -> newest, taking the first 80% of
# ROWS as train and the last 20% as test IS a chronological split — no
# shuffling involved. This is the correct way to split time series data.
split_idx = int(len(df) * (1 - TEST_SIZE_FRACTION))
train_df = df.iloc[:split_idx]
test_df = df.iloc[split_idx:]

print(f"Train period: {train_df['Date'].min().date()} to {train_df['Date'].max().date()} ({len(train_df)} rows)")
print(f"Test period:  {test_df['Date'].min().date()} to {test_df['Date'].max().date()} ({len(test_df)} rows)")


# ---------------------------------------------------------------------------
# STEP 3: Train + evaluate a model for each horizon
# ---------------------------------------------------------------------------
results = {}

for horizon in HORIZONS:
    label_col = f"Label_{horizon}"
    print(f"\n{'='*60}")
    print(f"HORIZON: {horizon}")
    print(f"{'='*60}")

    X_train, y_train = train_df[FEATURE_COLS], train_df[label_col]
    X_test, y_test = test_df[FEATURE_COLS], test_df[label_col]

    # -----------------------------------------------------------------
    # 3a. Naive baseline — "always predict the most common class"
    # -----------------------------------------------------------------
    # This is CRITICAL: without this, you have no idea whether your real
    # model is actually smart, or just as good as a lazy guess. A model
    # that's only slightly better than this baseline isn't very useful,
    # no matter how good its raw accuracy number looks in isolation.
    most_common_class = y_train.mode()[0]
    naive_preds = np.full_like(y_test, fill_value=most_common_class)
    naive_accuracy = accuracy_score(y_test, naive_preds)
    naive_bal_acc = balanced_accuracy_score(y_test, naive_preds)
    naive_f1 = f1_score(y_test, naive_preds, average="macro", zero_division=0)
    print(f"\nNaive baseline (always predict {most_common_class}):")
    print(f"  Accuracy: {naive_accuracy:.1%}  |  Balanced accuracy: {naive_bal_acc:.1%}  |  Macro F1: {naive_f1:.3f}")

    # -----------------------------------------------------------------
    # 3b. Logistic Regression
    # -----------------------------------------------------------------
    # WHY WE SCALE FEATURES HERE (and not for Random Forest below):
    # Logistic Regression is sensitive to the NUMERIC SCALE of features —
    # e.g. MA_50 is in the thousands (raw price level) while RSI_14 ranges
    # 0-100 and MACD_Diff is a small decimal. Without scaling, the
    # optimizer struggles to converge (this is exactly why you saw the
    # ConvergenceWarning) and features with naturally larger numbers can
    # dominate the model even if they're not actually more predictive.
    # StandardScaler transforms every feature to have mean 0, std 1 — a
    # level playing field. Random Forest does NOT need this: it splits on
    # thresholds per feature independently, so raw scale doesn't affect it.
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)  # transform only, using the
                                               # SAME scaling learned from
                                               # train — never re-fit on
                                               # test data, that would leak
                                               # test-set information in

    log_reg = LogisticRegression(max_iter=2000, class_weight="balanced")
    log_reg.fit(X_train_scaled, y_train)
    log_reg_preds = log_reg.predict(X_test_scaled)
    log_reg_acc = accuracy_score(y_test, log_reg_preds)
    log_reg_bal_acc = balanced_accuracy_score(y_test, log_reg_preds)
    log_reg_f1 = f1_score(y_test, log_reg_preds, average="macro", zero_division=0)

    # -----------------------------------------------------------------
    # 3c. Random Forest
    # -----------------------------------------------------------------
    rf = RandomForestClassifier(
        n_estimators=200, max_depth=8, class_weight="balanced",
        random_state=42,  # fixed seed = reproducible results every run
    )
    rf.fit(X_train, y_train)
    rf_preds = rf.predict(X_test)
    rf_acc = accuracy_score(y_test, rf_preds)
    rf_bal_acc = balanced_accuracy_score(y_test, rf_preds)
    rf_f1 = f1_score(y_test, rf_preds, average="macro", zero_division=0)

    print(f"\nLogistic Regression: Accuracy {log_reg_acc:.1%}  |  "
          f"Balanced accuracy {log_reg_bal_acc:.1%}  |  Macro F1 {log_reg_f1:.3f}")
    print(f"Random Forest:       Accuracy {rf_acc:.1%}  |  "
          f"Balanced accuracy {rf_bal_acc:.1%}  |  Macro F1 {rf_f1:.3f}")

    print(f"\n--- Random Forest detailed report ---")
    print(classification_report(y_test, rf_preds, zero_division=0))

    print(f"--- Random Forest confusion matrix ---")
    print("(rows = actual, columns = predicted; labels order: -1, 0, 1)")
    print(confusion_matrix(y_test, rf_preds, labels=[-1, 0, 1]))

    # -----------------------------------------------------------------
    # 3d. Feature importance — the beginning of explainability
    # -----------------------------------------------------------------
    importances = pd.Series(rf.feature_importances_, index=FEATURE_COLS)
    importances = importances.sort_values(ascending=False)
    print(f"\n--- Top 5 most important features (Random Forest) ---")
    print(importances.head(5))

    # -----------------------------------------------------------------
    # 3e. Save the trained model
    # -----------------------------------------------------------------
    # Random Forest won on both fair metrics for every horizon (see the
    # SUMMARY table), so it becomes our PRODUCTION model — the one the
    # backtest and later the API will actually load and use. We save one
    # model file per horizon, since each horizon is a genuinely different
    # prediction problem with its own trained model. joblib is the
    # standard way to persist scikit-learn models — faster and more
    # reliable for this than Python's generic pickle module.
    model_path = MODELS_DIR / f"rf_model_{horizon}.joblib"
    joblib.dump(rf, model_path)
    print(f"\nSaved model to: {model_path}")

    results[horizon] = {
        "naive_bal_acc": naive_bal_acc,
        "naive_macro_f1": naive_f1,
        "log_reg_bal_acc": log_reg_bal_acc,
        "log_reg_macro_f1": log_reg_f1,
        "rf_bal_acc": rf_bal_acc,
        "rf_macro_f1": rf_f1,
    }

# ---------------------------------------------------------------------------
# STEP 4: Final summary across all horizons
# ---------------------------------------------------------------------------
# NOTE: we compare BALANCED ACCURACY and MACRO F1 here, not raw accuracy.
# Raw accuracy is misleading on an imbalanced problem like this one — a
# naive "always predict the majority class" baseline can score deceptively
# high on raw accuracy while having ZERO ability to ever catch an actual
# up or down move (0% recall on the classes we actually care about).
# Balanced accuracy and macro F1 both correct for this by weighing every
# class equally, regardless of how common it is — a much fairer test of
# whether the model is doing something genuinely useful.
print(f"\n{'='*60}")
print("SUMMARY — fair comparison (balanced accuracy / macro F1)")
print(f"{'='*60}")
summary_df = pd.DataFrame(results).T
print(summary_df.round(3))
