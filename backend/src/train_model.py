import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, f1_score,
    confusion_matrix, classification_report,
)

SCRIPT_DIR  = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
IN_PATH     = BACKEND_DIR / "data" / "processed" / "nifty50_features.csv"
MODELS_DIR  = BACKEND_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLS = [
    "MA_10", "MA_20", "MA_50", "Pct_From_MA_10", "Pct_From_MA_20",
    "Pct_From_MA_50", "RSI_14", "MACD", "MACD_Signal", "MACD_Diff",
    "Momentum_10d", "Rolling_Volatility_20d",
]
HORIZONS = ["1d", "5d", "20d"]

# Chronological 80/20 split — train on past, test on future (no random shuffle)
TEST_SIZE_FRACTION = 0.2

df = pd.read_csv(IN_PATH, parse_dates=["Date"])
df = df.sort_values("Date").reset_index(drop=True)

split_idx = int(len(df) * (1 - TEST_SIZE_FRACTION))
train_df = df.iloc[:split_idx]
test_df  = df.iloc[split_idx:]

print(f"Train: {train_df['Date'].min().date()} → {train_df['Date'].max().date()} ({len(train_df)} rows)")
print(f"Test:  {test_df['Date'].min().date()}  → {test_df['Date'].max().date()} ({len(test_df)} rows)")

results = {}

for horizon in HORIZONS:
    label_col = f"Label_{horizon}"
    print(f"\n{'='*55}")
    print(f"HORIZON: {horizon}")
    print(f"{'='*55}")

    train_mask = train_df[label_col].notna()
    test_mask  = test_df[label_col].notna()
    X_train, y_train = train_df.loc[train_mask, FEATURE_COLS], train_df.loc[train_mask, label_col]
    X_test,  y_test  = test_df.loc[test_mask, FEATURE_COLS],  test_df.loc[test_mask, label_col]

    # Naive baseline — always predict the most common class
    most_common   = y_train.mode()[0]
    naive_preds   = np.full_like(y_test, fill_value=most_common)
    naive_bal_acc = balanced_accuracy_score(y_test, naive_preds)
    naive_f1      = f1_score(y_test, naive_preds, average="macro", zero_division=0)
    print(f"Naive baseline (always {most_common}): balanced-acc {naive_bal_acc:.1%}  macro-F1 {naive_f1:.3f}")

    # Logistic Regression (needs StandardScaler — features span very different numeric ranges)
    scaler        = StandardScaler()
    X_train_sc    = scaler.fit_transform(X_train)
    X_test_sc     = scaler.transform(X_test)
    lr            = LogisticRegression(max_iter=2000, class_weight="balanced")
    lr.fit(X_train_sc, y_train)
    lr_preds      = lr.predict(X_test_sc)
    lr_bal_acc    = balanced_accuracy_score(y_test, lr_preds)
    lr_f1         = f1_score(y_test, lr_preds, average="macro", zero_division=0)

    # Random Forest
    rf = RandomForestClassifier(n_estimators=200, max_depth=8, class_weight="balanced", random_state=42)
    rf.fit(X_train, y_train)
    rf_preds   = rf.predict(X_test)
    rf_bal_acc = balanced_accuracy_score(y_test, rf_preds)
    rf_f1      = f1_score(y_test, rf_preds, average="macro", zero_division=0)

    print(f"Logistic Regression : balanced-acc {lr_bal_acc:.1%}  macro-F1 {lr_f1:.3f}")
    print(f"Random Forest       : balanced-acc {rf_bal_acc:.1%}  macro-F1 {rf_f1:.3f}")
    print(f"\n{classification_report(y_test, rf_preds, zero_division=0)}")
    print(f"Confusion matrix (rows=actual, cols=predicted | labels: -1, 0, 1):")
    print(confusion_matrix(y_test, rf_preds, labels=[-1, 0, 1]))

    # Feature importance
    importances = pd.Series(rf.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
    print(f"\nTop 5 features:\n{importances.head(5)}")

    # Save the Random Forest — it outperformed Logistic Regression on all horizons
    model_path = MODELS_DIR / f"rf_model_{horizon}.joblib"
    joblib.dump(rf, model_path)
    print(f"Saved → {model_path}")

    results[horizon] = {
        "naive_bal_acc": naive_bal_acc, "naive_macro_f1": naive_f1,
        "lr_bal_acc":    lr_bal_acc,    "lr_macro_f1":    lr_f1,
        "rf_bal_acc":    rf_bal_acc,    "rf_macro_f1":    rf_f1,
    }

print(f"\n{'='*55}")
print("FINAL SUMMARY (balanced accuracy / macro F1)")
print(f"{'='*55}")
print(pd.DataFrame(results).T.round(3))
