import { json, preflight, fetchJson, cacheGet, cacheSet } from './_util.js'

// GET ?symbol=AAPL&limit=8  -> recent company headlines
const TTL = 15 * 60 * 1000 // 15m

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  const key = process.env.FINNHUB_API_KEY
  if (!key) return json(500, { error: 'FINNHUB_API_KEY not configured' })

  const symbol = (event.queryStringParameters?.symbol || '').trim().toUpperCase()
  const limit = Math.min(Number(event.queryStringParameters?.limit) || 8, 30)
  if (!symbol) return json(400, { error: 'symbol query param required' })

  const ck = `n:${symbol}`
  const cached = cacheGet(ck)
  if (cached) return json(200, { symbol, news: cached.slice(0, limit) }, { 'X-Cache': 'HIT' })

  const to = new Date()
  const from = new Date(to.getTime() - 14 * 86400000)
  const fmt = (d) => d.toISOString().slice(0, 10)
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`

  const { ok, data } = await fetchJson(url)
  if (!ok || !Array.isArray(data)) return json(502, { error: 'news unavailable' })

  const news = data
    .filter((n) => n.headline)
    .sort((a, b) => b.datetime - a.datetime)
    .map((n) => ({
      headline: n.headline,
      summary: n.summary || '',
      source: n.source || '',
      url: n.url || '',
      datetime: n.datetime,
      image: n.image || '',
    }))

  cacheSet(ck, news, TTL)
  return json(200, { symbol, news: news.slice(0, limit) })
}
