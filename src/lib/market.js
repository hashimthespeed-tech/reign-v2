// US market hours / holiday / greeting logic, all in America/New_York.

// US market holidays (observed dates), 2026–2027. Extend yearly.
const HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
])

// Current time broken into Eastern-time parts.
export function nowET(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  let hour = parseInt(parts.hour, 10)
  if (hour === 24) hour = 0 // some engines emit 24 for midnight
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    minute: parseInt(parts.minute, 10),
    weekday: weekdayMap[parts.weekday],
    minutesOfDay: hour * 60 + parseInt(parts.minute, 10),
  }
}

const OPEN = 9 * 60 + 30   // 9:30
const CLOSE = 16 * 60      // 16:00
const PREDICT_OPEN = 6 * 60 // 6:00

export function isHoliday(dateStr) { return HOLIDAYS.has(dateStr) }

export function isTradingDay(et = nowET()) {
  return et.weekday >= 1 && et.weekday <= 5 && !isHoliday(et.dateStr)
}

// 'weekend' | 'holiday' | 'pre' | 'open' | 'after'
export function getMarketStatus(et = nowET()) {
  if (et.weekday === 0 || et.weekday === 6) return 'weekend'
  if (isHoliday(et.dateStr)) return 'holiday'
  if (et.minutesOfDay < OPEN) return 'pre'
  if (et.minutesOfDay < CLOSE) return 'open'
  return 'after'
}

export function isMarketOpen(et = nowET()) { return getMarketStatus(et) === 'open' }

// Prediction window: 6:00–9:30 ET on trading days.
export function isPredictionWindowOpen(et = nowET()) {
  return isTradingDay(et) && et.minutesOfDay >= PREDICT_OPEN && et.minutesOfDay < OPEN
}

export function minutesToOpen(et = nowET()) {
  return Math.max(0, OPEN - et.minutesOfDay)
}

export function getGreeting(et = nowET()) {
  const status = getMarketStatus(et)
  if (status === 'weekend' || status === 'holiday') {
    return 'Markets are closed. Your rivals are studying.'
  }
  if (status === 'pre') {
    const mins = minutesToOpen(et)
    const hrs = Math.floor(mins / 60)
    const when = hrs >= 1 ? `${hrs} hour${hrs > 1 ? 's' : ''}` : `${mins} minute${mins !== 1 ? 's' : ''}`
    return `Market opens in ${when}. Your prediction is waiting.`
  }
  if (status === 'open') return 'Market is live. Your portfolio is moving.'
  return 'Market closed. Your report is ready.'
}

export function marketStatusLabel(et = nowET()) {
  return { weekend: 'Weekend', holiday: 'Holiday', pre: 'Pre-market', open: 'Market open', after: 'Market closed' }[getMarketStatus(et)]
}
