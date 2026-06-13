// Phase 7 predictions: lock-in, immutability (RLS), and server-side resolution
// against real past-date open/close. Requires dev server :5173 (restarted with
// SUPABASE_SERVICE_ROLE). Run: node scripts/verify-phase7.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { computeStreak, computeAccuracy } from '../src/lib/predictions.js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim()
}
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const FN = 'http://localhost:5173/.netlify/functions'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`) }
const bad = (m, e) => { fail++; console.log(`  \x1b[31m✗ ${m}\x1b[0m${e ? ' — ' + (e.message || JSON.stringify(e)) : ''}`) }
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`)
const ts = Date.now(), PW = 'reignTest123'
const teacher = mk(), student = mk()
let classId, studentId

// real OHLC for expected-result computation
async function ohlc(symbol) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`, { headers: { 'User-Agent': UA } }).then((x) => x.json())
  const res = r.chart.result[0], t = res.timestamp, o = res.indicators.quote[0].open, c = res.indicators.quote[0].close
  const map = {}
  for (let i = 0; i < t.length; i++) if (o[i] != null && c[i] != null) map[new Date(t[i] * 1000).toISOString().slice(0, 10)] = { open: o[i], close: c[i] }
  return map
}
const expected = (day, dir) => {
  const move = (day.close - day.open) / day.open
  if (Math.abs(move) < 0.001) return 'incorrect'
  return (day.close > day.open ? 'up' : 'down') === dir ? 'correct' : 'incorrect'
}

try {
  step('Setup: approved student')
  {
    const { data: t } = await teacher.auth.signUp({ email: `p7-t-${ts}@reigntest.dev`, password: PW })
    if (!t.session) { bad('email confirmation ON'); process.exit(1) }
    await teacher.from('profiles').upsert({ id: t.user.id, username: `p7t_${ts}`, investor_type: 'teacher' })
    const code = 'S' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: c } = await teacher.from('classes').insert({ name: 'P7', teacher_id: t.user.id, class_code: code, starting_budget: 20000 }).select().single()
    classId = c.id
    const { data: s } = await student.auth.signUp({ email: `p7-s-${ts}@reigntest.dev`, password: PW })
    studentId = s.user.id
    await student.from('profiles').upsert({ id: studentId, username: `p7s_${ts}`, investor_type: 'aggressive' })
    await student.from('class_requests').insert({ student_id: studentId, class_id: classId, status: 'pending' })
    await teacher.from('class_requests').update({ status: 'approved' }).eq('student_id', studentId)
    await student.from('profiles').update({ class_id: classId }).eq('id', studentId)
    ok('student ready')
  }

  // find two recent past trading dates present in AAPL data
  const aapl = await ohlc('AAPL')
  const dates = Object.keys(aapl).sort().slice(-6, -1) // a few recent completed days
  const d1 = dates[dates.length - 1], d2 = dates[dates.length - 2]

  step('1. Lock-in: insert predictions for two past dates')
  {
    const { error: e1 } = await student.from('predictions').insert({ user_id: studentId, class_id: classId, ticker: 'AAPL', direction: 'up', prediction_date: d1 })
    const { error: e2 } = await student.from('predictions').insert({ user_id: studentId, class_id: classId, ticker: 'AAPL', direction: 'down', prediction_date: d2 })
    e1 || e2 ? bad('insert predictions', e1 || e2) : ok(`locked in AAPL up@${d1}, down@${d2}`)
  }

  step('2. Duplicate prediction for same date is rejected (unique)')
  {
    const { error } = await student.from('predictions').insert({ user_id: studentId, class_id: classId, ticker: 'AAPL', direction: 'up', prediction_date: d1 })
    error ? ok(`duplicate rejected: ${error.code}`) : bad('duplicate NOT rejected')
  }

  step('3. Resolution via service-role function')
  {
    const res = await fetch(`${FN}/resolve-predictions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: studentId }) }).then((r) => r.json())
    if (res.resolved >= 2) ok(`function resolved ${res.resolved} predictions`)
    else bad(`expected >=2 resolved, got ${JSON.stringify(res)}`)

    const { data: preds } = await student.from('predictions').select('*').eq('user_id', studentId).order('prediction_date')
    for (const p of preds) {
      const exp = expected(aapl[p.prediction_date], p.direction)
      if (p.result === exp && p.opening_price && p.closing_price) ok(`${p.prediction_date} ${p.direction}: ${p.result} (o ${p.opening_price} → c ${p.closing_price}) matches Yahoo`)
      else bad(`${p.prediction_date} result ${p.result} != expected ${exp}`)
    }
  }

  step('4. Immutability: student cannot rewrite a result (RLS)')
  {
    const { data: before } = await student.from('predictions').select('*').eq('user_id', studentId).eq('prediction_date', d1).single()
    await student.from('predictions').update({ result: 'correct', closing_price: 99999 }).eq('id', before.id)
    const { data: after } = await student.from('predictions').select('*').eq('id', before.id).single()
    if (after.result === before.result && Number(after.closing_price) === Number(before.closing_price)) ok('student cheat update had no effect (immutable)')
    else bad('prediction was mutated by student!')
  }

  step('5. Accuracy + streak helpers')
  {
    const { data: preds } = await student.from('predictions').select('*').eq('user_id', studentId)
    const a = computeAccuracy(preds), s = computeStreak(preds)
    ok(`accuracy ${a.correct}/${a.total} (${a.pct?.toFixed(0)}%), streak ${s}`)
  }

  console.log(`\n     Test users remain: p7-*-${ts}@reigntest.dev`)
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exit(fail ? 1 : 0)
