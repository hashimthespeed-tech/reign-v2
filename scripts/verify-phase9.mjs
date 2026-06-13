// Phase 9 leaderboard + weekly class narrative.
// Requires dev server :5173 (started with service_role in env). Run: node scripts/verify-phase9.mjs
// Depends on supabase/06_leaderboard.sql being applied (class_leaderboard RPC).
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
const teacher = mk(), sA = mk(), sB = mk()
let classId, idA, idB

const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }

try {
  step('Setup: class of 2 students with different values')
  {
    const { data: t } = await teacher.auth.signUp({ email: `p9-t-${ts}@reigntest.dev`, password: PW })
    if (!t.session) { bad('email confirmation ON'); process.exit(1) }
    await teacher.from('profiles').upsert({ id: t.user.id, username: `p9t_${ts}`, investor_type: 'teacher' })
    const code = 'L' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: c } = await teacher.from('classes').insert({ name: `P9 ${ts}`, teacher_id: t.user.id, class_code: code, starting_budget: BUDGET, show_leaderboard: true }).select().single()
    classId = c.id

    for (const [client, label, value] of [[sA, 'ava', 24000], [sB, 'ben', 19000]]) {
      const { data: s } = await client.auth.signUp({ email: `p9-${label}-${ts}@reigntest.dev`, password: PW })
      const uid = s.user.id
      if (label === 'ava') idA = uid; else idB = uid
      await client.from('profiles').upsert({ id: uid, username: `${label}_${ts}`, investor_type: 'aggressive' })
      await client.from('class_requests').insert({ student_id: uid, class_id: classId, status: 'pending' })
      await teacher.from('class_requests').update({ status: 'approved' }).eq('student_id', uid)
      await client.from('profiles').update({ class_id: classId }).eq('id', uid)
      await client.from('portfolios').insert({ user_id: uid, class_id: classId, cash_balance: BUDGET })
      await client.from('portfolios').update({ last_value: value, last_value_at: new Date().toISOString() }).eq('user_id', uid)
    }
    ok('2 approved students (ava 24000 > ben 19000)')
  }

  step('1. class_leaderboard() RPC — ranked, privacy-safe')
  {
    const { data: rows, error } = await sA.rpc('class_leaderboard')
    if (error) { bad('RPC failed (06_leaderboard.sql applied?)', error) }
    else if (!Array.isArray(rows)) { bad('RPC returned no array') }
    else {
      rows.length === 2 ? ok(`returns ${rows.length} class members`) : bad(`expected 2 rows, got ${rows.length}`)
      const top = rows[0]
      top && Number(top.value) >= Number(rows[1]?.value) ? ok('sorted by value desc') : bad('not sorted by value desc')
      String(top?.user_id) === String(idA) ? ok('ava ranks #1') : bad('ava is not #1')
      const keys = Object.keys(rows[0] || {})
      const leaks = keys.filter((k) => /ticker|shares|holding|cash|avg_buy/i.test(k))
      leaks.length === 0 ? ok(`no holdings leaked (keys: ${keys.join(', ')})`) : bad(`leaked keys: ${leaks.join(', ')}`)
    }
  }

  step('2. Week-ago baseline flows through the RPC')
  {
    const { error: insErr } = await sA.from('daily_reports').insert({
      user_id: idA, class_id: classId, report_date: daysAgo(8), portfolio_value_at_close: 21000,
    })
    if (insErr) { bad('could not seed week-ago daily_report', insErr) }
    else {
      const { data: rows, error } = await sA.rpc('class_leaderboard')
      const ava = (rows || []).find((r) => String(r.user_id) === String(idA))
      if (error || !ava) bad('RPC unavailable — skipped week-ago check', error || {})
      else Number(ava.week_ago_value) === 21000 ? ok('week_ago_value = 21000 (from daily_reports)') : bad(`week_ago_value was ${ava.week_ago_value}`)
    }
  }

  step('3. Generate weekly class narrative (force) via service-role function')
  {
    const res = await fetch(`${FN}/generate-narrative`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId, force: true }) }).then((r) => r.json())
    if (res.ok && res.narrative) {
      const txt = res.narrative.narrative_text || ''
      if (txt.length > 20) ok(`narrative stored (${txt.length} chars)`); else bad('narrative too short')
      if (/ava_|ben_/.test(txt)) ok('narrative references a class member by username')
      else console.log('   \x1b[2m(note: AI did not name a username this run)\x1b[0m')
      console.log('\n   \x1b[2m── CLASS NARRATIVE ──\x1b[0m\n   ' + txt + '\n')
    } else bad('generate-narrative', res)
  }

  step('4. Idempotent: second call (no force) skips this week')
  {
    const res = await fetch(`${FN}/generate-narrative`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId }) }).then((r) => r.json())
    res.skipped === 'already generated this week' ? ok('second call skipped (already generated this week)') : bad(`expected weekly skip, got ${JSON.stringify(res)}`)
  }

  step('5. Student can read the narrative; one row this week')
  {
    const { data: narrs } = await sB.from('class_narratives').select('id, narrative_text').eq('class_id', classId)
    narrs?.length === 1 ? ok('exactly one narrative this week, readable by a classmate') : bad(`expected 1 narrative, got ${narrs?.length}`)
  }

  step('6. Hidden leaderboard: narrative generation is skipped')
  {
    await teacher.from('classes').update({ show_leaderboard: false }).eq('id', classId)
    const res = await fetch(`${FN}/generate-narrative`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId, force: true }) }).then((r) => r.json())
    res.skipped === 'leaderboard hidden' ? ok('generation refused when leaderboard hidden') : bad(`expected hidden skip, got ${JSON.stringify(res)}`)
    await teacher.from('classes').update({ show_leaderboard: true }).eq('id', classId)
  }

  console.log(`\n     Test users remain: p9-*-${ts}@reigntest.dev`)
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exit(fail ? 1 : 0)
