import { fetchJson } from './_util.js'
import { nowET } from '../../src/lib/market.js'
import { fmtMoney } from '../../src/lib/portfolio.js'
import { buildRows, computeMovers, pickChampion } from '../../src/lib/leaderboard.js'

// Same coach persona as the daily report, scoped to the class story.
const REIGN_VOICE =
  "You are Reign, an investing coach for a competitive high-school stock simulator. " +
  "Voice: direct, sharp, plain language a 16-year-old respects. No fluff, no exclamation marks, " +
  "no corporate speak, never say 'great job'. Frame everything competitively. Speak like the " +
  "smartest person in the room who has nothing to prove.";

async function callGroqJSON(system, prompt, key, model) {
  const { ok, data } = await fetchJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.8, max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    }),
  }, 30000)
  if (!ok) throw new Error(data?.error?.message || 'Groq failed')
  try { return JSON.parse(data.choices[0].message.content) } catch { return null }
}

// Monday (ET) of the week containing this ET day — the dedupe anchor so the
// on-demand path generates at most one narrative per class per week.
function weekStartET(et) {
  const d = new Date(`${et.dateStr}T00:00:00Z`)
  const dow = et.weekday === 0 ? 7 : et.weekday // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  return d.toISOString().slice(0, 10)
}

function daysAgoET(et, n) {
  const d = new Date(`${et.dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// Generate (or return existing) this week's narrative for one class.
// Privacy-safe: uses usernames + values only, never holdings — same data the
// leaderboard already shows classmates.
export async function generateNarrativeForClass(admin, classId, { force = false } = {}) {
  const et = nowET()
  const weekStart = weekStartET(et)

  const { data: cls } = await admin.from('classes').select('name, starting_budget, show_leaderboard').eq('id', classId).maybeSingle()
  if (!cls) return { skipped: 'no such class' }
  if (cls.show_leaderboard === false) return { skipped: 'leaderboard hidden' }

  // one narrative per class per week unless forced (the Friday cron forces a recap)
  if (!force) {
    const { data: existing } = await admin.from('class_narratives')
      .select('id').eq('class_id', classId).gte('narrative_date', weekStart).maybeSingle()
    if (existing) return { skipped: 'already generated this week', id: existing.id }
  }

  const startingBudget = Number(cls.starting_budget) || 10000

  const { data: pfs } = await admin.from('portfolios')
    .select('user_id, last_value, cash_balance, created_at').eq('class_id', classId)
  if (!pfs?.length) return { skipped: 'no students' }

  const userIds = pfs.map((p) => p.user_id)
  const { data: profs } = await admin.from('profiles').select('id, username').in('id', userIds)
  const nameOf = Object.fromEntries((profs || []).map((p) => [p.id, p.username]))

  // week-ago baseline (latest stored close at least 7 days back)
  const weekAgoCutoff = daysAgoET(et, 7)
  const { data: reps } = await admin.from('daily_reports')
    .select('user_id, report_date, portfolio_value_at_close')
    .eq('class_id', classId).lte('report_date', weekAgoCutoff)
    .order('report_date', { ascending: false })
  const weekAgo = {}
  for (const r of reps || []) if (!(r.user_id in weekAgo)) weekAgo[r.user_id] = r.portfolio_value_at_close

  // predictions for accuracy/streak (all-time) + this-week champion tallies
  const { data: preds } = await admin.from('predictions')
    .select('user_id, result, prediction_date').eq('class_id', classId)
  const byUser = {}
  for (const p of preds || []) (byUser[p.user_id] ||= []).push(p)

  const rawRows = pfs.map((p) => {
    const mine = (byUser[p.user_id] || [])
    const resolved = mine.filter((x) => x.result != null)
      .sort((a, b) => (a.prediction_date < b.prediction_date ? 1 : -1))
    const thisWeek = mine.filter((x) => x.prediction_date >= weekAgoCutoff && x.result != null)
    return {
      user_id: p.user_id,
      username: nameOf[p.user_id] || 'unknown',
      value: p.last_value ?? p.cash_balance,
      week_ago_value: weekAgo[p.user_id] ?? null,
      pred_results: resolved.map((x) => x.result),
      week_correct: thisWeek.filter((x) => x.result === 'correct').length,
      week_total: thisWeek.length,
      joined_at: p.created_at,
    }
  })

  const rows = buildRows(rawRows, startingBudget)
  const leader = rows[0]
  const runnerUp = rows[1] || null
  const { up, down } = computeMovers(rows)
  const champion = pickChampion(rows)
  const classAvgReturn = (rows.reduce((s, r) => s + (r.value - startingBudget) / startingBudget, 0) / rows.length) * 100

  const GROQ = process.env.GROQ_API_KEY
  const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  const facts = [
    `Class "${cls.name}" — ${rows.length} student${rows.length === 1 ? '' : 's'}.`,
    `Leader: @${leader.username} at ${fmtMoney(leader.value)}` +
      (leader.hasWeekBaseline ? ` (${leader.weekChangePct >= 0 ? '+' : ''}${leader.weekChangePct.toFixed(1)}% this week).` : '.'),
    runnerUp ? `Second: @${runnerUp.username} at ${fmtMoney(runnerUp.value)}, ${fmtMoney(leader.value - runnerUp.value)} behind.` : 'No one else close.',
    up ? `Biggest climber: @${up.username}, up ${up.delta} spot${up.delta > 1 ? 's' : ''} this week.` : '',
    down ? `Biggest slide: @${down.username}, down ${Math.abs(down.delta)}.` : '',
    champion ? `Prediction champion: @${champion.username}, ${champion.weekCorrect}/${champion.weekTotal} calls right this week.` : 'No standout predictor this week.',
    `Class average return: ${classAvgReturn >= 0 ? '+' : ''}${classAvgReturn.toFixed(1)}%.`,
  ].filter(Boolean).join('\n')

  const prompt = `Write this week's class story for a competitive trading simulator leaderboard.

THIS WEEK:
${facts}

Return STRICT JSON: { "narrative": "2-4 sentences. Tell the story of the week's race — who leads, who's chasing, who moved. Use the @usernames given. Competitive and specific. No holdings, no ticker symbols. Make everyone want to climb." }`

  const ai = await callGroqJSON(REIGN_VOICE, prompt, GROQ, MODEL)
  if (!ai?.narrative) throw new Error('AI returned no usable narrative')

  const row = { class_id: classId, narrative_date: et.dateStr, narrative_text: ai.narrative }
  const { data: saved, error } = await admin.from('class_narratives')
    .upsert(row, { onConflict: 'class_id,narrative_date' }).select().single()
  if (error) throw new Error(error.message)
  return { ok: true, id: saved.id, narrative: saved }
}

// Generate for every visible class (scheduled use). The Friday cron forces a
// fresh end-of-week recap even if an on-demand narrative already ran this week.
export async function generateNarrativesForAll(admin, { force = false } = {}) {
  const { data: classes } = await admin.from('classes').select('id').eq('show_leaderboard', true)
  let made = 0, skipped = 0
  for (const c of classes || []) {
    try {
      const r = await generateNarrativeForClass(admin, c.id, { force })
      r.ok ? made++ : skipped++
    } catch { skipped++ }
  }
  return { made, skipped, total: (classes || []).length }
}
