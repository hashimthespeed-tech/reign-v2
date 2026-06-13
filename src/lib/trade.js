import { nowET } from './market.js'

const today = () => nowET().dateStr
const EPS = 1e-6

// Buy (open/add to a long, or convert a watchlist row to a position).
export async function executeBuy({ supabase, portfolio, existing, ticker, companyName, price, dollarAmount, thesis, thesisAi }) {
  if (!(price > 0)) return { error: 'No live price for this stock right now.' }
  if (dollarAmount <= 0) return { error: 'Enter an amount.' }
  const newCash = Number(portfolio.cash_balance) - dollarAmount
  if (newCash < -EPS) return { error: 'Not enough cash for that.' }
  const shares = dollarAmount / price

  if (existing && Number(existing.shares) > 0 && !existing.is_short) {
    const total = Number(existing.shares) + shares
    const newAvg = (existing.shares * existing.avg_buy_price + shares * price) / total
    const patch = { shares: total, avg_buy_price: newAvg, company_name: companyName }
    if (thesis) patch.thesis = thesis
    if (thesisAi) patch.thesis_ai_response = thesisAi
    const { error } = await supabase.from('holdings').update(patch).eq('id', existing.id)
    if (error) return { error: error.message }
  } else if (existing) {
    const { error } = await supabase.from('holdings').update({
      shares, avg_buy_price: price, company_name: companyName, is_short: false,
      thesis: thesis || existing.thesis, thesis_ai_response: thesisAi || existing.thesis_ai_response,
    }).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('holdings').insert({
      portfolio_id: portfolio.id, ticker, company_name: companyName,
      shares, avg_buy_price: price, thesis, thesis_ai_response: thesisAi,
    })
    if (error) return { error: error.message }
  }

  const { error: e2 } = await supabase.from('portfolios').update({ cash_balance: newCash }).eq('id', portfolio.id)
  if (e2) return { error: e2.message }
  await supabase.from('trades').insert({
    portfolio_id: portfolio.id, user_id: portfolio.user_id, ticker, company_name: companyName,
    trade_type: 'buy', shares, price_at_trade: price, total_value: dollarAmount, thesis, trade_date: today(),
  })
  return { ok: true, shares }
}

// Sell part or all of a long.
export async function executeSell({ supabase, portfolio, holding, price, sharesToSell }) {
  if (!(price > 0)) return { error: 'No live price for this stock right now.' }
  if (sharesToSell <= 0) return { error: 'Enter a quantity.' }
  if (sharesToSell > Number(holding.shares) + EPS) return { error: "You don't own that many shares." }
  const proceeds = sharesToSell * price
  const remaining = Number(holding.shares) - sharesToSell

  if (remaining <= EPS) {
    const { error } = await supabase.from('holdings').delete().eq('id', holding.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('holdings').update({ shares: remaining }).eq('id', holding.id)
    if (error) return { error: error.message }
  }
  const newCash = Number(portfolio.cash_balance) + proceeds
  const { error: e2 } = await supabase.from('portfolios').update({ cash_balance: newCash }).eq('id', portfolio.id)
  if (e2) return { error: e2.message }
  await supabase.from('trades').insert({
    portfolio_id: portfolio.id, user_id: portfolio.user_id, ticker: holding.ticker, company_name: holding.company_name,
    trade_type: 'sell', shares: sharesToSell, price_at_trade: price, total_value: proceeds, trade_date: today(),
  })
  return { ok: true }
}

// Open/add a short: receive proceeds now, owe shares back later.
export async function executeShort({ supabase, portfolio, existing, ticker, companyName, price, dollarAmount }) {
  if (!(price > 0)) return { error: 'No live price for this stock right now.' }
  if (dollarAmount <= 0) return { error: 'Enter an amount.' }
  if (dollarAmount > Number(portfolio.cash_balance) + EPS) return { error: 'Short size cannot exceed your cash balance.' }
  const shares = dollarAmount / price

  if (existing && existing.is_short && Number(existing.shares) > 0) {
    const total = Number(existing.shares) + shares
    const newAvg = (existing.shares * existing.avg_buy_price + shares * price) / total
    const { error } = await supabase.from('holdings').update({ shares: total, avg_buy_price: newAvg }).eq('id', existing.id)
    if (error) return { error: error.message }
  } else if (existing && Number(existing.shares) === 0) {
    const { error } = await supabase.from('holdings').update({ shares, avg_buy_price: price, is_short: true, company_name: companyName }).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('holdings').insert({
      portfolio_id: portfolio.id, ticker, company_name: companyName, shares, avg_buy_price: price, is_short: true,
    })
    if (error) return { error: error.message }
  }
  const newCash = Number(portfolio.cash_balance) + dollarAmount
  const { error: e2 } = await supabase.from('portfolios').update({ cash_balance: newCash }).eq('id', portfolio.id)
  if (e2) return { error: e2.message }
  await supabase.from('trades').insert({
    portfolio_id: portfolio.id, user_id: portfolio.user_id, ticker, company_name: companyName,
    trade_type: 'short', shares, price_at_trade: price, total_value: dollarAmount, trade_date: today(),
  })
  return { ok: true }
}

// Cover (buy back) a short: pay cash now.
export async function executeCover({ supabase, portfolio, holding, price, sharesToCover }) {
  if (!(price > 0)) return { error: 'No live price for this stock right now.' }
  if (sharesToCover <= 0) return { error: 'Enter a quantity.' }
  if (sharesToCover > Number(holding.shares) + EPS) return { error: 'You have not shorted that many shares.' }
  const cost = sharesToCover * price
  if (cost > Number(portfolio.cash_balance) + EPS) return { error: 'Not enough cash to cover.' }
  const remaining = Number(holding.shares) - sharesToCover

  if (remaining <= EPS) {
    const { error } = await supabase.from('holdings').delete().eq('id', holding.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('holdings').update({ shares: remaining }).eq('id', holding.id)
    if (error) return { error: error.message }
  }
  const newCash = Number(portfolio.cash_balance) - cost
  const { error: e2 } = await supabase.from('portfolios').update({ cash_balance: newCash }).eq('id', portfolio.id)
  if (e2) return { error: e2.message }
  await supabase.from('trades').insert({
    portfolio_id: portfolio.id, user_id: portfolio.user_id, ticker: holding.ticker, company_name: holding.company_name,
    trade_type: 'cover', shares: sharesToCover, price_at_trade: price, total_value: cost, trade_date: today(),
  })
  return { ok: true }
}
