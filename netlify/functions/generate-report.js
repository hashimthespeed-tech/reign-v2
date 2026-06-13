import { json, preflight } from './_util.js'
import { adminClient } from './_supabase.js'
import { generateReportForUser } from './_report.js'

// On-demand report generation (dashboard calls this on load, after close).
// POST { userId, force? }
export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  let body; try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'bad body' }) }
  if (!body.userId) return json(400, { error: 'userId required' })

  let admin
  try { admin = adminClient() } catch (e) { return json(500, { error: e.message }) }

  try {
    const result = await generateReportForUser(admin, body.userId, { force: !!body.force })
    return json(200, result)
  } catch (e) {
    return json(500, { error: e.message })
  }
}
