import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { colors, font, radius } from '../theme'
import { Logo, Button, Input, Spinner } from '../components/ui'

// Placeholder landing (full extraordinary build = Phase 15).
// Logged-in users are routed straight to where they belong.
export default function Entry() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const [code, setCode] = useState('')

  useEffect(() => {
    if (loading) return
    if (user && profile) {
      if (profile.investor_type === 'teacher') navigate('/teacher', { replace: true })
      else if (profile.class_id) navigate('/dashboard', { replace: true })
    }
  }, [user, profile, loading, navigate])

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={30} /></div>
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 22px',
      fontFamily: font.sans, textAlign: 'center',
    }}>
      <div style={{ animation: 'reign-fade-up 0.5s ease both', maxWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <Logo size={26} />
        </div>
        <h1 style={{ fontSize: 'clamp(34px, 6vw, 52px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
          The market is a game.<br />Win your class.
        </h1>
        <p style={{ color: colors.textMuted, fontSize: 17, lineHeight: 1.55, marginTop: 18, maxWidth: 460, marginInline: 'auto' }}>
          Real stocks. Real data. No real money. Reign turns investing into the most competitive thing in your classroom.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
          <Button onClick={() => navigate('/onboarding')}>Join your class</Button>
          <Button variant="secondary" onClick={() => navigate('/onboarding/teacher')}>Create a class</Button>
        </div>

        <div style={{
          marginTop: 44, padding: 20, maxWidth: 380, marginInline: 'auto',
          background: colors.bgElevated, border: `1px solid ${colors.border}`, borderRadius: radius.lg,
        }}>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12 }}>Have a class code?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={code} maxLength={6} placeholder="ABC123"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ fontFamily: font.mono, letterSpacing: '0.15em', textAlign: 'center' }} />
            <Button disabled={code.length < 6}
              onClick={() => navigate(`/onboarding?code=${code}`)}>Join</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
