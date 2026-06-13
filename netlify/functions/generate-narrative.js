import { json, preflight } from './_util.js'
import { adminClient } from './_supabase.js'
import { generateNarrativeForClass } from './_narrative.js'

// On-demand class-narrative generation (leaderboard page calls this on load).
// POST { classId, force? }
export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  let body; try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'bad body' }) }
  if (!body.classId) return json(400, { error: 'classId required' })

  let admin
  try { admin = adminClient() } catch (e) { return json(500, { error: e.message }) }

  try {
    const result = await generateNarrativeForClass(admin, body.classId, { force: !!body.force })
    return json(200, result)
  } catch (e) {
    return json(500, { error: e.message })
  }
}
