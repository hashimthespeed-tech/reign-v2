import { fetchJson } from './_util.js'
import { nowET } from '../../src/lib/market.js'
import { fmtMoney } from '../../src/lib/portfolio.js'
import { summarizeMonth } from '../../src/lib/behavior.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

const REIGN_VOICE =
  "You are Reign, an investing coach for a competitive high-school stock simulator. " +
  "This is a student's monthly behavioral report — hold up a mirror to how they actually traded. " +
  "Voice: direct, sharp, plain language a 16-year-old respects. No fluff, no exclamation marks, " +
  "never say 'great job'. Name patterns plainly and back them with the data given. Speak like the " +
  "smartest person in the room who has nothing to prove."

async function yahooHistory(symbol) {
  const { ok, data } = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`, { headers: { 'User-Agent': UA } }, 15000)
  if (!ok || !data?.chart?.result?.[0]) return []
  const r = data.chart.result[0], ts = r.timestamp || [], cl = r.indicators?.quote?.[0]?.close || []
  const pts = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) pts.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return pts
}

async function callGroqJSON(system, prompt, key, model) {
  const { ok, data } = await fetchJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.7, max_tokens: 1100,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    }),
  }, 35000)
  if (!ok) throw new Error(data?.error?.message || 'Groq failed')
  try { return JSON.parse(data.choices[0].message.content) } catch { return null }
}

const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0)
const isoDaysAgo = (et, n) => { const d = new Date(`${et.dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }

// Generate (or return existing) this month's behavioral report for one user.
// Gated to students who've been in their class >= 30 days.
export async function generateMonthlyForUser(admin, userId, { force = false } = {}) {
  const et = nowET()
  const reportMonth = `${et.dateStr.slice(0, 7)}-01` // first of the current ET month

  const { data: portfolio } = await admin.from('portfolios').select('*').eq('user_id', userId).maybeSingle()
  if (!portfolio) return { skipped: 'no portfolio' }

  const { data: existing } = await admin.from('monthly_reports').select('id').eq('user_id', userId).eq('report_month', reportMonth).maybeSingle()
  if (existing && !force) return { skipped: 'already generated', id: existing.id }

  if (!force && daysSince(portfolio.created_at) < 30) return { skipped: 'student under 30 days' }

  // Trailing ~35-day window of activity (captures the reported month).
  const windowStart = isoDaysAgo(et, 35)
  const { data: trades } = await admin.from('trades').select('ticker, company_name, trade_type, shares, price_at_trade, total_value, trade_date')
    .eq('user_id', userId).gte('trade_date', windowStart).order('trade_date', { ascending: true })
  if (!trades?.length) return { skipped: 'no trades this month' }

  const tickers = [...new Set(trades.map((t) => (t.ticker || '').toUpperCase()))]
  const histories = Object.fromEntries(await Promise.all(tickers.map(async (t) => [t, await yahooHistory(t)])))
  const signals = summarizeMonth(trades, histories)

  // prediction accuracy this month
  const { data: preds } = await admin.from('predictions').select('result, prediction_date')
    .eq('user_id', userId).gte('prediction_date', windowStart).not('result', 'is', null)
  const predTotal = (preds || []).length
  const predCorrect = (preds || []).filter((p) => p.result === 'correct').length
  const predAccuracy = predTotal ? (predCorrect / predTotal) * 100 : null

  // portfolio start/end value from stored daily closes in the window
  const { data: reps } = await admin.from('daily_reports').select('report_date, portfolio_value_at_close')
    .eq('user_id', userId).gte('report_date', windowStart).order('report_date', { ascending: true })
  const startValue = reps?.length ? Number(reps[0].portfolio_value_at_close) : null
  const endValue = reps?.length ? Number(reps[reps.length - 1].portfolio_value_at_close) : (portfolio.last_value != null ? Number(portfolio.last_value) : null)

  const nameOf = Object.fromEntries(trades.map((t) => [(t.ticker || '').toUpperCase(), t.company_name || t.ticker]))
  const GROQ = process.env.GROQ_API_KEY
  const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  const fmtList = (arr, f) => arr.length ? arr.map(f).join('; ') : 'none detected'
  const tradeLines = trades.map((t) => `${t.trade_date} ${t.trade_type.toUpperCase()} ${(t.ticker || '').toUpperCase()} @ ${fmtMoney(t.price_at_trade)} (${fmtMoney(t.total_value)})`).join('\n')
  const worstLines = signals.worst.map((w) =>
    `${w.trade_type.toUpperCase()} ${w.ticker} on ${w.date} at ${fmtMoney(w.price)}; later: ${['d7', 'd14', 'd30'].map((k) => w.later[k] != null ? `${k.slice(1)}d ${fmtMoney(w.later[k])}` : `${k.slice(1)}d n/a`).join(', ')}; aged-against-them ${w.regretPct}%`).join('\n') || 'none'

  const prompt = `Monthly behavioral report for this student.

PORTFOLIO: start ${startValue != null ? fmtMoney(startValue) : 'n/a'} → end ${endValue != null ? fmtMoney(endValue) : 'n/a'}.
PREDICTIONS: ${predTotal ? `${predCorrect}/${predTotal} correct (${predAccuracy.toFixed(0)}%)` : 'none resolved this month'}.

TRADES THIS MONTH:
${tradeLines}

DETECTED SIGNALS (data-grounded):
- Panic sells (sold into a >=3% drop): ${fmtList(signals.panicSells, (x) => `${x.ticker} ${x.date} (${x.dropPct}%)`)}
- Hype buys (bought into a >=3% spike): ${fmtList(signals.hypeBuys, (x) => `${x.ticker} ${x.date} (+${x.spikePct}%)`)}
- Impatience (bought then sold at a loss within 7 days): ${fmtList(signals.impatience, (x) => `${x.ticker} held ${x.daysHeld}d, ${x.lossPct}%`)}
- Patience (held through a >=10% drawdown): ${fmtList(signals.patience, (x) => `${x.ticker} (${x.drawdownPct}%)`)}

TWO WORST-AGING TRADES (for What If):
${worstLines}

Return STRICT JSON:
{
  "opening": "one sentence capturing the month honestly",
  "patterns": [ { "title": "short pattern name", "evidence": "1-2 sentences citing the specific data above" } ],
  "what_if": [ { "summary": "what they did on the worst trade", "alternative": "what the data shows would have happened if they'd waited/held" } ],  // up to 2, only for the worst trades above
  "prediction_analysis": "1-2 sentences on their prediction accuracy this month",
  "one_fix": "the single most important thing to fix next month"
}

Produce EXACTLY 3 to 5 "patterns" cards. Lead with the detected signals above; if fewer
than 3 signals fired, round out to 3 with grounded observations drawn from the trade list,
the portfolio start→end change, position concentration, or the prediction record. Every
card's evidence must cite real numbers/tickers/dates shown above — never invent data.`

  const ai = await callGroqJSON(REIGN_VOICE, prompt, GROQ, MODEL)
  if (!ai?.opening || !Array.isArray(ai.patterns)) throw new Error('AI returned no usable report')

  const row = {
    user_id: userId, class_id: portfolio.class_id, report_month: reportMonth,
    report_text: ai.opening,
    behavioral_patterns: { patterns: ai.patterns, one_fix: ai.one_fix || null, prediction_analysis: ai.prediction_analysis || null },
    what_if_scenarios: { scenarios: Array.isArray(ai.what_if) ? ai.what_if : [] },
    prediction_accuracy: predAccuracy,
    portfolio_start_value: startValue,
    portfolio_end_value: endValue,
  }
  const { data: saved, error } = await admin.from('monthly_reports')
    .upsert(row, { onConflict: 'user_id,report_month' }).select().single()
  if (error) throw new Error(error.message)
  return { ok: true, id: saved.id, report: saved }
}

// Generate for everyone eligible (scheduled use).
export async function generateMonthlyForAll(admin, { force = false } = {}) {
  const { data: pfs } = await admin.from('portfolios').select('user_id')
  let made = 0, skipped = 0
  for (const pf of pfs || []) {
    try {
      const r = await generateMonthlyForUser(admin, pf.user_id, { force })
      r.ok ? made++ : skipped++
    } catch { skipped++ }
  }
  return { made, skipped, total: (pfs || []).length }
}
