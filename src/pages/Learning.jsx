import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, font } from '../theme'
import { conceptTieIn } from '../lib/api'
import { daysInClass } from '../lib/dashboard'
import { STAGES, stageForStudent, conceptUnlocked, readTime, pickTodayConcept, vaultItems } from '../lib/learning'
import StudentLayout from '../components/StudentLayout'
import { Card, Spinner, Input } from '../components/ui'

const CATEGORY_LABEL = { basics: 'Basics', strategy: 'Strategy', psychology: 'Psychology', macro: 'Macro', analysis: 'Analysis' }

export default function Learning() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [concepts, setConcepts] = useState([])
  const [completed, setCompleted] = useState(new Set())
  const [progress, setProgress] = useState({ daysInClass: 0, tradeCount: 0, rank: 0 })
  const [today, setToday] = useState(null) // { concept, tieIn }
  const [reader, setReader] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data: list } = await supabase.from('concepts').select('*').order('unlock_requirement')
      const { data: sc } = await supabase.from('student_concepts').select('concept_id, completed_at').eq('user_id', user.id)
      const { data: pf } = await supabase.from('portfolios').select('id, created_at').eq('user_id', user.id).maybeSingle()
      const { count: tradeCount } = await supabase.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      const { data: standings } = await supabase.rpc('class_standings')
      const rank = (standings || []).findIndex((s) => s.user_id === user.id) + 1
      if (cancelled) return

      const prog = { daysInClass: daysInClass(pf?.created_at), tradeCount: tradeCount || 0, rank }
      const all = list || []
      setConcepts(all)
      setCompleted(new Set((sc || []).filter((r) => r.completed_at).map((r) => r.concept_id)))
      setProgress(prog)
      setLoading(false)

      // Today's Concept: deterministic daily pick from the unlocked set + cached AI tie-in.
      const unlocked = all.filter((c) => conceptUnlocked(c.unlock_requirement, prog))
      const pick = pickTodayConcept(unlocked)
      if (pick) {
        const dateKey = new Date().toISOString().slice(0, 10)
        const cacheKey = `reign_today_${dateKey}_${pick.name}`
        let tieIn = ''
        try { tieIn = localStorage.getItem(cacheKey) || '' } catch { /* */ }
        if (!cancelled) setToday({ concept: pick, tieIn })
        if (!tieIn) {
          const { data: hs } = pf?.id ? await supabase.from('holdings').select('ticker, shares').eq('portfolio_id', pf.id) : { data: [] }
          const tickers = (hs || []).filter((h) => Number(h.shares) > 0).map((h) => (h.ticker || '').toUpperCase())
          try {
            const line = await conceptTieIn(pick, tickers)
            if (line) { try { localStorage.setItem(cacheKey, line) } catch { /* */ }; if (!cancelled) setToday({ concept: pick, tieIn: line }) }
          } catch { /* leave hook only */ }
        }
      }
    })()
    return () => { cancelled = true }
  }, [user])

  async function markComplete(concept) {
    await supabase.from('student_concepts').upsert(
      { user_id: user.id, concept_id: concept.id, unlocked_at: new Date().toISOString(), completed_at: new Date().toISOString() },
      { onConflict: 'user_id,concept_id' }
    )
    setCompleted((prev) => new Set(prev).add(concept.id))
  }

  if (loading) return <StudentLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={30} /></div></StudentLayout>

  const stageIdx = stageForStudent(progress)
  const filtered = concepts.filter((c) => {
    const t = q.trim().toLowerCase()
    return !t || c.plain_english_name?.toLowerCase().includes(t) || c.hook?.toLowerCase().includes(t) || c.name?.toLowerCase().includes(t)
  })

  return (
    <StudentLayout>
      <h1 style={{ fontFamily: font.display, fontSize: 30, fontWeight: 900, letterSpacing: '-0.025em', marginBottom: 18 }}>Learning</h1>

      {/* progress path */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: colors.textMuted, marginBottom: 14 }}>YOUR PATH</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STAGES.map((s, i) => {
            const done = i < stageIdx, current = i === stageIdx
            return (
              <div key={s.key} style={{ flex: '1 1 120px', padding: 12, borderRadius: radius.sm,
                background: current ? colors.goldDim : 'transparent',
                border: `1px solid ${current ? colors.gold : done ? colors.greenDim : colors.border}`, opacity: i > stageIdx ? 0.55 : 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: current ? colors.gold : colors.text }}>
                  {done ? '✓ ' : ''}{s.name}
                </div>
                <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 3 }}>{current ? 'You are here' : s.req}</div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* today's concept */}
      {today && (
        <Card style={{ padding: 20, marginBottom: 16, cursor: conceptUnlocked(today.concept.unlock_requirement, progress) ? 'pointer' : 'default' }}
          onClick={() => conceptUnlocked(today.concept.unlock_requirement, progress) && setReader(today.concept)}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: colors.gold, marginBottom: 8 }}>TODAY'S CONCEPT</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{today.concept.plain_english_name}</div>
          <div style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.55, marginTop: 6 }}>
            {today.tieIn || today.concept.hook}
          </div>
        </Card>
      )}

      {/* search */}
      <div style={{ marginBottom: 14 }}>
        <Input placeholder="Search the arsenal…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* arsenal grid */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>The Arsenal</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
        {filtered.map((c) => {
          const unlocked = conceptUnlocked(c.unlock_requirement, progress)
          const done = completed.has(c.id)
          return (
            <Card key={c.id} onClick={() => unlocked && setReader(c)}
              style={{ padding: 16, opacity: unlocked ? 1 : 0.55, cursor: unlocked ? 'pointer' : 'default',
                border: `1px solid ${done ? colors.greenDim : unlocked ? colors.border : colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: colors.textFaint }}>{CATEGORY_LABEL[c.category] || c.category}</span>
                <span style={{ fontSize: 13 }}>{done ? '✓' : unlocked ? '' : '🔒'}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.plain_english_name}</div>
              <div style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.45, marginTop: 5 }}>{c.hook}</div>
              <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 8 }}>
                {unlocked ? `${readTime(c.content)} min read${done ? ' · completed' : ''}` : reqLabel(c.unlock_requirement)}
              </div>
            </Card>
          )
        })}
      </div>

      {/* unlock vault */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>The Vault</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {vaultItems(progress).map((it) => (
          <Card key={it.name} style={{ padding: 16, opacity: it.met ? 1 : 0.62, border: `1px solid ${it.met ? colors.goldDim : colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{it.name}</span>
              <span style={{ fontSize: 15 }}>{it.met ? '✓' : '🔒'}</span>
            </div>
            <div style={{ fontSize: 12.5, color: colors.textFaint, lineHeight: 1.4 }}>{it.desc}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: it.met ? colors.green : colors.gold, marginTop: 8 }}>
              {it.met ? 'UNLOCKED' : it.req}
            </div>
          </Card>
        ))}
      </div>

      {reader && (
        <ConceptReader concept={reader} done={completed.has(reader.id)}
          onComplete={() => markComplete(reader)} onClose={() => setReader(null)} />
      )}
    </StudentLayout>
  )
}

function reqLabel(req) {
  return { day_10: 'Unlocks at Day 10', day_30: 'Unlocks at Day 30', rank_1: 'Unlocks at Rank #1' }[req] || 'Locked'
}

function ConceptReader({ concept, done, onComplete, onClose }) {
  const paras = (concept.content || '').split(/\n\n+/).filter(Boolean)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, zIndex: 80, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 600, marginTop: 40 }}>
        <Card style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: colors.gold }}>{(CATEGORY_LABEL[concept.category] || concept.category).toUpperCase()} · {readTime(concept.content)} MIN</div>
              <h2 style={{ fontFamily: font.display, fontSize: 26, fontWeight: 900, letterSpacing: '-0.025em', marginTop: 6 }}>{concept.plain_english_name}</h2>
            </div>
            <button onClick={onClose} style={{ fontSize: 22, color: colors.textFaint }}>×</button>
          </div>
          <div style={{ fontSize: 14, color: colors.gold, marginTop: 4, fontStyle: 'italic' }}>{concept.hook}</div>
          <div style={{ marginTop: 16 }}>
            {paras.map((p, i) => (
              <p key={i} style={{ fontSize: 15, lineHeight: 1.65, color: colors.text, marginBottom: 14 }}>{p}</p>
            ))}
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            {done ? (
              <span style={{ color: colors.green, fontWeight: 700, fontSize: 14 }}>✓ Completed</span>
            ) : (
              <button onClick={onComplete} style={{ padding: '11px 20px', borderRadius: radius.md, fontWeight: 700, fontSize: 14, background: colors.gold, color: '#1A1405', fontFamily: font.sans }}>
                Mark complete
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
