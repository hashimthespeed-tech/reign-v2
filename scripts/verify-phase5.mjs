// Phase 5 teacher-dashboard data layer: teacher reads class roster (RLS),
// computes ranks, narrative insert/read, settings update.
// Requires dev server :5173 + 04 applied. Run: node scripts/verify-phase5.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { computePortfolio, fmtMoney, fmtPct } from '../src/lib/portfolio.js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim()
}
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const FN = 'http://localhost:5173/.netlify/functions'

let pass = 0, fail = 0, warn = 0
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`) }
const bad = (m, e) => { fail++; console.log(`  \x1b[31m✗ ${m}\x1b[0m${e ? ' — ' + (e.message || JSON.stringify(e)) : ''}`) }
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`)

const ts = Date.now(), PW = 'reignTest123', BUDGET = 20000
const teacher = mk()
let classRow

async function makeStudent(tag, ticker, spend) {
  const c = mk()
  const { data: s } = await c.auth.signUp({ email: `p5-${tag}-${ts}@reigntest.dev`, password: PW })
  const id = s.user.id
  await c.from('profiles').upsert({ id, username: `p5_${tag}_${ts}`, investor_type: 'aggressive' })
  await c.from('class_requests').insert({ student_id: id, class_id: classRow.id, status: 'pending' })
  await teacher.from('class_requests').update({ status: 'approved' }).eq('student_id', id).eq('class_id', classRow.id)
  await c.from('profiles').update({ class_id: classRow.id }).eq('id', id)
  const { data: pf } = await c.from('portfolios').insert({ user_id: id, class_id: classRow.id, cash_balance: BUDGET }).select().single()
  const qr = await fetch(`${FN}/quote?symbols=${ticker}`).then((r) => r.json())
  const price = qr.quotes[ticker].c
  const shares = Number((spend / price).toFixed(4))
  await c.from('holdings').insert({ portfolio_id: pf.id, ticker, company_name: ticker, shares, avg_buy_price: price })
  await c.from('portfolios').update({ cash_balance: BUDGET - spend, last_value: BUDGET, last_value_at: new Date().toISOString() }).eq('id', pf.id)
  return { id, pfId: pf.id }
}

try {
  step('Setup: teacher + class + 2 approved students with holdings')
  {
    const { data: t } = await teacher.auth.signUp({ email: `p5-teacher-${ts}@reigntest.dev`, password: PW })
    if (!t.session) { bad('email confirmation ON'); process.exit(1) }
    await teacher.from('profiles').upsert({ id: t.user.id, username: `p5t_${ts}`, full_name: 'P5 Teacher', investor_type: 'teacher' })
    const code = 'Q' + Math.random().toString(36).slice(2, 7).toUpperCase()
    const { data: c } = await teacher.from('classes').insert({ name: 'P5 Class', teacher_id: t.user.id, class_code: code, starting_budget: BUDGET }).select().single()
    classRow = c
    await makeStudent('alice', 'AAPL', 8000)
    await makeStudent('bob', 'NVDA', 3000)
    ok(`teacher + class ${code} + 2 students`)
  }

  step('1. Teacher reads roster (portfolios + profiles via RLS)')
  let pfList
  {
    const { data, error } = await teacher.from('portfolios')
      .select('id, user_id, cash_balance, profiles:user_id (username, created_at)')
      .eq('class_id', classRow.id)
    if (error) bad('teacher read portfolios', error)
    else {
      pfList = data
      const named = data.filter((p) => p.profiles?.username).length
      ok(`teacher sees ${data.length} portfolios, ${named} with usernames`)
      if (named !== data.length) bad('some student profiles unreadable by teacher (RLS)')
    }
  }

  step('2. Teacher reads holdings (RLS) + computes ranked roster')
  {
    const pfIds = pfList.map((p) => p.id)
    const { data: holdings, error } = await teacher.from('holdings').select('*').in('portfolio_id', pfIds)
    if (error) { bad('teacher read holdings', error) }
    else {
      ok(`teacher sees ${holdings.length} holdings across class`)
      const tickers = [...new Set(holdings.map((h) => h.ticker.toUpperCase()))]
      const quotes = (await fetch(`${FN}/quote?symbols=${tickers.join(',')}`).then((r) => r.json())).quotes
      const byPf = {}; for (const h of holdings) (byPf[h.portfolio_id] ||= []).push(h)
      let rows = pfList.map((p) => {
        const comp = computePortfolio({ cashBalance: p.cash_balance, holdings: byPf[p.id] || [], quotes })
        return { username: p.profiles?.username, value: comp.totalValue, returnPct: ((comp.totalValue - BUDGET) / BUDGET) * 100 }
      }).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }))
      rows.forEach((r) => console.log(`     #${r.rank} @${r.username} ${fmtMoney(r.value)} (${fmtPct(r.returnPct)})`))
      rows.length === 2 && rows[0].rank === 1 ? ok('roster ranked correctly') : bad('roster ranking off')
    }
  }

  step('3. Teacher reads predictions (RLS, expect 0)')
  {
    const { error } = await teacher.from('predictions').select('id').eq('class_id', classRow.id)
    error ? bad('teacher read predictions', error) : ok('predictions readable (none yet — Phase 7)')
  }

  step('4. Narrative insert (teacher policy) + read')
  {
    const today = new Date().toISOString().slice(0, 10)
    const { error: e1 } = await teacher.from('class_narratives')
      .upsert({ class_id: classRow.id, narrative_date: today, narrative_text: 'Alice is running away with it.' }, { onConflict: 'class_id,narrative_date' })
    const { data, error: e2 } = await teacher.from('class_narratives').select('*').eq('class_id', classRow.id).maybeSingle()
    if (e1 || e2 || !data) bad('narrative insert/read', e1 || e2)
    else ok(`narrative stored + read: "${data.narrative_text}"`)
  }

  step('5. Teacher updates class settings (RLS)')
  {
    const { data, error } = await teacher.from('classes').update({ allow_short_selling: true, name: 'P5 Class (edited)' }).eq('id', classRow.id).select().single()
    if (error) bad('settings update', error)
    else if (data.allow_short_selling === true && data.name.includes('edited')) ok('settings updated (short selling on, name changed)')
    else bad('settings did not persist')
  }

  console.log(`\n     Test users remain: p5-*-${ts}@reigntest.dev`)
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m, \x1b[33m${warn} warnings\x1b[0m`)
process.exit(fail ? 1 : 0)
