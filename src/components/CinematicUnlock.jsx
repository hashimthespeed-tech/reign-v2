import { colors, font } from '../theme'
import { Button } from './ui'

// Full-screen cinematic moment fired when a student crosses a milestone.
// Screen dims, a crown rises and glows, then a headline + body. One at a time.
const CONTENT = {
  day_10: {
    crown: '👑',
    tag: 'DAY 10 · THE TRADER',
    title: 'Thesis Validator Unlocked',
    body: 'From now on, Reign pressure-tests your reasoning before every buy — does the news back your thesis, and what could go wrong? Conviction beats guessing.',
  },
  day_30: {
    crown: '⚜️',
    tag: 'DAY 30 · THE ANALYST',
    title: 'You See the Machine Now',
    body: 'Your Monthly Behavioral Report is live — the patterns you can’t see in yourself, laid bare. And the Rabbit Hole now runs 7 levels deep instead of 4.',
  },
  rank_1: {
    crown: '👑',
    tag: 'RANK #1 · THE SOVEREIGN',
    title: 'Market Sovereign',
    body: 'You reached #1 in your class. Class-vs-class competition and the real-money path are on the horizon. The crown is yours — now defend it.',
  },
}

export default function CinematicUnlock({ type, onDismiss }) {
  const c = CONTENT[type]
  if (!c) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(3,4,7,0.92)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      animation: 'reign-dim-in 0.4s ease both', fontFamily: font.sans,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: 72, lineHeight: 1, animation: 'reign-crown 0.7s ease both, reign-crown-glow 2.4s ease-in-out 0.7s infinite' }}>
          {c.crown}
        </div>
        <div style={{ marginTop: 22, fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: colors.gold, animation: 'reign-fade-up 0.5s ease 0.35s both' }}>
          {c.tag}
        </div>
        <h1 style={{ fontFamily: font.display, marginTop: 10, fontSize: 38, fontWeight: 900, letterSpacing: '-0.025em', color: '#ffffff', animation: 'reign-fade-up 0.5s ease 0.5s both' }}>
          {c.title}
        </h1>
        <p style={{ marginTop: 14, fontSize: 15.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', animation: 'reign-fade-up 0.5s ease 0.65s both' }}>
          {c.body}
        </p>
        <div style={{ marginTop: 26, animation: 'reign-fade-up 0.5s ease 0.8s both' }}>
          <Button onClick={onDismiss} style={{ background: '#ffffff', color: '#0a0a0c', border: '1px solid #ffffff' }}>Claim it →</Button>
        </div>
      </div>
    </div>
  )
}
