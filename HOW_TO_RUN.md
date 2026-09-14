# HOW TO RUN THIS PROJECT — Quick Reference

You need TWO terminals open at the same time. Both must stay running
while you use the dashboard in your browser.

---

## Terminal 1 — Backend (FastAPI)

```
cd "...\market-intelligence-project"
backend\venv\Scripts\activate
uvicorn backend.src.api:app --reload --app-dir .
```

Confirms working: visit http://127.0.0.1:8000/docs in your browser.

---

## Terminal 2 — Frontend (React)

```
cd "...\market-intelligence-project\frontend"
npm run dev
```

(No venv here — venv is Python-only, npm/React don't use it.)

Confirms working: it prints a URL, usually http://localhost:5173 — open
that in your browser. This is your actual dashboard.

---

## Re-running the data pipeline (only needed if you want fresh data,
## or are demonstrating the pipeline itself)

All from the project root, Terminal 1, venv activated:

```
python backend\src\fetch_from_yahoo.py       # pulls latest data
python backend\src\clean_data.py             # cleans it
python backend\src\feature_engineering.py    # builds features + labels
python backend\src\train_model.py            # retrains + saves models
python backend\src\backtest.py               # re-runs the backtest
```

You do NOT need to re-run these every time you just want to view the
dashboard — the models and features are already saved on disk. Only
re-run if you want genuinely fresh/updated data or are demonstrating the
pipeline step-by-step to your teacher.

---

## If something won't start

- "(venv) doesn't appear" → you're not in the right folder, or forgot to
  run the activate command
- "ModuleNotFoundError" → venv isn't activated, or you're running from
  the wrong folder — always run backend commands from the PROJECT ROOT,
  not from inside backend/
- Frontend shows "Couldn't reach the backend" → Terminal 1 (FastAPI)
  isn't running, or crashed — check it
- Port already in use → you likely have an old server still running in
  another terminal/window — close it first
