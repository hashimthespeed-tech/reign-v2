// Phase 13 Learning page + cinematic unlock progression.
// Requires dev server :5173 (groq proxy) AND supabase/07_concepts.sql applied.
// Run: node scripts/verify-phase13.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { stageForStudent, conceptUnlocked, readTime, pickTodayConcept, pendingCinematics, vaultItems } from '../src/lib/learning.js'

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
const eq = (m, a, b) => (JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(`${m} (got ${JSON.stringify(a)})`))
const ts = Date.now(), PW = 'reignTest123'

try {
  step('1. learning.js pure logic')
  {
    eq('stage: rank 1 → Investor (3)', stageForStudent({ rank: 1 }), 3)
    eq('stage: day 30 → Analyst (2)', stageForStudent({ daysInClass: 30 }), 2)
    eq('stage: first trade → Trader (1)', stageForStudent({ tradeCount: 1 }), 1)
    eq('stage: fresh → Watcher (0)', stageForStudent({}), 0)
    conceptUnlocked('day_1', {}) && !conceptUnlocked('day_10', { daysInClass: 9 }) && conceptUnlocked('day_10', { daysInClass: 10 }) && conceptUnlocked('rank_1', { rank: 1 }) && !conceptUnlocked('rank_1', { rank: 2 })
      ? ok('conceptUnlocked gates day_1/10/30/rank_1 correctly') : bad('conceptUnlocked gating wrong')
    eq('readTime ~400 words = 2 min', readTime(Array(400).fill('word').join(' ')), 2)
    const list = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    const d = new Date('2026-06-13T12:00:00Z')
    pickTodayConcept(list, d) === pickTodayConcept(list, d) ? ok('pickTodayConcept is stable for a given day') : bad('today pick not stable')
    eq('pendingCinematics: all reached, none seen', pendingCinematics({ daysInClass: 30, rank: 1 }, []), ['day_10', 'day_30', 'rank_1'])
    eq('pendingCinematics: skips seen', pendingCinematics({ daysInClass: 30, rank: 1 }, ['day_10']), ['day_30', 'rank_1'])
    eq('pendingCinematics: none reached', pendingCinematics({ daysInClass: 5 }, []), [])
    vaultItems({ daysInClass: 30, rank: 0 }).filter((v) => v.met).length === 3 ? ok('vaultItems: Day-30 student has 3 of 4 unlocked') : bad('vaultItems gating wrong')
  }

  step('2. Concept catalog (needs 07_concepts.sql applied)')
  const student = mk()
  let conceptId = null
  {
    const { data: s } = await student.auth.signUp({ email: `p13-s-${ts}@reigntest.dev`, password: PW })
    if (!s.session) { bad('email confirmation ON'); }
    await student.from('profiles').upsert({ id: s.user.id, username: `lena_${ts}`, investor_type: 'aggressive' })
    const { data: concepts, error } = await student.from('concepts').select('*')
    if (error || !concepts?.length) { bad('no concepts found — apply supabase/07_concepts.sql', error || {}) }
    else {
      concepts.length >= 18 ? ok(`catalog has ${concepts.length} concepts`) : bad(`expected >=18, got ${concepts.length}`)
      const cats = new Set(['basics', 'strategy', 'psychology', 'macro', 'analysis'])
      const reqs = new Set(['day_1', 'day_10', 'day_30', 'rank_1'])
      concepts.every((c) => c.plain_english_name && c.hook && c.content && cats.has(c.category) && reqs.has(c.unlock_requirement))
        ? ok('every concept has name/hook/content + valid category & unlock requirement') : bad('a concept row is malformed')
      reqs.forEach((r) => { if (!concepts.some((c) => c.unlock_requirement === r)) bad(`no concept for tier ${r}`) })
      if ([...reqs].every((r) => concepts.some((c) => c.unlock_requirement === r))) ok('every unlock tier (day_1/10/30/rank_1) is represented')
      conceptId = concepts[0].id
    }

    step('3. student_concepts: mark complete round-trips (own-row RLS)')
    if (!conceptId) bad('skipped — no concept id')
    else {
      const { error: e1 } = await student.from('student_concepts').upsert(
        { user_id: s.user.id, concept_id: conceptId, unlocked_at: new Date().toISOString(), completed_at: new Date().toISOString() },
        { onConflict: 'user_id,concept_id' })
      if (e1) bad('mark-complete failed', e1)
      else {
        const { data: row } = await student.from('student_concepts').select('completed_at').eq('user_id', s.user.id).eq('concept_id', conceptId).maybeSingle()
        row?.completed_at ? ok('completed_at persisted') : bad('completed_at not stored')
      }
    }

    step('4. unlocks: cinematic-seen round-trips')
    {
      const { error: e2 } = await student.from('unlocks').upsert({ user_id: s.user.id, unlock_type: 'day_10', seen_by_user: true }, { onConflict: 'user_id,unlock_type' })
      if (e2) bad('unlock insert failed', e2)
      else {
        const { data: u } = await student.from('unlocks').select('seen_by_user').eq('user_id', s.user.id).eq('unlock_type', 'day_10').maybeSingle()
        u?.seen_by_user === true ? ok('day_10 unlock recorded as seen') : bad('unlock not stored')
      }
    }
  }

  step("5. Today's Concept AI tie-in (real Groq)")
  {
    const res = await fetch(`${FN}/groq`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: "You are Reign. Connect today's investing concept to the student's holdings in ONE sentence. No advice.",
        prompt: 'Concept: Diversification — Don\'t put your whole portfolio in one stock.\nStudent holdings: AAPL, NVDA, TSLA\nWrite ONE sentence connecting this concept to their holdings.',
        temperature: 0.7, max_tokens: 120,
      }),
    }).then((r) => r.json())
    const txt = (res.text || '').trim()
    txt.length > 15 ? ok(`tie-in generated (${txt.length} chars)`) : bad('tie-in empty', res)
    console.log('\n   \x1b[2m── TIE-IN ──\x1b[0m\n   ' + txt + '\n')
  }

  console.log(`\n     Test user remains: p13-s-${ts}@reigntest.dev`)
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exitCode = fail ? 1 : 0
