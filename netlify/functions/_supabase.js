import { createClient } from '@supabase/supabase-js'

// Service-role client for privileged server-side work (prediction resolution,
// report generation, cron). NEVER import this into client code.
export function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE not configured')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
