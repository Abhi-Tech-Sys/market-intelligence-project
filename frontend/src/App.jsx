import { useState, useEffect } from 'react'

// The backend API's address. During local development, FastAPI runs on
// port 8000 by default (see the uvicorn command). This will need to
// change to your real deployed backend URL later, once you host it —
// noted as a TODO so it's not forgotten.
const API_BASE = 'http://127.0.0.1:8000'

// Maps each prediction outcome to a color, so the dashboard is instantly
// readable at a glance without needing to read every word.
const PREDICTION_STYLES = {
  'Significant UP move expected': { color: '#22c55e', label: 'UP' },
  'No significant move expected': { color: '#64748b', label: 'FLAT' },
  'Significant DOWN move expected': { color: '#ef4444', label: 'DOWN' },
}

function ProbabilityBar({ label, value, color }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function HorizonCard({ horizonLabel, data }) {
  const style = PREDICTION_STYLES[data.prediction] || { color: '#64748b', label: '?' }

  return (
    <div className="bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-700 flex-1 min-w-[260px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">{horizonLabel}</h3>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: style.color + '33', color: style.color }}
        >
          {style.label}
        </span>
      </div>

      {Object.entries(data.probabilities).map(([label, value]) => (
        <ProbabilityBar
          key={label}
          label={label.replace(' expected', '').replace('Significant ', '')}
          value={value}
          color={PREDICTION_STYLES[label]?.color || '#64748b'}
        />
      ))}

      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">
          Top contributing factors
        </p>
        <ul className="text-sm text-slate-300 space-y-1">
          {data.top_contributing_features.map((f) => (
            <li key={f.feature} className="flex justify-between">
              <span>{f.feature}</span>
              <span className="text-slate-500">{(f.importance * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function App() {
  const [predictions, setPredictions] = useState(null)
  const [latestData, setLatestData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [predRes, latestRes] = await Promise.all([
          fetch(`${API_BASE}/predict`),
          fetch(`${API_BASE}/latest-data`),
        ])

        if (!predRes.ok || !latestRes.ok) {
          throw new Error('API request failed — is the backend server running?')
        }

        setPredictions(await predRes.json())
        setLatestData(await latestRes.json())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Loading market intelligence…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-red-950 border border-red-800 rounded-lg p-6 max-w-md">
          <p className="text-red-300 font-semibold mb-2">Couldn't reach the backend</p>
          <p className="text-red-400 text-sm">{error}</p>
          <p className="text-slate-500 text-xs mt-3">
            Make sure the FastAPI server is running:
            <br />
            <code className="text-slate-400">uvicorn backend.src.api:app --reload --app-dir .</code>
          </p>
        </div>
      </div>
    )
  }

  const horizonLabels = { '1d': '1 Day', '5d': '5 Days', '20d': '20 Days' }

  return (
    <div className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">
          NIFTY 50 Market Intelligence
        </h1>
        <p className="text-slate-400 mt-1">
          Movement probability forecast — data through{' '}
          <span className="text-slate-300">{predictions.based_on_data_through}</span>
        </p>
      </header>

      {latestData && (
        <div className="bg-slate-800 rounded-xl p-5 mb-8 border border-slate-700 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-slate-400 uppercase">Close</p>
            <p className="text-xl font-semibold text-slate-100">{latestData.close}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Daily Return</p>
            <p className={`text-xl font-semibold ${latestData.daily_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {latestData.daily_return_pct}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">RSI (14)</p>
            <p className="text-xl font-semibold text-slate-100">{latestData.rsi_14}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">20d Volatility</p>
            <p className="text-xl font-semibold text-slate-100">{latestData.rolling_volatility_20d}%</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {Object.entries(predictions.predictions).map(([horizon, data]) => (
          <HorizonCard
            key={horizon}
            horizonLabel={horizonLabels[horizon] || horizon}
            data={data}
          />
        ))}
      </div>

      <footer className="mt-10 text-xs text-slate-500">
        Predictions are probabilistic estimates based on historical patterns,
        not financial advice. Model: Random Forest, trained on price-derived
        technical indicators.
      </footer>
    </div>
  )
}

export default App
