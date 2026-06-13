// Pure behavioral-pattern detection over a month's trades + per-ticker daily
// history. Feeds the Monthly Behavioral Report. No I/O — fully testable.
// trades: [{ ticker, trade_type, price_at_trade, trade_date 'YYYY-MM-DD' }]
// histories: { TICKER: [{ date 'YYYY-MM-DD', close }] }

const up = (s) => (s || '').toUpperCase()
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)

function indexHistory(points = []) {
  const m = new Map()
  for (const p of points || []) if (p && p.close != null) m.set(p.date, p.close)
  return { m, dates: [...m.keys()].sort() }
}

function tradingIdxOnOrBefore(idx, date) {
  let i = -1
  for (let k = 0; k < idx.dates.length; k++) { if (idx.dates[k] <= date) i = k; else break }
  return i
}

// % change of the trading day that `date` falls on, vs the prior trading day.
export function dayChangePct(idx, date) {
  const i = tradingIdxOnOrBefore(idx, date)
  if (i <= 0) return null
  const cur = idx.m.get(idx.dates[i]), prev = idx.m.get(idx.dates[i - 1])
  return prev > 0 ? ((cur - prev) / prev) * 100 : null
}

// First available close at least `days` after `date` (null if not yet in history).
export function closeAfter(idx, date, days) {
  const t = new Date(date); t.setUTCDate(t.getUTCDate() + days)
  const ts = t.toISOString().slice(0, 10)
  for (const d of idx.dates) if (d >= ts) return idx.m.get(d)
  return null
}

// Sold within ~24h of a >=3% daily drop.
export function detectPanicSells(trades, histories, threshold = -3) {
  const out = []
  for (const t of trades) {
    if (t.trade_type !== 'sell') continue
    const dc = dayChangePct(indexHistory(histories[up(t.ticker)]), t.trade_date)
    if (dc != null && dc <= threshold) out.push({ ticker: up(t.ticker), date: t.trade_date, dropPct: Number(dc.toFixed(1)) })
  }
  return out
}

// Bought within ~24h of a >=3% daily spike (proxy for "bought into hype/news").
export function detectHypeBuys(trades, histories, threshold = 3) {
  const out = []
  for (const t of trades) {
    if (t.trade_type !== 'buy') continue
    const dc = dayChangePct(indexHistory(histories[up(t.ticker)]), t.trade_date)
    if (dc != null && dc >= threshold) out.push({ ticker: up(t.ticker), date: t.trade_date, spikePct: Number(dc.toFixed(1)) })
  }
  return out
}

// Bought then sold at a loss within `maxDays` (FIFO pairing per ticker).
export function detectImpatience(trades, maxDays = 7) {
  const sorted = [...trades].sort((a, b) => (a.trade_date < b.trade_date ? -1 : 1))
  const buys = {}
  const out = []
  for (const t of sorted) {
    const tk = up(t.ticker)
    if (t.trade_type === 'buy') (buys[tk] ||= []).push({ date: t.trade_date, price: Number(t.price_at_trade) })
    else if (t.trade_type === 'sell' && buys[tk]?.length) {
      const b = buys[tk].shift()
      const held = dayDiff(b.date, t.trade_date)
      const sellP = Number(t.price_at_trade)
      if (held <= maxDays && sellP < b.price) {
        out.push({ ticker: tk, buyDate: b.date, sellDate: t.trade_date, daysHeld: held, lossPct: Number((((sellP - b.price) / b.price) * 100).toFixed(1)) })
      }
    }
  }
  return out
}

// Held a position through a >=10% drawdown without selling it this month.
export function detectPatience(trades, histories, dropThreshold = -10) {
  const byTicker = {}
  for (const t of trades) (byTicker[up(t.ticker)] ||= []).push(t)
  const out = []
  for (const [tk, ts] of Object.entries(byTicker)) {
    const bought = ts.some((t) => t.trade_type === 'buy')
    const sold = ts.some((t) => t.trade_type === 'sell')
    if (!bought || sold) continue
    const idx = indexHistory(histories[tk])
    if (idx.dates.length < 2) continue
    let peak = -Infinity, maxDD = 0
    for (const d of idx.dates) {
      const c = idx.m.get(d)
      peak = Math.max(peak, c)
      if (peak > 0) maxDD = Math.min(maxDD, ((c - peak) / peak) * 100)
    }
    if (maxDD <= dropThreshold) out.push({ ticker: tk, drawdownPct: Number(maxDD.toFixed(1)) })
  }
  return out
}

// The `n` trades that aged worst (buys that fell, sells/covers that then rose).
export function worstTrades(trades, histories, n = 2) {
  const scored = trades.map((t) => {
    const idx = indexHistory(histories[up(t.ticker)])
    const p0 = Number(t.price_at_trade)
    const later = { d7: closeAfter(idx, t.trade_date, 7), d14: closeAfter(idx, t.trade_date, 14), d30: closeAfter(idx, t.trade_date, 30) }
    const horizon = later.d30 ?? later.d14 ?? later.d7
    let regret = 0
    if (horizon != null && p0 > 0) {
      const move = ((horizon - p0) / p0) * 100
      regret = (t.trade_type === 'sell' || t.trade_type === 'cover') ? move : -move
    }
    return { ticker: up(t.ticker), trade_type: t.trade_type, date: t.trade_date, price: p0, later, regretPct: Number(regret.toFixed(1)) }
  })
  return scored.filter((s) => s.regretPct > 0).sort((a, b) => b.regretPct - a.regretPct).slice(0, n)
}

export function summarizeMonth(trades, histories) {
  return {
    panicSells: detectPanicSells(trades, histories),
    hypeBuys: detectHypeBuys(trades, histories),
    impatience: detectImpatience(trades),
    patience: detectPatience(trades, histories),
    worst: worstTrades(trades, histories),
  }
}
