// Phase 8 daily report: server-side AI generation, storage, idempotency.
// Requires dev server :5173 (restarted with service_role). Run: node scripts/verify-phase8.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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
const teacher = mk(), student = mk()
let studentId, pf

const price = async (tk) => (await fetch(`${FN}/quote?symbols=${tk}`).then((r) => r.json())).quotes[tk].c

try {
  step('Setup: approved student holding 2 stocks')
  {
    const { data: t } = await teacher.auth.signUp({ email: `p8-t-${ts}@reigntest.dev`, password: PW })
    if (!t.session) { bad('email confirmation ON'); process.exit(1) }
    await teacher.from('profiles').upsert({ id: t.user.id, username: `p8t_${ts}`, investor_type: 'teacher' })
    const code = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: c } = await teacher.from('classes').insert({ name: 'P8', teacher_id: t.user.id, class_code: code, starting_budget: BUDGET }).select().single()
    const { data: s } = await student.auth.signUp({ email: `p8-s-${ts}@reigntest.dev`, password: PW })
    studentId = s.user.id
    await student.from('profiles').upsert({ id: studentId, username: `marcus_${ts}`, investor_type: 'aggressive' })
    await student.from('class_requests').insert({ student_id: studentId, class_id: c.id, status: 'pending' })
    await teacher.from('class_requests').update({ status: 'approved' }).eq('student_id', studentId)
    await student.from('profiles').update({ class_id: c.id }).eq('id', studentId)
    const { data: p } = await student.from('portfolios').insert({ user_id: studentId, class_id: c.id, cash_balance: BUDGET }).select().single()
    pf = p
    for (const [tk, name, spend] of [['AAPL', 'Apple', 8000], ['NVDA', 'NVIDIA', 6000]]) {
      const pr = await price(tk)
      await student.from('holdings').insert({ portfolio_id: pf.id, ticker: tk, company_name: name, shares: spend / pr, avg_buy_price: pr })
    }
    await student.from('portfolios').update({ cash_balance: BUDGET - 14000, last_value: BUDGET, last_value_at: new Date().toISOString() }).eq('id', pf.id)
    ok('student holds AAPL + NVDA')
  }

  step('1. Generate report (force) via service-role function')
  {
    const res = await fetch(`${FN}/generate-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: studentId, force: true }) }).then((r) => r.json())
    if (res.ok) ok('report generated')
    else bad('generate-report', res)
  }

  step('2. Report row stored with all fields')
  {
    const { data: rep } = await student.from('daily_reports').select('*').eq('user_id', studentId).maybeSingle()
    if (!rep) { bad('no report row'); }
    else {
      rep.report_text?.length > 20 ? ok(`summary stored (${rep.report_text.length} chars)`) : bad('summary too short')
      rep.unresolved_story ? ok('unresolved story present') : bad('no unresolved story')
      rep.concept_name && rep.concept_definition ? ok(`concept: ${rep.concept_name}`) : bad('no concept')
      rep.portfolio_value_at_close > 0 ? ok(`value at close ${rep.portfolio_value_at_close.toFixed(2)}`) : bad('no value')
      console.log('\n   \x1b[2m── AI SUMMARY ──\x1b[0m')
      console.log('   ' + rep.report_text)
      console.log('   \x1b[2mUnresolved:\x1b[0m ' + rep.unresolved_story)
      console.log(`   \x1b[2mConcept:\x1b[0m ${rep.concept_name} — ${rep.concept_definition}\n`)
    }
  }

  step('3. Idempotent: second call (no force) skips')
  {
    const res = await fetch(`${FN}/generate-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: studentId }) }).then((r) => r.json())
    res.skipped === 'already generated' ? ok('second call skipped (already generated)') : bad(`expected skip, got ${JSON.stringify(res)}`)
  }

  step('4. Student can read own report; unique constraint holds')
  {
    const { data: reps } = await student.from('daily_reports').select('id').eq('user_id', studentId)
    reps?.length === 1 ? ok('exactly one report for today (unique user+date)') : bad(`expected 1 report, got ${reps?.length}`)
  }

  console.log(`\n     Test users remain: p8-*-${ts}@reigntest.dev`)
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exit(fail ? 1 : 0)
