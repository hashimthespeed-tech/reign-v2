// Thesis Validator — builds the prompt for Reign's pre-buy thesis analysis and
// parses the strict-JSON response. Advisory only: never a buy/sell verdict,
// never a score, never praise/criticism (enforced by the system prompt + parser).

export const THESIS_SYSTEM =
  "You are Reign, an investing coach for a competitive high-school stock simulator. " +
  "A student wrote a thesis for why they want to buy a stock. Pressure-test their reasoning. " +
  "Voice: direct, sharp, plain language a 16-year-old respects. No fluff, no exclamation marks. " +
  "STRICT RULES: do NOT tell them whether to buy or not buy. Do NOT grade or score the thesis. " +
  "Do NOT praise or criticize the student. Reference the actual headlines provided. " +
  "Stay specific to THIS stock and THIS thesis."

// inputs: { ticker, companyName, thesis, headlines:[str], history:[{date,close}], portfolio:[{ticker,pct}] }
export function buildThesisPrompt({ ticker, companyName, thesis, headlines = [], history = [], portfolio = [] }) {
  const priceLine = history.length > 1
    ? (() => {
        const first = history[0].close, last = history[history.length - 1].close
        const pct = first > 0 ? ((last - first) / first) * 100 : 0
        return `${ticker} is ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% over the last ${history.length} trading days (${first.toFixed(2)} → ${last.toFixed(2)}).`
      })()
    : 'No recent price history available.'
  const newsLines = headlines.length
    ? headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
    : 'No recent headlines available.'
  const pf = portfolio.length
    ? portfolio.map((p) => `${p.ticker} ${p.pct.toFixed(0)}%`).join(', ')
    : 'no other holdings yet'

  return `Stock: ${ticker} (${companyName})

Student's thesis:
"${thesis}"

Recent news headlines:
${newsLines}

Price action: ${priceLine}

Student's current portfolio: ${pf}

Return STRICT JSON with exactly these keys:
{
  "alignment": "supports | contradicts | mixed",
  "news_assessment": "1-2 sentences on whether current news supports or contradicts the thesis, referencing the specific headlines above",
  "if_right": "one concrete chain reaction — if the thesis is right, what might happen next",
  "if_wrong": "one concrete chain reaction — here's what could go wrong",
  "blind_spot": "one specific thing the student may not have considered"
}`
}

const ALIGNMENTS = new Set(['supports', 'contradicts', 'mixed'])

// Returns a clean object or null if the model didn't return the required fields.
export function parseThesisResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  const need = ['news_assessment', 'if_right', 'if_wrong', 'blind_spot']
  if (need.some((k) => !parsed[k] || typeof parsed[k] !== 'string')) return null
  return {
    alignment: ALIGNMENTS.has(parsed.alignment) ? parsed.alignment : 'mixed',
    news_assessment: parsed.news_assessment.trim(),
    if_right: parsed.if_right.trim(),
    if_wrong: parsed.if_wrong.trim(),
    blind_spot: parsed.blind_spot.trim(),
  }
}
