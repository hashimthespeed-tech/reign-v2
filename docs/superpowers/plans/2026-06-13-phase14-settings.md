# Phase 14 — Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the student Settings page at `/settings` — profile editing (avatar, username, investor type, read-only class code), display (timezone), the conditional real-money transition card, and account management (change password/email, hard-delete account).

**Architecture:** A single `Settings.jsx` page in `StudentLayout` composed of four section cards. All pure logic (avatar presets, real-money gate, timezone formatting, affiliate config) lives in a side-effect-free `src/lib/settings.js` that is unit-verified by `scripts/verify-phase14.mjs`. Account deletion is a service_role Netlify function (`delete-account.js`) that verifies the caller's JWT and calls `auth.admin.deleteUser`; ON DELETE CASCADE FKs remove dependent rows. No manual SQL — every column already exists.

**Tech Stack:** React 18 + react-router-dom, Supabase JS (anon client + service_role in functions), Vite dev middleware that serves `netlify/functions/*` at `/.netlify/functions/<name>`. Verification is a standalone Node script (`node scripts/verify-phase14.mjs`) following the established `verify-phaseN.mjs` idiom — there is no unit-test runner in this repo.

**Spec:** `docs/superpowers/specs/2026-06-13-phase14-settings-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/settings.js` | Create | Pure helpers: `AVATAR_PRESETS`, `presetById`, `avatarInitial`, `isRealMoneyUnlocked`, `TIMEZONES`, `formatInTimezone`, `affiliateConfig`. No I/O. |
| `src/components/Avatar.jsx` | Create | Presentational gold-on-dark monogram avatar from a preset id + username. |
| `netlify/functions/delete-account.js` | Create | service_role hard-delete of the caller's account (JWT-verified). |
| `src/pages/Settings.jsx` | Create | The page: Profile / Display / Real-Money / Account section cards. |
| `src/App.jsx` | Modify (lines 13–14 imports, line 58 route) | Replace the `/settings` `ComingSoon` stub with the real `Settings` page. |
| `scripts/verify-phase14.mjs` | Create | Pure-logic asserts + `delete-account` integration round-trip. |
| `PHASES.md` | Modify (row 22) | Mark Phase 14 done with its commit hash. |

### Environment variables (documented, not committed)
The real-money card reads three optional Vite env vars; absence renders a disabled "Link coming soon" button. Add to `.env` when affiliate links are available:
```
VITE_AFFILIATE_ROBINHOOD=
VITE_AFFILIATE_VANGUARD=
VITE_AFFILIATE_FIDELITY=
```
Account deletion needs the already-configured `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` (non-`VITE_` keys the dev middleware injects into function handlers).

---

## Task 1: Pure helpers — `src/lib/settings.js`

**Files:**
- Create: `src/lib/settings.js`
- Test: `scripts/verify-phase14.mjs` (pure-logic block; created here, extended in Task 3)

- [ ] **Step 1: Write the failing test (verify script, pure-logic block)**

Create `scripts/verify-phase14.mjs`:

```javascript
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
} catch (e) { console.error('Unexpected:', e) }

console.log(`\n\x1b[1mRESULT:\x1b[0m \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m`)
process.exitCode = fail ? 1 : 0
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/verify-phase14.mjs`
Expected: FAIL — `Cannot find module '../src/lib/settings.js'` (the lib does not exist yet).

- [ ] **Step 3: Implement `src/lib/settings.js`**

```javascript
// Pure logic for the Settings page. No I/O, no React — verified in scripts/verify-phase14.mjs.

// ---- Avatar presets ----------------------------------------------------
// Generated gold-on-dark monogram avatars; avatar_url stores the preset id.
export const AVATAR_PRESETS = [
  { id: 'crest-1', ring: '#E8B339', fill: 'rgba(232,179,57,0.14)' },
  { id: 'crest-2', ring: '#5B8DEF', fill: 'rgba(91,141,239,0.14)' },
  { id: 'crest-3', ring: '#22C55E', fill: 'rgba(34,197,94,0.14)' },
  { id: 'crest-4', ring: '#F0C967', fill: 'rgba(240,201,103,0.16)' },
  { id: 'crest-5', ring: '#9BA1AD', fill: 'rgba(155,161,173,0.14)' },
  { id: 'crest-6', ring: '#EF4444', fill: 'rgba(239,68,68,0.12)' },
]
export const DEFAULT_AVATAR = AVATAR_PRESETS[0].id

export function presetById(id) {
  return AVATAR_PRESETS.find((p) => p.id === id) || AVATAR_PRESETS[0]
}

// First letter for the monogram, from a username.
export function avatarInitial(username = '') {
  const c = (username || '').trim().charAt(0)
  return c ? c.toUpperCase() : '?'
}

// ---- Real-money gate ---------------------------------------------------
// True iff the class enabled real money AND its semester end date has passed.
export function isRealMoneyUnlocked(klass, now = new Date()) {
  if (!klass || klass.show_real_money !== true) return false
  if (!klass.semester_end_date) return false
  const end = new Date(klass.semester_end_date)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() < now.getTime()
}

// ---- Timezones (display-only) -----------------------------------------
export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
]
export const DEFAULT_TZ = 'America/New_York'

export function formatInTimezone(date, tz = DEFAULT_TZ) {
  const d = date instanceof Date ? date : new Date(date)
  const opts = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).format(d)
  }
}

// ---- Affiliate broker cards -------------------------------------------
const BROKERS = [
  { key: 'robinhood', name: 'Robinhood', bonus: 'Get a free stock when you fund a new account.', envKey: 'VITE_AFFILIATE_ROBINHOOD' },
  { key: 'vanguard', name: 'Vanguard', bonus: 'Low-cost index funds built for long-term investors.', envKey: 'VITE_AFFILIATE_VANGUARD' },
  { key: 'fidelity', name: 'Fidelity', bonus: '$0 commission trades and cash bonus offers.', envKey: 'VITE_AFFILIATE_FIDELITY' },
]

// env defaults to {} so this is safe to call from Node (verify script).
// From the app, pass import.meta.env.
export function affiliateConfig(env = {}) {
  return BROKERS.map((b) => {
    const url = (env[b.envKey] || '').trim()
    return { key: b.key, name: b.name, bonus: b.bonus, url: url || null }
  })
}
```

- [ ] **Step 4: Run the test to verify the pure-logic block passes**

Run: `node scripts/verify-phase14.mjs`
Expected: section "1. settings.js pure logic" all green; `RESULT: N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.js scripts/verify-phase14.mjs
git commit -m "Phase 14: settings.js pure helpers + verify scaffold

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Avatar component — `src/components/Avatar.jsx`

A thin presentational wrapper over `presetById`/`avatarInitial` (both already covered by Task 1). No React test runner exists; verify by lint + the browser check in Task 4.

**Files:**
- Create: `src/components/Avatar.jsx`

- [ ] **Step 1: Implement the component**

```jsx
import { presetById, avatarInitial } from '../lib/settings'
import { colors, font } from '../theme'

// Gold-on-dark monogram avatar. `presetId` selects the palette; the initial
// comes from `username`. Pass `onClick` to make it a selectable swatch.
export default function Avatar({ presetId, username, size = 44, selected = false, onClick }) {
  const p = presetById(presetId)
  return (
    <div
      onClick={onClick}
      title={onClick ? p.id : undefined}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: p.fill,
        border: `2px solid ${selected ? colors.gold : p.ring}`,
        color: selected ? colors.gold : p.ring,
        fontFamily: font.mono, fontWeight: 700, fontSize: size * 0.42,
        boxShadow: selected ? `0 0 0 3px ${colors.goldDim}` : 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s', userSelect: 'none',
      }}
    >
      {avatarInitial(username)}
    </div>
  )
}
```

- [ ] **Step 2: Lint to verify it parses cleanly**

Run: `npm run lint`
Expected: no errors for `src/components/Avatar.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Avatar.jsx
git commit -m "Phase 14: Avatar monogram component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Delete-account function — `netlify/functions/delete-account.js`

**Files:**
- Create: `netlify/functions/delete-account.js`
- Test: `scripts/verify-phase14.mjs` (append a delete-account integration block)

- [ ] **Step 1: Write the failing test (append block to verify script)**

In `scripts/verify-phase14.mjs`, insert this block immediately **before** the final
`console.log(\`\n\x1b[1mRESULT...\`)` line (still inside the `try`):

```javascript
  step('2. delete-account hard-deletes the caller (needs dev server + SUPABASE_SERVICE_ROLE)')
  {
    const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const admin = (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE)
      ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } })
      : null
    if (!admin) { bad('SUPABASE_URL/SUPABASE_SERVICE_ROLE missing from .env — cannot verify deletion'); }
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
```

- [ ] **Step 2: Start the dev server, then run the test to verify it fails**

Run (in a separate terminal, leave running): `npm run dev`
Then run: `node scripts/verify-phase14.mjs`
Expected: section 2 fails — `delete-account` returns the dev middleware's 500/404 (`No handler` / module not found) because the function does not exist yet.

- [ ] **Step 3: Implement `netlify/functions/delete-account.js`**

```javascript
import { json, preflight } from './_util.js'
import { adminClient } from './_supabase.js'

// Hard-delete the caller's account.
// POST with `Authorization: Bearer <access_token>`. The token is verified
// server-side to resolve the uid (never trust a uid from the body); then
// auth.admin.deleteUser removes the auth user and ON DELETE CASCADE FKs
// remove every dependent row (profile, portfolio, holdings, trades, ...).
export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: 'missing token' })

  let admin
  try { admin = adminClient() } catch (e) { return json(500, { error: e.message }) }

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json(401, { error: 'invalid token' })

  const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id)
  if (delErr) return json(500, { error: delErr.message })

  return json(200, { ok: true })
}
```

- [ ] **Step 4: Re-run the test to verify it passes**

Run (dev server still up): `node scripts/verify-phase14.mjs`
Expected: sections 1 and 2 all green; `RESULT: N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/delete-account.js scripts/verify-phase14.mjs
git commit -m "Phase 14: delete-account service_role function + integration test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Settings page + route — `src/pages/Settings.jsx`, `src/App.jsx`

**Files:**
- Create: `src/pages/Settings.jsx`
- Modify: `src/App.jsx` (imports near line 13; route at line 58)

- [ ] **Step 1: Implement `src/pages/Settings.jsx`**

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import StudentLayout from '../components/StudentLayout'
import Avatar from '../components/Avatar'
import { Card, Button, Field, Input } from '../components/ui'
import { colors, radius, space } from '../theme'
import { INVESTOR_TYPES } from '../lib/constants'
import {
  AVATAR_PRESETS, DEFAULT_AVATAR, TIMEZONES, DEFAULT_TZ,
  formatInTimezone, isRealMoneyUnlocked, affiliateConfig,
} from '../lib/settings'

function Section({ title, subtitle, children, glow = false }) {
  return (
    <Card glow={glow} style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: colors.textFaint, marginTop: 4, marginBottom: 18 }}>{subtitle}</div>}
      {!subtitle && <div style={{ marginBottom: 18 }} />}
      {children}
    </Card>
  )
}

function Note({ tone = 'muted', children }) {
  if (!children) return null
  const c = tone === 'error' ? colors.red : tone === 'ok' ? colors.green : colors.textMuted
  return <div style={{ fontSize: 13, color: c, marginTop: 8 }}>{children}</div>
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, signOut } = useAuth()

  // Class row (for class code + real-money gate)
  const [klass, setKlass] = useState(null)
  useEffect(() => {
    if (!profile?.class_id) return
    supabase.from('classes')
      .select('class_code, show_real_money, semester_end_date')
      .eq('id', profile.class_id).maybeSingle()
      .then(({ data }) => setKlass(data || null))
  }, [profile?.class_id])

  // ---- Profile state ----
  const [avatar, setAvatar] = useState(profile?.avatar_url || DEFAULT_AVATAR)
  const [username, setUsername] = useState(profile?.username || '')
  const [investor, setInvestor] = useState(profile?.investor_type || 'no_idea')
  const [profileMsg, setProfileMsg] = useState(null)
  const [profileErr, setProfileErr] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    setAvatar(profile?.avatar_url || DEFAULT_AVATAR)
    setUsername(profile?.username || '')
    setInvestor(profile?.investor_type || 'no_idea')
  }, [profile])

  const profileDirty = profile && (
    avatar !== (profile.avatar_url || DEFAULT_AVATAR) ||
    username.trim() !== profile.username ||
    investor !== profile.investor_type
  )

  async function saveProfile() {
    setProfileMsg(null); setProfileErr(null)
    const uname = username.trim()
    if (uname.length < 3) { setProfileErr('Username must be at least 3 characters.'); return }
    setSavingProfile(true)
    try {
      if (uname.toLowerCase() !== profile.username.toLowerCase()) {
        const { data: available } = await supabase.rpc('username_available', { check_username: uname })
        if (!available) { setProfileErr('That username is taken.'); setSavingProfile(false); return }
      }
      const { error } = await supabase.from('profiles')
        .update({ username: uname, investor_type: investor, avatar_url: avatar })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setProfileMsg('Profile saved.')
    } catch (e) {
      setProfileErr(e.message || 'Could not save profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  // ---- Display (timezone, localStorage only) ----
  const [tz, setTz] = useState(() => localStorage.getItem('reign_tz') || DEFAULT_TZ)
  function changeTz(v) { setTz(v); localStorage.setItem('reign_tz', v) }
  const tzPreview = useMemo(() => formatInTimezone(new Date(), tz), [tz])

  // ---- Account ----
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState(null); const [pwErr, setPwErr] = useState(null); const [pwBusy, setPwBusy] = useState(false)
  async function changePassword() {
    setPwMsg(null); setPwErr(null)
    if (pw.length < 6) { setPwErr('Password must be at least 6 characters.'); return }
    if (pw !== pw2) { setPwErr('Passwords do not match.'); return }
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) setPwErr(error.message)
    else { setPw(''); setPw2(''); setPwMsg('Password updated.') }
  }

  const [email, setEmail] = useState(user?.email || '')
  const [emailMsg, setEmailMsg] = useState(null); const [emailErr, setEmailErr] = useState(null); const [emailBusy, setEmailBusy] = useState(false)
  async function changeEmail() {
    setEmailMsg(null); setEmailErr(null)
    const e = email.trim()
    if (!e || !e.includes('@')) { setEmailErr('Enter a valid email.'); return }
    setEmailBusy(true)
    const { error } = await supabase.auth.updateUser({ email: e })
    setEmailBusy(false)
    if (error) setEmailErr(error.message)
    else setEmailMsg('Email updated.')
  }

  // ---- Delete account ----
  const [showDelete, setShowDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleteErr, setDeleteErr] = useState(null); const [deleting, setDeleting] = useState(false)
  async function deleteAccount() {
    setDeleteErr(null); setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok || !out.ok) throw new Error(out.error || 'Delete failed.')
      await signOut()
      navigate('/')
    } catch (e) {
      setDeleteErr(e.message); setDeleting(false)
    }
  }

  const realMoney = isRealMoneyUnlocked(klass)
  const brokers = affiliateConfig(import.meta.env)
  const swatch = (active) => ({
    padding: '12px 10px', borderRadius: radius.sm, cursor: 'pointer',
    textAlign: 'center', fontSize: 13.5, fontWeight: 600,
    border: `1px solid ${active ? colors.gold : colors.border}`,
    background: active ? colors.bgRaised : 'transparent',
    color: active ? colors.text : colors.textMuted, transition: 'all 0.15s',
  })

  return (
    <StudentLayout maxWidth={760}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 22px' }}>Settings</h1>

      {/* Profile */}
      <Section title="Profile" subtitle="How you show up in your class.">
        <Field label="Avatar">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {AVATAR_PRESETS.map((p) => (
              <Avatar key={p.id} presetId={p.id} username={username} size={48}
                selected={avatar === p.id} onClick={() => setAvatar(p.id)} />
            ))}
          </div>
        </Field>
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
        </Field>
        <Field label="Investor type">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {INVESTOR_TYPES.map((t) => (
              <div key={t.value} onClick={() => setInvestor(t.value)} style={swatch(investor === t.value)}>
                {t.label}
              </div>
            ))}
          </div>
        </Field>
        <Field label="Class code">
          <Input value={klass?.class_code || '—'} disabled readOnly
            style={{ opacity: 0.7, cursor: 'not-allowed', fontFamily: 'monospace', letterSpacing: '0.15em' }} />
        </Field>
        <Button onClick={saveProfile} loading={savingProfile} disabled={!profileDirty || savingProfile}>
          Save profile
        </Button>
        <Note tone="error">{profileErr}</Note>
        <Note tone="ok">{profileMsg}</Note>
      </Section>

      {/* Display */}
      <Section title="Display" subtitle="Timezone affects only how dates and times are shown to you.">
        <Field label="Timezone" hint={`Times will look like: ${tzPreview}`}>
          <select value={tz} onChange={(e) => changeTz(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', fontSize: 15,
              background: colors.bgRaised, color: colors.text,
              border: `1px solid ${colors.border}`, borderRadius: radius.sm, outline: 'none',
            }}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </Section>

      {/* Real-money transition (conditional) */}
      {realMoney && (
        <Section glow title="Ready for the real thing"
          subtitle="Your class has reached the real-money transition. These are real brokerages — open an account when you're ready.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {brokers.map((b) => (
              <div key={b.key} style={{
                border: `1px solid ${colors.borderStrong}`, borderRadius: radius.md,
                padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, flex: 1 }}>{b.bonus}</div>
                {b.url
                  ? <a href={b.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" full style={{ padding: '10px' }}>Open account</Button>
                    </a>
                  : <Button variant="secondary" full disabled style={{ padding: '10px' }}>Link coming soon</Button>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Account */}
      <Section title="Account">
        <Field label="Change password">
          <Input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ marginBottom: 10 }} />
          <Input type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={changePassword} loading={pwBusy} disabled={pwBusy || !pw}>Update password</Button>
        <Note tone="error">{pwErr}</Note>
        <Note tone="ok">{pwMsg}</Note>

        <div style={{ height: 1, background: colors.border, margin: `${space(6)} 0` }} />

        <Field label="Change email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={changeEmail} loading={emailBusy} disabled={emailBusy}>Update email</Button>
        <Note tone="error">{emailErr}</Note>
        <Note tone="ok">{emailMsg}</Note>

        <div style={{ height: 1, background: colors.border, margin: `${space(6)} 0` }} />

        <div style={{ fontSize: 14.5, fontWeight: 600, color: colors.red, marginBottom: 6 }}>Danger zone</div>
        <div style={{ fontSize: 12.5, color: colors.textFaint, marginBottom: 12 }}>
          Deleting your account permanently removes your profile, portfolio, and all history. This cannot be undone.
        </div>
        {!showDelete
          ? <Button variant="danger" onClick={() => { setShowDelete(true); setConfirmText(''); setDeleteErr(null) }}>Delete account</Button>
          : (
            <div style={{ border: `1px solid ${colors.red}`, borderRadius: radius.md, padding: 16 }}>
              <div style={{ fontSize: 13.5, marginBottom: 10 }}>Type <strong>DELETE</strong> to confirm.</div>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="danger" onClick={deleteAccount} loading={deleting}
                  disabled={confirmText !== 'DELETE' || deleting}>Permanently delete</Button>
                <Button variant="ghost" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</Button>
              </div>
              <Note tone="error">{deleteErr}</Note>
            </div>
          )}
      </Section>
    </StudentLayout>
  )
}
```

- [ ] **Step 2: Wire the route in `src/App.jsx`**

Add the import after the `Learning` import (currently line 14):

```jsx
import Settings from './pages/Settings'
```

Replace the `/settings` route (currently line 58):

```jsx
        <Route path="/settings" element={<StudentRoute><Settings /></StudentRoute>} />
```

- [ ] **Step 3: Build to verify the page compiles**

Run: `npm run build`
Expected: build succeeds (the recharts bundle-size warning from earlier phases is unrelated and expected).

- [ ] **Step 4: Browser check (manual)**

With `npm run dev` running, sign in as a student and visit `/settings`. Confirm: avatar swatches highlight on click and Save persists (reload shows the kept avatar); username/investor save; class code is read-only; timezone preview updates live; the real-money card is **absent** (expected unless a class has `show_real_money` and a past `semester_end_date`); password/email update controls respond; "Delete account" reveals the typed-DELETE confirmation. (Do not actually delete your working account — deletion is covered by the Task 3 integration test.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.jsx src/App.jsx
git commit -m "Phase 14: Settings page wired at /settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Finalize — full verification + PHASES.md

**Files:**
- Modify: `PHASES.md` (row 22)

- [ ] **Step 1: Run the full verification with the dev server up**

Run (dev server running): `node scripts/verify-phase14.mjs`
Expected: every section green; `RESULT: N passed, 0 failed`. If any check fails, fix the root cause (use systematic-debugging) before continuing — do not mark the phase done.

- [ ] **Step 2: Mark Phase 14 done in `PHASES.md`**

Change row 22 from:

```
| 14 | **Settings page (incl. real-money transition)** | 🔨 next | — |
```

to (use the actual hash of the Task 4 commit):

```
| 14 | Settings page (incl. real-money transition) | ✅ done | `<task4-hash>` |
```

And change row 15 status from `⏳ planned` to `🔨 next`.

- [ ] **Step 3: Commit**

```bash
git add PHASES.md
git commit -m "Mark Phase 14 done in PHASES.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Log the decision**

Append a Phase 14 entry to `C:\Users\hashi\projects\.decisions.md` summarizing the five locked decisions (dark-mode dropped, timezone localStorage display-only, real service_role delete-account, affiliate env-var-with-fallback, generated monogram avatars), the no-SQL note, and the verify result. Commit:

```bash
git add C:/Users/hashi/projects/.decisions.md
git commit -m "Log Phase 14 settings decisions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Profile (username / avatar / investor type / read-only class code) → Task 4 Profile section + Task 1 presets + Task 2 Avatar. ✓
- Display (timezone) → Task 4 Display section + Task 1 `TIMEZONES`/`formatInTimezone`. ✓ (Dark-mode intentionally dropped per spec.)
- Real-Money Transition (gated, three brokers, env links + fallback) → Task 4 conditional section + Task 1 `isRealMoneyUnlocked`/`affiliateConfig`. ✓
- Account (change password / email / delete) → Task 4 Account section + Task 3 `delete-account.js`. ✓
- Verification → `scripts/verify-phase14.mjs` (Tasks 1 & 3). ✓
- No manual SQL → confirmed against existing schema. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output. ✓

**Type/name consistency:** `AVATAR_PRESETS`, `DEFAULT_AVATAR`, `presetById`, `avatarInitial`, `isRealMoneyUnlocked`, `TIMEZONES`, `DEFAULT_TZ`, `formatInTimezone`, `affiliateConfig` are defined identically in Task 1 and consumed with matching names/signatures in Tasks 2–4. `delete-account` request/response shape (`Authorization: Bearer`, `{ ok: true }`) matches between the function (Task 3), the verify block (Task 3), and the page (Task 4). ✓
