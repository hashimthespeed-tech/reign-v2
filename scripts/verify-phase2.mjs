// End-to-end Phase 2 verification against the live Supabase project.
// Drives the exact queries the app makes, as the anon client, exercising RLS.
// Run: node scripts/verify-phase2.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ---- load .env ----
const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY

const mk = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let pass = 0, fail = 0, warn = 0
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`) }
const bad = (m, e) => { fail++; console.log(`  \x1b[31m✗ ${m}\x1b[0m${e ? ' — ' + (e.message || JSON.stringify(e)) : ''}`) }
const wrn = (m) => { warn++; console.log(`  \x1b[33m! ${m}\x1b[0m`) }
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`)

const ts = Date.now()
const teacherEmail = `reign-teacher-${ts}@reigntest.dev`
const studentEmail = `reign-student-${ts}@reigntest.dev`
const PW = 'reignTest123'

const teacher = mk()
const student = mk()
let classRow, teacherId, studentId, portfolioId

try {
  // ---------------- TEACHER ----------------
  step('1. Teacher: sign up')
  {
    const { data, error } = await teacher.auth.signUp({ email: teacherEmail, password: PW })
    if (error) throw bad('teacher signUp', error) || new Error('abort')
    if (!data.session) {
      bad('teacher signUp returned NO session')
      console.log('\n\x1b[33mEmail confirmation is still ON. Disable it: Supabase → Authentication → Sign In/Providers → Email → turn off "Confirm email".\x1b[0m')
      process.exit(1)
    }
    teacherId = data.user.id
    ok(`teacher account + session (${teacherId.slice(0, 8)}…)`)
  }

  step('2. Teacher: create profile')
  {
    const { error } = await teacher.from('profiles').upsert({
      id: teacherId, username: `MrAvery_${ts}`, full_name: 'Jordan Avery',
      investor_type: 'teacher', school_name: 'Lincoln High',
    })
    error ? bad('insert teacher profile', error) : ok('teacher profile inserted (RLS: own row)')
  }

  step('3. Teacher: create class')
  {
    const code = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data, error } = await teacher.from('classes').insert({
      name: 'Period 3 — Economics', teacher_id: teacherId, class_code: code,
      starting_budget: 25000, account_type: 'standard', tax_enabled: false,
      require_predictions: true, show_leaderboard: true, allow_short_selling: false,
      thesis_required: false, show_real_money: true, school_name: 'Lincoln High',
    }).select().single()
    if (error) { bad('insert class (this was Bug 1)', error) }
    else { classRow = data; ok(`class created, code = ${data.class_code}, budget $${data.starting_budget}`) }
  }

  // ---------------- STUDENT ----------------
  step('4. Student: sign up')
  {
    const { data, error } = await student.auth.signUp({ email: studentEmail, password: PW })
    if (error || !data.session) throw bad('student signUp', error) || new Error('abort')
    studentId = data.user.id
    ok(`student account + session (${studentId.slice(0, 8)}…)`)
  }

  step('5. Student: look up class by code (ilike)')
  {
    const { data, error } = await student.from('classes')
      .select('*').ilike('class_code', classRow.class_code).maybeSingle()
    if (error || !data) bad('class code lookup', error)
    else ok(`found "${data.name}" via code (RLS: classes readable by authenticated)`)
  }

  step('6. Student: check username availability (RPC)')
  {
    const { data, error } = await student.rpc('username_available', { check_username: `market_king_${ts}` })
    if (error) bad('username_available rpc', error)
    else ok(`username_available returned ${data}`)
  }

  step('7. Student: create profile')
  {
    const { error } = await student.from('profiles').upsert({
      id: studentId, username: `market_king_${ts}`, investor_type: 'aggressive',
    })
    error ? bad('insert student profile', error) : ok('student profile inserted')
  }

  step('8. Student: submit join request (FK now satisfied — profile exists)')
  {
    const { error } = await student.from('class_requests').insert({
      student_id: studentId, class_id: classRow.id, status: 'pending',
    })
    error ? bad('insert class_request', error) : ok('class_request inserted (pending)')
  }

  // ---------------- APPROVAL (RLS) ----------------
  step('9. Teacher: read pending requests + requester name (tests fix 03)')
  {
    const { data, error } = await teacher.from('class_requests')
      .select('id, status, student_id, profiles:student_id (username, full_name)')
      .eq('class_id', classRow.id).eq('status', 'pending')
    if (error) bad('teacher read requests', error)
    else if (!data.length) bad('teacher sees 0 pending requests (RLS requests_select_teacher?)')
    else {
      ok(`teacher sees ${data.length} pending request(s)`)
      const name = data[0].profiles?.username
      if (name) ok(`requester name visible: @${name} (fix 03 applied)`)
      else wrn('requester profile is NULL — run supabase/03_teacher_read_requesters.sql')
    }
  }

  step('10. Teacher: approve the request')
  {
    const { data, error } = await teacher.from('class_requests')
      .update({ status: 'approved' }).eq('student_id', studentId).eq('class_id', classRow.id).select()
    if (error || !data?.length) bad('approve request', error)
    else ok('request status → approved')
  }

  // ---------------- STUDENT FINALIZE ----------------
  step('11. Student: finalize membership (class_id + portfolio + holdings)')
  {
    const { error: e1 } = await student.from('profiles').update({ class_id: classRow.id }).eq('id', studentId)
    e1 ? bad('set profile.class_id', e1) : ok('profile.class_id set')

    const { data: pf, error: e2 } = await student.from('portfolios').insert({
      user_id: studentId, class_id: classRow.id, cash_balance: classRow.starting_budget,
    }).select().single()
    if (e2) bad('create portfolio', e2)
    else { portfolioId = pf.id; ok(`portfolio created, cash $${pf.cash_balance}`) }

    if (portfolioId) {
      const tickers = ['AAPL', 'NVDA', 'TSLA']
      const { error: e3 } = await student.from('holdings').insert(
        tickers.map((t) => ({ portfolio_id: portfolioId, ticker: t, company_name: t, shares: 0, avg_buy_price: 0 }))
      )
      e3 ? bad('create watchlist holdings', e3) : ok(`${tickers.length} watchlist holdings created`)
    }
  }

  step('12. Student: read own portfolio + verify budget')
  {
    const { data } = await student.from('portfolios').select('*').eq('user_id', studentId).maybeSingle()
    if (data && Number(data.cash_balance) === Number(classRow.starting_budget)) ok('own portfolio reads back with correct budget')
    else bad('own portfolio mismatch')
  }

  // ---------------- TEACHER VISIBILITY (RLS) ----------------
  step('13. Teacher: read approved student portfolio + holdings (RLS teacher select)')
  {
    const { data: pf, error: e1 } = await teacher.from('portfolios').select('*').eq('class_id', classRow.id)
    if (e1) bad('teacher read portfolios', e1)
    else if (pf.length) ok(`teacher sees ${pf.length} student portfolio(s)`)
    else bad('teacher sees 0 portfolios (RLS portfolios_select_teacher?)')

    const { data: h } = await teacher.from('holdings').select('*').eq('portfolio_id', portfolioId)
    if (h && h.length) ok(`teacher sees ${h.length} holdings of student`)
    else bad('teacher cannot see student holdings (RLS holdings_select_teacher?)')
  }

  step('14. Returning-login routing simulation')
  {
    const { data: prof } = await student.from('profiles').select('class_id, username').eq('id', studentId).maybeSingle()
    const { data: req } = await student.from('class_requests').select('status').eq('student_id', studentId).maybeSingle()
    if (prof?.class_id && req?.status === 'approved') ok('student would route → /dashboard (class_id set + approved)')
    else bad('routing state incomplete')

    const { data: tClasses } = await teacher.from('classes').select('id').eq('teacher_id', teacherId)
    tClasses?.length ? ok('teacher would route → /teacher (owns class)') : bad('teacher class query empty')
  }

  // ---------------- best-effort cleanup ----------------
  step('15. Cleanup (best effort under RLS)')
  {
    await student.from('holdings').delete().eq('portfolio_id', portfolioId)
    await student.from('portfolios').delete().eq('user_id', studentId)
    ok('removed test holdings + portfolio')
    wrn(`Test auth users remain (anon key cannot delete them). Purge in dashboard if desired:`)
    console.log(`     ${teacherEmail}\n     ${studentEmail}`)
    wrn('Test class + profiles + request remain (no DELETE policy by design).')
  }
} catch (e) {
  if (e.message !== 'abort') console.error('Unexpected:', e)
}

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m, \x1b[33m${warn} warnings\x1b[0m`)
process.exit(fail ? 1 : 0)
