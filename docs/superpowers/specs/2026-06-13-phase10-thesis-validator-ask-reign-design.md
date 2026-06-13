# Phase 10 — Thesis Validator + Ask Reign — Design

Status: approved 2026-06-13. Source of truth for behaviour: `PHASES.md` → Phase 10.

## Goal
Add two AI coaching features to REIGN v2:
1. **Thesis Validator** — pressure-tests a student's written buy reasoning before purchase.
2. **Ask Reign** — an inline, single-shot "ask the coach" affordance on cards/reports/news.

Both are **advisory** and **student-facing** (no integrity/anti-cheat concern), so both
run through the existing `groq.js` proxy via `askGroq()` — **no new Netlify functions,
no cron, no Supabase schema change** (`holdings.thesis` and `holdings.thesis_ai_response`
already exist).

## Architecture
- Prompt construction + response parsing live in **pure, testable libs**
  (`src/lib/thesis.js`, `src/lib/askReign.js`), matching the existing `lib/` pattern.
- Thin client wrappers in `src/lib/api.js` (`analyzeThesis`, `askReign`) over `askGroq`.
- Reusable presentational component `src/components/AskReign.jsx`.

## A. Thesis Validator
**Where:** the existing `ThesisStep` in `src/pages/Portfolio.jsx` (currently a placeholder).

**Trigger (reconciled per spec):** show the thesis step on a *buy* when
`classes.thesis_required === true` **OR** `daysInClass(portfolio.created_at) >= 10`.
(`daysInClass` from `src/lib/dashboard.js`.) The Day-10 *cinematic* unlock is Phase 13;
Phase 10 ships only the functional gate.

**Flow:** write thesis (≥2 sentences, existing rule) → **Analyze with Reign** →
inline structured analysis → **Continue to buy** (always enabled; never blocks).

**AI inputs** (gathered client-side, already fetched elsewhere):
ticker + company name, the thesis, last 5 `getNews` headlines, 30-day `getHistory`
closes, current portfolio composition (tickers + % weights) from state.

**AI output — strict JSON:**
```json
{
  "alignment": "supports | contradicts | mixed",
  "news_assessment": "1-2 sentences referencing the actual headlines provided",
  "if_right": "one chain reaction if the thesis plays out",
  "if_wrong": "one chain reaction for what could go wrong",
  "blind_spot": "one thing the student may not have considered"
}
```
System prompt (Reign voice) **forbids**: buy/don't-buy recommendation, grade/score,
praise/criticism.

**Persistence:** `executeBuy` already accepts a `thesisAi` param and writes
`thesis_ai_response`; the buy flow just needs to pass the analysis (stringified JSON)
alongside `thesis`. No `trade.js` change required.

## B. Ask Reign
**Component:** `<AskReign context={string} />` — a small persistent affordance that, on
tap, expands **inline** (no modal, no new page) into a one-line input. On submit it calls
`askGroq` **single-shot (no conversation history)**, renders the answer inline beneath,
and offers collapse/reset. Each open is independent.

**`context` prop:** short string from the parent describing what's on screen, e.g.
`"AAPL +2.3% today — your hero of the day"`, a daily-report summary, or a news headline.

**Guardrails (system prompt):** answer only about what's shown; never give personalized
buy/sell advice; never reference or reveal other students or their data; educational only.

**Surfaces wired this phase:** stock `DetailDrawer` (replaces the disabled
"Ask Reign (soon)" button), dashboard **hero/villain** cards, dashboard **report** card.
The component is generic; remaining surfaces (news items, leaderboard) are later drop-ins.

## Files
- **New:** `src/lib/thesis.js`, `src/lib/askReign.js`, `src/components/AskReign.jsx`,
  `scripts/verify-phase10.mjs`
- **Edit:** `src/lib/api.js` (wrappers), `src/pages/Portfolio.jsx`,
  `src/pages/StudentDashboard.jsx`. (`trade.js` already supports `thesisAi`.)

## Verification — `scripts/verify-phase10.mjs` (real Groq, Phase 8/9 convention)
1. Thesis analysis returns valid JSON with all five fields; `news_assessment` references a
   seeded headline. Print output for quality eyeball.
2. Guardrail smoke: "should I buy this?" → answer avoids a direct buy/sell verdict
   (soft check + printed).
3. `thesis` + `thesis_ai_response` persist to the holding on buy and read back.
4. Ask Reign returns a non-empty, on-topic inline answer; print it.

## Out of scope (later phases)
Cinematic Day-10 unlock animation (Phase 13); Rabbit Hole (Phase 11); Ask Reign on every
remaining surface (incremental drop-ins).
