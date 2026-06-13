import { adminClient } from './_supabase.js'
import { generateReportsForAll } from './_report.js'

// Scheduled: generate everyone's daily report after market close.
// 21:45 UTC weekdays — after 4:00 PM ET (and after cron-resolve at 21:30).
export const config = { schedule: '45 21 * * 1-5' }

export const handler = async () => {
  try {
    const admin = adminClient()
    const result = await generateReportsForAll(admin)
    console.log('[cron-daily-report]', result)
    return { statusCode: 200, body: JSON.stringify(result) }
  } catch (e) {
    console.error('[cron-daily-report] failed:', e.message)
    return { statusCode: 500, body: e.message }
  }
}
