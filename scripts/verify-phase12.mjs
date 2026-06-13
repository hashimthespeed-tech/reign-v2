// Phase 12 Monthly Behavioral Report — server-side pipeline + behavior detectors.
// Requires dev server :5173 (started with service_role). Run: node scripts/verify-phase12.mjs
// No Supabase schema change (monthly_reports already exists).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { detectImpatience, detectPanicSells, worstTrades } from '../src/lib/behavior.js'

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
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }
const isoTs = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString() }

const genMonthly = (body) => fetch(`${FN}/generate-monthly`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json())

try {
  step('1. behavior.js detectors (pure)')
  {
    const trades = [
      { ticker: 'AAPL', trade_type: 'buy', price_at_trade: 200, trade_date: daysAgo(10) },
      { ticker: 'AAPL', trade_type: 'sell', price_at_trade: 180, trade_date: daysAgo(6) },
    ]
    const imp = detectImpatience(trades)
    imp.length === 1 && imp[0].daysHeld === 4 && imp[0].lossPct < 0 ? ok(`impatience detected (held ${imp[0].daysHeld}d, ${imp[0].lossPct}%)`) : bad('impatience not detected', imp)

    const hist = { TSLA: [{ date: daysAgo(3), close: 100 }, { date: daysAgo(2), close: 95 }] } // -5% day
    const panic = detectPanicSells([{ ticker: 'TSLA', trade_type: 'sell', price_at_trade: 95, trade_date: daysAgo(2) }], hist)
    panic.length === 1 && panic[0].dropPct <= -3 ? ok(`panic-sell detected (${panic[0].dropPct}%)`) : bad('panic-sell not detected', panic)

    const wh = { MSFT: [{ date: daysAgo(20), close: 100 }, { date: daysAgo(1), close: 80 }] }
    const worst = worstTrades([{ ticker: 'MSFT', trade_type: 'buy', price_at_trade: 100, trade_date: daysAgo(20) }], wh)
    worst.length === 1 && worst[0].regretPct > 0 ? ok(`worst-trade ranked (aged ${worst[0].regretPct}% against)`) : bad('worst-trade not ranked', worst)
  }

  step('Setup: 35-day student with a losing flip, a hold, predictions, and start/end values')
  let studentId, pf
  {
    const teacher = mk(), student = mk()
    const { data: t } = await teacher.auth.signUp({ email: `p12-t-${ts}@reigntest.dev`, password: PW })
    if (!t.session) { bad('email confirmation ON'); throw new Error('stop') }
    await teacher.from('profiles').upsert({ id: t.user.id, username: `p12t_${ts}`, investor_type: 'teacher' })
    const code = 'M' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: c } = await teacher.from('classes').insert({ name: `P12 ${ts}`, teacher_id: t.user.id, class_code: code, starting_budget: BUDGET }).select().single()
    const { data: s } = await student.auth.signUp({ email: `p12-s-${ts}@reigntest.dev`, password: PW })
    studentId = s.user.id
    await student.from('profiles').upsert({ id: studentId, username: `theo_${ts}`, investor_type: 'aggressive' })
    await student.from('class_requests').insert({ student_id: studentId, class_id: c.id, status: 'pending' })
    await teacher.from('class_requests').update({ status: 'approved' }).eq('student_id', studentId)
    await student.from('profiles').update({ class_id: c.id }).eq('id', studentId)
    const { data: p } = await student.from('portfolios').insert({ user_id: studentId, class_id: c.id, cash_balance: BUDGET, created_at: isoTs(35) }).select().single()
    pf = p
    const trades = [
      { ticker: 'AAPL', company_name: 'Apple', trade_type: 'buy', shares: 5, price_at_trade: 210, total_value: 1050, trade_date: daysAgo(12) },
      { ticker: 'AAPL', company_name: 'Apple', trade_type: 'sell', shares: 5, price_at_trade: 188, total_value: 940, trade_date: daysAgo(8) },
      { ticker: 'NVDA', company_name: 'NVIDIA', trade_type: 'buy', shares: 8, price_at_trade: 120, total_value: 960, trade_date: daysAgo(22) },
    ]
    for (const tr of trades) await student.from('trades').insert({ ...tr, portfolio_id: pf.id, user_id: studentId })
    await student.from('daily_reports').insert({ user_id: studentId, class_id: c.id, report_date: daysAgo(30), portfolio_value_at_close: 20000 })
    await student.from('daily_reports').insert({ user_id: studentId, class_id: c.id, report_date: daysAgo(1), portfolio_value_at_close: 19250 })
    await student.from('predictions').insert({ user_id: studentId, class_id: c.id, ticker: 'AAPL', direction: 'up', prediction_date: daysAgo(9), result: 'correct' })
    await student.from('predictions').insert({ user_id: studentId, class_id: c.id, ticker: 'NVDA', direction: 'down', prediction_date: daysAgo(5), result: 'incorrect' })
    ok('seeded student, trades, daily_reports, predictions')
  }

  step('2. Generate monthly report (force) — stores all sections')
  {
    const res = await genMonthly({ userId: studentId, force: true })
    if (!res.ok) { bad('generate-monthly', res) }
    else {
      const r = res.report
      r.report_text?.length > 10 ? ok(`opening stored (${r.report_text.length} chars)`) : bad('opening missing')
      const patterns = r.behavioral_patterns?.patterns || []
      patterns.length >= 3 && patterns.every((p) => p.title && p.evidence) ? ok(`${patterns.length} pattern cards with evidence`) : bad(`expected >=3 patterns, got ${patterns.length}`)
      Array.isArray(r.what_if_scenarios?.scenarios) ? ok(`what-if scenarios present (${r.what_if_scenarios.scenarios.length})`) : bad('what_if missing')
      r.behavioral_patterns?.one_fix ? ok('one-thing-to-fix present') : bad('one_fix missing')
      Math.round(r.prediction_accuracy) === 50 ? ok('prediction_accuracy = 50%') : bad(`prediction_accuracy was ${r.prediction_accuracy}`)
      Number(r.portfolio_start_value) === 20000 && Number(r.portfolio_end_value) === 19250 ? ok('start/end values from daily_reports (20000 → 19250)') : bad(`values ${r.portfolio_start_value} / ${r.portfolio_end_value}`)
      console.log('\n   \x1b[2m── REPORT ──\x1b[0m')
      console.log('   ' + r.report_text)
      patterns.forEach((p) => console.log(`   • \x1b[1m${p.title}\x1b[0m — ${p.evidence}`))
      console.log('   \x1b[2mFix:\x1b[0m ' + r.behavioral_patterns.one_fix + '\n')
    }
  }

  step('3. Idempotent: second call (no force) skips')
  {
    const res = await genMonthly({ userId: studentId })
    res.skipped === 'already generated' ? ok('second call skipped (already generated)') : bad(`expected skip, got ${JSON.stringify(res)}`)
  }

  step('4. Gate: a student under 30 days is skipped')
  {
    const young = mk()
    const { data: s } = await young.auth.signUp({ email: `p12-y-${ts}@reigntest.dev`, password: PW })
    await young.from('profiles').upsert({ id: s.user.id, username: `young_${ts}`, investor_type: 'aggressive' })
    await young.from('portfolios').insert({ user_id: s.user.id, cash_balance: BUDGET, created_at: isoTs(5) })
    const res = await genMonthly({ userId: s.user.id })
    res.skipped === 'student under 30 days' ? ok('under-30-day student skipped') : bad(`expected under-30 skip, got ${JSON.stringify(res)}`)
  }

  console.log(`\n     Test users remain: p12-*-${ts}@reigntest.dev`)
} catch (e) { if (e.message !== 'stop') console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exitCode = fail ? 1 : 0
