import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { colors, font, radius, shadow } from '../theme'

const TABLES = [
  'profiles', 'classes', 'class_requests', 'portfolios', 'holdings',
  'predictions', 'trades', 'daily_reports', 'monthly_reports',
  'concepts', 'student_concepts', 'unlocks', 'class_narratives',
]

function StatusDot({ state }) {
  const map = { ok: colors.green, fail: colors.red, pending: colors.textFaint }
  return (
    <span style={{
      width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
      background: map[state] || colors.textFaint,
      boxShadow: state === 'ok' ? `0 0 10px ${colors.green}` : 'none',
      animation: state === 'pending' ? 'reign-pulse 1.1s ease-in-out infinite' : 'none',
    }} />
  )
}

function Row({ label, hint, state }) {
  return (
    <div style={{
      padding: '16px 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`,
    }}>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 2 }}>{hint}</div>
      </div>
      <StatusDot state={state} />
    </div>
  )
}

export default function SystemCheck() {
  const [env, setEnv] = useState('pending')
  const [authState, setAuthState] = useState('pending')
  const [tableStates, setTableStates] = useState(
    Object.fromEntries(TABLES.map((t) => [t, 'pending']))
  )

  useEffect(() => {
    const hasEnv = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY
    setEnv(hasEnv ? 'ok' : 'fail')

    supabase.auth.getSession()
      .then(({ error }) => setAuthState(error ? 'fail' : 'ok'))
      .catch(() => setAuthState('fail'))

    ;(async () => {
      const { data, error } = await supabase.rpc('reign_health_check', { table_names: TABLES })
      if (error || !data) {
        setTableStates(Object.fromEntries(TABLES.map((t) => [t, 'fail'])))
        return
      }
      const byName = Object.fromEntries(data.map((r) => [r.name, r.present]))
      setTableStates(Object.fromEntries(TABLES.map((t) => [t, byName[t] ? 'ok' : 'fail'])))
    })()
  }, [])

  const tablesOk = Object.values(tableStates).filter((s) => s === 'ok').length

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '48px 20px', fontFamily: font.sans,
    }}>
      <div style={{ animation: 'reign-fade-up 0.6s ease both', textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontFamily: font.mono, letterSpacing: '0.5em', fontSize: 13, color: colors.gold, marginBottom: 14, paddingLeft: '0.5em' }}>
          R E I G N
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>System Check</h1>
        <p style={{ color: colors.textMuted, marginTop: 8, fontSize: 15 }}>Infrastructure verification</p>
      </div>

      <div style={{
        width: '100%', maxWidth: 520, background: colors.bgElevated,
        border: `1px solid ${colors.border}`, borderRadius: radius.lg,
        boxShadow: shadow.card, overflow: 'hidden', animation: 'reign-fade-up 0.6s 0.1s ease both',
      }}>
        <Row label="Environment variables" hint="VITE_SUPABASE_URL + anon key" state={env} />
        <Row label="Supabase auth" hint="auth endpoint reachable" state={authState} />
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Database tables</span>
          <span style={{ fontFamily: font.mono, fontSize: 13, color: tablesOk === TABLES.length ? colors.green : colors.textMuted }}>
            {tablesOk}/{TABLES.length}
          </span>
        </div>
        <div style={{ padding: '4px 20px 14px' }}>
          {TABLES.map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13.5 }}>
              <StatusDot state={tableStates[t]} />
              <span style={{ fontFamily: font.mono, color: colors.textMuted }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
