import { fetchJson } from './_util.js'
import { nowET, getMarketStatus } from '../../src/lib/market.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// A prediction date is resolvable if it's a past day, or today after close.
export function dateComplete(dateStr) {
  const et = nowET()
  if (dateStr < et.dateStr) return true
  if (dateStr === et.dateStr) {
    const s = getMarketStatus(et)
    return s === 'after' || s === 'weekend' || s === 'holiday'
  }
  return false
}

async function dailyOHLC(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`
  const { ok, data } = await fetchJson(url, { headers: { 'User-Agent': UA } }, 15000)
  if (!ok || !data?.chart?.result?.[0]) return {}
  const r = data.chart.result[0]
  const ts = r.timestamp || []
  const opens = r.indicators?.quote?.[0]?.open || []
  const closes = r.indicators?.quote?.[0]?.close || []
  const map = {}
  for (let i = 0; i < ts.length; i++) {
    if (opens[i] == null || closes[i] == null) continue
    map[new Date(ts[i] * 1000).toISOString().slice(0, 10)] = { open: opens[i], close: closes[i] }
  }
  return map
}

// Resolve unresolved predictions. filter: { userId?, classId? } (omit both = all).
export async function resolveUnresolved(admin, filter = {}) {
  let q = admin.from('predictions').select('*').is('result', null)
  if (filter.userId) q = q.eq('user_id', filter.userId)
  if (filter.classId) q = q.eq('class_id', filter.classId)
  const { data: preds, error } = await q
  if (error) throw new Error(error.message)

  const resolvable = (preds || []).filter((p) => dateComplete(p.prediction_date))
  if (!resolvable.length) return { resolved: 0, checked: 0 }

  const tickers = [...new Set(resolvable.map((p) => p.ticker.toUpperCase()))]
  const ohlc = {}
  await Promise.all(tickers.map(async (t) => { ohlc[t] = await dailyOHLC(t) }))

  let resolved = 0
  for (const p of resolvable) {
    const day = ohlc[p.ticker.toUpperCase()]?.[p.prediction_date]
    if (!day) continue
    const { open, close } = day
    const move = open > 0 ? (close - open) / open : 0
    let correct
    if (Math.abs(move) < 0.001) correct = false
    else if (close > open) correct = p.direction === 'up'
    else correct = p.direction === 'down'
    const { error: upErr } = await admin.from('predictions').update({
      opening_price: Number(open.toFixed(2)),
      closing_price: Number(close.toFixed(2)),
      result: correct ? 'correct' : 'incorrect',
    }).eq('id', p.id)
    if (!upErr) resolved++
  }
  return { resolved, checked: resolvable.length }
}
