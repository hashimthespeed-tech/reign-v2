import { useEffect, useState } from 'react'
import { getQuotes, getHistory } from '../lib/api'

// Tickers shown in the landing mockup ticker, in display order.
// Static metadata (name/badge letter) is fixed; price + % change are LIVE.
const TICKERS = [
  { id: 'aapl', symbol: 'AAPL', name: 'Apple',     iconLetter: 'A' },
  { id: 'nvda', symbol: 'NVDA', name: 'Nvidia',    iconLetter: 'N' },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla',     iconLetter: 'T' },
  { id: 'msft', symbol: 'MSFT', name: 'Microsoft', iconLetter: 'M' },
]

const PRIMARY = TICKERS[0] // AAPL drives the chart price tag

// Illustrative fallbacks so the landing always renders, even if the market
// data proxy is unreachable (offline dev, rate limit, etc.).
const FALLBACK_STOCKS = TICKERS.map((t, i) => ({
  ...t,
  price: [180.5, 485.2, 242.1, 415.3][i],
  changePercent: [2.4, -4.1, 1.15, 0.8][i],
  direction: [2.4, -4.1, 1.15, 0.8][i] >= 0 ? 'up' : 'down',
}))
const FALLBACK_CHART = [90, 85, 92, 88, 95, 80, 85, 75, 80, 70, 78, 65, 72, 68, 60, 65, 55, 50, 48, 45]

// Map ~20 historical closes onto the SVG's 0–120 Y space.
// Lower Y = higher on screen, per the export's chart contract.
function closesToChartPoints(closes) {
  const series = closes.slice(-20)
  if (series.length < 2) return FALLBACK_CHART
  const min = Math.min(...series)
  const max = Math.max(...series)
  if (max === min) return series.map(() => 80)
  return series.map((c) => {
    const y = 120 - ((c - min) / (max - min)) * 100
    return Math.max(10, Math.min(110, y))
  })
}

/**
 * useLandingData — live Finnhub-backed props for the Network Vista landing.
 * Reuses the existing market proxy (api.js → /.netlify/functions). Returns the
 * placeholder set immediately, then swaps in live data once it resolves.
 *
 * Note: portfolioValue / portfolioDirection are intentionally NOT provided here —
 * they remain fixed illustrative placeholders set by the page.
 */
export function useLandingData() {
  const [stocks, setStocks] = useState(FALLBACK_STOCKS)
  const [chartPoints, setChartPoints] = useState(FALLBACK_CHART)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [quotes, history] = await Promise.all([
          getQuotes(TICKERS.map((t) => t.symbol)),
          getHistory(PRIMARY.symbol, '1mo', '1d'),
        ])
        if (cancelled) return

        const live = TICKERS
          .map((t) => {
            const q = quotes[t.symbol]
            if (!q || typeof q.c !== 'number') return null
            return {
              ...t,
              price: q.c,
              changePercent: typeof q.dp === 'number' ? q.dp : 0,
              direction: (q.dp ?? 0) >= 0 ? 'up' : 'down',
            }
          })
          .filter(Boolean)

        if (live.length) setStocks(live)

        const closes = (history?.points || []).map((p) => p.close).filter((n) => typeof n === 'number')
        if (closes.length >= 2) setChartPoints(closesToChartPoints(closes))
      } catch {
        // Keep the illustrative fallbacks; the landing must never break.
      }
    })()

    return () => { cancelled = true }
  }, [])

  return { stocks, chartPoints, primaryStockId: PRIMARY.id }
}
