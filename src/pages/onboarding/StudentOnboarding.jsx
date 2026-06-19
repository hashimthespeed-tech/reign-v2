import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { colors, radius, font } from '../../theme'
import { STOCK_CATEGORIES, INVESTOR_TYPES, TICKER_NAMES } from '../../lib/constants'
import { Logo, Button, Field, Input, Card, Spinner, OnboardingShell } from '../../components/ui'
import { BootScreen, WelcomeScreen, AuthStep } from './parts'

// Idempotent: link student to class, create portfolio + watchlist holdings.
async function finalizeMembership(userId, cls, tickers) {
  await supabase.from('profiles').update({ class_id: cls.id }).eq('id', userId)
  let { data: pf } = await supabase.from('portfolios')
    .select('id').eq('user_id', userId).eq('class_id', cls.id).maybeSingle()
  if (!pf) {
    const { data: newPf } = await supabase.from('portfolios')
      .insert({ user_id: userId, class_id: cls.id, cash_balance: cls.starting_budget })
      .select().single()
    pf = newPf
    if (pf && tickers?.length) {
      await supabase.from('holdings').insert(
        tickers.map((t) => ({
          portfolio_id: pf.id, ticker: t, company_name: TICKER_NAMES[t] || t,
          shares: 0, avg_buy_price: 0,
        }))
      )
    }
  }
}

export default function StudentOnboarding() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [classInfo, setClassInfo] = useState(null)
  const [selected, setSelected] = useState([])

  // Resolve where an existing (logged-in) student should land.
  async function routeExisting() {
    const uid = user?.id
    if (!uid) return setStep(3)
    const { data: prof } = await supabase.from('profiles')
      .select('id, username, class_id').eq('id', uid).maybeSingle()
    const { data: req } = await supabase.from('class_requests')
      .select('id, status, class_id').eq('student_id', uid)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (req?.status === 'approved') {
      const { data: cls } = await supabase.from('classes')
        .select('*').eq('id', req.class_id).maybeSingle()
      if (cls) await finalizeMembership(uid, cls, [])
      await refreshProfile()
      return navigate('/dashboard')
    }
    if (req?.status === 'pending') {
      const { data: cls } = await supabase.from('classes')
        .select('*').eq('id', req.class_id).maybeSingle()
      setClassInfo(cls)
      return setStep('waiting')
    }
    // no request yet — resume at code entry (profile may or may not exist)
    return setStep(3)
  }

  if (step === 0) return <BootScreen onDone={() => setStep(1)} />
  if (step === 1) return <WelcomeScreen role="student" onContinue={() => setStep(2)} />
  if (step === 2) {
    return <AuthStep role="student" onCreated={() => setStep(3)} onLogin={routeExisting} />
  }
  if (step === 3) {
    return <CodeStep prefill={params.get('code') || ''} userId={user?.id}
      onFound={(cls) => { setClassInfo(cls); setStep(4) }}
      onApproved={async (cls) => { await finalizeMembership(user.id, cls, []); await refreshProfile(); navigate('/dashboard') }}
      onPending={(cls) => { setClassInfo(cls); setStep('waiting') }} />
  }
  if (step === 4) {
    return <IdentityStep userId={user?.id}
      onDone={async () => { await refreshProfile(); setStep(5) }} />
  }
  if (step === 5) {
    return <StocksStep selected={selected} setSelected={setSelected}
      onDone={async () => {
        // Profile exists now → safe to insert the class request (FK satisfied).
        await supabase.from('class_requests').insert({
          student_id: user.id, class_id: classInfo.id, status: 'pending',
        })
        setStep('waiting')
      }} />
  }
  if (step === 'waiting') {
    return <WaitingScreen userId={user?.id} classInfo={classInfo} tickers={selected}
      onApproved={async () => { await refreshProfile(); setStep(6) }} />
  }
  return <RevealStep onDone={() => navigate('/dashboard')} />
}

// ---------- Step 3: class code ----------
function CodeStep({ prefill, userId, onFound, onApproved, onPending }) {
  const [code, setCode] = useState(prefill.toUpperCase())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    const clean = code.trim().toUpperCase()
    const { data: cls } = await supabase.from('classes')
      .select('*').ilike('class_code', clean).maybeSingle()
    if (!cls) { setBusy(false); return setError("That code doesn't exist. Check with your teacher.") }

    // If this student already has a request for this class, branch accordingly.
    if (userId) {
      const { data: req } = await supabase.from('class_requests')
        .select('status').eq('student_id', userId).eq('class_id', cls.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (req?.status === 'approved') { setBusy(false); return onApproved(cls) }
      if (req?.status === 'pending') { setBusy(false); return onPending(cls) }
    }
    setBusy(false)
    onFound(cls)
  }

  return (
    <OnboardingShell>
      <div style={{ marginBottom: 24 }}><Logo size={18} /></div>
      <h2 style={{ fontFamily: font.display, fontSize: 29, fontWeight: 900, letterSpacing: '-0.025em', marginBottom: 6 }}>
        Enter your class code
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 24 }}>Your teacher gave you a 6-character code.</p>
      <form onSubmit={submit}>
        <Input value={code} maxLength={6} autoFocus
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          style={{
            fontFamily: font.mono, fontSize: 30, textAlign: 'center',
            letterSpacing: '0.35em', padding: '18px', fontWeight: 700,
          }} />
        {error && <div style={{ color: colors.red, fontSize: 13.5, margin: '14px 0' }}>{error}</div>}
        <div style={{ marginTop: 18 }}>
          <Button full type="submit" loading={busy} disabled={code.length < 6}>Find my class</Button>
        </div>
      </form>
    </OnboardingShell>
  )
}

// ---------- Step 4: identity ----------
function IdentityStep({ userId, onDone }) {
  const [username, setUsername] = useState('')
  const [avail, setAvail] = useState(null) // null | 'checking' | true | false
  const [type, setType] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function checkUsername() {
    const u = username.trim()
    if (u.length < 3) { setAvail(null); return }
    setAvail('checking')
    const { data } = await supabase.rpc('username_available', { check_username: u })
    setAvail(data === true)
  }

  async function submit(e) {
    e.preventDefault()
    if (!type) return setError('Pick an investor type')
    if (avail === false) return setError('That username is taken')
    setBusy(true); setError('')
    const { error: err } = await supabase.from('profiles').upsert({
      id: userId, username: username.trim(), investor_type: type,
    })
    setBusy(false)
    if (err) {
      if (err.code === '23505') { setAvail(false); return setError('That username is taken') }
      return setError(err.message || 'Could not save')
    }
    onDone()
  }

  return (
    <OnboardingShell>
      <div style={{ marginBottom: 24 }}><Logo size={18} /></div>
      <h2 style={{ fontFamily: font.display, fontSize: 29, fontWeight: 900, letterSpacing: '-0.025em', marginBottom: 6 }}>
        Build your identity
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 24 }}>This is the name on the leaderboard.</p>
      <form onSubmit={submit}>
        <Field label="Username"
          error={avail === false ? 'Taken — try another' : ''}
          hint={avail === true ? '✓ Available' : (avail === 'checking' ? 'Checking…' : 'At least 3 characters')}>
          <Input value={username} invalid={avail === false}
            onChange={(e) => { setUsername(e.target.value); setAvail(null) }}
            onBlur={checkUsername} placeholder="market_king" />
        </Field>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 10 }}>
          What kind of investor are you?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {INVESTOR_TYPES.map((t) => (
            <div key={t.value} onClick={() => setType(t.value)} style={{
              padding: 14, borderRadius: radius.md, cursor: 'pointer', transition: 'all 0.15s',
              background: type === t.value ? colors.goldDim : colors.bgRaised,
              border: `1px solid ${type === t.value ? colors.gold : colors.border}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: type === t.value ? colors.gold : colors.text }}>
                {t.label}
              </div>
              <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 4, lineHeight: 1.35 }}>
                {t.blurb}
              </div>
            </div>
          ))}
        </div>
        {error && <div style={{ color: colors.red, fontSize: 13.5, marginBottom: 12 }}>{error}</div>}
        <Button full type="submit" loading={busy} disabled={username.trim().length < 3 || !type}>
          Continue
        </Button>
      </form>
    </OnboardingShell>
  )
}

// ---------- Step 5: pick first stocks ----------
function StocksStep({ selected, setSelected, onDone }) {
  const [busy, setBusy] = useState(false)
  function toggle(ticker) {
    setSelected((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker)
        : prev.length >= 5 ? prev : [...prev, ticker]
    )
  }
  const ok = selected.length >= 2 && selected.length <= 5
  return (
    <OnboardingShell maxWidth={560}>
      <div style={{ marginBottom: 22 }}><Logo size={18} /></div>
      <h2 style={{ fontFamily: font.display, fontSize: 29, fontWeight: 900, letterSpacing: '-0.025em', marginBottom: 6 }}>
        Pick your first stocks
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 4 }}>
        Choose 2–5 to watch. You'll buy them with real prices once you're in.
      </p>
      <div style={{ fontSize: 13, fontWeight: 600, color: ok ? colors.green : colors.gold, marginBottom: 18 }}>
        {selected.length} selected
      </div>

      {STOCK_CATEGORIES.map((cat) => (
        <div key={cat.category} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em',
            color: colors.textFaint, textTransform: 'uppercase', marginBottom: 9,
          }}>
            {cat.category}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {cat.stocks.map((s) => {
              const active = selected.includes(s.ticker)
              return (
                <div key={s.ticker} onClick={() => toggle(s.ticker)} style={{
                  padding: '11px 13px', borderRadius: radius.sm, cursor: 'pointer',
                  transition: 'all 0.13s', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: active ? colors.goldDim : colors.bgRaised,
                  border: `1px solid ${active ? colors.gold : colors.border}`,
                }}>
                  <div>
                    <div style={{ fontFamily: font.mono, fontWeight: 600, fontSize: 14,
                      color: active ? colors.gold : colors.text }}>{s.ticker}</div>
                    <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 1 }}>{s.name}</div>
                  </div>
                  {active && <span style={{ color: colors.gold, fontSize: 16 }}>✓</span>}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 12, position: 'sticky', bottom: 16 }}>
        <Button full disabled={!ok} loading={busy}
          onClick={async () => { setBusy(true); await onDone() }}>
          {ok ? 'Lock in my watchlist' : 'Pick at least 2'}
        </Button>
      </div>
    </OnboardingShell>
  )
}

// ---------- Waiting for approval ----------
function WaitingScreen({ userId, classInfo, tickers, onApproved }) {
  const tickersRef = useRef(tickers)
  tickersRef.current = tickers
  useEffect(() => {
    let stop = false
    async function check() {
      const { data: req } = await supabase.from('class_requests')
        .select('status').eq('student_id', userId).eq('class_id', classInfo.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!stop && req?.status === 'approved') {
        await finalizeMembership(userId, classInfo, tickersRef.current)
        if (!stop) onApproved()
      }
    }
    check()
    const id = setInterval(check, 30000)
    return () => { stop = true; clearInterval(id) }
  }, [userId, classInfo, onApproved])

  return (
    <OnboardingShell>
      <Card style={{ padding: 36, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <Spinner size={34} />
        </div>
        <h2 style={{ fontFamily: font.display, fontSize: 26, fontWeight: 900, letterSpacing: '-0.025em' }}>
          Your request is in
        </h2>
        <p style={{ color: colors.textMuted, marginTop: 10, lineHeight: 1.55 }}>
          Your teacher will let you into <strong style={{ color: colors.text }}>{classInfo?.name}</strong> shortly.
          This screen updates automatically.
        </p>
      </Card>
    </OnboardingShell>
  )
}

// ---------- Step 6: brief reveal then dashboard ----------
function RevealStep({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 1400); return () => clearTimeout(t) }, [onDone])
  return (
    <OnboardingShell>
      <Card ink style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ marginBottom: 18 }}><Logo size={22} color="#ffffff" /></div>
        <h2 style={{ fontFamily: font.display, fontSize: 30, fontWeight: 900, letterSpacing: '-0.025em', color: '#ffffff' }}>You're in.</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 10 }}>Taking you to your dashboard…</p>
      </Card>
    </OnboardingShell>
  )
}
