// Client wrappers around the Netlify functions. Same paths in dev & prod.
const FN = '/.netlify/functions'

async function get(path) {
  const res = await fetch(`${FN}${path}`)
  if (!res.ok) throw new Error(`${path} failed (${res.status})`)
  return res.json()
}

// { AAPL: { c, d, dp, o, h, l, pc, t }, ... }
export async function getQuotes(symbols = []) {
  if (!symbols.length) return {}
  const { quotes } = await get(`/quote?symbols=${encodeURIComponent(symbols.join(','))}`)
  return quotes || {}
}

export async function getQuote(symbol) {
  const quotes = await getQuotes([symbol])
  return quotes[symbol.toUpperCase()] || null
}

// { symbol, currency, prevClose, points: [{ date, close }] }
export async function getHistory(symbol, range = '1mo', interval = '1d') {
  return get(`/history?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`)
}

export async function getNews(symbol, limit = 8) {
  const { news } = await get(`/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`)
  return news || []
}

export async function searchStocks(q) {
  if (!q || q.trim().length < 1) return []
  const { results } = await get(`/search?q=${encodeURIComponent(q)}`)
  return results || []
}

export async function getProfile(symbol) {
  const { profile } = await get(`/search?symbol=${encodeURIComponent(symbol)}`)
  return profile || null
}

// Resolve a user's (or class's) unresolved predictions server-side. Best-effort.
export async function resolvePredictions({ userId, classId } = {}) {
  try {
    const res = await fetch(`${FN}/resolve-predictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, classId }),
    })
    if (!res.ok) return { resolved: 0 }
    return res.json()
  } catch {
    return { resolved: 0 }
  }
}

// Generate (or fetch existing) today's daily report. Self-gates to after close.
export async function generateReport({ userId, force } = {}) {
  try {
    const res = await fetch(`${FN}/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, force }),
    })
    if (!res.ok) return { skipped: 'error' }
    return res.json()
  } catch {
    return { skipped: 'error' }
  }
}

// Generate (or fetch existing) this week's class narrative. Idempotent per week.
export async function generateNarrative({ classId, force } = {}) {
  try {
    const res = await fetch(`${FN}/generate-narrative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, force }),
    })
    if (!res.ok) return { skipped: 'error' }
    return res.json()
  } catch {
    return { skipped: 'error' }
  }
}

// Generic AI call. Returns { text, parsed, usage }.
export async function askGroq({ system, prompt, messages, temperature, max_tokens, json } = {}) {
  const res = await fetch(`${FN}/groq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt, messages, temperature, max_tokens, json }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || `groq failed (${res.status})`)
  }
  return res.json()
}
