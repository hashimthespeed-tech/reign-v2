// Build the leaderboard from class_leaderboard() rows. All derived client-side
// from the privacy-safe RPC payload (value + result arrays, no holdings).

export function accuracyFromResults(results = []) {
  if (!results.length) return null
  const correct = results.filter((r) => r === 'correct').length
  return (correct / results.length) * 100
}

// pred_results is ordered most-recent-first → streak = leading 'correct' count.
export function streakFromResults(results = []) {
  let s = 0
  for (const r of results) { if (r === 'correct') s++; else break }
  return s
}

// Build ranked rows. Primary: value desc. Tiebreaker: accuracy desc.
export function buildRows(rawRows, startingBudget) {
  const rows = rawRows.map((r) => {
    const accuracy = accuracyFromResults(r.pred_results)
    const baseline = r.week_ago_value != null ? Number(r.week_ago_value) : Number(startingBudget)
    const weekChangeDollars = Number(r.value) - baseline
    const weekChangePct = baseline > 0 ? (weekChangeDollars / baseline) * 100 : 0
    return {
      userId: r.user_id,
      username: r.username,
      value: Number(r.value),
      accuracy,
      streak: streakFromResults(r.pred_results),
      weekChangeDollars,
      weekChangePct,
      weekCorrect: Number(r.week_correct || 0),
      weekTotal: Number(r.week_total || 0),
      joinedAt: r.joined_at,
      hasWeekBaseline: r.week_ago_value != null,
    }
  })
  rows.sort((a, b) => (b.value - a.value) || ((b.accuracy ?? -1) - (a.accuracy ?? -1)))
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

// Anonymous rival: a classmate within 15% of my value, similar time in class,
// deterministic per ISO week so it's stable for the week.
export function pickRival(rows, myUserId, weekSeed) {
  const me = rows.find((r) => r.userId === myUserId)
  if (!me) return null
  const candidates = rows.filter((r) =>
    r.userId !== myUserId && me.value > 0 &&
    Math.abs(r.value - me.value) / me.value <= 0.15
  )
  if (!candidates.length) return null
  // closeness, then stable weekly rotation
  candidates.sort((a, b) => Math.abs(a.value - me.value) - Math.abs(b.value - me.value))
  return candidates[weekSeed % candidates.length]
}

// Biggest weekly rank movers (needs week-ago baseline).
export function computeMovers(rows) {
  const withBase = rows.filter((r) => r.hasWeekBaseline)
  if (withBase.length < 2) return { up: null, down: null }
  const weekAgoRank = [...withBase]
    .sort((a, b) => (b.value - b.weekChangeDollars) - (a.value - a.weekChangeDollars))
    .reduce((m, r, i) => (m[r.userId] = i + 1, m), {})
  let up = null, down = null
  for (const r of withBase) {
    const delta = (weekAgoRank[r.userId] ?? r.rank) - r.rank // positive = climbed
    if (delta > 0 && (!up || delta > up.delta)) up = { ...r, delta }
    if (delta < 0 && (!down || delta < down.delta)) down = { ...r, delta }
  }
  return { up, down }
}

export function pickChampion(rows) {
  const eligible = rows.filter((r) => r.weekTotal > 0)
  if (!eligible.length) return null
  eligible.sort((a, b) => (b.weekCorrect / b.weekTotal) - (a.weekCorrect / a.weekTotal) || b.weekTotal - a.weekTotal)
  return eligible[0]
}

// ISO-ish week number for deterministic weekly rotations.
export function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}
