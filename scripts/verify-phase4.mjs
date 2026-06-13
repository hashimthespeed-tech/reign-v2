// Phase 4 data-layer verification: rank pipeline + dashboard helpers
// against the live dev server (functions) and Supabase.
// Requires: dev server on :5173, and supabase/04_standings.sql applied.
// Run: node scripts/verify-phase4.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { computePortfolio, fmtMoney } from '../src/lib/portfolio.js'
import { reconstructHistory, detectHeroVillain } from '../src/lib/dashboard.js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim()
}
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const FN = 'http://localhost:5173/.netlify/functions'

let pass = 0, fail = 0, warn = 0
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`) }
const bad = (m, e) => { fail++; console.log(`  \x1b[31m✗ ${m}\x1b[0m${e ? ' — ' + (e.message || JSON.stringify(e)) : ''}`) }
const wrn = (m) => { warn++; console.log(`  \x1b[33m! ${m}\x1b[0m`) }
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`)

const ts = Date.now()
const PW = 'reignTest123'
const teacher = mk(), student = mk()
let classRow, studentId, portfolioId

try {
  step('Setup: teacher + class + approved student')
  {
    const { data: t } = await teacher.auth.signUp({ email: `p4-teacher-${ts}@reigntest.dev`, password: PW })
    if (!t.session) { bad('email confirmation still ON'); process.exit(1) }
    await teacher.from('profiles').upsert({ id: t.user.id, username: `p4t_${ts}`, full_name: 'P4 Teacher', investor_type: 'teacher' })
    const code = 'P' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: c } = await teacher.from('classes').insert({
      name: 'P4 Test Class', teacher_id: t.user.id, class_code: code, starting_budget: 20000,
    }).select().single()
    classRow = c

    const { data: s } = await student.auth.signUp({ email: `p4-student-${ts}@reigntest.dev`, password: PW })
    studentId = s.user.id
    await student.from('profiles').upsert({ id: studentId, username: `p4s_${ts}`, investor_type: 'aggressive' })
    await student.from('class_requests').insert({ student_id: studentId, class_id: classRow.id, status: 'pending' })
    await teacher.from('class_requests').update({ status: 'approved' }).eq('student_id', studentId).eq('class_id', classRow.id)
    await student.from('profiles').update({ class_id: classRow.id }).eq('id', studentId)
    const { data: pf } = await student.from('portfolios').insert({ user_id: studentId, class_id: classRow.id, cash_balance: 20000 }).select().single()
    portfolioId = pf.id
    ok(`approved student with $20,000 portfolio (class ${code})`)
  }

  step('1. Simulate a BUY of AAPL using a live quote')
  let quotes = {}
  {
    const qr = await fetch(`${FN}/quote?symbols=AAPL`).then((r) => r.json())
    quotes = qr.quotes
    const price = quotes.AAPL?.c
    if (!price) { bad('no live AAPL quote'); throw new Error('abort') }
    const spend = 5000, shares = Number((spend / price).toFixed(4))
    const { error: e1 } = await student.from('holdings').insert({
      portfolio_id: portfolioId, ticker: 'AAPL', company_name: 'Apple', shares, avg_buy_price: price,
    })
    const { error: e2 } = await student.from('portfolios').update({ cash_balance: 20000 - spend }).eq('id', portfolioId)
    const { error: e3 } = await student.from('trades').insert({
      portfolio_id: portfolioId, user_id: studentId, ticker: 'AAPL', company_name: 'Apple',
      trade_type: 'buy', shares, price_at_trade: price, total_value: spend, trade_date: new Date().toISOString().slice(0, 10),
    })
    if (e1 || e2 || e3) bad('buy writes', e1 || e2 || e3)
    else ok(`bought ${shares} AAPL @ ${fmtMoney(price)} ($5,000); cash now $15,000; trade recorded`)
  }

  step('2. computePortfolio + write last_value')
  let computed
  {
    const { data: hs } = await student.from('holdings').select('*').eq('portfolio_id', portfolioId)
    computed = computePortfolio({ cashBalance: 15000, holdings: hs, quotes })
    ok(`total value ${fmtMoney(computed.totalValue)} (cash 15k + AAPL ${fmtMoney(computed.investedValue)})`)
    const { error } = await student.from('portfolios').update({ last_value: computed.totalValue, last_value_at: new Date().toISOString() }).eq('id', portfolioId)
    error ? bad('write last_value (run 04_standings.sql?)', error) : ok('last_value persisted')
  }

  step('3. class_standings RPC → rank')
  {
    const { data, error } = await student.rpc('class_standings')
    if (error) { bad('class_standings RPC failed — run supabase/04_standings.sql', error) }
    else {
      const mine = data.findIndex((r) => r.user_id === studentId) + 1
      if (mine > 0) ok(`standings returned ${data.length} member(s); my rank #${mine} of ${data.length}, value ${fmtMoney(data[mine - 1].value)}`)
      else bad('student not found in own standings')
      const leaksHoldings = data[0] && ('shares' in data[0] || 'ticker' in data[0])
      leaksHoldings ? bad('standings leaks holdings!') : ok('standings exposes username + value only (no holdings leaked)')
    }
  }

  step('4. Dashboard helpers on real history')
  {
    const hist = await fetch(`${FN}/history?symbol=AAPL&range=1mo`).then((r) => r.json())
    const histories = { AAPL: hist.points }
    const series = reconstructHistory(computed.owned, histories, computed.cash)
    series.length > 1 ? ok(`reconstructHistory → ${series.length} points (e.g. ${series[0].date}=${fmtMoney(series[0].value)} … ${series.at(-1).date}=${fmtMoney(series.at(-1).value)})`) : bad('reconstructHistory empty')
    const { hero, villain } = detectHeroVillain(computed.owned, histories, quotes)
    ok(`detectHeroVillain ran (hero=${hero ? hero.ticker : 'none'}, villain=${villain ? villain.ticker : 'none'}) — only fires on >2σ moves, so 'none' is normal`)
  }

  step('5. Cleanup (best effort)')
  {
    await student.from('trades').delete().eq('portfolio_id', portfolioId)
    await student.from('holdings').delete().eq('portfolio_id', portfolioId)
    await student.from('portfolios').delete().eq('id', portfolioId)
    ok('removed test trades/holdings/portfolio')
    wrn(`Test auth users remain: p4-teacher-${ts}@reigntest.dev, p4-student-${ts}@reigntest.dev`)
  }
} catch (e) {
  if (e.message !== 'abort') console.error('Unexpected:', e)
}

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m, \x1b[33m${warn} warnings\x1b[0m`)
process.exit(fail ? 1 : 0)
