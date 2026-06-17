# REIGN v2 — Phase Plan & Spec

The authoritative build order and feature spec. Each completed phase ships as one
commit and is verified by `scripts/verify-phaseN.mjs` (integration checks against
the dev server). Infra/SQL is applied manually in the Supabase SQL Editor. Design
decisions are logged in `C:\Users\hashi\projects\.decisions.md`.

| Phase | Feature | Status | Commit |
|------:|---------|:------:|--------|
| 1+2 | Project foundation, schema, auth & onboarding | ✅ done | `0ce4393` |
| 3 | Core infrastructure (Finnhub + Yahoo + Groq, all proxied) | ✅ done | `660dd07` |
| 4 | Student dashboard with real data | ✅ done | `65eff29` |
| 5 | Teacher dashboard with real data | ✅ done | `01e4df3` |
| 6 | Portfolio page with real buy/sell/short | ✅ done | `00224ca` |
| 7 | Prediction mechanic end-to-end | ✅ done | `6477f6a` |
| 8 | Daily report AI pipeline | ✅ done | `45d8533` |
| 9 | Leaderboard + weekly class narrative | ✅ done | `61e7bf4` |
| 10 | Thesis Validator + Ask Reign | ✅ done | `9165d41` |
| 11 | Rabbit Hole | ✅ done | `f0ae760` |
| 12 | Monthly Behavioral Report | ✅ done | `26fa5fe` |
| 13 | Learning page + feature-unlock progression (cinematic events) | ✅ done | `f2cc0a5` |
| 14 | Settings page (incl. real-money transition) | ✅ done | `61edab1` |
| 15 | **Landing page — "Network Vista" rebuild (Hero + Features + Steps + CTA)** | ✅ done | `9f690b5` |
| 16 | Mobile responsive across all pages | ⏳ planned | — |
| 17 | RLS audit + security review + performance review + final bug sweep | ⏳ planned | — |

---

## Phase 10 — Thesis Validator + Ask Reign

### Thesis Validator
- **Trigger:** student attempts to buy a stock **after Day 10** (or **from Day 1**
  if the teacher has forced it via `classes.thesis_required`).
- **AI inputs:** ticker + company name; the student's written thesis; last 5 news
  headlines for the stock; recent 30-day price history; the student's current
  portfolio composition.
- **AI outputs:** whether current news **supports or contradicts** the thesis, with
  specific references to actual news items; **1–2 chain reactions** ("if your thesis
  is right, here's what might happen next…" and "here's what could go wrong…"); **one
  thing the student may not have considered.**
- **AI must NOT output:** a buy / don't-buy recommendation; a grade or score; praise
  or criticism.
- **Always proceedable:** the student can buy regardless of the AI response.
- **Persistence:** thesis + AI response saved to the `holdings` record
  (`holdings.thesis`, `holdings.thesis_ai_response`).

### Ask Reign
- A **persistent button on every card, report section, and news item.**
- One tap opens a **small inline input box** — not a new page, not a popup.
- **Context** auto-included from whatever the student was looking at.
- Calls Groq with context + question; returns the response **inline**.
- **No conversation history** — each interaction is independent.
- **Guardrails:** cannot give personal financial advice; cannot access other
  students' data.

---

## Phase 11 — Rabbit Hole
- Button on every market event, stock move, or news item.
- Reveals a cascading cause-and-effect chain. **4 levels deep** for Watcher and
  Trader stages, **7 levels deep after Day 30.**
- Each level: one **cause as a bold headline** + one explanatory sentence.
  Indentation shows distance from the original event.
- Appears on: hero/villain cards, stock detail pages, news items, daily-report items.

## Phase 12 — Monthly Behavioral Report
- Generates after the student's **30th day**; regenerates monthly.
- **Inputs:** all trades for the month with prices at trade and 7/14/30 days later;
  all prediction results; trades within 24h of a 3% drop (panic-sell); trades within
  24h of major news (hype-buy); holdings bought & sold at a loss within 7 days
  (impatience); holdings held through 10%+ drops (patience).
- **Output:** opening sentence capturing the month; 3–5 behavioral-pattern cards with
  data evidence; a **What If** section for the 2 worst trades showing alternative
  outcomes; prediction analysis; **one thing to fix** as a gold-bordered card.
- Table `monthly_reports` exists; mirrors the Phase 8 daily-report pipeline.

## Phase 13 — Learning Page + Feature-Unlock Progression
- **Arsenal grid** of all concepts — locked / unlocked / completed; each card shows
  plain-English name, one-line hook, status, read time.
- **Today's Concept** surfaced daily, connected to real market events.
- **Progress path** — four stages: The Watcher (Day 1), The Trader (first trades +
  thesis unlocks), The Analyst (Day 30), The Investor (Rank 1).
- **Unlock Vault** showing every locked feature and exactly what unlocks it.
- Concept library is searchable and permanent.
- **Cinematic unlock events:**
  - **Day 10:** Thesis Validator unlocks — screen dims, crown animation, full-screen moment.
  - **Day 30:** Monthly behavioral report unlocks; Rabbit Hole goes 4 → 7 levels — cinematic event.
  - **Rank 1:** Class-vs-class, Market Sovereign title, real-money transition visible — largest cinematic event.
- Tables `concepts`, `student_concepts`, `unlocks` exist.

## Phase 14 — Settings Page
- **Profile:** username editable; profile picture (preset avatars); investor type
  updatable; current class code read-only.
- **Display:** timezone selection; dark-mode toggle.
- **Real-Money Transition** (only if `classes.show_real_money = true` **AND**
  `semester_end_date` has passed): gold-bordered card; affiliate cards for
  Robinhood / Vanguard / Fidelity with signup bonuses and affiliate links from env vars.
- **Account:** change password; change email; delete account.

## Phase 15 — Landing Page ("Network Vista" rebuild)
**Design pivot (2026-06-16):** the original 10-section concept and a WebGL/Three.js
"A market is waking" crown hero were both rejected. The landing is now the
**"Network Vista"** design (Antigravity export, Option 41): React 18 + inline styles,
animated 2D `<canvas>` plexus backgrounds, **zero new dependencies**. Four sections:

- **Hero** — animated S-curve cream/black canvas + plexus; live stock-ticker mockup
  card (3D tilt); two CTAs → onboarding (Create a Class / Join a Class).
- **Features** — frosted-glass capability cards over a plexus canvas.
- **Steps** — cream section, three black "how it works" step cards.
- **CTA + footer** — dark CTA with onboarding buttons.

Files: `src/components/landing/*` (NetworkVistaPage, Navbar, HeroSection,
DashboardMockup, FeaturesSection, StepsSection, CtaSection) + `src/hooks/`
(useHeroCanvas, usePlexusCanvas, useLandingData). Mounted at `/` via the
repurposed `Entry.jsx` (auth-redirect logic preserved).

**Live data:** `useLandingData` feeds the mockup card real Finnhub quotes
(AAPL/NVDA/TSLA/MSFT prices + % change) and a real AAPL 1-month chart line via the
existing market proxy (`api.js`). `portfolioValue` / `portfolioDirection` remain
fixed illustrative placeholders (no real classroom usage on the public landing).
Required Google Fonts (Plus Jakarta Sans + Cabinet Grotesk) added to `index.html`.

> Note: Cabinet Grotesk is a Fontshare font (not on Google Fonts); the README's
> Google Fonts link is in place but headings fall back to sans-serif until it's
> served from Fontshare — minor follow-up.

## Phase 16 — Mobile Responsive
Responsive design across all pages.

## Phase 17 — Hardening
RLS audit; security review; performance review (incl. recharts bundle code-split,
deferred from Phase 4); final bug sweep.
