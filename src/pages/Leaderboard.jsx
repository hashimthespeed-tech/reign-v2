import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, font } from '../theme'
import { fmtMoney, fmtPct } from '../lib/portfolio'
import { buildRows, pickRival, computeMovers, pickChampion, isoWeek } from '../lib/leaderboard'
import { generateNarrative } from '../lib/api'
import StudentLayout from '../components/StudentLayout'
import { Card, Spinner } from '../components/ui'

const chg = (n) => (Number(n) > 0 ? colors.green : Number(n) < 0 ? colors.red : colors.textMuted)

export default function Leaderboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [rows, setRows] = useState([])
  const [narrative, setNarrative] = useState(null)
  const [startingBudget, setStartingBudget] = useState(10000)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: pf } = await supabase.from('portfolios').select('class_id').eq('user_id', user.id).maybeSingle()
      const { data: cls } = pf?.class_id ? await supabase.from('classes').select('show_leaderboard, starting_budget').eq('id', pf.class_id).maybeSingle() : { data: null }
      if (cls && cls.show_leaderboard === false) { setHidden(true); setLoading(false); return }
      if (cls) setStartingBudget(Number(cls.starting_budget))

      const { data: raw } = await supabase.rpc('class_leaderboard')
      setRows(buildRows(raw || [], cls?.starting_budget || 10000))

      if (pf?.class_id) {
        // fill this week's class story if it hasn't run yet (idempotent per week), then load latest
        await generateNarrative({ classId: pf.class_id })
        const { data: narr } = await supabase.from('class_narratives')
          .select('*').eq('class_id', pf.class_id).order('narrative_date', { ascending: false }).limit(1).maybeSingle()
        setNarrative(narr || null)
      }
      setLoading(false)
    })()
  }, [user])

  if (loading) return <StudentLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={30} /></div></StudentLayout>
  if (hidden) return <StudentLayout><Card style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Your teacher has hidden the leaderboard for this class.</Card></StudentLayout>

  const me = rows.find((r) => r.userId === user.id)
  const myRank = me?.rank || 0
  const nextUp = myRank > 1 ? rows[myRank - 2] : null
  const gap = nextUp ? nextUp.value - me.value : 0
  const rival = pickRival(rows, user.id, isoWeek())
  const { up, down } = computeMovers(rows)
  const champion = pickChampion(rows)

  return (
    <StudentLayout>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 18 }}>Leaderboard</h1>

      {/* weekly narrative */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: colors.gold, marginBottom: 8 }}>THIS WEEK IN YOUR CLASS</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: narrative ? colors.text : colors.textMuted }}>
          {narrative?.narrative_text || 'Your weekly class story posts here once your teacher runs the week. Keep trading — you might be in it.'}
        </div>
      </Card>

      {/* movers + champion + rival */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
        {champion && (
          <MiniCard title="PREDICTION CHAMPION" accent={colors.gold}>
            <strong>@{champion.username}</strong> — {champion.weekCorrect}/{champion.weekTotal} calls right this week.
          </MiniCard>
        )}
        {(up || down) && (
          <MiniCard title="RANK MOVEMENT">
            {up && <div>@{up.username} climbed {up.delta} spot{up.delta > 1 ? 's' : ''}. </div>}
            {down && <div style={{ color: colors.textMuted }}>@{down.username} slid {Math.abs(down.delta)}.</div>}
            {!up && !down && 'Quiet week. Nobody moved much.'}
          </MiniCard>
        )}
        {rival && (
          <MiniCard title="YOUR RIVAL THIS WEEK" accent={colors.blue}>
            Someone in your class is right on your tail: {fmtMoney(rival.value)} ({fmtPct(rival.weekChangePct)} this week
            {rival.accuracy != null ? `, ${rival.accuracy.toFixed(0)}% accuracy` : ''}). No name. Just beat them.
          </MiniCard>
        )}
      </div>

      {/* rankings */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ color: colors.textFaint, fontSize: 11.5, textAlign: 'left' }}>
              <th style={th}>#</th><th style={th}>Student</th><th style={thR}>Value</th>
              <th style={thR}>Week</th><th style={thR}>Acc.</th><th style={thR}>Streak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isMe = r.userId === user.id
              const top3 = r.rank <= 3
              return (
                <>
                  <tr key={r.userId} style={{
                    borderTop: `1px solid ${colors.border}`,
                    background: isMe ? colors.goldDim : 'transparent',
                  }}>
                    <td style={{ ...td, fontFamily: font.mono, fontWeight: 700, color: top3 ? colors.gold : colors.textMuted }}>
                      {medal(r.rank)}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      @{r.username}{isMe && <span style={{ color: colors.gold, fontSize: 11.5, marginLeft: 8 }}>YOU</span>}
                    </td>
                    <td style={{ ...tdR, fontWeight: 700 }}>{fmtMoney(r.value)}</td>
                    <td style={{ ...tdR, color: chg(r.weekChangeDollars) }}>{r.hasWeekBaseline ? fmtPct(r.weekChangePct) : '—'}</td>
                    <td style={tdR}>{r.accuracy == null ? '—' : `${r.accuracy.toFixed(0)}%`}</td>
                    <td style={tdR}>{r.streak > 0 ? `${r.streak}🔥` : '—'}</td>
                  </tr>
                  {isMe && nextUp && (
                    <tr key={`${r.userId}-gap`} style={{ background: colors.goldDim }}>
                      <td></td>
                      <td colSpan={5} style={{ padding: '0 16px 12px', fontSize: 12.5, color: colors.gold }}>
                        You're {fmtMoney(gap)} behind #{nextUp.rank} (@{nextUp.username}). Close it.
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </Card>

      {/* class vs class (locked) */}
      <Card style={{ padding: 20, marginTop: 18, opacity: 0.65, border: `1px dashed ${colors.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Class vs Class 🔒</div>
            <div style={{ fontSize: 13, color: colors.textFaint, marginTop: 4 }}>
              Unlocks when someone in your class reaches #1 and claims Market Sovereign. Then you compete beyond your classroom.
            </div>
          </div>
        </div>
      </Card>
    </StudentLayout>
  )
}

function medal(rank) {
  return rank === 1 ? '👑' : rank === 2 ? '2' : rank === 3 ? '3' : rank
}

function MiniCard({ title, accent, children }) {
  return (
    <Card style={{ padding: 16, border: `1px solid ${accent ? accent + '55' : colors.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: accent || colors.textMuted, marginBottom: 7 }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{children}</div>
    </Card>
  )
}

const th = { padding: '12px 16px', fontWeight: 600 }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '13px 16px' }
const tdR = { ...td, textAlign: 'right' }
