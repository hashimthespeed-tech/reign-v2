import { json, preflight } from './_util.js'
import { adminClient } from './_supabase.js'
import { resolveUnresolved } from './_resolve.js'

// On-demand resolution (dashboard calls this on load). POST { userId } or { classId }.
export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  let body; try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'bad body' }) }
  const { userId, classId } = body
  if (!userId && !classId) return json(400, { error: 'userId or classId required' })

  let admin
  try { admin = adminClient() } catch (e) { return json(500, { error: e.message }) }

  try {
    const result = await resolveUnresolved(admin, { userId, classId })
    return json(200, result)
  } catch (e) {
    return json(500, { error: e.message })
  }
}
