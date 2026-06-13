// Portfolio math. Pure functions: feed holdings + quotes + cash, get values.
// quote shape: { c (current), d (day change $/share), dp, o, h, l, pc }

export function enrichHolding(h, quote) {
  const shares = Number(h.shares) || 0
  const avg = Number(h.avg_buy_price) || 0
  const price = quote?.c ?? null
  const dayPerShare = quote?.d ?? 0
  const isShort = !!h.is_short

  const marketValue = price != null ? shares * price : 0
  const dayChange = price != null ? shares * dayPerShare : 0
  const dayChangePct = quote?.dp ?? 0

  const costBasis = shares * avg
  const rawAllTime = price != null ? (price - avg) * shares : 0
  // Short positions profit when price falls — invert P&L sign.
  const allTimeChange = isShort ? -rawAllTime : rawAllTime
  const allTimeChangePct = costBasis > 0 ? (allTimeChange / costBasis) * 100 : 0

  return {
    ...h,
    shares, avg, price, isShort,
    marketValue,
    dayChange,
    dayChangePct,
    allTimeChange,
    allTimeChangePct,
    isWatchlist: shares === 0,
  }
}

export function computePortfolio({ cashBalance = 0, holdings = [], quotes = {} }) {
  const cash = Number(cashBalance) || 0
  const enriched = holdings.map((h) => enrichHolding(h, quotes[(h.ticker || '').toUpperCase()]))
  const owned = enriched.filter((h) => h.shares > 0)
  const watchlist = enriched.filter((h) => h.shares === 0)

  const investedValue = owned.reduce((s, h) => s + h.marketValue, 0)
  const totalValue = cash + investedValue
  const dayChangeDollars = owned.reduce((s, h) => s + h.dayChange, 0)
  const prevTotal = totalValue - dayChangeDollars
  const dayChangePct = prevTotal > 0 ? (dayChangeDollars / prevTotal) * 100 : 0

  return {
    cash,
    investedValue,
    totalValue,
    dayChangeDollars,
    dayChangePct,
    pctInvested: totalValue > 0 ? (investedValue / totalValue) * 100 : 0,
    pctCash: totalValue > 0 ? (cash / totalValue) * 100 : 100,
    owned,
    watchlist,
    holdings: enriched,
  }
}

// Formatting helpers used across the UI.
export function fmtMoney(n, dp = 2) {
  const v = Number(n) || 0
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function fmtSigned(n, dp = 2) {
  const v = Number(n) || 0
  const s = v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return v > 0 ? `+${s}` : s
}

export function fmtPct(n, dp = 2) {
  const v = Number(n) || 0
  return `${v > 0 ? '+' : ''}${v.toFixed(dp)}%`
}
