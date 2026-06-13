import { useState } from 'react'
import { colors, radius } from '../theme'
import { rabbitHole } from '../lib/api'
import { Spinner } from './ui'

// Persistent "Rabbit Hole" affordance on a market event/stock move/news item.
// On tap it generates a cause-and-effect chain and reveals it INLINE, each level
// indented further from the originating event. `event` is a short description of
// what happened; `depth` is 4 (Watcher/Trader) or 7 (after Day 30).
export default function RabbitHole({ event, depth = 4, label = 'Rabbit Hole', compact = false, full = false }) {
  const [open, setOpen] = useState(false)
  const [chain, setChain] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function dig() {
    setOpen(true); setBusy(true); setErr(''); setChain(null)
    try {
      const c = await rabbitHole(event, depth)
      if (!c) setErr("Reign couldn't trace this one right now.")
      else setChain(c)
    } catch {
      setErr('Reign is unavailable right now. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  function reset() { setOpen(false); setChain(null); setErr('') }

  if (!open) {
    return (
      <button onClick={dig} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        width: full ? '100%' : 'auto',
        padding: compact ? '6px 11px' : '8px 13px', borderRadius: 8,
        fontSize: 12.5, fontWeight: 600, color: colors.textMuted,
        background: 'transparent', border: `1px solid ${colors.border}`, cursor: 'pointer',
      }}>
        <span style={{ color: colors.gold }}>🕳</span> {label}
      </button>
    )
  }

  return (
    <div style={{ marginTop: 8, padding: 12, background: colors.bgRaised, borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: colors.gold }}>RABBIT HOLE · {depth} LEVELS</span>
        <button onClick={reset} aria-label="Close" style={{ color: colors.textFaint, fontSize: 16, cursor: 'pointer' }}>×</button>
      </div>
      {busy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.textMuted, fontSize: 13 }}>
          <Spinner size={14} /> Tracing the chain…
        </div>
      )}
      {err && <div style={{ color: colors.red, fontSize: 12.5 }}>{err}</div>}
      {chain && chain.map((lvl, i) => (
        <div key={i} style={{ marginLeft: i * 14, paddingLeft: 10, borderLeft: `2px solid ${colors.gold}`, marginBottom: 9 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.text }}>{lvl.headline}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.45, marginTop: 2 }}>{lvl.detail}</div>
        </div>
      ))}
    </div>
  )
}
