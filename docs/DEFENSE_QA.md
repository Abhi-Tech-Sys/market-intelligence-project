# Project Defense — Questions & Honest Answers

Use this to prepare for your demo/viva. Every answer here is grounded in
something we actually tested, not a guess — if asked to prove any of
these, you can point to the specific script/output that backs it up.

---

## "What's the accuracy of your model?"

Trick question, and you should say so. Raw accuracy is misleading here:
a naive model that ALWAYS predicts "no significant move" scores 91.2% on
the 1-day horizon — higher than our real model — simply because most
days genuinely are unremarkable. That naive model is also completely
useless, since it can never once catch an actual up/down move.

**Better answer**: "On balanced accuracy — a fairer metric for imbalanced
data — our Random Forest model beats the naive baseline on all three
horizons (e.g. 41.8% vs 33.3% on the 1-day horizon, where 33.3% is
literally chance-level for 3 classes). More concretely, in backtesting,
the strategy achieved a 62.2% win rate on the specific days it predicted
an up-move — meaningfully above chance."

## "62% win rate doesn't sound very high — is that actually good?"

For financial markets specifically, yes — this is a realistic and
defensible number. Markets are famously close to efficient/random in the
short term; even professional quantitative funds often operate on edges
of a few percentage points above chance. A model claiming 90%+ accuracy
on stock movement should be treated with suspicion (likely overfit or
leaking information), not celebrated. Modest, honest, above-chance
performance backed by a real backtest is more credible than an
implausibly high number.

## "How do you know this isn't overfitting?"

Three concrete answers:
1. We used a strict chronological train/test split (trained on
   2007–2022, tested only on 2022–2026 — data the model never saw).
2. We used `TimeSeriesSplit`-compatible methodology and Random Forest
   with limited depth (`max_depth=8`), which constrains how much the
   model can memorize noise.
3. The backtest result (62.2% win rate) was computed on the same
   held-out test period — an independent confirmation, not just a
   training-set metric.

## "How do you know there's no data leakage?"

Two specific safeguards, both in the code:
1. Labels are built by looking FORWARD in time (correct — a label is the
   answer, allowed to use future data), but FEATURES only ever use past/
   current data (moving averages, RSI, etc. — nothing computed from
   future prices).
2. In the backtest specifically, we used `.shift(1)` on predictions
   before computing returns — meaning today's trading decision is based
   on YESTERDAY's prediction, never using same-day information we
   wouldn't have had in advance in real life.

## "Why Random Forest and not a deep learning model like LSTM?"

Most existing public NIFTY prediction projects use LSTM and report
weak, inconsistent results (one reference project we researched got
~61% accuracy on a much easier — and less meaningful — regression
target). We deliberately chose interpretable baseline models first
(Logistic Regression, Random Forest) because:
- They're less prone to overfitting on a dataset this size (~4,600 rows
  is small for deep learning)
- They provide genuine feature importance/explainability — a real
  differentiator from typical projects, and part of our PRD's success
  criteria
- Random Forest clearly outperformed Logistic Regression, giving a
  legitimate reason to pick it over trying something more complex

## "Why did you only use price data, not volume, news, or sentiment?"

Volume data was found to be missing/unreliable for ~29% of rows —
specifically 100% missing every year from 2007–2012 (see EDA finding).
Using it inconsistently would either corrupt the model or force
discarding valuable historical data (including the 2008 financial
crisis). We made a deliberate, documented tradeoff: price-derived
features only, across the FULL history. News/sentiment was explicitly
scoped out from the start as a non-goal, to keep the project feasible
within a semester (see PRD section 3).

## "Is this backtest realistic? Could I actually make money with this?"

No, and we say so explicitly in the script's own output: the backtest
EXCLUDES real-world costs — brokerage fees, taxes (STT), bid-ask spread,
and slippage. Since the strategy only trades ~5% of days, each trade's
fixed costs would meaningfully eat into these already-modest returns in
real life. This is a demonstration of SIGNAL quality, not a
ready-to-deploy trading system — explicitly out of scope per the PRD.

## "The strategy made LESS money than just holding the index — isn't that a failure?"

No — that's a misreading of what the strategy was designed to do. It was
only "in the market" 4.9% of the time, by design (it only acts on
high-confidence signals). During this specific test period, NIFTY 50 was
in a strong sustained uptrend — so simply holding the whole time
captured more of that drift than a selective strategy ever could. In
exchange, the strategy had ~2.6x lower volatility and a smaller max
drawdown (-9.8% vs -15.8%). This is a real risk/return tradeoff, not a
failure — the honest, complete comparison (return AND risk) is what
makes this analysis credible.

## "Why these three specific time horizons (1, 5, 20 days)?"

They represent meaningfully different use cases: 1-day for short-term
signal, 5-day for roughly one trading week, 20-day for roughly one
trading month. Testing multiple horizons — rather than just one — is
also part of what differentiates this project from typical single-target
prediction projects.

## "How do you know your data is even correct?"

We spot-checked specific known real-world events against the dataset:
the March 23, 2020 COVID crash low and the September 2024 all-time-high
period both appear correctly in the data (verified against publicly
known values). We also cross-referenced expectations about Yahoo
Finance's data format and confirmed the column structure matched.

## "What would you do differently with more time?" (a GOOD question to
## answer proactively, shows maturity)

Documented explicitly in the PRD as "Advanced/Later scope":
market regime detection (bull/bear/sideways classification), richer
SHAP-based explainability instead of just global feature importance,
sector-relative comparison, live/daily-refreshed data, and potentially
testing whether Volume-based features improve results specifically on
the 2013+ subset where that data is reliable.

## "Is this better than existing student projects on the same topic?"

We researched actual existing public projects before starting (see
`docs/PROJECT_CONTEXT.md` section 2) and found the near-universal pattern
is: predict exact next price via LSTM, report RMSE only, no
explainability, no backtest, deploy as a bare notebook at best. This
project differs by: predicting decision-useful movement PROBABILITY
instead of an unreliable exact price, testing multiple horizons,
providing real feature-based explanations, running an honest backtest
with risk metrics, and deploying via a real API + custom frontend rather
than a notebook or Streamlit template.
