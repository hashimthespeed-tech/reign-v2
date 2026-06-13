// Pure logic for the Learning page + unlock progression. No I/O — testable.

export const STAGES = [
  { key: 'watcher', name: 'The Watcher', req: 'Day 1' },
  { key: 'trader', name: 'The Trader', req: 'First trade' },
  { key: 'analyst', name: 'The Analyst', req: 'Day 30' },
  { key: 'investor', name: 'The Investor', req: 'Rank #1' },
]

// Current stage index (0..3) from progress signals.
export function stageForStudent({ daysInClass = 0, tradeCount = 0, rank = 0 }) {
  if (rank === 1) return 3
  if (daysInClass >= 30) return 2
  if (tradeCount > 0) return 1
  return 0
}

// Is a concept unlocked for this student?
export function conceptUnlocked(requirement, { daysInClass = 0, rank = 0 }) {
  switch (requirement) {
    case 'day_1': return true
    case 'day_10': return daysInClass >= 10
    case 'day_30': return daysInClass >= 30
    case 'rank_1': return rank === 1
    default: return true
  }
}

// Estimated minutes to read (~200 wpm), floored at 1.
export function readTime(content = '') {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// Deterministic daily pick from a list — stable for the whole day.
export function pickTodayConcept(concepts, date = new Date()) {
  if (!concepts.length) return null
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000)
  return concepts[day % concepts.length]
}

// Which cinematic unlocks should fire now: milestone reached but not yet seen.
export function pendingCinematics({ daysInClass = 0, rank = 0 }, seenTypes = []) {
  const seen = new Set(seenTypes)
  const out = []
  if (daysInClass >= 10 && !seen.has('day_10')) out.push('day_10')
  if (daysInClass >= 30 && !seen.has('day_30')) out.push('day_30')
  if (rank === 1 && !seen.has('rank_1')) out.push('rank_1')
  return out
}

// Static "what unlocks what" vault, evaluated against the student's progress.
export function vaultItems({ daysInClass = 0, rank = 0 }) {
  return [
    { name: 'Thesis Validator', req: 'Day 10', met: daysInClass >= 10, desc: 'AI pressure-tests your reasoning before every buy.' },
    { name: 'Monthly Behavioral Report', req: 'Day 30', met: daysInClass >= 30, desc: 'The investor you actually are — your patterns, exposed.' },
    { name: 'Rabbit Hole · 7 levels deep', req: 'Day 30', met: daysInClass >= 30, desc: 'Cause-and-effect chains go from 4 to 7 levels.' },
    { name: 'Class vs Class + Market Sovereign', req: 'Reach Rank #1', met: rank === 1, desc: 'Compete beyond your classroom. The real-money path opens.' },
  ]
}
