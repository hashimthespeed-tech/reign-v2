// Curated onboarding stock universe (spec §4 student Step 5).
export const STOCK_CATEGORIES = [
  {
    category: 'Tech',
    stocks: [
      { ticker: 'AAPL', name: 'Apple' },
      { ticker: 'MSFT', name: 'Microsoft' },
      { ticker: 'GOOGL', name: 'Alphabet (Google)' },
      { ticker: 'NVDA', name: 'NVIDIA' },
      { ticker: 'META', name: 'Meta Platforms' },
    ],
  },
  {
    category: 'Consumer',
    stocks: [
      { ticker: 'AMZN', name: 'Amazon' },
      { ticker: 'TSLA', name: 'Tesla' },
      { ticker: 'NKE', name: 'Nike' },
      { ticker: 'SBUX', name: 'Starbucks' },
      { ticker: 'MCD', name: "McDonald's" },
    ],
  },
  {
    category: 'Finance',
    stocks: [
      { ticker: 'JPM', name: 'JPMorgan Chase' },
      { ticker: 'V', name: 'Visa' },
      { ticker: 'BAC', name: 'Bank of America' },
      { ticker: 'GS', name: 'Goldman Sachs' },
    ],
  },
  {
    category: 'Energy & Other',
    stocks: [
      { ticker: 'XOM', name: 'ExxonMobil' },
      { ticker: 'CVX', name: 'Chevron' },
      { ticker: 'DIS', name: 'Disney' },
      { ticker: 'NFLX', name: 'Netflix' },
      { ticker: 'PFE', name: 'Pfizer' },
      { ticker: 'SPY', name: 'S&P 500 ETF' },
    ],
  },
]

// Flat lookup ticker -> company name
export const TICKER_NAMES = STOCK_CATEGORIES.reduce((acc, c) => {
  c.stocks.forEach((s) => { acc[s.ticker] = s.name })
  return acc
}, {})

export const INVESTOR_TYPES = [
  { value: 'aggressive', label: 'Aggressive', blurb: 'High risk, high reward. You go big.' },
  { value: 'cautious', label: 'Cautious', blurb: 'Steady and careful. You protect what you have.' },
  { value: 'long_term', label: 'Long Term', blurb: 'Patient. You think in years, not days.' },
  { value: 'no_idea', label: 'No idea yet', blurb: "That's why you're here. Let's find out." },
]

export const ACCOUNT_TYPES = [
  { value: 'standard', label: 'Standard', blurb: 'A regular brokerage account.' },
  { value: 'roth_ira', label: 'Roth IRA', blurb: 'Gains grow tax-free.' },
  { value: '401k', label: '401k', blurb: 'Pre-tax contributions.' },
]

// 6-char uppercase alphanumeric class code (no ambiguous chars: 0/O, 1/I).
export function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
