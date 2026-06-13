import { adminClient } from './_supabase.js'
import { generateMonthlyForAll } from './_monthly.js'

// Scheduled: monthly behavioral reports, 1st of each month after close.
// 23:00 UTC on the 1st — the trailing-35-day window captures the month just ended.
export const config = { schedule: '0 23 1 * *' }

export const handler = async () => {
  try {
    const admin = adminClient()
    const result = await generateMonthlyForAll(admin, { force: true })
    console.log('[cron-monthly-report]', result)
    return { statusCode: 200, body: JSON.stringify(result) }
  } catch (e) {
    console.error('[cron-monthly-report] failed:', e.message)
    return { statusCode: 500, body: e.message }
  }
}
