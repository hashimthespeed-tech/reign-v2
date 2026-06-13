import { TICKER_NAMES } from './constants.js'

export function daysInClass(joinedAt) {
  if (!joinedAt) return 0
  const ms = Date.now() - new Date(joinedAt).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

// Hero / villain: a stock whose today move is > 2 standard deviations from
// its own ~30-day average daily move. historiesMap: { TICKER: [{date,close}] }.
export function detectHeroVillain(ownedHoldings, historiesMap, quotes) {
  let hero = null, villain = null
  for (const h of ownedHoldings) {
    const tk = (h.ticker || '').toUpperCase()
    const q = quotes[tk]
    const hist = historiesMap[tk]
    if (!q || !hist || hist.length < 8) continue

    // daily % returns
    const rets = []
    for (let i = 1; i < hist.length; i++) {
      const prev = hist[i - 1].close, cur = hist[i].close
      if (prev > 0) rets.push((cur - prev) / prev * 100)
    }
    if (rets.length < 5) continue
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length)
    if (sd <= 0) continue

    const today = q.dp ?? 0
    const z = (today - mean) / sd
    const name = h.company_name || TICKER_NAMES[tk] || tk
    if (z > 2 && today > 0) {
      if (!hero || today > hero.dp) hero = { ticker: tk, name, dp: today, text: `${name} carried your portfolio today.` }
    } else if (z < -2 && today < 0) {
      if (!villain || today < villain.dp) villain = { ticker: tk, name, dp: today, text: `${name} tore you apart today.` }
    }
  }
  return { hero, villain }
}

// Reconstruct a portfolio-value line over the available history window:
// value(date) = cash + Σ shares × close(date). Owned holdings only.
export function reconstructHistory(ownedHoldings, historiesMap, cash) {
  const owned = ownedHoldings.filter((h) => h.shares > 0)
  if (!owned.length) return [] // flat/no line — caller shows empty state

  // ticker -> Map(date -> close)
  const maps = {}
  const allDates = new Set()
  for (const h of owned) {
    const tk = (h.ticker || '').toUpperCase()
    const hist = historiesMap[tk] || []
    const m = new Map()
    for (const p of hist) { m.set(p.date, p.close); allDates.add(p.date) }
    maps[tk] = m
  }
  const dates = [...allDates].sort()
  if (!dates.length) return []

  const last = {} // last known close per ticker (forward fill)
  const series = []
  for (const date of dates) {
    let invested = 0
    let haveAny = false
    for (const h of owned) {
      const tk = (h.ticker || '').toUpperCase()
      const close = maps[tk].get(date) ?? last[tk]
      if (close != null) { last[tk] = close; invested += h.shares * close; haveAny = true }
    }
    if (haveAny) series.push({ date, value: Number((cash + invested).toFixed(2)) })
  }
  return series
}
