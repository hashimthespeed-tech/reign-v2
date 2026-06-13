import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, font } from '../theme'
import { Logo, Button, Card, Spinner } from '../components/ui'

// Phase 2 build: class header + functional join-request approval.
// (Full roster, analytics, narratives, CSV come in Phase 5.)
export default function TeacherDashboard() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [cls, setCls] = useState(null)
  const [requests, setRequests] = useState([])
  const [roster, setRoster] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    const { data: classes } = await supabase.from('classes')
      .select('*').eq('teacher_id', user.id)
      .order('created_at', { ascending: true })
    const c = classes?.[0] || null
    setCls(c)
    if (c) {
      const { data: reqs } = await supabase.from('class_requests')
        .select('id, status, created_at, student_id, profiles:student_id (username, full_name)')
        .eq('class_id', c.id).eq('status', 'pending')
        .order('created_at', { ascending: true })
      setRequests(reqs || [])
      const { count } = await supabase.from('class_requests')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', c.id).eq('status', 'approved')
      setRoster(count || 0)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function act(reqId, status) {
    await supabase.from('class_requests').update({ status }).eq('id', reqId)
    setRequests((prev) => prev.filter((r) => r.id !== reqId))
    if (status === 'approved') setRoster((n) => n + 1)
  }

  if (loading) return <CenterSpinner />

  return (
    <div style={{ minHeight: '100vh', fontFamily: font.sans }}>
      <TopBar onSignOut={async () => { await signOut(); navigate('/') }} name={profile?.full_name || profile?.username} />

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 22px 80px' }}>
        {!cls ? (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ color: colors.textMuted, marginBottom: 18 }}>You haven't created a class yet.</p>
            <Button onClick={() => navigate('/onboarding/teacher')}>Create a class</Button>
          </Card>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
              <StatCard label="Class" value={cls.name} />
              <StatCard label="Class code" value={cls.class_code} mono accent />
              <StatCard label="Students enrolled" value={roster} />
              <StatCard label="Starting budget" value={`$${Number(cls.starting_budget).toLocaleString()}`} />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              Join requests {requests.length > 0 && <span style={{ color: colors.gold }}>({requests.length})</span>}
            </h3>
            {requests.length === 0 ? (
              <Card style={{ padding: 24, color: colors.textMuted, fontSize: 14.5 }}>
                No pending requests. Share code <strong style={{ color: colors.gold, fontFamily: font.mono }}>{cls.class_code}</strong> with your students.
              </Card>
            ) : (
              <Card style={{ padding: '6px 18px' }}>
                {requests.map((r) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0', borderBottom: `1px solid ${colors.border}`,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.profiles?.username || 'Student'}</div>
                      <div style={{ fontSize: 12.5, color: colors.textFaint }}>
                        Requested {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="secondary" style={{ padding: '8px 16px', fontSize: 13.5 }}
                        onClick={() => act(r.id, 'rejected')}>Reject</Button>
                      <Button style={{ padding: '8px 16px', fontSize: 13.5 }}
                        onClick={() => act(r.id, 'approved')}>Approve</Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TopBar({ onSignOut, name }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 22px', borderBottom: `1px solid ${colors.border}`,
      position: 'sticky', top: 0, background: 'rgba(6,7,10,0.85)', backdropFilter: 'blur(10px)', zIndex: 10,
    }}>
      <Logo size={17} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 13.5, color: colors.textMuted }}>{name}</span>
        <Button variant="ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  )
}

function StatCard({ label, value, mono, accent }) {
  return (
    <Card style={{ padding: 18, flex: '1 1 180px', minWidth: 160 }}>
      <div style={{ fontSize: 12, color: colors.textFaint, marginBottom: 8, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700,
        fontFamily: mono ? font.mono : font.sans,
        letterSpacing: mono ? '0.1em' : '-0.01em',
        color: accent ? colors.gold : colors.text,
      }}>{value}</div>
    </Card>
  )
}

function CenterSpinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={30} />
    </div>
  )
}
