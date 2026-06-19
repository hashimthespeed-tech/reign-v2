import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { colors, font } from '../../theme'
import { Logo, Button, Field, Input, Tabs, OnboardingShell } from '../../components/ui'

// Cabinet Grotesk display heading style — matches the landing page.
const displayHeading = {
  fontFamily: font.display, fontWeight: 900, letterSpacing: '-0.025em',
}

// ---------- Step 0: branded boot screen ----------
export function BootScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
    }}>
      <div style={{ animation: 'reign-fade-up 0.7s ease both', transform: 'scale(1.4)' }}>
        <Logo size={30} />
      </div>
      <div style={{
        fontFamily: font.mono, fontSize: 12.5, color: colors.textFaint,
        letterSpacing: '0.25em', animation: 'reign-pulse 1.6s ease-in-out infinite',
      }}>
        LOADING THE FLOOR
      </div>
    </div>
  )
}

// ---------- Step 1: welcome ----------
export function WelcomeScreen({ role, onContinue }) {
  const teacher = role === 'teacher'
  return (
    <OnboardingShell>
      <div style={{ marginBottom: 30 }}><Logo size={20} /></div>
      <h1 style={{ ...displayHeading, fontSize: 40, lineHeight: 1.05 }}>
        {teacher ? 'Run the market.' : 'Take your throne.'}
      </h1>
      <p style={{ color: colors.textMuted, fontSize: 16.5, lineHeight: 1.55, marginTop: 16 }}>
        {teacher
          ? 'Set up a class in minutes. Your students trade real stocks with real market data — and learn how money actually moves. You watch it all unfold.'
          : 'Real stocks. Real market data. No real risk. Build the best portfolio in your class, predict the market, and prove you belong at #1.'}
      </p>
      <div style={{ marginTop: 32 }}>
        <Button full onClick={onContinue}>
          {teacher ? 'Set up my class' : 'Join the game'}
        </Button>
      </div>
    </OnboardingShell>
  )
}

// ---------- Step 2: account create / login ----------
// onCreated() fires when a NEW account is made with an active session.
// onLogin() fires after a successful existing-account sign-in.
export function AuthStep({ role, onCreated, onLogin }) {
  const [tab, setTab] = useState('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirm) return setError('Passwords do not match')
    setBusy(true)
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (err) {
      const msg = (err.message || '').toLowerCase()
      if (err.code === 'user_already_exists' || msg.includes('already')) {
        return setError('That email is already in use')
      }
      if (msg.includes('password')) return setError('Password must be at least 6 characters')
      return setError(err.message || 'Could not create account')
    }
    if (!data.session) {
      // Email confirmation is ON in Supabase — blocks the spec flow.
      return setError('Account created, but email confirmation is required. Ask the admin to disable it.')
    }
    onCreated()
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (err) return setError('Incorrect email or password.')
    onLogin()
  }

  const creating = tab === 'create'
  return (
    <OnboardingShell>
      <div style={{ marginBottom: 26 }}><Logo size={18} /></div>
      <h2 style={{ ...displayHeading, fontSize: 28, marginBottom: 22 }}>
        {role === 'teacher' ? 'Teacher account' : 'Your account'}
      </h2>

      <Tabs
        tabs={[
          { value: 'create', label: 'Create Account' },
          { value: 'login', label: 'I Have An Account' },
        ]}
        active={tab}
        onChange={(v) => { setTab(v); setError('') }}
      />

      <form onSubmit={creating ? handleCreate : handleLogin}>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete={creating ? 'new-password' : 'current-password'}
            required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" />
        </Field>
        {creating && (
          <Field label="Confirm password">
            <Input type="password" autoComplete="new-password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          </Field>
        )}
        {error && (
          <div style={{ color: colors.red, fontSize: 13.5, marginBottom: 14 }}>{error}</div>
        )}
        <Button full type="submit" loading={busy}>
          {creating ? 'Create account' : 'Log in'}
        </Button>
      </form>
    </OnboardingShell>
  )
}
