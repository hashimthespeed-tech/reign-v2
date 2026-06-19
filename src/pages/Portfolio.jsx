import { useEffect, useState, useCallback } from 'react'
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { colors, radius, font } from '../theme'
import { getQuotes, getHistory, getNews, searchStocks, getProfile, analyzeThesis } from '../lib/api'
import { computePortfolio, fmtMoney, fmtPct } from '../lib/portfolio'
import { isMarketOpen } from '../lib/market'
import { daysInClass } from '../lib/dashboard'
import { executeBuy, executeSell, executeShort, executeCover } from '../lib/trade'
import StudentLayout from '../components/StudentLayout'
import AskReign from '../components/AskReign'
import RabbitHole from '../components/RabbitHole'
import { Card, Button, Input, Spinner } from '../components/ui'

const chg = (n) => (Number(n) > 0 ? colors.green : Number(n) < 0 ? colors.red : colors.textMuted)

export default function Portfolio() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [portfolio, setPortfolio] = useState(null)
  const [classInfo, setClassInfo] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [quotes, setQuotes] = useState({})
  const [spark, setSpark] = useState({})
  const [modal, setModal] = useState(null) // { mode:'search'|'ticket', stock, ticket }
  const [detail, setDetail] = useState(null) // holding

  const load = useCallback(async () => {
    if (!user) return
    const { data: pf } = await supabase.from('portfolios').select('*').eq('user_id', user.id).maybeSingle()
    const { data: hs } = await supabase.from('holdings').select('*').eq('portfolio_id', pf?.id || '0')
    const { data: cls } = pf?.class_id ? await supabase.from('classes').select('*').eq('id', pf.class_id).maybeSingle() : { data: null }
    setPortfolio(pf); setHoldings(hs || []); setClassInfo(cls)

    const tickers = [...new Set((hs || []).map((h) => (h.ticker || '').toUpperCase()))]
    const q = tickers.length ? await getQuotes(tickers) : {}
    setQuotes(q)
    // sparklines for owned
    const owned = (hs || []).filter((h) => Number(h.shares) > 0).map((h) => (h.ticker || '').toUpperCase())
    const sparks = await Promise.all(owned.map((t) => getHistory(t, '1mo').then((r) => [t, r.points]).catch(() => [t, []])))
    setSpark(Object.fromEntries(sparks))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // live refresh during market hours
  useEffect(() => {
    if (!isMarketOpen() || !holdings.length) return
    const id = setInterval(async () => {
      const tickers = [...new Set(holdings.map((h) => (h.ticker || '').toUpperCase()))]
      setQuotes(await getQuotes(tickers))
    }, 60000)
    return () => clearInterval(id)
  }, [holdings])

  async function afterTrade() {
    setModal(null); setDetail(null)
    await load()
    // refresh stored value for rank
    const { data: pf } = await supabase.from('portfolios').select('*').eq('user_id', user.id).maybeSingle()
    const { data: hs } = await supabase.from('holdings').select('*').eq('portfolio_id', pf.id)
    const tickers = [...new Set((hs || []).map((h) => (h.ticker || '').toUpperCase()))]
    const q = tickers.length ? await getQuotes(tickers) : {}
    const comp = computePortfolio({ cashBalance: pf.cash_balance, holdings: hs || [], quotes: q })
    await supabase.from('portfolios').update({ last_value: comp.totalValue, last_value_at: new Date().toISOString() }).eq('id', pf.id)
  }

  if (loading) return <StudentLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={30} /></div></StudentLayout>

  const p = computePortfolio({ cashBalance: portfolio?.cash_balance, holdings, quotes })
  const allowShort = !!classInfo?.allow_short_selling
  // Thesis Validator gate: teacher-forced (Day 1) OR unlocked at Day 10.
  const thesisActive = !!classInfo?.thesis_required || daysInClass(portfolio?.created_at) >= 10

  return (
    <StudentLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: font.display, fontSize: 30, fontWeight: 900, letterSpacing: '-0.025em' }}>Portfolio</h1>
        <Button onClick={() => setModal({ mode: 'search' })}>Buy a stock</Button>
      </div>

      {/* summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <Sum label="Total value" value={fmtMoney(p.totalValue)} />
        <Sum label="Cash available" value={fmtMoney(p.cash)} />
        <Sum label="Today" value={`${p.dayChangeDollars >= 0 ? '+' : ''}${fmtMoney(p.dayChangeDollars)}`} sub={fmtPct(p.dayChangePct)} color={chg(p.dayChangeDollars)} />
        <Sum label="% invested" value={`${p.pctInvested.toFixed(0)}%`} sub={`${p.pctCash.toFixed(0)}% cash`} />
      </div>

      {/* holdings */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Holdings</h3>
      {p.owned.length === 0 ? (
        <Card style={{ padding: 28, textAlign: 'center', color: colors.textMuted, marginBottom: 24 }}>
          You haven't bought anything yet. Hit <strong style={{ color: colors.gold }}>Buy a stock</strong> to start.
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          {p.owned.map((h, i) => (
            <HoldingRow key={h.id} h={h} spark={spark[(h.ticker || '').toUpperCase()]} first={i === 0}
              onClick={() => setDetail(h)} />
          ))}
        </Card>
      )}

      {/* watchlist */}
      {p.watchlist.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Watchlist</h3>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {p.watchlist.map((h, i) => (
              <WatchRow key={h.id} h={h} quote={quotes[(h.ticker || '').toUpperCase()]} first={i === 0}
                onBuy={() => setModal({ mode: 'ticket', stock: { ticker: h.ticker, name: h.company_name }, ticketMode: 'buy', existing: h })}
                onClick={() => setDetail(h)} />
            ))}
          </Card>
        </>
      )}

      {modal && (
        <TradeModal
          modal={modal} portfolio={portfolio} holdings={holdings} quotes={quotes}
          p={p} allowShort={allowShort} thesisActive={thesisActive}
          onClose={() => setModal(null)} onDone={afterTrade} />
      )}
      {detail && (
        <DetailDrawer holding={detail} portfolio={portfolio} quote={quotes[(detail.ticker || '').toUpperCase()]}
          allowShort={allowShort}
          onClose={() => setDetail(null)}
          onBuyMore={() => { setDetail(null); setModal({ mode: 'ticket', stock: { ticker: detail.ticker, name: detail.company_name }, ticketMode: 'buy', existing: detail }) }}
          onSell={() => { setDetail(null); setModal({ mode: 'ticket', stock: { ticker: detail.ticker, name: detail.company_name }, ticketMode: detail.is_short ? 'cover' : 'sell', existing: detail }) }}
        />
      )}
    </StudentLayout>
  )
}

// ---------- summary / rows ----------
function Sum({ label, value, sub, color }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11.5, color: colors.textFaint, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: color || colors.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: color || colors.textFaint, marginTop: 2 }}>{sub}</div>}
    </Card>
  )
}

function HoldingRow({ h, spark, first, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', borderTop: first ? 'none' : `1px solid ${colors.border}` }}>
      <div style={{ width: 86 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: font.mono, fontWeight: 700, fontSize: 15 }}>{h.ticker}</span>
          {h.isShort && <span style={{ fontSize: 9, fontWeight: 700, color: colors.red, background: colors.redDim, padding: '1px 5px', borderRadius: 4 }}>SHORT</span>}
        </div>
        <div style={{ fontSize: 11.5, color: colors.textFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 86 }}>{h.company_name}</div>
      </div>
      <div style={{ flex: 1, height: 38, minWidth: 60 }}>
        {spark?.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark}>
              <defs><linearGradient id={`sp-${h.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chg(h.allTimeChange)} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chg(h.allTimeChange)} stopOpacity={0} />
              </linearGradient></defs>
              <Area type="monotone" dataKey="close" stroke={chg(h.allTimeChange)} strokeWidth={1.5} fill={`url(#sp-${h.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={{ textAlign: 'right', width: 96 }}>
        <div style={{ fontWeight: 700 }}>{fmtMoney(h.price || 0)}</div>
        <div style={{ fontSize: 12, color: chg(h.dayChangePct) }}>{fmtPct(h.dayChangePct)}</div>
      </div>
      <div style={{ textAlign: 'right', width: 110 }}>
        <div style={{ fontWeight: 700 }}>{fmtMoney(h.marketValue)}</div>
        <div style={{ fontSize: 12, color: chg(h.allTimeChange) }}>
          {h.allTimeChange >= 0 ? '+' : ''}{fmtMoney(h.allTimeChange)}
        </div>
      </div>
      <div style={{ fontSize: 12, color: colors.textFaint, width: 64, textAlign: 'right' }}>{h.shares.toFixed(2)} sh</div>
    </div>
  )
}

function WatchRow({ h, quote, first, onBuy, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: first ? 'none' : `1px solid ${colors.border}` }}>
      <div onClick={onClick} style={{ flex: 1, cursor: 'pointer' }}>
        <span style={{ fontFamily: font.mono, fontWeight: 700, fontSize: 15 }}>{h.ticker}</span>
        <span style={{ fontSize: 12.5, color: colors.textFaint, marginLeft: 10 }}>{h.company_name}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700 }}>{quote?.c ? fmtMoney(quote.c) : '—'}</div>
        <div style={{ fontSize: 12, color: chg(quote?.dp) }}>{quote?.dp != null ? fmtPct(quote.dp) : ''}</div>
      </div>
      <Button style={{ padding: '7px 16px', fontSize: 13.5 }} onClick={onBuy}>Buy</Button>
    </div>
  )
}

// ---------- trade modal ----------
function ModalShell({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: wide ? 560 : 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <Card style={{ padding: 22 }}>{children}</Card>
      </div>
    </div>
  )
}

function TradeModal({ modal, portfolio, holdings, quotes, p, allowShort, thesisActive, onClose, onDone }) {
  const [stage, setStage] = useState(modal.mode === 'search' ? 'search' : (thesisActive && modal.ticketMode === 'buy' ? 'thesis' : 'ticket'))
  const [stock, setStock] = useState(modal.stock || null)
  const [ticketMode, setTicketMode] = useState(modal.ticketMode || 'buy')
  const [existing, setExisting] = useState(modal.existing || null)
  const [price, setPrice] = useState(null)
  const [desc, setDesc] = useState('')
  const [thesis, setThesis] = useState(existing?.thesis || '')
  const [analysis, setAnalysis] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // load quote + profile when a stock is chosen
  useEffect(() => {
    if (!stock?.ticker) return
    const tk = stock.ticker.toUpperCase()
    const known = quotes[tk]?.c
    if (known) setPrice(known)
    else getQuotes([tk]).then((q) => setPrice(q[tk]?.c ?? null))
    getProfile(tk).then((pr) => { if (pr) setDesc([pr.name, pr.industry].filter(Boolean).join(' · ')) }).catch(() => {})
  }, [stock, quotes])

  function pick(s) {
    const ex = holdings.find((h) => (h.ticker || '').toUpperCase() === s.symbol.toUpperCase())
    setStock({ ticker: s.symbol, name: s.name }); setExisting(ex || null)
    setTicketMode(ex?.is_short ? 'cover' : 'buy')
    setStage(thesisActive ? 'thesis' : 'ticket')
  }

  async function run(args) {
    setBusy(true); setErr('')
    let res
    if (ticketMode === 'buy') res = await executeBuy({ supabase, portfolio, existing, ticker: stock.ticker.toUpperCase(), companyName: stock.name || stock.ticker, price, dollarAmount: args.dollars, thesis: thesisActive ? thesis : undefined, thesisAi: analysis ? JSON.stringify(analysis) : undefined })
    else if (ticketMode === 'sell') res = await executeSell({ supabase, portfolio, holding: existing, price, sharesToSell: args.shares })
    else if (ticketMode === 'short') res = await executeShort({ supabase, portfolio, existing, ticker: stock.ticker.toUpperCase(), companyName: stock.name || stock.ticker, price, dollarAmount: args.dollars })
    else if (ticketMode === 'cover') res = await executeCover({ supabase, portfolio, holding: existing, price, sharesToCover: args.shares })
    setBusy(false)
    if (res?.error) return setErr(res.error)
    onDone()
  }

  return (
    <ModalShell onClose={onClose} wide={stage === 'search'}>
      {stage === 'search' && <SearchPanel onPick={pick} onClose={onClose} />}
      {stage === 'thesis' && (
        <ThesisStep stock={stock} thesis={thesis} setThesis={setThesis}
          analysis={analysis} setAnalysis={setAnalysis} p={p}
          onBack={() => setStage('search')} onNext={() => setStage('ticket')} />
      )}
      {stage === 'ticket' && (
        <Ticket stock={stock} desc={desc} price={price} mode={ticketMode} setMode={setTicketMode}
          existing={existing} cash={p.cash} totalValue={p.totalValue} allowShort={allowShort}
          busy={busy} err={err} onRun={run} onClose={onClose} />
      )}
    </ModalShell>
  )
}

function SearchPanel({ onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (q.trim().length < 1) { setResults([]); return }
    setBusy(true)
    const t = setTimeout(async () => { setResults(await searchStocks(q)); setBusy(false) }, 280)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div>
      <h3 style={{ fontFamily: font.display, fontSize: 21, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 14 }}>Find a stock</h3>
      <Input autoFocus placeholder="Search ticker or company (e.g. NVDA, Tesla)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ marginTop: 14, minHeight: 60 }}>
        {busy && <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner size={20} /></div>}
        {!busy && results.map((r) => (
          <div key={r.symbol} onClick={() => onPick(r)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 12px', borderRadius: 8, cursor: 'pointer', background: colors.bgRaised, marginBottom: 6 }}>
            <div>
              <span style={{ fontFamily: font.mono, fontWeight: 700 }}>{r.symbol}</span>
              <span style={{ fontSize: 13, color: colors.textFaint, marginLeft: 10 }}>{r.name}</span>
            </div>
            <span style={{ color: colors.gold, fontSize: 18 }}>→</span>
          </div>
        ))}
        {!busy && q.length >= 1 && results.length === 0 && (
          <div style={{ color: colors.textFaint, fontSize: 13.5, padding: 8 }}>No matches.</div>
        )}
      </div>
    </div>
  )
}

function ThesisStep({ stock, thesis, setThesis, analysis, setAnalysis, p, onBack, onNext }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const enough = thesis.trim().split(/[.!?]+/).filter((s) => s.trim().length > 3).length >= 2

  async function analyze() {
    setBusy(true); setErr('')
    try {
      const tk = stock.ticker.toUpperCase()
      const [news, hist] = await Promise.all([
        getNews(tk, 5).catch(() => []),
        getHistory(tk, '1mo').then((r) => r.points || []).catch(() => []),
      ])
      const portfolio = (p?.owned || []).map((h) => ({
        ticker: (h.ticker || '').toUpperCase(),
        pct: p.totalValue > 0 ? (h.marketValue / p.totalValue) * 100 : 0,
      }))
      const result = await analyzeThesis({
        ticker: tk, companyName: stock.name || tk, thesis: thesis.trim(),
        headlines: news.map((n) => n.headline).filter(Boolean).slice(0, 5),
        history: hist, portfolio,
      })
      if (!result) setErr("Reign couldn't analyze that one — you can still continue.")
      else setAnalysis(result)
    } catch {
      setErr('Reign is unavailable right now — you can still continue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h3 style={{ fontFamily: font.display, fontSize: 21, fontWeight: 900, letterSpacing: '-0.02em' }}>Why {stock.ticker}?</h3>
      <p style={{ color: colors.textMuted, fontSize: 13.5, margin: '6px 0 14px' }}>
        Write your reasoning — at least two sentences. Reign will pressure-test it. You can always continue.
      </p>
      <textarea value={thesis} onChange={(e) => { setThesis(e.target.value); if (analysis) setAnalysis(null) }} rows={5} disabled={busy}
        placeholder="I think it goes up because…"
        style={{ width: '100%', padding: 12, fontSize: 14.5, background: colors.bgRaised, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: radius.sm, resize: 'vertical', fontFamily: font.sans }} />

      {!analysis ? (
        <Button full loading={busy} disabled={!enough || busy} onClick={analyze} style={{ marginTop: 12 }}>
          {busy ? 'Reign is reading…' : 'Analyze with Reign'}
        </Button>
      ) : (
        <ThesisAnalysis a={analysis} onRedo={() => setAnalysis(null)} />
      )}
      {err && <div style={{ color: colors.gold, fontSize: 13, marginTop: 10 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Button variant="secondary" full onClick={onBack}>Back</Button>
        <Button full disabled={!enough} onClick={onNext}>Continue to buy</Button>
      </div>
    </div>
  )
}

const ALIGN_META = {
  supports: { c: colors.green, bg: colors.greenDim, label: 'News supports your thesis' },
  contradicts: { c: colors.red, bg: colors.redDim, label: 'News cuts against your thesis' },
  mixed: { c: colors.gold, bg: colors.goldDim, label: 'News is mixed on your thesis' },
}

function ThesisAnalysis({ a, onRedo }) {
  const m = ALIGN_META[a.alignment] || ALIGN_META.mixed
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: m.bg, color: m.c, fontSize: 12.5, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.c }} /> {m.label}
        </span>
        {onRedo && <button onClick={onRedo} style={{ fontSize: 12.5, color: colors.textFaint }}>Edit & re-analyze</button>}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: colors.text, marginBottom: 12 }}>{a.news_assessment}</div>
      <ThesisBit label="IF YOU'RE RIGHT" color={colors.green} text={a.if_right} />
      <ThesisBit label="WHAT COULD GO WRONG" color={colors.red} text={a.if_wrong} />
      <ThesisBit label="HAVE YOU CONSIDERED" color={colors.blue} text={a.blind_spot} />
    </div>
  )
}

function ThesisBit({ label, color, text }) {
  return (
    <div style={{ marginBottom: 9, padding: 11, background: colors.bgRaised, borderRadius: radius.sm, borderLeft: `2px solid ${color}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: colors.text }}>{text}</div>
    </div>
  )
}

function Ticket({ stock, desc, price, mode, setMode, existing, cash, totalValue, allowShort, busy, err, onRun, onClose }) {
  const [amount, setAmount] = useState('')
  const isSellSide = mode === 'sell' || mode === 'cover'

  // For buy/short: amount = dollars. For sell/cover: amount = shares.
  const dollars = !isSellSide ? Number(amount) || 0 : 0
  const shares = isSellSide ? Number(amount) || 0 : (price ? (Number(amount) || 0) / price : 0)
  const pctOfPortfolio = totalValue > 0 ? (dollars / totalValue) * 100 : 0
  const heldShares = existing ? Number(existing.shares) : 0

  const canSubmit = !busy && price > 0 && (isSellSide ? shares > 0 && shares <= heldShares + 1e-6 : dollars > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 800 }}>{stock.ticker}</div>
          <div style={{ fontSize: 13, color: colors.textFaint }}>{desc || stock.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: colors.textFaint }}>PRICE</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{price ? fmtMoney(price) : <Spinner size={16} />}</div>
        </div>
      </div>

      {/* mode switch (buy/short) when opening a new position */}
      {!isSellSide && allowShort && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14, background: colors.bgRaised, padding: 4, borderRadius: 10 }}>
          {['buy', 'short'].map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: 8, borderRadius: 7, fontWeight: 700, fontSize: 13.5, color: mode === m ? colors.text : colors.textFaint, background: mode === m ? colors.bgElevated : 'transparent' }}>
              {m === 'buy' ? 'Buy' : 'Short'}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 7 }}>
          {isSellSide ? `Shares to ${mode === 'cover' ? 'cover' : 'sell'} (you hold ${heldShares.toFixed(2)})` : 'Dollar amount'}
        </div>
        <Input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder={isSellSide ? '0' : '$0'} />
        {isSellSide && (
          <button onClick={() => setAmount(String(heldShares))} style={{ fontSize: 12.5, color: colors.gold, marginTop: 8 }}>Max ({heldShares.toFixed(2)})</button>
        )}
        {!isSellSide && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {[25, 50, 100].map((pctv) => (
              <button key={pctv} onClick={() => setAmount(String(Math.floor(cash * pctv / 100)))}
                style={{ fontSize: 12, color: colors.textMuted, background: colors.bgRaised, padding: '5px 10px', borderRadius: 6 }}>
                {pctv}% cash
              </button>
            ))}
          </div>
        )}
      </div>

      {/* live preview */}
      <div style={{ marginTop: 14, padding: 12, background: colors.bgRaised, borderRadius: radius.sm, fontSize: 13.5 }}>
        {!isSellSide ? (
          <>
            <Row k="Shares" v={price ? (dollars / price).toFixed(4) : '—'} />
            <Row k="% of portfolio" v={`${pctOfPortfolio.toFixed(1)}%`} />
            <Row k="Cash after" v={fmtMoney(cash - dollars)} />
          </>
        ) : (
          <>
            <Row k={mode === 'cover' ? 'Cost to cover' : 'Proceeds'} v={fmtMoney(shares * (price || 0))} />
            <Row k="Shares left" v={(heldShares - shares).toFixed(4)} />
          </>
        )}
      </div>

      {/* warnings */}
      {!isSellSide && pctOfPortfolio > 25 && (
        <Warn text={`This puts ${pctOfPortfolio.toFixed(0)}% of your portfolio in one stock. Make sure you know why.`} />
      )}
      {mode === 'sell' && (
        <SellDipWarning ticker={stock.ticker} />
      )}
      {err && <div style={{ color: colors.red, fontSize: 13.5, marginTop: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Button variant="secondary" full onClick={onClose}>Cancel</Button>
        <Button full loading={busy} disabled={!canSubmit}
          onClick={() => onRun(isSellSide ? { shares } : { dollars })}>
          {mode === 'buy' ? 'Confirm buy' : mode === 'short' ? 'Confirm short' : mode === 'cover' ? 'Confirm cover' : 'Confirm sell'}
        </Button>
      </div>
    </div>
  )
}

function SellDipWarning({ ticker }) {
  const [dp, setDp] = useState(null)
  useEffect(() => { getQuotes([ticker]).then((q) => setDp(q[ticker.toUpperCase()]?.dp ?? null)) }, [ticker])
  if (dp == null || dp > -3) return null
  return <Warn text={`You're selling after a ${Math.abs(dp).toFixed(1)}% drop today. Check your monthly report — you've done this before.`} />
}

function Warn({ text }) {
  return (
    <div style={{ marginTop: 12, padding: 11, background: colors.redDim, border: `1px solid ${colors.red}`, borderRadius: radius.sm, fontSize: 13, color: colors.red }}>
      {text}
    </div>
  )
}

function Row({ k, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: colors.textFaint }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
}

// ---------- stock detail drawer ----------
function DetailDrawer({ holding, portfolio, quote, onClose, onBuyMore, onSell }) {
  const tk = (holding.ticker || '').toUpperCase()
  const [hist, setHist] = useState([])
  const [news, setNews] = useState([])
  useEffect(() => {
    getHistory(tk, '3mo').then((r) => setHist(r.points || [])).catch(() => {})
    getNews(tk, 5).then(setNews).catch(() => {})
  }, [tk])
  const owns = Number(holding.shares) > 0
  let savedTake = null
  try { savedTake = holding.thesis_ai_response ? JSON.parse(holding.thesis_ai_response) : null } catch { savedTake = null }
  const askContext = `${tk} (${holding.company_name || tk}) at ${quote?.c ? fmtMoney(quote.c) : 'n/a'}${quote?.dp != null ? `, ${fmtPct(quote.dp)} today` : ''}.` +
    (owns ? ` The student holds ${Number(holding.shares).toFixed(2)} shares, avg ${fmtMoney(holding.avg_buy_price)}.` : '') +
    (holding.thesis ? ` Their thesis: "${holding.thesis}"` : '')
  const rhDepth = daysInClass(portfolio?.created_at) >= 30 ? 7 : 4
  const moveEvent = `${tk} (${holding.company_name || tk}) is ${quote?.dp != null ? `${fmtPct(quote.dp)} today` : 'moving today'}`
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'flex-end', zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', height: '100%', background: colors.bgElevated, borderLeft: `1px solid ${colors.border}`, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div style={{ fontFamily: font.mono, fontSize: 26, fontWeight: 800 }}>{tk}</div>
            <div style={{ fontSize: 13.5, color: colors.textFaint }}>{holding.company_name}</div>
          </div>
          <button onClick={onClose} style={{ fontSize: 22, color: colors.textFaint }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', margin: '8px 0 16px' }}>
          <span style={{ fontSize: 26, fontWeight: 800 }}>{quote?.c ? fmtMoney(quote.c) : '—'}</span>
          <span style={{ color: chg(quote?.dp), fontWeight: 600 }}>{quote?.dp != null ? fmtPct(quote.dp) : ''}</span>
        </div>

        <div style={{ height: 180, marginLeft: -8, marginBottom: 18 }}>
          {hist.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hist} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="date" hide /><YAxis domain={['dataMin', 'dataMax']} hide />
                <Tooltip contentStyle={{ background: colors.bgRaised, border: `1px solid ${colors.borderStrong}`, borderRadius: 10, fontSize: 12 }} formatter={(v) => [fmtMoney(v), 'Close']} />
                {owns && holding.avg_buy_price > 0 && (
                  <ReferenceLine y={holding.avg_buy_price} stroke={colors.gold} strokeDasharray="4 4"
                    label={{ value: `Your avg ${fmtMoney(holding.avg_buy_price)}`, fill: colors.gold, fontSize: 11, position: 'insideTopLeft' }} />
                )}
                <Line type="monotone" dataKey="close" stroke={colors.text} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {owns && (
          <Card style={{ padding: 14, marginBottom: 16, background: colors.bgRaised }}>
            <Row k="Shares" v={`${Number(holding.shares).toFixed(4)}${holding.is_short ? ' (short)' : ''}`} />
            <Row k="Avg price" v={fmtMoney(holding.avg_buy_price)} />
            <Row k="Market value" v={fmtMoney(Number(holding.shares) * (quote?.c || 0))} />
          </Card>
        )}

        {holding.thesis && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.gold, letterSpacing: '0.08em', marginBottom: 6 }}>YOUR THESIS</div>
            <div style={{ fontSize: 14, color: colors.text, lineHeight: 1.5 }}>{holding.thesis}</div>
          </div>
        )}

        {savedTake && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.gold, letterSpacing: '0.08em', marginBottom: 2 }}>REIGN'S TAKE</div>
            <ThesisAnalysis a={savedTake} />
          </div>
        )}

        {news.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.textMuted, letterSpacing: '0.08em', marginBottom: 8 }}>RECENT NEWS</div>
            {news.map((n, i) => (
              <div key={i} style={{ padding: '10px 0', borderTop: i ? `1px solid ${colors.border}` : 'none' }}>
                <a href={n.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 13.5, color: colors.text }}>
                  {n.headline}
                  <span style={{ display: 'block', fontSize: 11.5, color: colors.textFaint, marginTop: 2 }}>{n.source}</span>
                </a>
                <div style={{ marginTop: 6 }}>
                  <RabbitHole compact event={n.headline} depth={rhDepth} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <AskReign full context={askContext} />
          <RabbitHole full event={moveEvent} depth={rhDepth} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button full onClick={onBuyMore}>{owns && !holding.is_short ? 'Buy more' : 'Buy'}</Button>
          {owns && <Button variant="secondary" full onClick={onSell}>{holding.is_short ? 'Cover' : 'Sell'}</Button>}
        </div>
      </div>
    </div>
  )
}
