// Shared helpers for Netlify functions (bundled by esbuild on deploy,
// imported directly by the Vite dev middleware locally).

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
    body: JSON.stringify(body),
  }
}

export function preflight(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  return null
}

export async function fetchJson(url, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    const text = await res.text()
    let data
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(t)
  }
}

// In-memory TTL cache. Only persists within a warm container, which is
// enough to absorb bursts (e.g. a class refreshing at once).
const _cache = new Map()
export function cacheGet(key) {
  const hit = _cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  if (hit) _cache.delete(key)
  return null
}
export function cacheSet(key, value, ttlMs) {
  _cache.set(key, { value, expires: Date.now() + ttlMs })
  return value
}
