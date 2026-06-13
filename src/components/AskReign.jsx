import { useState } from 'react'
import { colors, radius, font } from '../theme'
import { askReign } from '../lib/api'
import { Spinner } from './ui'

// Persistent "Ask Reign" affordance. Tapping expands INLINE (no modal, no page)
// into a one-line question box; the answer renders inline beneath. Single-shot —
// no conversation history. `context` is a short string describing what the
// student is looking at (auto-included with the question).
export default function AskReign({ context, label = 'Ask Reign', compact = false, full = false }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e?.preventDefault?.()
    const question = q.trim()
    if (!question || busy) return
    setBusy(true); setErr(''); setAnswer('')
    try {
      const a = await askReign(context, question)
      setAnswer(a || 'Reign had nothing to add on that one.')
    } catch {
      setErr('Reign is unavailable right now. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  function reset() { setOpen(false); setQ(''); setAnswer(''); setErr('') }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        width: full ? '100%' : 'auto',
        padding: compact ? '6px 11px' : '8px 13px', borderRadius: 8,
        fontSize: 12.5, fontWeight: 600, color: colors.textMuted,
        background: 'transparent', border: `1px solid ${colors.border}`, cursor: 'pointer',
      }}>
        <span style={{ color: colors.gold }}>✦</span> {label}
      </button>
    )
  }

  return (
    <div style={{ marginTop: 8, padding: 12, background: colors.bgRaised, borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Ask Reign about this…"
          style={{
            flex: 1, padding: '9px 11px', fontSize: 13.5, fontFamily: font.sans,
            background: colors.bg, color: colors.text,
            border: `1px solid ${colors.border}`, borderRadius: 8, outline: 'none',
          }}
        />
        <button type="submit" disabled={busy || !q.trim()} style={{
          padding: '9px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13,
          background: colors.gold, color: '#1A1405', cursor: busy || !q.trim() ? 'not-allowed' : 'pointer',
          opacity: busy || !q.trim() ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {busy ? <Spinner size={13} color="#1A1405" /> : 'Ask'}
        </button>
        <button type="button" onClick={reset} aria-label="Close" style={{ padding: '4px 8px', color: colors.textFaint, fontSize: 18, cursor: 'pointer' }}>×</button>
      </form>
      {err && <div style={{ color: colors.red, fontSize: 12.5, marginTop: 8 }}>{err}</div>}
      {answer && (
        <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.55, color: colors.text }}>
          <span style={{ color: colors.gold, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', marginRight: 7 }}>REIGN</span>
          {answer}
        </div>
      )}
    </div>
  )
}
