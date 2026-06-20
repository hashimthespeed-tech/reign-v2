import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { font } from '../theme'
import { dark as colors, Logo, Button, Field, Input, OnboardingShell } from './onboarding/darkUi'

// Standalone login page for returning users.
// Matches the dark plexus design system used by the onboarding shells.
export default function Login() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // After a successful sign-in we don't navigate immediately — the auth context
  // (session + profile) updates asynchronously via onAuthStateChange, and the
  // route guards read from it. Navigating too early makes StudentRoute bounce to
  // /onboarding before the profile has loaded. So we stash the intent here and
  // let the effect below navigate once the context has actually caught up.
  const [pending, setPending] = useState(null) // { role: 'teacher'|'student', hasProfile: bool }

  useEffect(() => {
    if (!pending || !user) return
    // For students we must wait until the loaded profile matches this user, so
    // StudentRoute can see class_id. Teachers' guard only needs the user.
    if (pending.hasProfile && (!profile || profile.id !== user.id)) return
    if (pending.role === 'teacher') navigate('/teacher', { replace: true })
    else if (pending.hasProfile) navigate('/dashboard', { replace: true })
    else navigate('/onboarding', { replace: true }) // signed in but no profile yet
  }, [pending, user, profile, navigate])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err || !data?.user) {
      setBusy(false)
      return setError('Incorrect email or password.')
    }

    // Detect teacher vs student the same way onboarding does — read
    // profiles.investor_type — then route to the right home.
    const { data: prof } = await supabase
      .from('profiles')
      .select('investor_type')
      .eq('id', data.user.id)
      .maybeSingle()

    setPending({ role: prof?.investor_type === 'teacher' ? 'teacher' : 'student', hasProfile: !!prof })
    // keep `busy` true — the effect navigates as soon as the context catches up.
  }

  return (
    <OnboardingShell>
      <div style={{ marginBottom: 26 }}><Logo size={18} /></div>
      <h2 style={{ fontFamily: font.display, fontWeight: 900, letterSpacing: '-0.03em', fontSize: 28, marginBottom: 6 }}>
        Welcome back
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 24 }}>Log in to your Reign account.</p>

      <form onSubmit={submit}>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        {error && (
          <div style={{ color: colors.red, fontSize: 13.5, marginBottom: 14 }}>{error}</div>
        )}
        <Button full type="submit" loading={busy}>Log in</Button>
      </form>

      <div style={{
        marginTop: 22, display: 'flex', justifyContent: 'space-between',
        fontSize: 13.5, color: colors.textMuted,
      }}>
        <Link to="/onboarding/teacher" style={{ color: colors.goldSoft, textDecoration: 'none', fontWeight: 600 }}>
          Create account
        </Link>
        <Link to="/" style={{ color: colors.textMuted, textDecoration: 'none' }}>
          ← Back to landing
        </Link>
      </div>
    </OnboardingShell>
  )
}
