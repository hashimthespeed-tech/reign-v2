// Pure logic for the Settings page. No I/O, no React — verified in scripts/verify-phase14.mjs.

// ---- Avatar presets ----------------------------------------------------
// Generated gold-on-dark monogram avatars; avatar_url stores the preset id.
export const AVATAR_PRESETS = [
  { id: 'crest-1', ring: '#E8B339', fill: 'rgba(232,179,57,0.14)' },
  { id: 'crest-2', ring: '#5B8DEF', fill: 'rgba(91,141,239,0.14)' },
  { id: 'crest-3', ring: '#22C55E', fill: 'rgba(34,197,94,0.14)' },
  { id: 'crest-4', ring: '#F0C967', fill: 'rgba(240,201,103,0.16)' },
  { id: 'crest-5', ring: '#9BA1AD', fill: 'rgba(155,161,173,0.14)' },
  { id: 'crest-6', ring: '#EF4444', fill: 'rgba(239,68,68,0.12)' },
]
export const DEFAULT_AVATAR = AVATAR_PRESETS[0].id

export function presetById(id) {
  return AVATAR_PRESETS.find((p) => p.id === id) || AVATAR_PRESETS[0]
}

// First letter for the monogram, from a username.
export function avatarInitial(username = '') {
  const c = (username || '').trim().charAt(0)
  return c ? c.toUpperCase() : '?'
}

// ---- Real-money gate ---------------------------------------------------
// True iff the class enabled real money AND its semester end date has passed.
export function isRealMoneyUnlocked(klass, now = new Date()) {
  if (!klass || klass.show_real_money !== true) return false
  if (!klass.semester_end_date) return false
  const end = new Date(klass.semester_end_date)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() < now.getTime()
}

// ---- Timezones (display-only) -----------------------------------------
export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
]
export const DEFAULT_TZ = 'America/New_York'

export function formatInTimezone(date, tz = DEFAULT_TZ) {
  const d = date instanceof Date ? date : new Date(date)
  const opts = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).format(d)
  }
}

// ---- Affiliate broker cards -------------------------------------------
const BROKERS = [
  { key: 'robinhood', name: 'Robinhood', bonus: 'Get a free stock when you fund a new account.', envKey: 'VITE_AFFILIATE_ROBINHOOD' },
  { key: 'vanguard', name: 'Vanguard', bonus: 'Low-cost index funds built for long-term investors.', envKey: 'VITE_AFFILIATE_VANGUARD' },
  { key: 'fidelity', name: 'Fidelity', bonus: '$0 commission trades and cash bonus offers.', envKey: 'VITE_AFFILIATE_FIDELITY' },
]

// env defaults to {} so this is safe to call from Node (verify script).
// From the app, pass import.meta.env.
export function affiliateConfig(env = {}) {
  return BROKERS.map((b) => {
    const url = (env[b.envKey] || '').trim()
    return { key: b.key, name: b.name, bonus: b.bonus, url: url || null }
  })
}
