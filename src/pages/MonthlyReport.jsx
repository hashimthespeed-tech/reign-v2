import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, font } from '../theme'
import { generateMonthly } from '../lib/api'
import { fmtMoney, fmtPct } from '../lib/portfolio'
import { daysInClass } from '../lib/dashboard'
import StudentLayout from '../components/StudentLayout'
import { Card, Spinner } from '../components/ui'

const chg = (n) => (Number(n) > 0 ? colors.green : Number(n) < 0 ? colors.red : colors.textMuted)

export default function MonthlyReport() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [joinDays, setJoinDays] = useState(0)
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data: pf } = await supabase.from('portfolios').select('created_at').eq('user_id', user.id).maybeSingle()
      const jd = daysInClass(pf?.created_at)
      if (cancelled) return
      setJoinDays(jd)
      if (jd < 30) { setLocked(true); setLoading(false); return }
      // generate this month's report if it hasn't run yet (idempotent), then load latest
      await generateMonthly({ userId: user.id })
      const { data: rep } = await supabase.from('monthly_reports')
        .select('*').eq('user_id', user.id).order('report_month', { ascending: false }).limit(1).maybeSingle()
      if (!cancelled) { setReport(rep || null); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <StudentLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={30} /></div></StudentLayout>

  if (locked) {
    return (
      <StudentLayout>
        <BackLink onClick={() => navigate('/dashboard')} />
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
          <h1 style={{ fontFamily: font.display, fontSize: 26, fontWeight: 900, letterSpacing: '-0.025em', marginBottom: 8 }}>Monthly Behavioral Report</h1>
          <div style={{ color: colors.textMuted, fontSize: 14.5, lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
            Your first behavioral report unlocks on <strong style={{ color: colors.gold }}>Day 30</strong>. It exposes the
            investor you actually are — your patterns, your worst trades, and the one thing to fix. {30 - joinDays} day{30 - joinDays === 1 ? '' : 's'} to go.
          </div>
        </Card>
      </StudentLayout>
    )
  }

  const patterns = report?.behavioral_patterns?.patterns || []
  const oneFix = report?.behavioral_patterns?.one_fix
  const predAnalysis = report?.behavioral_patterns?.prediction_analysis
  const scenarios = report?.what_if_scenarios?.scenarios || []
  const monthLabel = report?.report_month
    ? new Date(report.report_month + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''
  const delta = report && report.portfolio_start_value != null && report.portfolio_end_value != null
    ? report.portfolio_end_value - report.portfolio_start_value : null
  const deltaPct = delta != null && report.portfolio_start_value > 0 ? (delta / report.portfolio_start_value) * 100 : null

  return (
    <StudentLayout>
      <BackLink onClick={() => navigate('/dashboard')} />

      {!report ? (
        <Card style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>
          Your report is being assembled — check back after your next few trades and market closes.
        </Card>
      ) : (
        <>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: colors.gold }}>BEHAVIORAL REPORT · {monthLabel.toUpperCase()}</div>
            <h1 style={{ fontFamily: font.display, fontSize: 27, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.25, marginTop: 8 }}>{report.report_text}</h1>
            {delta != null && (
              <div style={{ marginTop: 10, fontSize: 14, color: colors.textMuted }}>
                Portfolio this month: {fmtMoney(report.portfolio_start_value)} → {fmtMoney(report.portfolio_end_value)}{' '}
                <span style={{ color: chg(delta), fontWeight: 700 }}>
                  ({delta >= 0 ? '+' : ''}{fmtMoney(delta)}{deltaPct != null ? `, ${fmtPct(deltaPct)}` : ''})
                </span>
              </div>
            )}
          </div>

          {/* behavioral pattern cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 18 }}>
            {patterns.map((p, i) => (
              <Card key={i} style={{ padding: 18 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 13.5, color: colors.textMuted, lineHeight: 1.5 }}>{p.evidence}</div>
              </Card>
            ))}
          </div>

          {/* what if */}
          {scenarios.length > 0 && (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>What If</h3>
              <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
                {scenarios.map((s, i) => (
                  <Card key={i} style={{ padding: 18, border: `1px solid ${colors.borderStrong}` }}>
                    <div style={{ fontSize: 13.5, color: colors.text, lineHeight: 1.5 }}>{s.summary}</div>
                    <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${colors.border}`, fontSize: 13.5, color: colors.blue, lineHeight: 1.5 }}>
                      → {s.alternative}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* prediction analysis */}
          {(predAnalysis || report.prediction_accuracy != null) && (
            <Card style={{ padding: 18, marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', color: colors.textMuted, marginBottom: 6 }}>
                PREDICTIONS{report.prediction_accuracy != null ? ` · ${report.prediction_accuracy.toFixed(0)}% ACCURATE` : ''}
              </div>
              {predAnalysis && <div style={{ fontSize: 14, color: colors.text, lineHeight: 1.55 }}>{predAnalysis}</div>}
            </Card>
          )}

          {/* one thing to fix */}
          {oneFix && (
            <Card glow style={{ padding: 20, border: `1px solid ${colors.gold}`, background: colors.goldDim }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: colors.gold, marginBottom: 8 }}>FIX THIS NEXT MONTH</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, lineHeight: 1.5 }}>{oneFix}</div>
            </Card>
          )}
        </>
      )}
    </StudentLayout>
  )
}

function BackLink({ onClick }) {
  return (
    <button onClick={onClick} style={{ color: colors.textMuted, fontSize: 13.5, marginBottom: 16, fontFamily: font.sans }}>
      ← Back to dashboard
    </button>
  )
}
