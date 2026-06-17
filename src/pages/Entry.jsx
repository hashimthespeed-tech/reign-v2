import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from '../components/ui'
import NetworkVistaPage from '../components/landing/NetworkVistaPage'
import { useLandingData } from '../hooks/useLandingData'

// Phase 15 landing — the "Network Vista" page (Antigravity export).
// Logged-in users are routed straight to where they belong.
//
// LIVE DATA: stocks / chartPoints / primaryStockId come from real Finnhub data
// via the existing market proxy (useLandingData → api.js → Netlify functions).
// portfolioValue / portfolioDirection are fixed illustrative placeholders for now
// (no real classroom usage on the public landing — decided in .decisions.md).
const PLACEHOLDER_PORTFOLIO_VALUE = 10240.5
const PLACEHOLDER_PORTFOLIO_DIRECTION = 'up'

export default function Entry() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const { stocks, chartPoints, primaryStockId } = useLandingData()

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
    <NetworkVistaPage
      portfolioValue={PLACEHOLDER_PORTFOLIO_VALUE}
      portfolioDirection={PLACEHOLDER_PORTFOLIO_DIRECTION}
      stocks={stocks}
      chartPoints={chartPoints}
      primaryStockId={primaryStockId}
      onJoin={() => navigate('/onboarding')}
      onCreateClass={() => navigate('/onboarding/teacher')}
    />
  )
}
