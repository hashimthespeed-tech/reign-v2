import { json, preflight } from './_util.js'
import { adminClient } from './_supabase.js'

// Hard-delete the caller's account.
// POST with `Authorization: Bearer <access_token>`. The token is verified
// server-side to resolve the uid (never trust a uid from the body); then
// auth.admin.deleteUser removes the auth user and ON DELETE CASCADE FKs
// remove every dependent row (profile, portfolio, holdings, trades, ...).
export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: 'missing token' })

  let admin
  try { admin = adminClient() } catch (e) { return json(500, { error: e.message }) }

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json(401, { error: 'invalid token' })

  const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id)
  if (delErr) return json(500, { error: delErr.message })

  return json(200, { ok: true })
}
