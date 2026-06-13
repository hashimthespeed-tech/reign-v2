import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, font } from '../theme'
import { getQuotes, getHistory } from '../lib/api'
import { computePortfolio, fmtMoney, fmtPct } from '../lib/portfolio'
import { nowET, getMarketStatus, getGreeting, marketStatusLabel, isMarketOpen, isPredictionWindowOpen } from '../lib/market'
import { detectHeroVillain, reconstructHistory, daysInClass } from '../lib/dashboard'
import StudentLayout from '../components/StudentLayout'
import { Card, Button, Spinner } from '../components/ui'

const chg = (n) => (Number(n) > 0 ? colors.green : Number(n) < 0 ? colors.red : colors.textMuted)

export default function StudentDashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [portfolio, setPortfolio] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [quotes, setQuotes] = useState({})
  const [histories, setHistories] = useState({})
  const [classInfo, setClassInfo] = useState(null)
  const [standings, setStandings] = useState([])
  const [report, setReport] = useState(null)
  const etRef = useRef(nowET())

  // initial load
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data: pf } = await supabase.from('portfolios').select('*').eq('user_id', user.id).maybeSingle()
      const { data: hs } = await supabase.from('holdings').select('*').eq('portfolio_id', pf?.id || '00000000-0000-0000-0000-000000000000')
      const { data: cls } = pf?.class_id
        ? await supabase.from('classes').select('*').eq('id', pf.class_id).maybeSingle()
        : { data: null }
      if (cancelled) return
      setPortfolio(pf); setHoldings(hs || []); setClassInfo(cls)

      const tickers = [...new Set((hs || []).map((h) => (h.ticker || '').toUpperCase()))]
      const owned = (hs || []).filter((h) => Number(h.shares) > 0).map((h) => (h.ticker || '').toUpperCase())

      const [q, ...histResults] = await Promise.all([
        getQuotes(tickers),
        ...owned.map((t) => getHistory(t, '1mo').then((r) => [t, r.points]).catch(() => [t, []])),
      ])
      if (cancelled) return
      setQuotes(q || {})
      setHistories(Object.fromEntries(histResults))

      // today's report (if generated yet)
      const { data: rep } = await supabase.from('daily_reports')
        .select('*').eq('user_id', user.id).order('report_date', { ascending: false }).limit(1).maybeSingle()
      if (!cancelled) setReport(rep || null)

      // store own live value + fetch rank
      const computed = computePortfolio({ cashBalance: pf?.cash_balance, holdings: hs || [], quotes: q || {} })
      if (pf) await supabase.from('portfolios').update({ last_value: computed.totalValue, last_value_at: new Date().toISOString() }).eq('id', pf.id)
      const { data: st } = await supabase.rpc('class_standings')
      if (!cancelled) setStandings(st || [])

      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  // live price refresh during market hours
  const refreshQuotes = useCallback(async () => {
    const tickers = [...new Set(holdings.map((h) => (h.ticker || '').toUpperCase()))]
    if (!tickers.length) return
    const q = await getQuotes(tickers)
    setQuotes(q || {})
  }, [holdings])

  useEffect(() => {
    if (!isMarketOpen()) return
    const id = setInterval(refreshQuotes, 60000)
    return () => clearInterval(id)
  }, [refreshQuotes])

  if (loading) {
    return <StudentLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={30} /></div></StudentLayout>
  }

  const p = computePortfolio({ cashBalance: portfolio?.cash_balance, holdings, quotes })
  const { hero, villain } = detectHeroVillain(p.owned, histories, quotes)
  const series = reconstructHistory(p.owned, histories, p.cash)
  const myRank = standings.findIndex((s) => s.user_id === user.id) + 1
  const totalStudents = standings.length || 1
  const et = etRef.current
  const status = getMarketStatus(et)
  const joinDays = daysInClass(portfolio?.created_at)

  return (
    <StudentLayout>
      {/* Greeting row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, marginBottom: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <StatusPill status={status} />
            <span style={{ fontSize: 13, color: colors.textFaint }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {getGreeting(et)}
          </h1>
        </div>
        {classInfo?.show_leaderboard !== false && myRank > 0 && (
          <div onClick={() => navigate('/leaderboard')} style={{ textAlign: 'right', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: colors.textFaint }}>YOUR RANK</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: colors.gold, fontFamily: font.mono }}>
              #{myRank}<span style={{ fontSize: 14, color: colors.textMuted, fontWeight: 500 }}> of {totalStudents}</span>
            </div>
          </div>
        )}
      </div>

      {/* Value + chart hero */}
      <Card style={{ padding: 26, marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12.5, color: colors.textFaint, marginBottom: 6 }}>PORTFOLIO VALUE</div>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1 }}>
              {fmtMoney(p.totalValue)}
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
              <ChangeStat label="Today" dollars={p.dayChangeDollars} pct={p.dayChangePct} />
              <ChangeStat label="All time" dollars={allTime(p)} pct={allTimePct(p)} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 150 }}>
            <MiniStat label="Cash" value={fmtMoney(p.cash)} />
            <MiniStat label="Invested" value={fmtMoney(p.investedValue)} />
            <MiniStat label="% invested" value={`${p.pctInvested.toFixed(0)}%`} />
          </div>
        </div>

        <div style={{ height: 200, marginTop: 22, marginLeft: -8 }}>
          {series.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.gold} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Tooltip
                  contentStyle={{ background: colors.bgRaised, border: `1px solid ${colors.borderStrong}`, borderRadius: 10, fontSize: 13 }}
                  labelStyle={{ color: colors.textFaint }}
                  formatter={(v) => [fmtMoney(v), 'Value']} />
                <Area type="monotone" dataKey="value" stroke={colors.gold} strokeWidth={2} fill="url(#pv)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </Card>

      {/* Hero / villain */}
      {(hero || villain) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 18 }}>
          {hero && <MoverCard mover={hero} kind="hero" onClick={() => navigate('/portfolio')} />}
          {villain && <MoverCard mover={villain} kind="villain" onClick={() => navigate('/portfolio')} />}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 18 }}>
        <PredictionCard classInfo={classInfo} et={et} />
        <ReportCard report={report} />
      </div>

      <LockedFeatures joinDays={joinDays} myRank={myRank} />
    </StudentLayout>
  )
}

// ----- all-time helpers (sum of holding-level all-time change) -----
function allTime(p) { return p.owned.reduce((s, h) => s + h.allTimeChange, 0) }
function allTimePct(p) {
  const cost = p.owned.reduce((s, h) => s + h.shares * h.avg, 0)
  return cost > 0 ? (allTime(p) / cost) * 100 : 0
}

// ---------- small components ----------
function StatusPill({ status }) {
  const map = {
    open: [colors.green, colors.greenDim], pre: [colors.gold, colors.goldDim],
    after: [colors.textMuted, colors.bgRaised], weekend: [colors.textMuted, colors.bgRaised],
    holiday: [colors.textMuted, colors.bgRaised],
  }
  const [c, bg] = map[status] || map.after
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: bg, fontSize: 12, fontWeight: 600, color: c }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
      {marketStatusLabel({ ...nowET() })}
    </span>
  )
}

function ChangeStat({ label, dollars, pct }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: colors.textFaint }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: chg(dollars) }}>
        {dollars >= 0 ? '+' : ''}{fmtMoney(dollars)} <span style={{ fontSize: 13 }}>({fmtPct(pct)})</span>
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, fontSize: 13.5 }}>
      <span style={{ color: colors.textFaint }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function MoverCard({ mover, kind, onClick }) {
  const isHero = kind === 'hero'
  const c = isHero ? colors.green : colors.red
  return (
    <Card onClick={onClick} style={{ padding: 18, cursor: 'pointer', border: `1px solid ${isHero ? colors.greenDim : colors.redDim}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: c }}>
          {isHero ? 'HERO OF THE DAY' : 'VILLAIN OF THE DAY'}
        </span>
        <span style={{ fontFamily: font.mono, fontWeight: 700, color: c }}>{fmtPct(mover.dp)}</span>
      </div>
      <div style={{ fontSize: 16.5, fontWeight: 700 }}>{mover.text}</div>
      <div style={{ fontSize: 12.5, color: colors.textFaint, marginTop: 6 }}>Tap to see {mover.ticker} in your portfolio →</div>
    </Card>
  )
}

function PredictionCard({ classInfo, et }) {
  const windowOpen = isPredictionWindowOpen(et)
  const required = classInfo?.require_predictions !== false
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: colors.gold, marginBottom: 10 }}>
        DAILY PREDICTION
      </div>
      {windowOpen ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 600 }}>The market opens soon. Call one of your stocks.</div>
          <div style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>
            Up or down — lock it in before 9:30 AM ET. Streaks and accuracy feed your rank.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {required ? 'Your next call opens at 6:00 AM ET.' : 'Predictions are optional in this class.'}
          </div>
          <div style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>
            Predict one portfolio stock each market morning. Build a streak, climb the board.
          </div>
        </>
      )}
      <div style={{ marginTop: 14 }}>
        <Button variant="secondary" disabled style={{ fontSize: 13.5, padding: '9px 16px' }}>
          Lock-in arrives in the prediction build
        </Button>
      </div>
    </Card>
  )
}

function ReportCard({ report }) {
  const [open, setOpen] = useState(false)
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: colors.gold, marginBottom: 10 }}>
        TODAY'S REPORT
      </div>
      {report ? (
        <>
          <div style={{ fontSize: 14.5, lineHeight: 1.55, color: colors.text }}>
            {open ? report.report_text : (report.report_text || '').slice(0, 180) + (report.report_text?.length > 180 ? '…' : '')}
          </div>
          {report.report_text?.length > 180 && (
            <button onClick={() => setOpen(!open)} style={{ color: colors.gold, fontSize: 13, fontWeight: 600, marginTop: 10 }}>
              {open ? 'Show less' : 'Read full report'}
            </button>
          )}
        </>
      ) : (
        <div style={{ fontSize: 14.5, color: colors.textMuted, lineHeight: 1.55 }}>
          Your first AI report drops after the next market close. It'll break down exactly what
          moved your portfolio — in plain English.
        </div>
      )}
    </Card>
  )
}

function LockedFeatures({ joinDays, myRank }) {
  const items = [
    { name: 'Thesis Validator', cond: joinDays >= 10, req: 'Day 10', desc: 'AI pressure-tests your reasoning before every buy.' },
    { name: 'Monthly Behavioral Report', cond: joinDays >= 30, req: 'Day 30', desc: 'See the investor you actually are — your patterns, exposed.' },
    { name: 'Class vs Class + Market Sovereign', cond: myRank === 1, req: 'Reach Rank #1', desc: 'The biggest unlock. Compete beyond your classroom.' },
  ]
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.textMuted, marginBottom: 12 }}>The Vault</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {items.map((it) => (
          <Card key={it.name} style={{ padding: 16, opacity: it.cond ? 1 : 0.6, border: `1px solid ${it.cond ? colors.goldDim : colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>{it.name}</span>
              <span style={{ fontSize: 16 }}>{it.cond ? '✓' : '🔒'}</span>
            </div>
            <div style={{ fontSize: 12.5, color: colors.textFaint, lineHeight: 1.4 }}>{it.desc}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: it.cond ? colors.green : colors.gold, marginTop: 8 }}>
              {it.cond ? 'UNLOCKED' : it.req}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textFaint, fontSize: 13.5, border: `1px dashed ${colors.border}`, borderRadius: radius.md }}>
      Buy your first stock to start your performance line.
    </div>
  )
}
