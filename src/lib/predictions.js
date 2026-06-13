// Pick the stock Reign asks about today. Spec priority is earnings/volatility/
// news; v1 uses recent volatility (highest daily-return SD), which is real,
// deterministic for the day, and computable from history we already have.
export function selectPredictionStock(owned, histories) {
  const candidates = owned.filter((h) => Number(h.shares) > 0)
  if (!candidates.length) return null

  let best = null, bestSd = -1
  for (const h of candidates) {
    const tk = (h.ticker || '').toUpperCase()
    const hist = histories[tk] || []
    if (hist.length < 6) continue
    const rets = []
    for (let i = 1; i < hist.length; i++) {
      const prev = hist[i - 1].close
      if (prev > 0) rets.push((hist[i].close - prev) / prev)
    }
    if (rets.length < 4) continue
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length)
    if (sd > bestSd) { bestSd = sd; best = h }
  }
  // fallback: first owned holding
  return best || candidates[0]
}

export function computeAccuracy(preds) {
  const resolved = preds.filter((p) => p.result)
  if (!resolved.length) return { pct: null, correct: 0, total: 0 }
  const correct = resolved.filter((p) => p.result === 'correct').length
  return { pct: (correct / resolved.length) * 100, correct, total: resolved.length }
}

// Consecutive correct from most recent resolved prediction backwards.
// Misses (no row) aren't counted, so they don't break the streak.
export function computeStreak(preds) {
  const resolved = [...preds].filter((p) => p.result)
    .sort((a, b) => (a.prediction_date < b.prediction_date ? 1 : -1))
  let streak = 0
  for (const p of resolved) {
    if (p.result === 'correct') streak++
    else break
  }
  return streak
}
