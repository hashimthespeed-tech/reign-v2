// Phase 14 Settings page.
// Pure-logic checks need nothing running. The delete-account block (added in
// Task 3) needs the dev server on :5173 and SUPABASE_SERVICE_ROLE in .env.
// Run: node scripts/verify-phase14.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  AVATAR_PRESETS, presetById, avatarInitial,
  isRealMoneyUnlocked, TIMEZONES, formatInTimezone, affiliateConfig,
} from '../src/lib/settings.js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].trim()
}
const FN = 'http://localhost:5173/.netlify/functions'

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`) }
const bad = (m, e) => { fail++; console.log(`  \x1b[31m✗ ${m}\x1b[0m${e ? ' — ' + (e.message || JSON.stringify(e)) : ''}`) }
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`)
const ts = Date.now(), PW = 'reignTest123'

try {
  step('1. settings.js pure logic')
  {
    // Avatar presets
    AVATAR_PRESETS.length >= 4 ? ok(`${AVATAR_PRESETS.length} avatar presets`) : bad('need >=4 presets')
    new Set(AVATAR_PRESETS.map((p) => p.id)).size === AVATAR_PRESETS.length ? ok('preset ids unique') : bad('duplicate preset id')
    AVATAR_PRESETS.every((p) => p.id && p.ring && p.fill) ? ok('every preset has id/ring/fill') : bad('malformed preset')
    presetById('crest-2').id === 'crest-2' ? ok('presetById finds a known preset') : bad('presetById miss')
    presetById('nope').id === AVATAR_PRESETS[0].id ? ok('presetById falls back to first') : bad('presetById no fallback')
    avatarInitial('lena') === 'L' ? ok('avatarInitial uppercases first char') : bad('avatarInitial wrong')
    avatarInitial('') === '?' ? ok('avatarInitial blank → ?') : bad('avatarInitial blank wrong')

    // Real-money gate
    const past = '2020-01-01', future = '2999-01-01'
    isRealMoneyUnlocked({ show_real_money: true, semester_end_date: past }) === true ? ok('unlocked: enabled + semester ended') : bad('gate should be open')
    isRealMoneyUnlocked({ show_real_money: true, semester_end_date: future }) === false ? ok('locked: semester not ended') : bad('gate should be closed (future)')
    isRealMoneyUnlocked({ show_real_money: false, semester_end_date: past }) === false ? ok('locked: real money disabled') : bad('gate should be closed (disabled)')
    isRealMoneyUnlocked({ show_real_money: true, semester_end_date: null }) === false ? ok('locked: no semester end date') : bad('gate should be closed (null)')
    isRealMoneyUnlocked(null) === false ? ok('locked: no class') : bad('gate should be closed (null class)')

    // Timezones
    TIMEZONES.length >= 4 && TIMEZONES.every((t) => t.value && t.label) ? ok(`${TIMEZONES.length} timezones, all well-formed`) : bad('timezone list malformed')
    const sample = new Date('2026-06-13T20:30:00Z')
    formatInTimezone(sample, 'America/New_York') !== formatInTimezone(sample, 'America/Los_Angeles')
      ? ok('formatInTimezone differs across zones') : bad('timezone formatting identical')
    typeof formatInTimezone(sample, 'Not/AZone') === 'string' ? ok('formatInTimezone tolerates a bad zone') : bad('formatInTimezone threw')

    // Affiliate config
    const cfgEmpty = affiliateConfig({})
    cfgEmpty.length === 3 && cfgEmpty.every((b) => b.url === null) ? ok('affiliateConfig: missing env → 3 cards, url null') : bad('affiliate fallback wrong')
    const cfgSet = affiliateConfig({ VITE_AFFILIATE_ROBINHOOD: 'https://r.example' })
    cfgSet.find((b) => b.key === 'robinhood').url === 'https://r.example' ? ok('affiliateConfig: env url passed through') : bad('affiliate env not read')
    cfgSet.every((b) => b.name && b.bonus) ? ok('every broker card has name + bonus copy') : bad('broker card missing copy')
  }

  step('2. delete-account hard-deletes the caller (needs dev server + SUPABASE_SERVICE_ROLE)')
  {
    const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const admin = (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE)
      ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } })
      : null
    if (!admin) { bad('SUPABASE_URL/SUPABASE_SERVICE_ROLE missing from .env — cannot verify deletion') }
    else {
      const email = `p14-del-${ts}@reigntest.dev`
      const { data: s } = await anon.auth.signUp({ email, password: PW })
      const token = s?.session?.access_token
      const uid = s?.user?.id
      if (!token || !uid) { bad('signUp returned no session (email confirmation ON?)') }
      else {
        await anon.from('profiles').upsert({ id: uid, username: `del_${ts}`, investor_type: 'cautious' })
        const { data: before } = await admin.from('profiles').select('id').eq('id', uid).maybeSingle()
        before ? ok('seeded profile row exists pre-delete') : bad('seed profile missing')

        // Reject missing token
        const noTok = await fetch(`${FN}/delete-account`, { method: 'POST' })
        noTok.status === 401 ? ok('rejects request with no token (401)') : bad(`expected 401, got ${noTok.status}`)

        // Real deletion
        const res = await fetch(`${FN}/delete-account`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        })
        const out = await res.json().catch(() => ({}))
        res.ok && out.ok ? ok('delete-account returned ok') : bad('delete-account failed', out)

        const { data: gone } = await admin.from('profiles').select('id').eq('id', uid).maybeSingle()
        gone === null ? ok('profile row gone after delete (cascade)') : bad('profile row still present')
        const { data: au } = await admin.auth.admin.getUserById(uid)
        !au?.user ? ok('auth user gone after delete') : bad('auth user still present')
      }
    }
  }
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exitCode = fail ? 1 : 0
