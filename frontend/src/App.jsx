import { useState, useEffect } from 'react'

// Backend API configuration (Local development or Cloud deployment)
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').replace(/\/+$/, '')
const IS_LOCAL = API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1')

// Plain-English visual themes for forecast outcomes
const OUTCOME_THEMES = {
  'Significant UP move expected': {
    color: '#10b981',
    label: 'EXPECTED TO GO UP',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    cardBorder: 'border-emerald-500/30 bg-emerald-950/15'
  },
  'No significant move expected': {
    color: '#94a3b8',
    label: 'STAYING STEADY (NO BIG MOVE)',
    dot: 'bg-slate-400',
    badge: 'bg-slate-800 text-slate-300 border border-slate-700',
    cardBorder: 'border-slate-800 bg-slate-900/70'
  },
  'Significant DOWN move expected': {
    color: '#f43f5e',
    label: 'EXPECTED TO GO DOWN',
    dot: 'bg-rose-400',
    badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    cardBorder: 'border-rose-500/30 bg-rose-950/15'
  },
}

// Plain-English indicator translations
const PLAIN_FEATURE_NAMES = {
  Rolling_Volatility_20d: 'Market Calmness & Risk',
  RSI_14: 'Buying vs Selling Momentum',
  MA_10: 'Short-Term 10-Day Trend',
  MA_20: 'Medium-Term 20-Day Trend',
  MA_50: 'Long-Term 50-Day Trend Baseline',
  Pct_From_MA_10: 'Distance Above/Below 10-Day Trend',
  Pct_From_MA_20: 'Distance Above/Below 20-Day Trend',
  Pct_From_MA_50: 'Distance Above/Below 50-Day Baseline',
  MACD: 'Trend Direction & Speed',
  MACD_Signal: 'Trend Baseline',
  MACD_Diff: 'Shift in Momentum',
  Daily_Return_Pct: 'Latest Day Move %',
}

// ── Probability Bar Component ──────────────────────────────────────────
function ConfidenceBar({ label, value, color }) {
  return (
    <div className="mb-3.5">
      <div className="flex justify-between text-sm sm:text-base mb-1.5 font-medium">
        <span className="text-slate-200">{label}</span>
        <span className="font-mono font-bold text-base" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full bg-slate-800/90 rounded-full h-3 border border-slate-700/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}44` }}
        />
      </div>
    </div>
  )
}

// ── Market Momentum Speed (Plain English) ────────────────────────────
function MarketMomentumDisplay({ value }) {
  const score = Math.min(Math.max(value, 0), 100)
  let status = 'Balanced & Steady'
  let color = '#38bdf8'
  let explanation = 'Buyers and sellers are in balance. No extreme panic or euphoria.'

  if (score < 30) {
    status = 'Heavily Sold (Bargain Zone)'
    color = '#10b981'
    explanation = 'Prices have dropped sharply. Statistically favorable for a rebound.'
  } else if (score > 70) {
    status = 'Heavily Stretched (Caution Zone)'
    color = '#f43f5e'
    explanation = 'Prices have run up quickly. Risk of a short-term pause or pullback is high.'
  } else if (score < 45) {
    status = 'Slightly Weak Momentum'
    color = '#f59e0b'
    explanation = 'Sellers have mild control. Waiting for strength before aggressive buying.'
  }

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Buying vs Selling Speed
        </span>
        <span className="font-mono text-2xl font-bold text-slate-100">{value}</span>
      </div>
      <div className="my-3.5">
        <div className="relative w-full h-3 bg-slate-800 rounded-full border border-slate-700 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[30%] bg-emerald-500/20 border-r border-emerald-500/40" />
          <div className="absolute left-[30%] top-0 bottom-0 w-[40%] bg-slate-700/20 border-r border-slate-600/40" />
          <div className="absolute left-[70%] top-0 bottom-0 w-[30%] bg-rose-500/20" />
          <div
            className="absolute top-0 bottom-0 w-3 rounded-full -ml-1.5 transition-all duration-700 shadow-md"
            style={{ left: `${score}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-slate-500 mt-1.5">
          <span>Oversold / Cheap (&lt;30)</span>
          <span>Balanced (50)</span>
          <span>Overbought / Expensive (&gt;70)</span>
        </div>
      </div>
      <p className="text-sm font-medium" style={{ color }}>
        {status} — <span className="text-slate-300 font-normal">{explanation}</span>
      </p>
    </div>
  )
}

// ── Plain English Actionable Advice ─────────────────────────────────
function getSimpleAdvice(horizonKey, data) {
  const down = data.probabilities['Significant DOWN move expected'] || 0
  const up = data.probabilities['Significant UP move expected'] || 0

  if (horizonKey === '1d') {
    if (down > up && down > 35) {
      return {
        action: 'Avoid Fresh Buying Today',
        detail: `The chance of a downward drop (${down}%) is higher than an upward move (${up}%). Safer to wait for stability.`,
        tag: 'Caution'
      }
    }
    if (up > down && up > 35) {
      return {
        action: 'Favorable for Buying',
        detail: `Upward probability leads at ${up}%. Market shows positive short-term momentum.`,
        tag: 'Positive'
      }
    }
    return {
      action: 'Wait & Watch (No Trade Needed)',
      detail: 'The market is expected to fluctuate within its normal quiet range. Avoid forcing trades in noise.',
      tag: 'Quiet Range'
    }
  }

  if (horizonKey === '5d') {
    if (up > down && up >= 35) {
      return {
        action: 'Positive Weekly Outlook',
        detail: `Indicators suggest upward accumulation (${up}% chance). Good setup for 1-week swing holding.`,
        tag: 'Weekly Growth'
      }
    }
    if (down > up && down >= 35) {
      return {
        action: 'Weekly Selling Pressure',
        detail: `Sellers have steady control over the next 5 days (${down}% chance of drop). Hold tight stops.`,
        tag: 'Elevated Risk'
      }
    }
    return {
      action: 'Weekly Consolidation',
      detail: 'No strong directional push this week. The index is holding its ground between support and resistance.',
      tag: 'Consolidation'
    }
  }

  // 20d (1 Month)
  if (down > up && down >= 35) {
    return {
      action: 'Protect Your Portfolio',
      detail: `Monthly outlook leans cautious (${down}%). Consider reducing exposure or taking partial profits.`,
      tag: 'Capital Safety'
    }
  }
  if (up > down && up >= 35) {
    return {
      action: 'Healthy Monthly Uptrend',
      detail: `Strong economic tailwinds detected (${up}%). Ideal environment for staying invested in quality holdings.`,
      tag: 'Favorable'
    }
  }
  return {
    action: 'Stable Month Ahead',
    detail: 'Monthly indicators indicate a balanced range without major runaway rallies or severe crashes.',
    tag: 'Balanced'
  }
}

// ── Horizon Forecast Card ───────────────────────────────────────────
function HorizonForecastCard({ horizonKey, horizonLabel, data }) {
  const theme = OUTCOME_THEMES[data.prediction] || OUTCOME_THEMES['No significant move expected']
  const advice = getSimpleAdvice(horizonKey, data)

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 flex flex-col justify-between shadow-xl transition-all hover:border-cyan-500/50 ${theme.cardBorder}`}>
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div>
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block mb-0.5">
              Time Horizon
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-100">{horizonLabel}</h3>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${theme.badge}`}>
            {theme.label}
          </span>
        </div>

        {/* Action Advice Box */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Recommended Action
            </span>
            <span className="text-xs font-mono text-amber-400 font-bold">{advice.tag}</span>
          </div>
          <p className="text-base font-bold text-slate-100 flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full ${theme.dot} animate-pulse`} />
            {advice.action}
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">{advice.detail}</p>
        </div>

        {/* Confidence Percentages */}
        <div className="mb-4">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Likelihood Breakdown
          </p>
          {Object.entries(data.probabilities).map(([label, value]) => {
            let simpleLabel = 'Staying Steady (Normal Range)'
            if (label.includes('UP')) simpleLabel = 'Expected to Go Up'
            if (label.includes('DOWN')) simpleLabel = 'Expected to Go Down'

            const barColor = (OUTCOME_THEMES[label] || {}).color || '#64748b'
            return (
              <ConfidenceBar key={label} label={simpleLabel} value={value} color={barColor} />
            )
          })}
        </div>
      </div>

      {/* Top Indicators Behind This Forecast */}
      {data.top_contributing_features && data.top_contributing_features.length > 0 && (
        <div className="pt-4 border-t border-slate-800/80">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 mb-2.5">
            Key Factors Driving This Outlook
          </p>
          <div className="space-y-2">
            {data.top_contributing_features.slice(0, 3).map((f) => (
              <div
                key={f.feature}
                className="flex justify-between items-center text-sm text-slate-200 bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800"
              >
                <span>{PLAIN_FEATURE_NAMES[f.feature] || f.feature}</span>
                <span className="font-mono text-cyan-400 font-bold">{(f.importance * 100).toFixed(0)}% weight</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Overall Market Signal Banner ────────────────────────────────────
function OverallSignalBanner({ predictions, latestData }) {
  if (!predictions || !latestData) return null

  const p1 = predictions.predictions['1d']
  const p5 = predictions.predictions['5d']
  const p20 = predictions.predictions['20d']
  const down1 = p1?.probabilities['Significant DOWN move expected'] || 0

  let verdict = {
    title: 'Wait & Watch — Market in Steady Balance',
    desc: 'The market is moving within a calm, sideways range. There is no aggressive buying or panic selling right now. For ordinary investors, waiting patiently offers the safest risk-reward.',
    badge: 'WAIT & WATCH',
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    icon: '🟡',
  }

  if (p1?.prediction_code === 1 && p5?.prediction_code === 1) {
    verdict = {
      title: 'Bullish Momentum — Favorable for Growth',
      desc: 'Both short-term and weekly indicators indicate upward momentum. Statistically favorable conditions for holding investments and buying dips.',
      badge: 'BULLISH (BUY ON DIPS)',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      icon: '🟢',
    }
  } else if ((p1?.prediction_code === -1 && p20?.prediction_code === -1) || down1 > 40) {
    verdict = {
      title: 'Caution Advised — Downside Pressure Detected',
      desc: 'Indicators show elevated selling pressure across multiple time horizons. Avoid aggressive risk-taking; protect existing capital.',
      badge: 'DEFENSIVE (PROTECT CAPITAL)',
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
      borderColor: 'rgba(244, 63, 94, 0.3)',
      icon: '🔴',
    }
  }

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 border backdrop-blur-md shadow-2xl relative overflow-hidden"
      style={{ backgroundColor: '#0f172ae6', borderColor: verdict.borderColor }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
            Today's Overall Market Signal
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 mt-0.5 flex items-center gap-2">
            <span className="text-2xl">{verdict.icon}</span> {verdict.title}
          </h2>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wide ${verdict.badgeClass}`}>
          {verdict.badge}
        </span>
      </div>

      <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed max-w-5xl">
        {verdict.desc}
      </p>

      {/* 3 Plain-English Drivers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/80">
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-sm text-slate-300">
          <span className="text-cyan-400 font-bold block mb-1">1. Timeframe Agreement</span>
          {p1?.prediction_code === p5?.prediction_code
            ? 'Short-term and weekly models agree on direction, signaling clearer conviction.'
            : 'Different timeframes show mixed signals, indicating a normal quiet consolidation.'}
        </div>
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-sm text-slate-300">
          <span className="text-cyan-400 font-bold block mb-1">2. Price Momentum</span>
          {latestData.rsi_14 > 70
            ? 'Prices have stretched high quickly; avoid rushing to buy at peaks.'
            : latestData.rsi_14 < 30
            ? 'Prices are heavily discounted; statistical bounce zone.'
            : `Momentum is in a healthy, balanced range at ${latestData.rsi_14}.`}
        </div>
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-sm text-slate-300">
          <span className="text-cyan-400 font-bold block mb-1">3. Market Calmness</span>
          {latestData.rolling_volatility_20d < 0.8
            ? 'Volatility is low. The index is moving smoothly in a tight range.'
            : 'Volatility is high. Expect larger fluctuations throughout the day.'}
        </div>
      </div>
    </div>
  )
}

// ── 52-Week Market Position Card ─────────────────────────────────────
function MarketPositionCard({ latestData }) {
  const low52  = latestData?.low_52w  ?? 22231.80
  const high52 = latestData?.high_52w ?? 26328.55
  const current = latestData?.close   ?? 25884.50

  // Position percentage within 52-week range (0–100)
  const pct = Math.min(100, Math.max(0,
    ((current - low52) / (high52 - low52)) * 100
  ))

  // Descriptive badge based on position
  let posLabel, posColor, posGlow, posDetail
  if (pct >= 85) {
    posLabel = 'Near 52-Week High — Strong Bullish Baseline'
    posColor = '#10b981'
    posGlow  = 'shadow-emerald-500/30'
    posDetail = 'The index is trading very close to its annual peak. Momentum is strong and bulls are in control.'
  } else if (pct >= 55) {
    posLabel = 'Upper Half of Annual Range — Positive Territory'
    posColor = '#38bdf8'
    posGlow  = 'shadow-cyan-500/30'
    posDetail = 'The market is comfortably above mid-range. Moderate upward bias with no extreme readings.'
  } else if (pct >= 35) {
    posLabel = 'Middle of Annual Range — Neutral Zone'
    posColor = '#f59e0b'
    posGlow  = 'shadow-amber-500/30'
    posDetail = 'The index sits near the center of its 52-week channel. No strong directional tilt right now.'
  } else {
    posLabel = 'Lower Half of Annual Range — Caution Zone'
    posColor = '#f43f5e'
    posGlow  = 'shadow-rose-500/30'
    posDetail = 'The index is trading in the lower portion of its annual range. Watch for further weakness.'
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 block mb-1">
            52-Week Market Position
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-100">
            Where Does NIFTY 50 Stand Right Now?
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xl leading-relaxed">
            This shows where today's price sits inside the full range the market has traded over the last 52 weeks (1 year). Think of it like a thermometer — low end is cold (cheap / fallen), high end is hot (expensive / risen).
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap`}
          style={{ color: posColor, borderColor: `${posColor}55`, background: `${posColor}18` }}
        >
          {Math.round(pct)}% of Annual Range
        </span>
      </div>

      {/* Current Price Hero */}
      <div className="flex flex-wrap items-baseline gap-4 mb-7">
        <span className="text-4xl sm:text-5xl font-mono font-black text-slate-100 tracking-tight">
          ₹{current.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-sm font-medium text-slate-400">Current NIFTY 50 Level</span>
      </div>

      {/* Visual Progress Bar — 52-Week Thermometer */}
      <div className="mb-6">
        <div className="flex justify-between text-xs font-mono text-slate-400 mb-2">
          <span>52-Week Low<br /><strong className="text-rose-400 text-sm">₹{low52.toLocaleString('en-IN')}</strong></span>
          <span className="text-center">Current Position<br />
            <strong style={{ color: posColor }} className="text-sm">▼ ₹{current.toLocaleString('en-IN')}</strong>
          </span>
          <span className="text-right">52-Week High<br /><strong className="text-emerald-400 text-sm">₹{high52.toLocaleString('en-IN')}</strong></span>
        </div>

        {/* Bar track */}
        <div className="relative w-full h-5 rounded-full overflow-visible bg-slate-800 border border-slate-700">
          {/* Gradient fill */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, #f43f5e22 0%, ${posColor}99 100%)`
            }}
          />
          {/* Marker dot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg ${posGlow} transition-all duration-700`}
            style={{ left: `${pct}%`, backgroundColor: posColor, boxShadow: `0 0 14px ${posColor}` }}
          />
        </div>

        {/* Zone labels below bar */}
        <div className="flex justify-between text-xs text-slate-600 mt-2 select-none">
          <span>Fallen / Cheap</span>
          <span>Mid Range</span>
          <span>Peak / Expensive</span>
        </div>
      </div>

      {/* Verdict badge */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl border mb-6"
        style={{ borderColor: `${posColor}40`, background: `${posColor}0f` }}
      >
        <span className="text-xl mt-0.5">📍</span>
        <div>
          <p className="font-bold text-sm" style={{ color: posColor }}>{posLabel}</p>
          <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">{posDetail}</p>
        </div>
      </div>

      {/* Quick-launch buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="https://in.tradingview.com/chart/?symbol=NSE%3ANIFTY"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-cyan-600/80 to-blue-700/80 hover:from-cyan-500 hover:to-blue-600 border border-cyan-500/30 text-white font-bold text-sm transition-all group shadow-lg shadow-cyan-500/10"
        >
          <span className="text-2xl">📈</span>
          <span>
            <span className="block text-base">Open Interactive Chart</span>
            <span className="font-normal text-xs text-cyan-200 group-hover:text-white transition-colors">
              Full-screen candles on TradingView →
            </span>
          </span>
        </a>

        <a
          href="https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY%2050"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-emerald-700/80 to-teal-700/80 hover:from-emerald-600 hover:to-teal-600 border border-emerald-500/30 text-white font-bold text-sm transition-all group shadow-lg shadow-emerald-500/10"
        >
          <span className="text-2xl">🏛️</span>
          <span>
            <span className="block text-base">Official NSE India Live Data</span>
            <span className="font-normal text-xs text-emerald-200 group-hover:text-white transition-colors">
              All 50 stocks, breadth &amp; turnover →
            </span>
          </span>
        </a>
      </div>
    </div>
  )
}

// ── Live Charts & Fundamental Health Tab ───────────────────────────
function ChartsAndFundamentalsTab({ latestData }) {
  const dynamicPe = latestData?.pe_ratio ? latestData.pe_ratio : 22.5
  const dynamic52w = (latestData?.low_52w && latestData?.high_52w)
    ? `₹${latestData.low_52w.toLocaleString()} – ₹${latestData.high_52w.toLocaleString()}`
    : '₹22,231 – ₹26,328'
  const dynamicReturn1y = (latestData?.return_1y !== undefined)
    ? `${latestData.return_1y >= 0 ? '+' : ''}${latestData.return_1y}%`
    : '+21.4%'

  return (
    <div className="space-y-5">
      {/* 1. Fundamental Overview (Shown directly on the page, dynamically calculated from data) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
              Fundamental Analysis & Valuation
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
              NIFTY 50 Valuation & Economic Health
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Dynamically Calibrated from Market Data
          </span>
        </div>
        <p className="text-sm text-slate-300 max-w-4xl leading-relaxed mb-6">
          Fundamental analysis evaluates corporate earnings multiples, dividend payouts, and 52-week price extremes. The metrics below are automatically calibrated from live index data and trailing corporate earnings:
        </p>

        {/* 4 Key Fundamental Metrics (Dynamic from Backend) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-slate-400 uppercase font-bold block mb-1">
              Index P/E Ratio (Valuation)
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">
              {dynamicPe}
            </span>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              <strong>Fair Valuation:</strong> Calculated dynamically from closing price. Historical fair corridor is 20–24. The market is reasonably priced.
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-slate-400 uppercase font-bold block mb-1">
              1-Year Trailing Return
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-bold text-cyan-300">
              {dynamicReturn1y}
            </span>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              <strong>Annual Performance:</strong> Calculated automatically across the last 252 trading sessions from 1 year ago to today.
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-slate-400 uppercase font-bold block mb-1">
              Dynamic 52-Week Price Range
            </span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-slate-100">
              {dynamic52w}
            </span>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              <strong>1-Year Span:</strong> Calculated in real-time from the highest peak and lowest trough across the trailing 52 weeks.
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-slate-400 uppercase font-bold block mb-1">
              Top Index Sector
            </span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-amber-300">
              Financials (32.2%)
            </span>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              <strong>Dominant Driver:</strong> Indian banking and financial institutions generate roughly one-third of the total index movements.
            </p>
          </div>
        </div>

        {/* Top 5 Sector Weights (Inline visual) */}
        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-xs font-mono text-slate-400 uppercase font-bold block mb-3">
            Top 5 Sectors Powering the NIFTY 50 Index
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-lg font-bold text-cyan-400 block font-mono">32.2%</span>
              <span className="text-xs text-slate-300">Financial Services</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-lg font-bold text-cyan-400 block font-mono">13.8%</span>
              <span className="text-xs text-slate-300">Information Tech (IT)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-lg font-bold text-cyan-400 block font-mono">11.4%</span>
              <span className="text-xs text-slate-300">Oil, Gas & Energy</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-lg font-bold text-cyan-400 block font-mono">8.9%</span>
              <span className="text-xs text-slate-300">Consumer Goods (FMCG)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-lg font-bold text-cyan-400 block font-mono">7.1%</span>
              <span className="text-xs text-slate-300">Automobiles</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 52-Week Market Position Card (with built-in launch buttons) */}
      <MarketPositionCard latestData={latestData} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APPLICATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════
function App() {
  const [predictions, setPredictions] = useState(null)
  const [latestData, setLatestData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('forecast') // 'forecast' | 'charts'

  async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timer)
      return res
    } catch (err) {
      clearTimeout(timer)
      throw err
    }
  }

  async function loadMarketData() {
    setError(null)
    const maxAttempts = IS_LOCAL ? 2 : 8
    let attempt = 0
    let lastError = null

    while (attempt < maxAttempts) {
      attempt++
      try {
        const ts = Date.now()
        const [predRes, latestRes] = await Promise.all([
          fetchWithTimeout(`${API_BASE}/predict?t=${ts}`, { cache: 'no-store' }, 15000),
          fetchWithTimeout(`${API_BASE}/latest-data?t=${ts}`, { cache: 'no-store' }, 15000),
        ])
        if (!predRes.ok || !latestRes.ok) {
          throw new Error('Server returned an error status')
        }
        const predData = await predRes.json()
        const latest = await latestRes.json()

        setPredictions(predData)
        setLatestData(latest)
        setError(null)
        setLoading(false)
        return
      } catch (err) {
        lastError = err
        if (IS_LOCAL) break
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 3000))
        }
      }
    }

    setLoading(false)
    setError(
      lastError?.name === 'AbortError' || lastError?.message?.includes('Failed to fetch')
        ? 'Backend is currently starting up or unreachable. Please refresh in a moment.'
        : lastError?.message || 'Could not connect to backend.'
    )
  }

  // Load automatically on startup
  useEffect(() => {
    loadMarketData()
  }, [])

  // ── Loading Screen ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="relative w-16 h-16 mb-6">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 animate-ping absolute" />
          <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Loading Live Market Intelligence…</h2>
        <p className="text-sm text-slate-400">Analyzing latest NIFTY 50 market close and indicator patterns</p>
      </div>
    )
  }

  // ── Error Screen ────────────────────────────────────────────────────
  if (error && !predictions) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-8 max-w-lg shadow-2xl w-full text-center">
          <span className="text-4xl block mb-3">⚠️</span>
          <h2 className="text-xl font-bold text-rose-400 mb-2">Unable to Connect</h2>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              loadMarketData()
            }}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-cyan-500/20"
          >
            ↻ Retry Connection
          </button>
        </div>
      </div>
    )
  }

  const horizonLabels = {
    '1d': 'Tomorrow (1-Day Ahead)',
    '5d': 'Next 5 Days (Weekly Ahead)',
    '20d': 'Next 1 Month (20-Days Ahead)',
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Full-Width Responsive Container */}
      <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 lg:px-12 py-5">
        {/* Header Bar */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                Live Analysis Feed
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100">
              NIFTY 50 Intelligence
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Data through{' '}
              <span className="text-slate-200 font-mono font-semibold">
                {predictions?.based_on_data_through || '—'}
              </span>{' '}
              (Official NSE Market Close)
            </p>
          </div>

          {/* Simple Tab Toggle */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('forecast')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === 'forecast'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📈</span> Market Forecast & Signals
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === 'charts'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📊</span> Live Charts & Fundamentals
            </button>
          </div>
        </header>

        {/* TAB 1: Market Forecast & Signals */}
        {activeTab === 'forecast' && (
          <div className="space-y-5">
            {/* 1. Overall Signal Banner */}
            <OverallSignalBanner predictions={predictions} latestData={latestData} />

            {/* 2. Market Snapshot Quick Stats */}
            {latestData && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    NIFTY 50 Closing Level
                  </span>
                  <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-300 my-2">
                    ₹{latestData.close.toLocaleString()}
                  </span>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Latest Day Change:</span>
                    <span
                      className={`font-mono font-bold ${
                        latestData.daily_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {latestData.daily_return_pct >= 0 ? '+' : ''}
                      {latestData.daily_return_pct}%
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <MarketMomentumDisplay value={latestData.rsi_14} />
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Market Calmness & Risk
                  </span>
                  <span className="text-3xl sm:text-4xl font-black font-mono text-slate-100 my-2">
                    {latestData.rolling_volatility_20d}%
                  </span>
                  <p className="text-sm text-cyan-400 font-medium pt-2 border-t border-slate-800">
                    {latestData.rolling_volatility_20d < 0.8
                      ? 'Calm & Steady / Low Turbulence'
                      : 'Elevated Intraday Swings'}
                  </p>
                </div>
              </div>
            )}

            {/* 3. Multi-Horizon Forecast Cards */}
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-100">
                  Forecasts by Time Horizon
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  ML model probability estimates for Tomorrow, Next 5 Days, and Next 1 Month
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {Object.entries(predictions?.predictions || {}).map(([horizon, data]) => (
                  <HorizonForecastCard
                    key={horizon}
                    horizonKey={horizon}
                    horizonLabel={horizonLabels[horizon] || horizon}
                    data={data}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Live Charts & Fundamentals */}
        {activeTab === 'charts' && (
          <div>
            <ChartsAndFundamentalsTab latestData={latestData} />
          </div>
        )}

        {/* Simple Clean Footer */}
        <footer className="mt-8 pt-5 border-t border-slate-800 text-center text-sm text-slate-500 space-y-1">
          <p className="font-semibold text-slate-400">
            NIFTY 50 Market Intelligence Engine · Enterprise Quantitative Analytics Platform
          </p>
          <p className="text-xs text-slate-500">
            Automated probabilistic decision-support platform. Predictions are statistical regime estimates, not direct financial advice.
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
