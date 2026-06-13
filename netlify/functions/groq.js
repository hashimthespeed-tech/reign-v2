import { json, preflight, fetchJson } from './_util.js'

// AI proxy. The Groq key never reaches the browser.
// POST body: { system?, prompt?, messages?, temperature?, max_tokens?, json? }
export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const key = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  if (!key) return json(500, { error: 'GROQ_API_KEY not configured' })

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON body' }) }

  const { system, prompt, messages, temperature = 0.7, max_tokens = 900, json: wantJson = false } = body

  const msgs = messages || [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt || '' },
  ]

  const { ok, status, data } = await fetchJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: msgs,
      temperature,
      max_tokens,
      ...(wantJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  }, 30000)

  if (!ok) {
    return json(status || 502, { error: 'Groq request failed', detail: data?.error?.message || data })
  }

  const text = data?.choices?.[0]?.message?.content ?? ''
  let parsed = null
  if (wantJson) { try { parsed = JSON.parse(text) } catch { /* leave null */ } }

  return json(200, { text, parsed, usage: data?.usage || null })
}
