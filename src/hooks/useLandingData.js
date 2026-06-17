import { useEffect, useRef, useState } from 'react'
import { getQuotes, getHistory } from '../lib/api'

// Tickers shown in the landing mockup, in display order — matches the export's
// original 2-position design (primary + one other).
const TICKERS = [
  { id: 'aapl', symbol: 'AAPL', name: 'Apple',  iconLetter: 'A' },
  { id: 'nvda', symbol: 'NVDA', name: 'Nvidia', iconLetter: 'N' },
]

const PRIMARY = TICKERS[0] // AAPL drives the chart price tag
const JITTER_MS = 1000     // decorative animation tick — NOT a network call

// Illustrative fallbacks so the landing always renders, even if the market
// data proxy is unreachable (offline dev, rate limit, etc.).
const FALLBACK_STOCKS = [
  { ...TICKERS[0], price: 180.5, changePercent: 2.4, direction: 'up' },
  { ...TICKERS[1], price: 485.2, changePercent: -4.1, direction: 'down' },
]
const FALLBACK_CHART = [90, 85, 92, 88, 95, 80, 85, 75, 80, 70, 78, 65, 72, 68, 60, 65, 55, 50, 48, 45]

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Map a real price series onto the SVG's 0–120 Y space (lower Y = higher on
// screen). Used once, to seed the chart's initial shape from real history.
function pricesToYs(prices) {
  const series = prices.slice(-20)
  if (series.length < 2) return FALLBACK_CHART.slice()
  const min = Math.min(...series)
  const max = Math.max(...series)
  if (max === min) return series.map(() => 80)
  return series.map((c) => clamp(120 - ((c - min) / (max - min)) * 100, 10, 110))
}

/**
 * useLandingData — landing dashboard props.
 *
 * - INITIAL prices + chart shape are REAL: one fetch of AAPL/NVDA quotes and a
 *   1-month AAPL history on mount (via the existing market proxy). No polling.
 * - After that, a purely DECORATIVE ~1s animation gently jitters the displayed
 *   numbers and scrolls the chart — fake, bounded "live ticker" motion for
 *   visual appeal only, no network calls and no real market meaning.
 * - portfolioValue / portfolioDirection are set by the page (fixed placeholder).
 */
export function useLandingData() {
  const [stocks, setStocks] = useState(FALLBACK_STOCKS)
  const [chartPoints, setChartPoints] = useState(FALLBACK_CHART)

  // Animation working state in refs so the 1s tick reads the latest values
  // without re-subscribing the interval.
  const baseRef = useRef(             // seed values each walk mean-reverts toward
    Object.fromEntries(FALLBACK_STOCKS.map((s) => [s.symbol, { price: s.price, dp: s.changePercent, sign: s.direction === 'up' ? 1 : -1 }]))
  )
  const liveRef = useRef(FALLBACK_STOCKS.map((s) => ({ ...s })))
  const seriesRef = useRef(FALLBACK_CHART.slice()) // current chart Y window
  const velRef = useRef(0)                          // chart momentum (damped)

  // 1) Seed from REAL data, once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [quotes, history] = await Promise.all([
          getQuotes(TICKERS.map((t) => t.symbol)),
          getHistory(PRIMARY.symbol, '1mo', '1d'),
        ])
        if (cancelled) return

        const base = {}
        const seeded = TICKERS.map((t, i) => {
          const q = quotes[t.symbol]
          const price = q && typeof q.c === 'number' ? q.c : FALLBACK_STOCKS[i].price
          const dp = q && typeof q.dp === 'number' ? q.dp : FALLBACK_STOCKS[i].changePercent
          base[t.symbol] = { price, dp, sign: dp >= 0 ? 1 : -1 }
          return { ...t, price, changePercent: dp, direction: dp >= 0 ? 'up' : 'down' }
        })
        baseRef.current = base
        liveRef.current = seeded.map((s) => ({ ...s }))
        setStocks(seeded)

        const closes = (history?.points || []).map((p) => p.close).filter((n) => typeof n === 'number')
        if (closes.length >= 2) {
          const ys = pricesToYs(closes)
          seriesRef.current = ys
          setChartPoints(ys)
        }
      } catch {
        // Keep the illustrative fallbacks (baseRef/liveRef already seeded from them).
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 2) Decorative jitter ~1s — fake, bounded, no network.
  useEffect(() => {
    const id = setInterval(() => {
      // Prices + % : mean-reverting random walk around the seed (a few cents /
      // hundredths of a percent), keeping the seed sign so ▲/▼ never flickers.
      const base = baseRef.current
      const next = liveRef.current.map((s) => {
        const b = base[s.symbol]
        const price = s.price + 0.18 * (b.price - s.price) + (Math.random() - 0.5) * b.price * 0.001
        let changePercent = s.changePercent + 0.18 * (b.dp - s.changePercent) + (Math.random() - 0.5) * 0.05
        changePercent = b.sign >= 0 ? Math.max(0.01, changePercent) : Math.min(-0.01, changePercent)
        return { ...s, price, changePercent, direction: b.sign >= 0 ? 'up' : 'down' }
      })
      liveRef.current = next
      setStocks(next)

      // Chart: scroll a rolling window with damped momentum so the line trends
      // smoothly (subtle, bounded — not a per-tick jitter that flips colors).
      const ys = seriesRef.current
      const lastY = ys[ys.length - 1]
      let v = velRef.current
      v += (Math.random() - 0.5) * 0.9 // small random impulse
      v -= 0.05 * (lastY - 60)         // gentle pull toward the middle
      v *= 0.82                        // damping → smooth momentum
      velRef.current = v
      const nextYs = [...ys.slice(1), clamp(lastY + v, 18, 102)]
      seriesRef.current = nextYs
      setChartPoints(nextYs)
    }, JITTER_MS)
    return () => clearInterval(id)
  }, [])

  return { stocks, chartPoints, primaryStockId: PRIMARY.id }
}
