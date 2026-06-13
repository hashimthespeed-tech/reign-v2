import { adminClient } from './_supabase.js'
import { resolveUnresolved } from './_resolve.js'

// Scheduled (production): resolve ALL unresolved predictions after market close.
// 21:30 UTC weekdays is after 4:00 PM ET in both EST and EDT.
export const config = { schedule: '30 21 * * 1-5' }

export const handler = async () => {
  try {
    const admin = adminClient()
    const result = await resolveUnresolved(admin, {}) // no filter = everyone
    console.log('[cron-resolve]', result)
    return { statusCode: 200, body: JSON.stringify(result) }
  } catch (e) {
    console.error('[cron-resolve] failed:', e.message)
    return { statusCode: 500, body: e.message }
  }
}
