import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { colors, font } from '../theme'
import { Logo, Button, Card, Spinner } from '../components/ui'

// Phase 2 placeholder shell. Full dashboard (prediction, report, charts) = Phase 4.
export default function StudentDashboard() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [portfolio, setPortfolio] = useState(null)
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: pf } = await supabase.from('portfolios')
        .select('*').eq('user_id', user.id).maybeSingle()
      setPortfolio(pf)
      if (pf?.class_id) {
        const { data: cls } = await supabase.from('classes')
          .select('name').eq('id', pf.class_id).maybeSingle()
        setClassName(cls?.name || '')
      }
      setLoading(false)
    })()
  }, [user])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={30} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: font.sans }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 22px', borderBottom: `1px solid ${colors.border}`,
      }}>
        <Logo size={17} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13.5, color: colors.textMuted }}>@{profile?.username}</span>
          <Button variant="ghost" style={{ padding: '7px 12px', fontSize: 13 }}
            onClick={async () => { await signOut(); navigate('/') }}>Sign out</Button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 22px' }}>
        <div style={{ fontSize: 13, color: colors.textFaint, letterSpacing: '0.04em' }}>
          {className || 'Your class'}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4, marginBottom: 24 }}>
          Welcome, @{profile?.username}
        </h1>

        <Card style={{ padding: 26 }}>
          <div style={{ fontSize: 12.5, color: colors.textFaint, marginBottom: 8 }}>CASH AVAILABLE</div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em' }}>
            ${Number(portfolio?.cash_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ color: colors.textMuted, marginTop: 16, fontSize: 14.5, lineHeight: 1.5 }}>
            You're in. The full dashboard — live portfolio, daily predictions, your AI report and class rank —
            arrives in the next build phase.
          </div>
        </Card>
      </div>
    </div>
  )
}
