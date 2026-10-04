# PROJECT HANDOFF CONTEXT — Market Intelligence Engine
## For continuing work in Google Antigravity (or any new agentic environment)

> This document exists so you (the agent) can continue this project with full
> context instead of starting from scratch or re-deciding things already
> settled. Read this fully before taking any action. Do not re-architect,
> re-pick the tech stack, or redo completed work without a strong reason —
> treat prior decisions below as final unless explicitly asked to revisit them.

---

## 1. WHO THIS IS FOR

B.Tech CSE (AI) student, building THREE semester projects across three
courses (Machine Learning, Computer Vision, Generative AI for Building
Applications), each designed to later become a capability of a long-term
personal "Personal Intelligence System" (JARVIS-style assistant). The three
projects are built SEPARATELY and FULLY, one at a time — NOT simultaneously.
Current focus: finish the ML project completely before starting CV or GenAI.

Core philosophy: build things genuinely useful and well-engineered, not
disposable coursework. Wants to understand everything, not just receive
working code — expects clear explanation alongside any code changes.

---

## 2. CURRENT PROJECT: Market Intelligence & Movement Prediction System

**What it does**: Predicts the PROBABILITY of a significant up/down
movement in the NIFTY 50 index over 1-day, 5-day, and 20-day horizons —
deliberately NOT predicting exact future price (that's the common,
weaker approach most public projects take).

**Status: ~70% complete.** Core ML pipeline, backend API, and frontend
dashboard are all BUILT AND CONFIRMED WORKING (verified locally, with a
real screenshot of live predictions rendering correctly). What remains:
(1) solving a local Windows execution blocker (see section 6), (2) actual
cloud deployment, (3) report/PPT/demo prep.

### 2.1 Tech stack (DECIDED — do not change without strong reason)
- Backend: Python, FastAPI, pandas, numpy, scikit-learn, `ta` (technical
  indicators), yfinance, joblib
- Frontend: React (Vite + Tailwind CSS) — explicitly NOT Streamlit (user
  dislikes Streamlit's generic look, wants a custom-built UI)
- Python version: 3.14 confirmed working for all pip installs (tested
  directly after initial caution about using it — it works fine)

### 2.2 Folder structure (this exact layout — matches the other 2 planned
projects too, for consistency)
```
market-intelligence-project/
├── backend/
│   ├── src/
│   │   ├── fetch_from_yahoo.py       # pulls NIFTY 50 (^NSEI) via yfinance
│   │   ├── clean_data.py             # handles yfinance's 2-row CSV header quirk
│   │   ├── feature_engineering.py    # technical indicators + labels
│   │   ├── train_model.py            # trains + saves Random Forest models
│   │   ├── backtest.py               # strategy vs buy-and-hold simulation
│   │   └── api.py                    # FastAPI app, serves predictions
│   ├── data/raw/ , data/processed/
│   ├── models/                       # saved .joblib files (rf_model_1d/5d/20d)
│   └── requirements.txt
├── frontend/
│   ├── src/App.jsx                   # main dashboard (single-file React app)
│   └── package.json
├── docs/
│   ├── PRD.md                        # full spec/scope
│   ├── PROJECT_CONTEXT.md            # competitive research, EDA findings, decisions
│   └── DEFENSE_QA.md                 # viva/demo prep — anticipated questions + honest answers
├── README.md
├── HOW_TO_RUN.md                     # exact run commands, both terminals
└── .gitignore
```

### 2.3 Key decisions already made, with reasoning (do not relitigate)
- **Data source**: yfinance (`^NSEI` ticker), 2007-09-17 to present. Chosen
  over a GitHub-mirrored CSV (which had Chinese-language headers initially,
  then English but still third-party) specifically so every step is directly
  reproducible and explainable by the user themselves.
- **Significant-move threshold**: ±1.29% (≈1 standard deviation of daily
  returns, found via EDA — do not change without re-running EDA).
- **Features used**: ONLY price-derived technical indicators (moving
  averages MA_10/20/50, RSI_14, MACD + signal + diff, Momentum_10d,
  Rolling_Volatility_20d). Volume is deliberately EXCLUDED from the MVP
  model — Volume data is missing/zero for 100% of rows from 2007-2012
  (confirmed via EDA), and using it would mean either corrupting the
  model with inconsistent features or discarding the 2008 financial
  crisis as valuable training data. Volume-based features are documented
  as "advanced scope, 2013+ only" — not yet built, not urgent.
- **Model**: Random Forest (`n_estimators=200, max_depth=8,
  class_weight="balanced", random_state=42`) — chosen over Logistic
  Regression after BOTH were trained and compared on BALANCED ACCURACY
  and MACRO F1 (not raw accuracy — raw accuracy is misleading here due to
  class imbalance; a naive "always predict majority class" baseline beats
  both real models on raw accuracy while being functionally useless,
  since it never once predicts an actual significant move). Random
  Forest won on every horizon on the fair metrics.
- **Validation**: Strict chronological split (80% train / 20% test by
  date, NOT randomly shuffled) — critical for time series, avoids data
  leakage. Test period: 2022-11-21 to 2026-08-07.
- **Backtest finding (documented, not a failure)**: A simple 1-day
  strategy (long only when model predicts "up") achieved a 62.2% win
  rate (meaningfully above chance) with ~2.6x LOWER volatility and
  smaller max drawdown than buy-and-hold, but LOWER absolute returns —
  because it's only "in the market" 4.9% of days. This is a legitimate
  risk/return tradeoff finding, explained honestly in DEFENSE_QA.md —
  not something to "fix."
- **API design**: `GET /predict` (all 3 horizons at once), `GET
  /latest-data` (market snapshot), `POST /refresh-data` (re-runs the
  full fetch→clean→feature pipeline on demand and reloads in-memory data
  — does NOT retrain the model, by design; retraining is a separate,
  periodic manual step via `train_model.py`). CORS enabled
  (`allow_origins=["*"]` — fine for dev, should restrict before a real
  production launch beyond this course project).
- **Frontend**: Single `App.jsx`, dark theme, 3 horizon cards with
  color-coded probability bars (green=up/gray=flat/red=down) + top
  contributing features per horizon + a market snapshot bar + two
  buttons ("Re-check Prediction" = fast re-fetch of existing data,
  "Fetch Latest Data" = full pipeline re-run, slower).

### 2.4 Explicitly out of scope for this project's V1
Individual stocks (index only), news/sentiment, live trading, portfolio
optimization, more than 2 compared model types, Streamlit.

---

## 3. IMMEDIATE NEXT STEPS (in priority order)

1. **Resolve the local execution blocker** (see section 6) OR skip
   straight to cloud deployment, which sidesteps it entirely.
2. **Deploy backend to Render (or Railway)** — Linux-hosted, avoids all
   Windows-specific issues the user has been hitting locally.
3. **Deploy frontend to Vercel** — update `API_BASE` in `App.jsx` from
   `http://127.0.0.1:8000` to the real deployed backend URL once known.
4. **Update CORS** in `api.py` to the real deployed frontend URL instead
   of `"*"`.
5. Verify the live, publicly-deployed version works end-to-end (same
   verification process already done locally — check `/docs`, check
   `/predict`, check the dashboard renders real data).
6. Commit and push all of this to GitHub (repo already exists and has
   prior history — do not create a new repo, continue the existing one).
7. **Report + PPT + live demo prep** — `docs/DEFENSE_QA.md` already has
   strong material for this; a Word doc export of key findings may be
   wanted.

---

## 4. WHAT'S ALREADY VERIFIED WORKING (do not need to redo/re-test from
scratch — only re-verify if something seems broken)

- Full pipeline run end-to-end locally: fetch → clean → feature
  engineering → train → backtest → API → frontend, with real printed
  output confirmed at every step (row counts, label distributions,
  balanced accuracy numbers, backtest results all checked and made sense)
- `/predict` endpoint tested via FastAPI's `/docs` page, returned
  correct multi-horizon JSON with probabilities and feature explanations
- React dashboard tested in browser, confirmed showing real live data
  matching what the API returned directly
- Git repository initialized and pushed at least once already

---

## 5. KNOWN ISSUES / THINGS TO BE AWARE OF

- User's machine appears to have a strict "Application Control" security
  policy blocking unsigned `.exe` files AND compiled DLL components
  inside installed packages (hit with `uvicorn.exe` directly, then with
  scikit-learn's internal `_pairwise_fast` DLL during import). This may
  indicate a managed/locked-down device (possibly college-provided) —
  unconfirmed. Workaround attempted: `python -m uvicorn ...` instead of
  calling `uvicorn.exe` directly — fixed the first block but NOT the
  deeper scikit-learn DLL block. **Recommended path: deploy to a Linux
  cloud host (Render) rather than continuing to fight this locally** —
  this class of problem is Windows-specific and won't occur on Render's
  servers.
- Project was originally inside OneDrive (`...\OneDrive\Documents\Sem -
  5 Projects\...`), which caused separate sync/lock issues; was moved to
  `C:\Sem - 5 Projects\ML Project\...` (directly under C:\, not inside
  the user's profile folder) — this relocation might ALSO be a factor in
  the Application Control strictness; moving again to somewhere under
  `C:\Users\<username>\...` could be worth trying if continuing to debug
  locally, but deploying to Render is the recommended priority instead.
- `backend/venv` and `frontend/node_modules` are NOT in version control
  (properly gitignored) — these need to be recreated (`pip install -r
  requirements.txt`, `npm install`) in any new environment, including
  inside Antigravity if it operates in a fresh container/sandbox.

---

## 6. THE OTHER TWO PROJECTS (not started yet — context only, don't build yet)

- **Computer Vision — "Visual Intelligence System"**: object detection
  (YOLO) + OCR + scene description. PRD exists at
  `cv-visual-intelligence-project/docs/PRD.md`. Folder scaffolded
  (backend/frontend split, same pattern) but NO code written yet.
- **Generative AI — "Personal AI Agent"**: chat + RAG over documents +
  basic memory + tool calling + agent decision logic. PRD exists at
  `genai-personal-agent-project/docs/PRD.md`. Folder scaffolded, NO code
  written yet.
- Per the user's current approach: **do not start either of these until
  the ML project above is 100% complete** (deployed + reported).

---

## 7. HOW TO WORK WITH THIS USER

- Explain reasoning, not just output code — they want to learn, not just
  receive finished work.
- When something has a nuanced/honest result (like the backtest
  underperforming buy-and-hold in raw returns), explain the honest
  "why" rather than hiding or glossing over it — this user values
  defensible, rigorous findings over impressive-looking but shallow ones.
- Don't silently change prior architectural decisions (listed in section
  2.3) — if something needs to change, explain why and confirm first.
- Prefers real engineering practice: Git commits at real checkpoints,
  `.gitignore` hygiene, documented reasoning in `docs/`, not shortcuts.
