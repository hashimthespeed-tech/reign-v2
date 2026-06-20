import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loud in dev so a missing .env is obvious immediately.
  console.error('[Reign] Missing Supabase env vars. Check reign-v2/.env')
}

// ── Per-tab auth isolation ──────────────────────────────────────────────────
// Each browser tab gets its own fully independent auth session. This lets a user
// sign into different accounts in different tabs at once, and guarantees an auth
// change (sign-in / sign-out / token refresh) in one tab NEVER leaks into — or
// navigates — another tab.
//
// Two mechanisms work together; both are required:
//   1. sessionStorage as the auth store. sessionStorage is scoped to a single
//      tab, so each tab holds its own session and no cross-tab `storage` events
//      fire. (localStorage is shared across tabs — that's what caused tabs to
//      mirror each other.)
//   2. A unique storageKey per tab. GoTrue names its cross-tab BroadcastChannel
//      after the storageKey and posts every auth event to it. A distinct key per
//      tab means those broadcasts are never received by other tabs.
//
// Tradeoff: sessions no longer persist across browser restarts, nor into newly
// opened tabs — every new tab starts signed out. A reload of the SAME tab keeps
// the session, because the tab id lives in sessionStorage.
const DEFAULT_KEY = 'reign-auth'

function perTabStorageKey() {
  try {
    const ID_KEY = 'reign-tab-id'
    let id = window.sessionStorage.getItem(ID_KEY)
    if (!id) {
      id = (window.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2))
      window.sessionStorage.setItem(ID_KEY, id)
    }
    return `${DEFAULT_KEY}-${id}`
  } catch {
    // sessionStorage unavailable (e.g. SSR / privacy mode) — fall back gracefully.
    return DEFAULT_KEY
  }
}

let storage
try { storage = window.sessionStorage } catch { storage = undefined }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage,
    storageKey: perTabStorageKey(),
  },
})
