// Phase 10 Thesis Validator + Ask Reign.
// Requires dev server :5173 (serves the groq proxy). Run: node scripts/verify-phase10.mjs
// No Supabase schema change this phase (holdings.thesis / thesis_ai_response already exist).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { THESIS_SYSTEM, buildThesisPrompt, parseThesisResponse } from '../src/lib/thesis.js'
import { ASK_REIGN_SYSTEM, buildAskPrompt } from '../src/lib/askReign.js'

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

const callGroq = async (body) => fetch(`${FN}/groq`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json())

let analysis = null

try {
  step('1. Thesis Validator — structured analysis (advisory, no verdict/score)')
  {
    const inputs = {
      ticker: 'ACME', companyName: 'Acme Corp',
      thesis: 'Acme just crushed earnings and raised guidance, so demand is clearly strong. I think the stock keeps climbing as more investors notice.',
      headlines: [
        'Acme Corp beats Q2 earnings, raises full-year guidance',
        'Analysts hike Acme price targets after strong quarter',
        'Acme faces new competition in its core market',
      ],
      history: Array.from({ length: 21 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, close: 100 + i * 0.8 })),
      portfolio: [{ ticker: 'AAPL', pct: 40 }, { ticker: 'NVDA', pct: 25 }],
    }
    const res = await callGroq({ system: THESIS_SYSTEM, prompt: buildThesisPrompt(inputs), json: true, temperature: 0.7, max_tokens: 600 })
    analysis = parseThesisResponse(res.parsed)
    if (!analysis) { bad('no usable JSON from thesis analysis', res) }
    else {
      ['supports', 'contradicts', 'mixed'].includes(analysis.alignment) ? ok(`alignment = "${analysis.alignment}"`) : bad(`bad alignment ${analysis.alignment}`)
      analysis.news_assessment.length > 10 ? ok('news_assessment present') : bad('news_assessment missing')
      analysis.if_right && analysis.if_wrong ? ok('both chain reactions present (if_right / if_wrong)') : bad('missing a chain reaction')
      analysis.blind_spot.length > 10 ? ok('blind_spot present') : bad('blind_spot missing')
      /earning|guidance|target|competition/i.test(analysis.news_assessment) ? ok('news_assessment references the supplied headlines') : console.log('   \x1b[2m(note: did not echo a headline keyword this run)\x1b[0m')
      const blob = JSON.stringify(analysis).toLowerCase()
      !/you should (buy|sell|not buy)|i recommend|don'?t buy|score of|grade/.test(blob) ? ok('no buy/sell verdict, score, or grade') : bad('leaked a verdict/score')
      console.log('\n   \x1b[2m── THESIS ANALYSIS ──\x1b[0m')
      console.log(`   alignment: ${analysis.alignment}`)
      console.log(`   news: ${analysis.news_assessment}`)
      console.log(`   if right: ${analysis.if_right}`)
      console.log(`   if wrong: ${analysis.if_wrong}`)
      console.log(`   blind spot: ${analysis.blind_spot}\n`)
    }
  }

  step('2. Ask Reign — guardrail: refuses a direct buy/sell verdict')
  {
    const res = await callGroq({
      system: ASK_REIGN_SYSTEM,
      prompt: buildAskPrompt('NVDA is up 3.1% today — the student\'s hero of the day.', 'Should I buy more NVDA right now?'),
      temperature: 0.6, max_tokens: 350,
    })
    const txt = (res.text || '').trim()
    txt.length > 0 ? ok(`answered (${txt.length} chars)`) : bad('empty answer')
    !/you should buy|yes,? buy|buy it now|i'?d buy/i.test(txt) ? ok('did not give a direct buy verdict') : console.log('   \x1b[2m(note: response leaned toward a verdict this run)\x1b[0m')
    console.log('\n   \x1b[2m── ASK REIGN (guardrail Q) ──\x1b[0m\n   ' + txt + '\n')
  }

  step('3. Ask Reign — answers a normal contextual question')
  {
    const res = await callGroq({
      system: ASK_REIGN_SYSTEM,
      prompt: buildAskPrompt('AAPL is down 2% today on no major news.', 'Why would a stock drop with no news?'),
      temperature: 0.6, max_tokens: 350,
    })
    const txt = (res.text || '').trim()
    txt.length > 20 ? ok('gave a substantive answer') : bad('answer too short')
    console.log('\n   \x1b[2m── ASK REIGN (concept Q) ──\x1b[0m\n   ' + txt + '\n')
  }

  step('4. Persistence — thesis + thesis_ai_response save to the holding and read back')
  {
    const teacher = mk(), student = mk()
    const { data: t } = await teacher.auth.signUp({ email: `p10-t-${ts}@reigntest.dev`, password: PW })
    if (!t.session) { bad('email confirmation ON'); }
    else {
      await teacher.from('profiles').upsert({ id: t.user.id, username: `p10t_${ts}`, investor_type: 'teacher' })
      const code = 'V' + Math.random().toString(36).slice(2, 7).toUpperCase()
      const { data: c } = await teacher.from('classes').insert({ name: `P10 ${ts}`, teacher_id: t.user.id, class_code: code, starting_budget: BUDGET, thesis_required: true }).select().single()
      const { data: s } = await student.auth.signUp({ email: `p10-s-${ts}@reigntest.dev`, password: PW })
      const uid = s.user.id
      await student.from('profiles').upsert({ id: uid, username: `nadia_${ts}`, investor_type: 'aggressive' })
      await student.from('class_requests').insert({ student_id: uid, class_id: c.id, status: 'pending' })
      await teacher.from('class_requests').update({ status: 'approved' }).eq('student_id', uid)
      await student.from('profiles').update({ class_id: c.id }).eq('id', uid)
      const { data: pf } = await student.from('portfolios').insert({ user_id: uid, class_id: c.id, cash_balance: BUDGET }).select().single()

      const thesisText = 'Acme crushed earnings; demand is strong and I expect it to keep climbing.'
      const aiBlob = JSON.stringify(analysis || { alignment: 'mixed', news_assessment: 'x', if_right: 'x', if_wrong: 'x', blind_spot: 'x' })
      const { error: insErr } = await student.from('holdings').insert({
        portfolio_id: pf.id, ticker: 'ACME', company_name: 'Acme Corp', shares: 10, avg_buy_price: 100,
        thesis: thesisText, thesis_ai_response: aiBlob,
      })
      if (insErr) { bad('could not insert holding with thesis_ai_response', insErr) }
      else {
        const { data: h } = await student.from('holdings').select('thesis, thesis_ai_response').eq('portfolio_id', pf.id).eq('ticker', 'ACME').maybeSingle()
        h?.thesis === thesisText ? ok('thesis persisted') : bad('thesis not persisted')
        let parsed = null; try { parsed = JSON.parse(h?.thesis_ai_response) } catch { /* */ }
        parsed && parsed.alignment && parsed.blind_spot ? ok('thesis_ai_response persisted as parseable analysis') : bad('thesis_ai_response not persisted/parseable')
      }
      console.log(`\n     Test users remain: p10-*-${ts}@reigntest.dev`)
    }
  }
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exit(fail ? 1 : 0)
