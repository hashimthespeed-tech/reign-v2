import { fetchJson } from './_util.js'
import { nowET, getMarketStatus } from '../../src/lib/market.js'
import { computePortfolio, fmtMoney } from '../../src/lib/portfolio.js'
import { detectHeroVillain } from '../../src/lib/dashboard.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

const REIGN_VOICE =
  "You are Reign, an investing coach for a competitive high-school stock simulator. " +
  "Voice: direct, sharp, plain language a 16-year-old respects. No fluff, no exclamation marks, " +
  "no corporate speak, never say 'great job'. Acknowledge losses plainly. Frame wins competitively " +
  "(reference class rank). Speak like the smartest person in the room who has nothing to prove."

async function finnhubQuotes(tickers, key) {
  const out = {}
  await Promise.all(tickers.map(async (t) => {
    const { ok, data } = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${t}&token=${key}`)
    if (ok && typeof data?.c === 'number') out[t] = { c: data.c, d: data.d, dp: data.dp, o: data.o, pc: data.pc }
  }))
  return out
}

async function yahooHistory(symbol) {
  const { ok, data } = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`, { headers: { 'User-Agent': UA } }, 15000)
  if (!ok || !data?.chart?.result?.[0]) return []
  const r = data.chart.result[0], ts = r.timestamp || [], cl = r.indicators?.quote?.[0]?.close || []
  const pts = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) pts.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return pts
}

async function newsHeadlines(ticker, key) {
  const to = new Date(), from = new Date(to.getTime() - 5 * 86400000)
  const fmt = (d) => d.toISOString().slice(0, 10)
  const { ok, data } = await fetchJson(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`)
  if (!ok || !Array.isArray(data)) return []
  return data.filter((n) => n.headline).slice(0, 2).map((n) => n.headline)
}

async function callGroqJSON(system, prompt, key, model) {
  const { ok, data } = await fetchJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.75, max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    }),
  }, 30000)
  if (!ok) throw new Error(data?.error?.message || 'Groq failed')
  try { return JSON.parse(data.choices[0].message.content) } catch { return null }
}

// Generate (or return existing) today's report for one user. Only runs after close.
export async function generateReportForUser(admin, userId, { force = false } = {}) {
  const et = nowET()
  const status = getMarketStatus(et)
  const reportDate = et.dateStr

  const { data: portfolio } = await admin.from('portfolios').select('*').eq('user_id', userId).maybeSingle()
  if (!portfolio) return { skipped: 'no portfolio' }

  // already generated today? (checked before the market-status gate so a repeat
  // call always returns the existing report rather than a confusing skip)
  const { data: existing } = await admin.from('daily_reports').select('id').eq('user_id', userId).eq('report_date', reportDate).maybeSingle()
  if (existing && !force) return { skipped: 'already generated', id: existing.id }

  // only generate a NEW report once the market has closed for the day
  if (!force && status !== 'after') return { skipped: 'market not closed for today' }

  const { data: profile } = await admin.from('profiles').select('username, investor_type').eq('id', userId).maybeSingle()
  const { data: holdings } = await admin.from('holdings').select('*').eq('portfolio_id', portfolio.id)
  const { data: cls } = await admin.from('classes').select('name, starting_budget').eq('id', portfolio.class_id).maybeSingle()

  const owned = (holdings || []).filter((h) => Number(h.shares) > 0)
  if (!owned.length) return { skipped: 'no holdings to report on' }

  const FINNHUB = process.env.FINNHUB_API_KEY
  const GROQ = process.env.GROQ_API_KEY
  const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  const tickers = [...new Set(owned.map((h) => h.ticker.toUpperCase()))]
  const quotes = await finnhubQuotes(tickers, FINNHUB)
  const histories = Object.fromEntries(await Promise.all(tickers.map(async (t) => [t, await yahooHistory(t)])))

  const p = computePortfolio({ cashBalance: portfolio.cash_balance, holdings, quotes })
  const { hero, villain } = detectHeroVillain(p.owned, histories, quotes)

  // rank (from stored values, like class_standings)
  const { data: classPfs } = await admin.from('portfolios').select('user_id, last_value, cash_balance').eq('class_id', portfolio.class_id)
  const ranked = (classPfs || []).map((x) => ({ user_id: x.user_id, v: Number(x.last_value ?? x.cash_balance) })).sort((a, b) => b.v - a.v)
  const rank = ranked.findIndex((x) => x.user_id === userId) + 1
  const total = ranked.length || 1
  const classAvgReturn = cls ? (ranked.reduce((s, x) => s + (x.v - cls.starting_budget) / cls.starting_budget, 0) / total) * 100 : 0

  // today's prediction
  const { data: pred } = await admin.from('predictions').select('ticker, direction, result').eq('user_id', userId).eq('prediction_date', reportDate).maybeSingle()

  // a few news headlines for the most-moved holding
  const moved = [...p.owned].sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))[0]
  const news = moved ? await newsHeadlines(moved.ticker.toUpperCase(), FINNHUB) : []

  // build prompt
  const holdingLines = p.owned.map((h) =>
    `${h.ticker}: ${h.dayChangePct >= 0 ? '+' : ''}${h.dayChangePct.toFixed(2)}% today, value ${fmtMoney(h.marketValue)}, all-time ${h.allTimeChange >= 0 ? '+' : ''}${fmtMoney(h.allTimeChange)}${h.isShort ? ' (SHORT)' : ''}`
  ).join('\n')

  const prompt = `Write today's daily report for ${profile?.username || 'this student'} (investor type: ${profile?.investor_type || 'unknown'}).

PORTFOLIO TODAY:
- Total value: ${fmtMoney(p.totalValue)}
- Today's change: ${p.dayChangeDollars >= 0 ? '+' : ''}${fmtMoney(p.dayChangeDollars)} (${p.dayChangePct.toFixed(2)}%)
- Class rank: #${rank} of ${total}; class average all-time return ${classAvgReturn.toFixed(1)}%

HOLDINGS:
${holdingLines}

${hero ? `HERO (unusually strong move, >2 std dev): ${hero.ticker} ${hero.dp.toFixed(1)}%` : 'No standout winner today.'}
${villain ? `VILLAIN (unusually weak move, >2 std dev): ${villain.ticker} ${villain.dp.toFixed(1)}%` : 'No standout loser today.'}
${pred ? `Today's prediction: called ${pred.ticker} ${pred.direction} — ${pred.result || 'pending'}.` : 'No prediction made today.'}
${news.length ? `Recent headlines (${moved.ticker}): ${news.join(' | ')}` : ''}

Return STRICT JSON with these keys:
{
  "summary": "2-3 sentences: what happened to the portfolio today and why. Reference rank if it helps. End naturally.",
  "hero_text": ${hero ? `"one punchy line, e.g. '${hero.name} carried your portfolio today.'"` : 'null'},
  "villain_text": ${villain ? `"one punchy line, e.g. '${villain.name} tore you apart today.'"` : 'null'},
  "unresolved_story": "one forward-looking sentence teasing something specific and relevant to THESE holdings for the days ahead",
  "concept_name": "one market concept directly relevant to what happened today",
  "concept_definition": "one-sentence plain-English definition of that concept"
}`

  const ai = await callGroqJSON(REIGN_VOICE, prompt, GROQ, MODEL)
  if (!ai) throw new Error('AI returned no usable JSON')

  const row = {
    user_id: userId, class_id: portfolio.class_id, report_date: reportDate,
    report_text: ai.summary || '',
    hero_ticker: hero?.ticker || null,
    villain_ticker: villain?.ticker || null,
    unresolved_story: ai.unresolved_story || null,
    concept_name: ai.concept_name || null,
    concept_definition: ai.concept_definition || null,
    portfolio_value_at_close: p.totalValue,
    day_change_dollars: p.dayChangeDollars,
    day_change_percentage: p.dayChangePct,
  }
  const { data: saved, error } = await admin.from('daily_reports')
    .upsert(row, { onConflict: 'user_id,report_date' }).select().single()
  if (error) throw new Error(error.message)
  return { ok: true, id: saved.id, report: saved }
}

// Generate for everyone with a portfolio (scheduled use).
export async function generateReportsForAll(admin) {
  const { data: pfs } = await admin.from('portfolios').select('user_id')
  let made = 0, skipped = 0
  for (const pf of pfs || []) {
    try {
      const r = await generateReportForUser(admin, pf.user_id)
      r.ok ? made++ : skipped++
    } catch { skipped++ }
  }
  return { made, skipped, total: (pfs || []).length }
}
