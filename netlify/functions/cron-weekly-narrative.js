import { adminClient } from './_supabase.js'
import { generateNarrativesForAll } from './_narrative.js'

// Scheduled: weekly class narrative, Friday after close.
// 22:00 UTC Fridays — after 4:00 PM ET (and after the daily report at 21:45).
// Forces a fresh end-of-week recap even if an on-demand narrative ran earlier.
export const config = { schedule: '0 22 * * 5' }

export const handler = async () => {
  try {
    const admin = adminClient()
    const result = await generateNarrativesForAll(admin, { force: true })
    console.log('[cron-weekly-narrative]', result)
    return { statusCode: 200, body: JSON.stringify(result) }
  } catch (e) {
    console.error('[cron-weekly-narrative] failed:', e.message)
    return { statusCode: 500, body: e.message }
  }
}
