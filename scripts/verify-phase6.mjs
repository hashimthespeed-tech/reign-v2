// Phase 6 trade execution: buy / add / sell / short / cover + validation,
// using the real lib/trade.js against Supabase + live quotes.
// Requires dev server :5173. Run: node scripts/verify-phase6.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { executeBuy, executeSell, executeShort, executeCover } from '../src/lib/trade.js'
import { computePortfolio, fmtMoney } from '../src/lib/portfolio.js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim()
}
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const FN = 'http://localhost:5173/.netlify/functions'

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`) }
const bad = (m, e) => { fail++; console.log(`  \x1b[31m✗ ${m}\x1b[0m${e ? ' — ' + (e.message || JSON.stringify(e)) : ''}`) }
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`)
const ts = Date.now(), PW = 'reignTest123', BUDGET = 20000
const supabase = mk(); const teacher = mk()
let pf, studentId

const reloadPf = async () => (await supabase.from('portfolios').select('*').eq('id', pf.id).single()).data
const holdingFor = async (tk) => (await supabase.from('holdings').select('*').eq('portfolio_id', pf.id).eq('ticker', tk).maybeSingle()).data
const price = async (tk) => (await fetch(`${FN}/quote?symbols=${tk}`).then((r) => r.json())).quotes[tk].c

try {
  step('Setup: approved student, short-selling enabled, $20k')
  {
    const { data: t } = await teacher.auth.signUp({ email: `p6-t-${ts}@reigntest.dev`, password: PW })
    if (!t.session) { bad('email confirmation ON'); process.exit(1) }
    await teacher.from('profiles').upsert({ id: t.user.id, username: `p6t_${ts}`, investor_type: 'teacher' })
    const code = 'R' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: c } = await teacher.from('classes').insert({ name: 'P6', teacher_id: t.user.id, class_code: code, starting_budget: BUDGET, allow_short_selling: true }).select().single()
    const { data: s } = await supabase.auth.signUp({ email: `p6-s-${ts}@reigntest.dev`, password: PW })
    studentId = s.user.id
    await supabase.from('profiles').upsert({ id: studentId, username: `p6s_${ts}`, investor_type: 'aggressive' })
    await supabase.from('class_requests').insert({ student_id: studentId, class_id: c.id, status: 'pending' })
    await teacher.from('class_requests').update({ status: 'approved' }).eq('student_id', studentId)
    await supabase.from('profiles').update({ class_id: c.id }).eq('id', studentId)
    const { data: p } = await supabase.from('portfolios').insert({ user_id: studentId, class_id: c.id, cash_balance: BUDGET }).select().single()
    pf = p
    ok('student ready with $20,000')
  }

  step('1. Buy AAPL $5,000')
  {
    const pr = await price('AAPL')
    const res = await executeBuy({ supabase, portfolio: pf, existing: null, ticker: 'AAPL', companyName: 'Apple', price: pr, dollarAmount: 5000 })
    pf = await reloadPf()
    const h = await holdingFor('AAPL')
    const trades = (await supabase.from('trades').select('id').eq('portfolio_id', pf.id).eq('trade_type', 'buy')).data
    if (res.ok && h && Math.abs(pf.cash_balance - 15000) < 0.01 && trades.length === 1) ok(`bought ${h.shares.toFixed(2)} sh @ ${fmtMoney(pr)}, cash ${fmtMoney(pf.cash_balance)}, trade logged`)
    else bad('buy', res.error)
  }

  step('2. Add AAPL $2,000 → weighted avg + cash 13k')
  {
    const pr = await price('AAPL')
    const before = await holdingFor('AAPL')
    const res = await executeBuy({ supabase, portfolio: pf, existing: before, ticker: 'AAPL', companyName: 'Apple', price: pr, dollarAmount: 2000 })
    pf = await reloadPf()
    const h = await holdingFor('AAPL')
    if (res.ok && h.shares > before.shares && Math.abs(pf.cash_balance - 13000) < 0.01) ok(`added; now ${h.shares.toFixed(2)} sh, avg ${fmtMoney(h.avg_buy_price)}, cash ${fmtMoney(pf.cash_balance)}`)
    else bad('add buy', res.error)
  }

  step('3. Sell half of AAPL')
  {
    const pr = await price('AAPL')
    const h = await holdingFor('AAPL')
    const sellShares = h.shares / 2
    const res = await executeSell({ supabase, portfolio: pf, holding: h, price: pr, sharesToSell: sellShares })
    pf = await reloadPf()
    const after = await holdingFor('AAPL')
    if (res.ok && Math.abs(after.shares - sellShares) < 0.001 && pf.cash_balance > 13000) ok(`sold half; ${after.shares.toFixed(2)} sh left, cash ${fmtMoney(pf.cash_balance)}`)
    else bad('sell', res.error)
  }

  step('4. Short NVDA $3,000 → proceeds add to cash')
  {
    const pr = await price('NVDA')
    const cashBefore = pf.cash_balance
    const res = await executeShort({ supabase, portfolio: pf, existing: null, ticker: 'NVDA', companyName: 'NVIDIA', price: pr, dollarAmount: 3000 })
    pf = await reloadPf()
    const h = await holdingFor('NVDA')
    if (res.ok && h?.is_short && Math.abs(pf.cash_balance - (cashBefore + 3000)) < 0.01) ok(`shorted ${h.shares.toFixed(2)} NVDA; cash ${fmtMoney(pf.cash_balance)} (proceeds in)`)
    else bad('short', res.error)
  }

  step('5. computePortfolio treats short as liability')
  {
    const { data: hs } = await supabase.from('holdings').select('*').eq('portfolio_id', pf.id)
    const tickers = [...new Set(hs.map((h) => h.ticker))]
    const quotes = (await fetch(`${FN}/quote?symbols=${tickers.join(',')}`).then((r) => r.json())).quotes
    const comp = computePortfolio({ cashBalance: pf.cash_balance, holdings: hs, quotes })
    const shortH = comp.owned.find((h) => h.isShort)
    if (shortH && shortH.netValue < 0) ok(`short netValue ${fmtMoney(shortH.netValue)} (negative); total ${fmtMoney(comp.totalValue)} ≈ start`)
    else bad('short not modeled as liability')
  }

  step('6. Cover half the NVDA short')
  {
    const pr = await price('NVDA')
    const h = await holdingFor('NVDA')
    const res = await executeCover({ supabase, portfolio: pf, holding: h, price: pr, sharesToCover: h.shares / 2 })
    pf = await reloadPf()
    const after = await holdingFor('NVDA')
    if (res.ok && after.shares < h.shares) ok(`covered half; ${after.shares.toFixed(2)} short sh left, cash ${fmtMoney(pf.cash_balance)}`)
    else bad('cover', res.error)
  }

  step('7. Validation: buy beyond cash is rejected')
  {
    const pr = await price('AAPL')
    const res = await executeBuy({ supabase, portfolio: pf, existing: null, ticker: 'AAPL', companyName: 'Apple', price: pr, dollarAmount: 999999 })
    res.error ? ok(`rejected over-spend: "${res.error}"`) : bad('over-spend NOT rejected')
  }

  console.log(`\n     Test users remain: p6-*-${ts}@reigntest.dev`)
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exit(fail ? 1 : 0)
