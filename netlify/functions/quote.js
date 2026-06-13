import { json, preflight, fetchJson, cacheGet, cacheSet } from './_util.js'

// GET ?symbols=AAPL,NVDA,TSLA  ->  { AAPL: { c, d, dp, o, h, l, pc, t }, ... }
// c=current, d=change$, dp=change%, o=open, h=high, l=low, pc=prevClose, t=epoch
const TTL = 20000

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  const key = process.env.FINNHUB_API_KEY
  if (!key) return json(500, { error: 'FINNHUB_API_KEY not configured' })

  const raw = (event.queryStringParameters?.symbols || '').trim()
  if (!raw) return json(400, { error: 'symbols query param required' })
  const symbols = [...new Set(raw.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 40)

  const out = {}
  await Promise.all(symbols.map(async (sym) => {
    const ck = `q:${sym}`
    const cached = cacheGet(ck)
    if (cached) { out[sym] = cached; return }
    const { ok, data } = await fetchJson(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`
    )
    if (ok && data && typeof data.c === 'number') {
      const q = { c: data.c, d: data.d, dp: data.dp, o: data.o, h: data.h, l: data.l, pc: data.pc, t: data.t }
      out[sym] = q
      cacheSet(ck, q, TTL)
    } else {
      out[sym] = null
    }
  }))

  return json(200, { quotes: out })
}
