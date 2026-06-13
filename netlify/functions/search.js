import { json, preflight, fetchJson, cacheGet, cacheSet } from './_util.js'

// Two modes:
//   GET ?q=apple          -> ticker/company search results (US common stocks + ETFs)
//   GET ?symbol=AAPL      -> company profile (name, industry, logo, marketcap)
const TTL = 24 * 60 * 60 * 1000 // 1 day — profiles/listings barely change

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  const key = process.env.FINNHUB_API_KEY
  if (!key) return json(500, { error: 'FINNHUB_API_KEY not configured' })

  const q = (event.queryStringParameters?.q || '').trim()
  const symbol = (event.queryStringParameters?.symbol || '').trim().toUpperCase()

  // ---- profile mode ----
  if (symbol) {
    const ck = `p:${symbol}`
    const cached = cacheGet(ck)
    if (cached) return json(200, { profile: cached }, { 'X-Cache': 'HIT' })
    const { ok, data } = await fetchJson(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`
    )
    if (!ok || !data) return json(502, { error: 'profile unavailable' })
    const profile = {
      ticker: data.ticker || symbol,
      name: data.name || symbol,
      industry: data.finnhubIndustry || '',
      logo: data.logo || '',
      exchange: data.exchange || '',
      marketCap: data.marketCapitalization || null,
      ipo: data.ipo || '',
      weburl: data.weburl || '',
    }
    cacheSet(ck, profile, TTL)
    return json(200, { profile })
  }

  // ---- search mode ----
  if (!q) return json(400, { error: 'q or symbol query param required' })
  const ck = `s:${q.toLowerCase()}`
  const cached = cacheGet(ck)
  if (cached) return json(200, { results: cached }, { 'X-Cache': 'HIT' })

  const { ok, data } = await fetchJson(
    `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`
  )
  if (!ok || !data?.result) return json(502, { error: 'search unavailable' })

  const results = data.result
    .filter((r) => r.type === 'Common Stock' || r.type === 'ETP' || r.type === '')
    .filter((r) => r.symbol && !r.symbol.includes('.')) // US primary listings
    .slice(0, 12)
    .map((r) => ({ symbol: r.symbol, name: r.description, displaySymbol: r.displaySymbol }))

  cacheSet(ck, results, TTL)
  return json(200, { results })
}
