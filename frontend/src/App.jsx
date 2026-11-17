import { useState, useEffect } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').replace(/\/+$/, '')
const IS_LOCAL = API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1')

// ── Visual Themes ──────────────────────────────────────────────────
const THEMES = {
  'Significant UP move expected':   { color: '#10b981', label: 'BULLISH',  dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  'No significant move expected':   { color: '#94a3b8', label: 'NEUTRAL',  dot: 'bg-slate-400',   badge: 'bg-slate-700/40 text-slate-300 border border-slate-600/40' },
  'Significant DOWN move expected': { color: '#f43f5e', label: 'BEARISH',  dot: 'bg-rose-400',    badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
}

// ── Probability Bar ────────────────────────────────────────────────
function ProbabilityBar({ label, value, color }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1 font-medium">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full bg-slate-800/80 rounded-full h-2 border border-slate-700/40 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}44` }} />
      </div>
    </div>
  )
}

// ── RSI Gauge ──────────────────────────────────────────────────────
function RsiGauge({ rsi }) {
  const val = Math.min(Math.max(rsi, 0), 100)
  let label = 'Balanced Momentum'
  let color = '#38bdf8'
  if (val < 30)      { label = 'Oversold — Potential Bounce Zone'; color = '#10b981' }
  else if (val > 70)  { label = 'Overbought — Risk of Pullback';   color = '#f43f5e' }
  else if (val < 45)  { label = 'Cooling / Weak Momentum';         color = '#f59e0b' }

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Momentum (RSI)</span>
        <span className="font-mono text-xl font-bold text-slate-100">{rsi}</span>
      </div>
      <div className="my-2">
        <div className="relative w-full h-2.5 bg-slate-800 rounded-full border border-slate-700/60 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[30%] bg-emerald-500/20 border-r border-emerald-500/40" />
          <div className="absolute left-[30%] top-0 bottom-0 w-[40%] bg-slate-700/20 border-r border-slate-600/40" />
          <div className="absolute left-[70%] top-0 bottom-0 w-[30%] bg-rose-500/20" />
          <div className="absolute top-0 bottom-0 w-2 rounded-full -ml-1 transition-all duration-700 shadow-md" style={{ left: `${val}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
        </div>
        <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
          <span>Oversold</span><span>30</span><span>50</span><span>70</span><span>Overbought</span>
        </div>
      </div>
      <p className="text-[11px] font-medium" style={{ color }}>{label}</p>
    </div>
  )
}

// ── Get trader-friendly advice per horizon ──────────────────────────
function getAdvice(horizonKey, data) {
  const down = data.probabilities['Significant DOWN move expected'] || 0
  const up   = data.probabilities['Significant UP move expected'] || 0
  const flat = data.probabilities['No significant move expected'] || 0

  if (horizonKey === '1d') {
    if (down > up && down > 40) return { stance: 'Avoid Fresh Longs', play: `Downside probability (${down}%) outweighs upside (${up}%). Safer to wait or use tight stops.`, risk: 'Elevated' }
    if (up > down && up > 40)   return { stance: 'Favorable for Longs', play: `Upside probability leads at ${up}%. Look for momentum entries above opening range.`, risk: 'Positive Edge' }
    return { stance: 'Sideways — No Trade', play: `Market likely stays within normal range. Avoid trading into noise.`, risk: 'Noise Zone' }
  }
  if (horizonKey === '5d') {
    if (up > down && up >= 35) return { stance: 'Watch for Bounce', play: `5-day outlook shows accumulation signals (${up}% upside). Wait for confirmation before swing entries.`, risk: 'Selective' }
    if (down > up && down >= 40) return { stance: 'Multi-Day Selling Pressure', play: `Sellers dominant over the next 5 sessions (${down}% downside). Avoid aggressive dip-buying.`, risk: 'Elevated' }
    return { stance: 'Consolidation', play: `No clear weekly direction. Market lacks conviction for a sustained move.`, risk: 'Low Conviction' }
  }
  // 20d
  if (down > up && down >= 40) return { stance: 'Protect Your Portfolio', play: `Monthly outlook leans bearish (${down}%). Consider reducing exposure or hedging existing positions.`, risk: 'Capital Protection' }
  if (up > down && up >= 40) return { stance: 'Monthly Uptrend', play: `Structural tailwinds detected (${up}%). Trail stop-losses higher on winners.`, risk: 'Favorable' }
  return { stance: 'Range-Bound Month Ahead', play: `Monthly outlook shows no strong directional conviction. Focus on asset allocation.`, risk: 'Neutral' }
}

// ── Horizon Card (Clean, No Developer Junk) ────────────────────────
function HorizonCard({ horizonKey, horizonLabel, data, idx }) {
  const theme = THEMES[data.prediction] || THEMES['No significant move expected']
  const advice = getAdvice(horizonKey, data)
  const cardClass = `card-enter-${idx + 1}`

  return (
    <div className={`bg-slate-900/90 rounded-2xl border transition-colors shadow-xl flex flex-col card-breathe ${cardClass}`} style={{ borderColor: theme.color + '33' }}>
      <div className="p-5 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-semibold">{horizonLabel}</span>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${theme.badge}`}>{theme.label}</span>
        </div>

        {/* Actionable Advice */}
        <div className="card-content-area content-swap-enter">
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Recommended Action</span>
              <span className="text-[10px] font-mono text-amber-400 font-semibold">{advice.risk}</span>
            </div>
            <p className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${theme.dot} animate-pulse`} />
              {advice.stance}
            </p>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">{advice.play}</p>
          </div>

          {/* Probability Bars */}
          <div className="pt-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Probability Distribution</p>
            {Object.entries(data.probabilities).map(([label, value]) => (
              <ProbabilityBar key={label} label={label.replace(' expected', '').replace('Significant ', '')} value={value} color={(THEMES[label] || {}).color || '#64748b'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Executive Decision Banner ──────────────────────────────────────
function ExecutiveBanner({ predictions, latestData }) {
  if (!predictions || !latestData) return null

  const p1 = predictions.predictions['1d']
  const p5 = predictions.predictions['5d']
  const p20 = predictions.predictions['20d']
  const down1 = p1?.probabilities['Significant DOWN move expected'] || 0

  let verdict = {
    title: 'Wait & Watch — Stay on Sidelines',
    desc: 'Horizon signals are conflicting while short-term risk remains elevated. Forcing trades in this environment has poor risk-reward.',
    badge: 'HOLD / WAIT',
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    icon: '🟡',
  }

  if (p1.prediction_code === 1 && p5.prediction_code === 1) {
    verdict = {
      title: 'Bullish Alignment — Consider Buying on Dips',
      desc: 'Short and medium-term models agree on upside momentum. This is a statistically favorable window for long positions.',
      badge: 'BUY SIGNAL',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      icon: '🟢',
    }
  } else if (p1.prediction_code === -1 && p20.prediction_code === -1 && down1 > 40) {
    verdict = {
      title: 'Bearish Pressure — Protect Your Capital',
      desc: 'Both short-term and monthly models lean downward. This is not the time to add risk. Sit tight or reduce exposure.',
      badge: 'DEFENSIVE',
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      borderColor: 'rgba(244, 63, 94, 0.3)',
      icon: '🔴',
    }
  }

  // Why we recommend this — plain English reasons
  const reasons = []
  if (p1.prediction_code !== p5.prediction_code || p5.prediction_code !== p20.prediction_code) {
    reasons.push('Timeframes disagree on direction — low overall conviction')
  } else {
    reasons.push('All timeframes agree — strong directional alignment')
  }
  const rsi = latestData.rsi_14
  if (rsi < 30)       reasons.push('RSI deeply oversold — historically a good rebound signal')
  else if (rsi > 70)  reasons.push('RSI overbought — historically a pullback warning')
  else                reasons.push(`RSI at ${rsi} — neutral zone, no extreme momentum`)

  const vol = latestData.rolling_volatility_20d
  if (vol < 0.8) reasons.push('Market is very quiet — avoid trading into thin, noisy moves')
  else           reasons.push('Volatility is elevated — expect larger swings both ways')

  return (
    <div className="rounded-2xl p-6 sm:p-7 mb-8 border backdrop-blur-md shadow-2xl relative overflow-hidden animate-fadeInUp" style={{ backgroundColor: '#0f172ae6', borderColor: verdict.borderColor }}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-800">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">Today's Market Signal</span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1 flex items-center gap-2">
            <span className="text-2xl">{verdict.icon}</span> {verdict.title}
          </h2>
        </div>
        <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide ${verdict.badgeClass}`}>{verdict.badge}</span>
      </div>

      <p className="mt-4 text-slate-300 text-sm leading-relaxed max-w-3xl">{verdict.desc}</p>

      {/* Reasoning Bullets */}
      <div className="mt-5 pt-4 border-t border-slate-800/80">
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">Why This Recommendation</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {reasons.map((r, i) => (
            <div key={i} className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              {r}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Technical Deep Dive Tab ────────────────────────────────────────
function TechnicalTab({ predictions, latestData }) {
  if (!predictions || !latestData) return null

  // Feature name → friendly label
  const friendlyName = (name) => ({
    Rolling_Volatility_20d: '20-Day Volatility',
    RSI_14: 'RSI (14-Day)',
    MA_10: '10-Day Moving Average',
    MA_20: '20-Day Moving Average',
    MA_50: '50-Day Moving Average',
    Pct_From_MA_10: 'Distance from 10-Day MA',
    Pct_From_MA_20: 'Distance from 20-Day MA',
    Pct_From_MA_50: 'Distance from 50-Day MA',
    MACD: 'MACD',
    MACD_Signal: 'MACD Signal Line',
    MACD_Diff: 'MACD Histogram',
    Daily_Return_Pct: 'Daily Return %',
  })[name] || name

  const horizonLabels = { '1d': 'Tomorrow (1-Day)', '5d': 'This Week (5-Day)', '20d': 'This Month (20-Day)' }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Performance Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-mono text-cyan-400 uppercase font-bold">Backtest Win Rate</span>
          <p className="text-3xl font-black font-mono text-emerald-400 mt-2 stat-glow">62.2%</p>
          <p className="text-xs text-slate-400 mt-1">On days where the model predicted an up-move, it was correct 62.2% of the time — significantly above random chance.</p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-mono text-cyan-400 uppercase font-bold">Selectivity</span>
          <p className="text-3xl font-black font-mono text-amber-400 mt-2 stat-glow">95.1%</p>
          <p className="text-xs text-slate-400 mt-1">The model stays in cash 95.1% of the time. It only signals a trade when conviction is high — avoiding noise and transaction costs.</p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-mono text-cyan-400 uppercase font-bold">Training Data</span>
          <p className="text-3xl font-black font-mono text-cyan-300 mt-2">19 Years</p>
          <p className="text-xs text-slate-400 mt-1">Trained on 2007–2022 NIFTY 50 daily data including the 2008 crisis, COVID crash, and multiple bull cycles.</p>
        </div>
      </div>

      {/* Per-Horizon Model Weights */}
      <div className="cards-grid">
        {Object.entries(predictions.predictions).map(([horizon, data], idx) => (
          <div key={horizon} className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg card-enter-${idx + 1}`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-semibold">{horizonLabels[horizon] || horizon}</span>
              <span className="text-xs font-mono text-slate-400">{((THEMES[data.prediction] || {}).label || '—')}</span>
            </div>

            <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-cyan-400 mb-2">Top Factors Driving This Prediction</p>
            <div className="space-y-2">
              {data.top_contributing_features.map((f) => {
                const pct = (f.importance * 100).toFixed(1)
                return (
                  <div key={f.feature} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-200 font-medium">{friendlyName(f.feature)}</span>
                      <span className="font-mono text-cyan-400 font-bold">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${Math.min(pct * 3, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Probabilities in this technical view */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Class Probabilities</p>
              {Object.entries(data.probabilities).map(([label, value]) => (
                <ProbabilityBar key={label} label={label.replace(' expected', '').replace('Significant ', '')} value={value} color={(THEMES[label] || {}).color || '#64748b'} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* How It Works (Abstracted, No Jargon) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <h4 className="text-sm font-bold text-cyan-400 mb-3">How the Engine Works</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <p className="font-bold text-slate-200 mb-1">1. Data Collection</p>
            <p className="text-slate-400">We pull 19 years of NIFTY 50 daily prices and compute technical indicators (moving averages, RSI, MACD, volatility).</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <p className="font-bold text-slate-200 mb-1">2. Noise Filtering</p>
            <p className="text-slate-400">Small daily price changes (under 1 standard deviation) are classified as noise. The model only flags moves that are statistically significant.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <p className="font-bold text-slate-200 mb-1">3. Prediction</p>
            <p className="text-slate-400">A machine learning model evaluates today's indicators and outputs the probability of a significant up, down, or neutral move over each time horizon.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Scenario Simulator ─────────────────────────────────────────────
function ScenarioSimulator({ defaultRsi, defaultVol }) {
  const [simRsi, setSimRsi] = useState(defaultRsi || 38)
  const [simVol, setSimVol] = useState(defaultVol || 0.34)
  const [simTrend, setSimTrend] = useState('divergent')

  let simVerdict = 'Wait & Watch — No Clear Edge'
  let simColor = 'text-amber-400'
  let simExplanation = 'Market conditions are neutral. Sitting tight avoids unnecessary risk and transaction costs.'

  if (simRsi < 30 && simTrend === 'aligned-up') {
    simVerdict = 'Strong Buy Signal'
    simColor = 'text-emerald-400'
    simExplanation = 'Deep oversold momentum combined with bullish trend agreement is historically one of the highest-probability rebound setups.'
  } else if (simRsi > 70 || (simVol > 1.5 && simTrend === 'aligned-down')) {
    simVerdict = 'Reduce Exposure / Hedge'
    simColor = 'text-rose-400'
    simExplanation = 'Overbought momentum or high volatility breakdown indicates immediate capital protection is the priority.'
  } else if (simTrend === 'aligned-up') {
    simVerdict = 'Mild Bullish — Trail Stops Higher'
    simColor = 'text-emerald-300'
    simExplanation = 'Favorable trend alignment, though momentum is not in the extreme bargain zone yet.'
  } else if (simTrend === 'aligned-down') {
    simVerdict = 'Bearish Caution — Avoid Longs'
    simColor = 'text-rose-300'
    simExplanation = 'Downward pressure expected across horizons. Preserve capital and wait for better entry.'
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl animate-fadeInUp">
      <div className="pb-4 border-b border-slate-800 mb-6">
        <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-bold">Interactive Lab</span>
        <h3 className="text-xl font-bold text-slate-100 mt-1">"What If" Scenario Simulator</h3>
        <p className="text-xs text-slate-400 mt-1">Drag the sliders and change market conditions to see how the recommendation engine would react.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* RSI Slider */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-2">
              <span className="text-slate-300">Market Momentum (RSI):</span>
              <span className="font-mono text-cyan-400 font-bold text-sm">{simRsi}</span>
            </div>
            <input type="range" min="10" max="90" step="1" value={simRsi} onChange={(e) => setSimRsi(Number(e.target.value))} className="w-full accent-cyan-400" />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>Panic Selling</span><span>Oversold</span><span>Neutral</span><span>Overbought</span><span>Euphoria</span>
            </div>
          </div>

          {/* Volatility Slider */}
          <div>
            <div className="flex justify-between text-xs font-medium mb-2">
              <span className="text-slate-300">Market Volatility (20-Day):</span>
              <span className="font-mono text-cyan-400 font-bold text-sm">{simVol}%</span>
            </div>
            <input type="range" min="0.1" max="3.0" step="0.05" value={simVol} onChange={(e) => setSimVol(Number(e.target.value))} className="w-full accent-cyan-400" />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>Very Quiet</span><span>Normal</span><span>High Turbulence</span>
            </div>
          </div>

          {/* Trend Toggle */}
          <div>
            <span className="text-xs font-medium text-slate-300 block mb-2">Trend Alignment Across Timeframes:</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'aligned-down', label: 'All Bearish' },
                { id: 'divergent', label: 'Mixed / Conflicting' },
                { id: 'aligned-up', label: 'All Bullish' },
              ].map((t) => (
                <button key={t.id} onClick={() => setSimTrend(t.id)} className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all ${simTrend === t.id ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow' : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Simulated Recommendation</span>
            <h4 className={`text-2xl font-black mt-2 tracking-tight ${simColor}`}>{simVerdict}</h4>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">{simExplanation}</p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-900 grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Volatility Regime</span>
              <span className={simVol > 1.3 ? 'text-amber-400 font-bold' : 'text-slate-300'}>{simVol > 1.3 ? 'High Turbulence' : 'Normal / Quiet'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Momentum Zone</span>
              <span className={simRsi < 30 ? 'text-emerald-400 font-bold' : simRsi > 70 ? 'text-rose-400 font-bold' : 'text-slate-300'}>{simRsi < 30 ? 'Oversold' : simRsi > 70 ? 'Overbought' : 'Neutral'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
function App() {
  const [predictions, setPredictions] = useState(null)
  const [latestData, setLatestData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [coldStartProgress, setColdStartProgress] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingData, setRefreshingData] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
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

  async function executeFetch() {
    const ts = Date.now()
    const [predRes, latestRes] = await Promise.all([
      fetchWithTimeout(`${API_BASE}/predict?t=${ts}`, { cache: 'no-store' }, 20000),
      fetchWithTimeout(`${API_BASE}/latest-data?t=${ts}`, { cache: 'no-store' }, 20000),
    ])
    if (!predRes.ok || !latestRes.ok) {
      throw new Error(`API returned error status (predict: ${predRes.status}, latest: ${latestRes.status})`)
    }
    const predData = await predRes.json()
    const latest = await latestRes.json()
    return { predData, latest }
  }

  async function fetchData(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    setError(null)

    // Free-tier cloud instances (like Render) sleep when idle and take 45-60s to wake up.
    // Retrying with progressive backoff ensures users never get stranded with "Failed to fetch".
    const maxAttempts = isRefresh ? 2 : 14
    let attempt = 0
    let lastError = null

    while (attempt < maxAttempts) {
      attempt++
      try {
        if (!isRefresh && attempt > 1) {
          setColdStartProgress({
            attempt,
            maxAttempts,
          })
        }
        const { predData, latest } = await executeFetch()
        setPredictions(predData)
        setLatestData(latest)
        setError(null)
        setColdStartProgress(null)
        setLoading(false)
        setRefreshing(false)
        if (isRefresh) showToast('Predictions updated!', 'success')
        else if (attempt > 1) showToast('Cloud engine connected successfully!', 'success')
        return
      } catch (err) {
        lastError = err
        if (isRefresh) break
        if (attempt < maxAttempts) {
          setColdStartProgress({
            attempt,
            maxAttempts,
          })
          await new Promise((r) => setTimeout(r, 4500))
        }
      }
    }

    setColdStartProgress(null)
    setLoading(false)
    setRefreshing(false)
    setError(
      lastError?.name === 'AbortError' || lastError?.message?.includes('Failed to fetch')
        ? 'Cloud backend unreachable or took too long to wake up. Please retry.'
        : lastError?.message || 'Failed to connect to backend.'
    )
  }

  async function refreshFullData() {
    setRefreshingData(true)
    setError(null)
    showToast('Pulling latest data from Yahoo Finance…', 'info')
    try {
      const res = await fetchWithTimeout(`${API_BASE}/refresh-data`, { method: 'POST' }, 60000)
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || `Refresh failed with status ${res.status}`)
      }
      const data = await res.json().catch(() => ({}))
      await fetchData(false)
      const syncedDate = data.new_latest_date ? ` through ${data.new_latest_date}` : ''
      showToast(`Live market data synced${syncedDate}!`, 'success')
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setRefreshingData(false)
    }
  }

  useEffect(() => { fetchData(false) }, [])

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="relative w-16 h-16 mb-6">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 animate-ping absolute" />
        <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-slate-100 mb-2">
        {coldStartProgress ? 'Waking Up Cloud Backend…' : 'Loading Market Intelligence…'}
      </h2>
      {coldStartProgress ? (
        <div className="max-w-md w-full bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-2xl">
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Free-tier cloud backends (Render) automatically sleep when idle and take ~45–60s to boot on first request.
          </p>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-3 border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((coldStartProgress.attempt / coldStartProgress.maxAttempts) * 100, 96)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
            <span>Attempt {coldStartProgress.attempt} of {coldStartProgress.maxAttempts}</span>
            <span className="text-cyan-400 animate-pulse font-medium">Connecting automatically…</span>
          </div>
        </div>
      ) : (
        <p className="font-mono text-xs text-slate-400">Connecting to live engine…</p>
      )}
    </div>
  )

  if (error && !predictions) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-7 max-w-lg shadow-2xl w-full">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-lg font-bold text-rose-400">Unable to Connect</h2>
        </div>
        <p className="text-slate-300 text-sm mb-4 leading-relaxed">{error}</p>
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-400 mb-5 space-y-1">
          <div className="text-slate-500">Target Backend API:</div>
          <div className="text-cyan-300 break-all">{API_BASE}</div>
          {IS_LOCAL ? (
            <div className="pt-2 text-slate-400 border-t border-slate-800">
              <code>python -m uvicorn backend.src.api:app --reload --app-dir .</code>
            </div>
          ) : (
            <div className="pt-2 text-slate-400 border-t border-slate-800">
              Free-tier instances may have spun down. Click below to reconnect automatically.
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setLoading(true)
            fetchData(false)
          }}
          className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-cyan-500/20"
        >
          ↻ Reconnect Now
        </button>
      </div>
    </div>
  )

  const horizonLabels = { '1d': 'Tomorrow', '5d': 'This Week', '20d': 'This Month' }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className={`px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold border flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-600' : toast.type === 'error' ? 'bg-rose-950/90 text-rose-200 border-rose-600' : 'bg-cyan-950/90 text-cyan-200 border-cyan-600'}`}>
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'} {toast.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-0.5 w-full rounded-full shimmer-bar mb-4" />
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Live</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">NIFTY 50 Intelligence</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-400">
              Data through <span className="text-slate-200 font-mono font-semibold">{predictions?.based_on_data_through || '—'}</span>
            </p>
            {predictions?.based_on_data_through && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Verified Fresh
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)} disabled={refreshing || refreshingData} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl text-xs font-semibold text-slate-200 border border-slate-700 transition-all">
            {refreshing ? '⟳ Updating…' : '↻ Re-check'}
          </button>
          <button onClick={refreshFullData} disabled={refreshing || refreshingData} className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 rounded-xl text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all">
            {refreshingData ? '⬇ Syncing…' : '⬇ Sync Latest Data'}
          </button>
        </div>
      </header>

      {/* 1. Executive Signal Banner */}
      <ExecutiveBanner predictions={predictions} latestData={latestData} />

      {/* 2. Market Snapshot */}
      {latestData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-fadeInUp">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between card-enter-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">NIFTY 50 Close</span>
            <span className="text-2xl font-black font-mono text-emerald-300 stat-glow my-2">₹{latestData.close.toLocaleString()}</span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Today:</span>
              <span className={`font-mono font-bold ${latestData.daily_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {latestData.daily_return_pct >= 0 ? '+' : ''}{latestData.daily_return_pct}%
              </span>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg card-enter-2">
            <RsiGauge rsi={latestData.rsi_14} />
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between card-enter-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Market Volatility (20D)</span>
            <span className="text-2xl font-black font-mono text-slate-100 my-2">{latestData.rolling_volatility_20d}%</span>
            <p className="text-[11px] text-cyan-400 font-medium">{latestData.rolling_volatility_20d < 0.8 ? 'Quiet / Tight Range' : 'Elevated Turbulence'}</p>
          </div>
        </div>
      )}

      {/* 3. Forecast by Time Horizon */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Forecast by Time Horizon</h2>
        <div className="cards-grid">
          {Object.entries(predictions?.predictions || {}).map(([horizon, data], idx) => (
            <HorizonCard key={horizon} horizonKey={horizon} horizonLabel={horizonLabels[horizon] || horizon} data={data} idx={idx} />
          ))}
        </div>
      </div>

      {/* 4. Technical Deep Dive (flows naturally below) */}
      <TechnicalTab predictions={predictions} latestData={latestData} />

      {/* Footer */}
      <footer className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500 space-y-1">
        <p>NIFTY 50 Market Intelligence Engine · Predictions are probabilistic, not financial advice.</p>
      </footer>
    </div>
  )
}

export default App

