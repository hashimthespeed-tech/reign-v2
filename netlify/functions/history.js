import { json, preflight, fetchJson, cacheGet, cacheSet } from './_util.js'

// GET ?symbol=AAPL&range=1mo&interval=1d
// Proxies Yahoo Finance chart (no key). Returns normalized daily closes.
// range: 5d,1mo,3mo,6mo,1y,ytd,max | interval: 1d,1wk
const TTL = 60 * 60 * 1000 // 1h (daily candles change once/day)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf

  const symbol = (event.queryStringParameters?.symbol || '').trim().toUpperCase()
  const range = (event.queryStringParameters?.range || '1mo').trim()
  const interval = (event.queryStringParameters?.interval || '1d').trim()
  if (!symbol) return json(400, { error: 'symbol query param required' })

  const ck = `h:${symbol}:${range}:${interval}`
  const cached = cacheGet(ck)
  if (cached) return json(200, cached, { 'X-Cache': 'HIT' })

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
  const { ok, status, data } = await fetchJson(url, { headers: { 'User-Agent': UA } }, 15000)

  if (!ok || data?.chart?.error || !data?.chart?.result?.[0]) {
    return json(status === 200 ? 502 : (status || 502), {
      error: 'history unavailable', detail: data?.chart?.error?.description || null,
    })
  }

  const res = data.chart.result[0]
  const ts = res.timestamp || []
  const closes = res.indicators?.quote?.[0]?.close || []
  const points = []
  for (let i = 0; i < ts.length; i++) {
    const close = closes[i]
    if (close == null) continue
    points.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: Number(close.toFixed(2)) })
  }

  const payload = {
    symbol,
    currency: res.meta?.currency || 'USD',
    prevClose: res.meta?.chartPreviousClose ?? null,
    points,
  }
  cacheSet(ck, payload, TTL)
  return json(200, payload, { 'X-Cache': 'MISS' })
}
