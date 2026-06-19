import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, font } from '../theme'
import { getQuotes, askGroq } from '../lib/api'
import { computePortfolio, fmtMoney, fmtPct } from '../lib/portfolio'
import { nowET } from '../lib/market'
import { Logo, Button, Card, Spinner, Toggle, Input } from '../components/ui'
import PlexusBackground from '../components/PlexusBackground'

const chg = (n) => (Number(n) > 0 ? colors.green : Number(n) < 0 ? colors.red : colors.textMuted)
const flagsKey = (cid) => `reign_flags_${cid}`

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [classes, setClasses] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [requests, setRequests] = useState([])
  const [roster, setRoster] = useState([])      // [{ user_id, username, joined, lastActive, value, returnPct, rank, accuracy, predToday }]
  const [narrative, setNarrative] = useState(null)
  const [loading, setLoading] = useState(true)
  const [genBusy, setGenBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [flags, setFlags] = useState([])

  const activeClass = classes.find((c) => c.id === activeId) || null

  // load teacher's classes
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase.from('classes').select('*').eq('teacher_id', user.id).order('created_at')
      setClasses(data || [])
      setActiveId((prev) => prev || data?.[0]?.id || null)
      if (!data?.length) setLoading(false)
    })()
  }, [user])

  const loadClass = useCallback(async (cls) => {
    if (!cls) return
    setLoading(true)
    setFlags(JSON.parse(localStorage.getItem(flagsKey(cls.id)) || '[]'))

    // pending requests
    const { data: reqs } = await supabase.from('class_requests')
      .select('id, created_at, student_id, profiles:student_id (username)')
      .eq('class_id', cls.id).eq('status', 'pending').order('created_at')
    setRequests(reqs || [])

    // approved roster: portfolios + profile + holdings
    const { data: portfolios } = await supabase.from('portfolios')
      .select('id, user_id, cash_balance, last_value_at, profiles:user_id (username, created_at)')
      .eq('class_id', cls.id)
    const pfList = portfolios || []
    const pfIds = pfList.map((p) => p.id)
    const { data: holdings } = pfIds.length
      ? await supabase.from('holdings').select('*').in('portfolio_id', pfIds)
      : { data: [] }

    // predictions for accuracy / today
    const { data: preds } = await supabase.from('predictions')
      .select('user_id, result, prediction_date').eq('class_id', cls.id)
    const today = nowET().dateStr
    const predByUser = {}
    for (const pr of preds || []) {
      const u = (predByUser[pr.user_id] ||= { total: 0, correct: 0, today: false })
      if (pr.result) { u.total++; if (pr.result === 'correct') u.correct++ }
      if (pr.prediction_date === today) u.today = true
    }

    // live quotes for all held tickers
    const tickers = [...new Set((holdings || []).map((h) => (h.ticker || '').toUpperCase()))]
    const quotes = tickers.length ? await getQuotes(tickers) : {}
    const byPortfolio = {}
    for (const h of holdings || []) (byPortfolio[h.portfolio_id] ||= []).push(h)

    let rows = pfList.map((p) => {
      const comp = computePortfolio({ cashBalance: p.cash_balance, holdings: byPortfolio[p.id] || [], quotes })
      const pu = predByUser[p.user_id] || { total: 0, correct: 0, today: false }
      return {
        user_id: p.user_id,
        username: p.profiles?.username || 'Student',
        joined: p.profiles?.created_at,
        lastActive: p.last_value_at,
        value: comp.totalValue,
        returnPct: ((comp.totalValue - cls.starting_budget) / cls.starting_budget) * 100,
        accuracy: pu.total ? (pu.correct / pu.total) * 100 : null,
        predToday: pu.today,
      }
    })
    rows.sort((a, b) => b.value - a.value)
    rows = rows.map((r, i) => ({ ...r, rank: i + 1 }))
    setRoster(rows)

    // latest narrative
    const { data: narr } = await supabase.from('class_narratives')
      .select('*').eq('class_id', cls.id).order('narrative_date', { ascending: false }).limit(1).maybeSingle()
    setNarrative(narr || null)

    setLoading(false)
  }, [])

  useEffect(() => { if (activeClass) loadClass(activeClass) }, [activeId, classes.length]) // eslint-disable-line

  async function act(reqId, status) {
    await supabase.from('class_requests').update({ status }).eq('id', reqId)
    setRequests((prev) => prev.filter((r) => r.id !== reqId))
  }

  function toggleFlag(uid) {
    setFlags((prev) => {
      const next = prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
      localStorage.setItem(flagsKey(activeClass.id), JSON.stringify(next))
      return next
    })
  }

  async function generateNarrative() {
    if (!roster.length) return
    setGenBusy(true)
    try {
      const top = roster.slice(0, 3).map((r) => `${r.username} (#${r.rank}, ${fmtPct(r.returnPct)})`)
      const bottom = roster.slice(-2).map((r) => `${r.username} (#${r.rank}, ${fmtPct(r.returnPct)})`)
      const system = "You are Reign, an investing coach speaking to a teacher about their class. Direct, sharp, no fluff, no exclamation marks, no corporate language. Reference students by name. 2-4 sentences. Plain language a 16-year-old would respect."
      const prompt = `Write this week's class narrative.\nClass: ${activeClass.name}, ${roster.length} students.\nTop: ${top.join('; ')}.\nStrugglers: ${bottom.join('; ')}.\nClass average return: ${fmtPct(avgReturn(roster))}.\nSummarize the week's dynamic and name names.`
      const { text } = await askGroq({ system, prompt, temperature: 0.8, max_tokens: 220 })
      const narrative_date = nowET().dateStr
      const { data } = await supabase.from('class_narratives')
        .upsert({ class_id: activeClass.id, narrative_date, narrative_text: text }, { onConflict: 'class_id,narrative_date' })
        .select().single()
      setNarrative(data || { narrative_text: text, narrative_date })
    } catch (e) {
      alert('Narrative generation failed: ' + e.message)
    } finally {
      setGenBusy(false)
    }
  }

  function downloadCSV() {
    const header = ['Rank', 'Username', 'Portfolio Value', 'Return %', 'Prediction Accuracy %', 'Predicted Today', 'Last Active']
    const lines = roster.map((r) => [
      r.rank, r.username, r.value.toFixed(2), r.returnPct.toFixed(2),
      r.accuracy == null ? '' : r.accuracy.toFixed(1), r.predToday ? 'yes' : 'no',
      r.lastActive ? new Date(r.lastActive).toISOString().slice(0, 10) : '',
    ])
    const csv = [header, ...lines].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${activeClass.name.replace(/\W+/g, '_')}_report.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ---------- render ----------
  if (loading && !classes.length) return <CenterSpinner signOut={async () => { await signOut(); navigate('/') }} name={profile?.full_name} />

  const enrolled = roster.length
  const predToday = roster.filter((r) => r.predToday).length
  const weekAcc = weekAccuracy(roster)
  const inactive = roster.filter((r) => daysSince(r.lastActive) >= 3)

  return (
    <div style={{ minHeight: '100vh', fontFamily: font.sans, position: 'relative' }}>
      <PlexusBackground />
      <TopBar name={profile?.full_name || profile?.username}
        onSignOut={async () => { await signOut(); navigate('/') }}
        onNewClass={() => navigate('/onboarding/teacher')} />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 22px 80px', position: 'relative', zIndex: 1 }}>
        {!activeClass ? (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ color: colors.textMuted, marginBottom: 18 }}>You haven't created a class yet.</p>
            <Button onClick={() => navigate('/onboarding/teacher')}>Create a class</Button>
          </Card>
        ) : (
          <>
            {/* class selector + title */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <div style={{ flex: 1 }}>
                {classes.length > 1 && (
                  <select value={activeId} onChange={(e) => setActiveId(e.target.value)}
                    style={{ background: colors.bgRaised, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, marginBottom: 8 }}>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <h1 style={{ fontFamily: font.display, fontSize: 30, fontWeight: 900, letterSpacing: '-0.025em' }}>{activeClass.name}</h1>
              </div>
              <Button variant="secondary" style={{ fontSize: 13.5, padding: '9px 16px' }} onClick={downloadCSV}>Download report (CSV)</Button>
            </div>

            {/* stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
              <Stat label="Class code" value={activeClass.class_code} mono accent />
              <Stat label="Students enrolled" value={enrolled} />
              <Stat label="Class avg return" value={fmtPct(avgReturn(roster))} color={chg(avgReturn(roster))} />
              <Stat label="Predicted today" value={`${predToday} of ${enrolled}`} />
              <Stat label="Week accuracy" value={weekAcc == null ? '—' : `${weekAcc.toFixed(0)}%`} />
            </div>

            {/* needs attention */}
            {inactive.length > 0 && (
              <Card style={{ padding: 16, marginBottom: 18, border: `1px solid ${colors.redDim}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.red, letterSpacing: '0.08em', marginBottom: 6 }}>NEEDS ATTENTION</div>
                <div style={{ fontSize: 14 }}>
                  {inactive.map((r) => r.username).join(', ')} {inactive.length === 1 ? 'has' : 'have'} not been active in 3+ days.
                </div>
              </Card>
            )}

            {/* pending requests */}
            {requests.length > 0 && (
              <Card style={{ padding: '6px 18px', marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.gold, padding: '12px 0 4px' }}>
                  Join requests ({requests.length})
                </div>
                {requests.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: `1px solid ${colors.border}` }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.profiles?.username || 'Student'}</div>
                      <div style={{ fontSize: 12.5, color: colors.textFaint }}>Requested {new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="secondary" style={{ padding: '8px 16px', fontSize: 13.5 }} onClick={() => act(r.id, 'rejected')}>Reject</Button>
                      <Button style={{ padding: '8px 16px', fontSize: 13.5 }} onClick={() => act(r.id, 'approved')}>Approve</Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* weekly narrative */}
            <Card style={{ padding: 20, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: colors.gold }}>THIS WEEK IN YOUR CLASS</span>
                <Button variant="secondary" loading={genBusy} disabled={!roster.length}
                  style={{ padding: '7px 14px', fontSize: 13 }} onClick={generateNarrative}>
                  {narrative ? 'Regenerate' : 'Generate'}
                </Button>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: narrative ? colors.text : colors.textMuted }}>
                {narrative?.narrative_text || 'Generate an AI summary of how your class is doing this week — written in plain language, naming names.'}
              </div>
            </Card>

            {/* roster */}
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Roster</h3>
            {roster.length === 0 ? (
              <Card style={{ padding: 24, color: colors.textMuted, fontSize: 14.5 }}>
                No students yet. Share code <strong style={{ color: colors.gold, fontFamily: font.mono }}>{activeClass.class_code}</strong>.
              </Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <RosterTable roster={roster} flags={flags} onFlag={toggleFlag} />
              </Card>
            )}

            {/* settings summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Class settings</h3>
              <Button variant="secondary" style={{ padding: '8px 16px', fontSize: 13.5 }} onClick={() => setEditOpen(true)}>Edit</Button>
            </div>
            <Card style={{ padding: 18, marginTop: 12 }}>
              <SettingRow label="Daily predictions" on={activeClass.require_predictions} />
              <SettingRow label="Leaderboard visible" on={activeClass.show_leaderboard} />
              <SettingRow label="Short selling" on={activeClass.allow_short_selling} />
              <SettingRow label="Thesis required" on={activeClass.thesis_required} />
              <SettingRow label="Real money option" on={activeClass.show_real_money} last />
            </Card>
          </>
        )}
      </div>

      {editOpen && activeClass && (
        <EditSettingsModal cls={activeClass} onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setClasses((prev) => prev.map((c) => c.id === updated.id ? updated : c))
            setEditOpen(false)
          }} />
      )}
    </div>
  )
}

// ---------- metrics helpers ----------
function avgReturn(roster) { return roster.length ? roster.reduce((s, r) => s + r.returnPct, 0) / roster.length : 0 }
function weekAccuracy(roster) {
  const withAcc = roster.filter((r) => r.accuracy != null)
  return withAcc.length ? withAcc.reduce((s, r) => s + r.accuracy, 0) / withAcc.length : null
}
function daysSince(ts) { return ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000) : 999 }
function lastActiveLabel(ts) {
  if (!ts) return 'never'
  const d = daysSince(ts)
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`
}

// ---------- components ----------
function RosterTable({ roster, flags, onFlag }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ color: colors.textFaint, fontSize: 12, textAlign: 'left' }}>
          <th style={th}>#</th><th style={th}>Student</th><th style={thR}>Value</th>
          <th style={thR}>Return</th><th style={thR}>Pred. acc.</th><th style={thR}>Active</th><th style={thR}>Flag</th>
        </tr>
      </thead>
      <tbody>
        {roster.map((r) => (
          <tr key={r.user_id} style={{ borderTop: `1px solid ${colors.border}` }}>
            <td style={{ ...td, fontFamily: font.mono, color: r.rank <= 3 ? colors.gold : colors.textMuted }}>{r.rank}</td>
            <td style={{ ...td, fontWeight: 600 }}>@{r.username}</td>
            <td style={tdR}>{fmtMoney(r.value)}</td>
            <td style={{ ...tdR, color: chg(r.returnPct) }}>{fmtPct(r.returnPct)}</td>
            <td style={tdR}>{r.accuracy == null ? '—' : `${r.accuracy.toFixed(0)}%`}</td>
            <td style={{ ...tdR, color: daysSince(r.lastActive) >= 3 ? colors.red : colors.textMuted }}>{lastActiveLabel(r.lastActive)}</td>
            <td style={tdR}>
              <button onClick={() => onFlag(r.user_id)} title="Flag for follow-up"
                style={{ fontSize: 15, opacity: flags.includes(r.user_id) ? 1 : 0.3 }}>
                {flags.includes(r.user_id) ? '🚩' : '⚐'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
const th = { padding: '12px 16px', fontWeight: 600 }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '13px 16px' }
const tdR = { ...td, textAlign: 'right' }

function Stat({ label, value, mono, accent, color }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11.5, color: colors.textFaint, marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: mono ? font.mono : font.sans, letterSpacing: mono ? '0.08em' : '-0.01em', color: color || (accent ? colors.gold : colors.text) }}>{value}</div>
    </Card>
  )
}

function SettingRow({ label, on, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${colors.border}`, fontSize: 14 }}>
      <span style={{ color: colors.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600, color: on ? colors.green : colors.textFaint }}>{on ? 'On' : 'Off'}</span>
    </div>
  )
}

function EditSettingsModal({ cls, onClose, onSaved }) {
  const [name, setName] = useState(cls.name)
  const [s, setS] = useState({
    require_predictions: cls.require_predictions, show_leaderboard: cls.show_leaderboard,
    allow_short_selling: cls.allow_short_selling, thesis_required: cls.thesis_required,
    show_real_money: cls.show_real_money,
  })
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const { data, error } = await supabase.from('classes').update({ name, ...s }).eq('id', cls.id).select().single()
    setBusy(false)
    if (error) return alert('Save failed: ' + error.message)
    onSaved(data)
  }

  const items = [
    ['require_predictions', 'Require daily predictions'],
    ['show_leaderboard', 'Show class leaderboard'],
    ['allow_short_selling', 'Allow short selling'],
    ['thesis_required', 'Thesis required to buy'],
    ['show_real_money', 'Show real money option'],
  ]
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460 }}>
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16 }}>Class settings</h3>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 7 }}>Class name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 8 }} />
          {items.map(([k, label]) => (
            <Toggle key={k} label={label} checked={s[k]} onChange={(v) => setS({ ...s, [k]: v })} />
          ))}
          <div style={{ fontSize: 12, color: colors.textFaint, margin: '12px 0' }}>
            Starting budget can't change after students have joined.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button variant="secondary" full onClick={onClose}>Cancel</Button>
            <Button full loading={busy} onClick={save}>Save</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function TopBar({ onSignOut, onNewClass, name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: `1px solid ${colors.border}`, position: 'sticky', top: 0, background: 'rgba(5,5,7,0.72)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', zIndex: 30 }}>
      <Logo size={17} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Button variant="ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={onNewClass}>+ New class</Button>
        <span style={{ fontSize: 13.5, color: colors.textMuted }}>{name}</span>
        <Button variant="ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  )
}

function CenterSpinner({ signOut, name }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={30} /></div>
}
