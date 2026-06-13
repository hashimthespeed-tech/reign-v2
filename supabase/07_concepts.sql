-- =====================================================================
--  REIGN v2 — 07: concept catalog (the Learning page arsenal)
--  Run in Supabase SQL Editor. Idempotent (unique name + on conflict).
--
--  unlock_requirement gates each concept by stage:
--    day_1  → The Watcher (everyone)      day_30 → The Analyst
--    day_10 → The Trader                  rank_1 → The Investor
-- =====================================================================

create unique index if not exists concepts_name_uniq on public.concepts(name);

insert into public.concepts (name, plain_english_name, hook, category, unlock_requirement, content) values

('stock_basics', 'What a Stock Really Is', 'A share of stock is a slice of a real business — not a lottery ticket.', 'basics', 'day_1',
'A stock is part-ownership of a company. Buy one share of Apple and you own a tiny piece of every iPhone sold, every dollar of profit, every factory.

Prices move because owning that slice becomes more or less attractive — better profits, new products, or just the mood of other buyers and sellers. Over the long run a stock tends to follow how the business actually does. Over days and weeks it follows emotion. Knowing which one you are betting on is the whole game.'),

('diversification', 'Diversification', 'Don''t put your whole portfolio in one stock — spread the risk.', 'basics', 'day_1',
'Diversification means owning different things so one bad bet can''t sink you. If every dollar is in one company and it drops 40%, you drop 40%. Spread across several companies and industries, and a single blow-up barely dents you.

The trade-off: diversification also caps your upside — you won''t 10x off one lucky pick. That''s the point. You are buying durability. A common rule of thumb is to keep any single position well under a quarter of your portfolio.'),

('bull_bear', 'Bull & Bear Markets', 'A bull market climbs, a bear market falls — and both end.', 'basics', 'day_1',
'A bull market is a sustained rise in prices and optimism. A bear market is a sustained fall — usually defined as a drop of 20% or more from the peak.

Both feel permanent while you are in them. They aren''t. Bulls make people overconfident; bears make people quit at the bottom. The investors who do well treat both as weather, not as identity. Your job is to keep making sound decisions in either one.'),

('risk_reward', 'Risk vs Reward', 'Bigger potential gains always come with bigger potential losses.', 'basics', 'day_1',
'Every investment trades risk for reward. A government bond barely moves and barely pays. A tiny biotech stock can triple or go to zero. There is no high reward without high risk — if someone promises one, walk away.

The skill isn''t avoiding risk; it''s taking risk you understand and can survive. Ask of any position: if this goes against me, how much do I lose, and can I take it?'),

('market_cap', 'Market Cap', 'Share price alone tells you almost nothing about a company''s size.', 'basics', 'day_1',
'Market capitalization = share price × number of shares. A $500 stock can be a smaller company than a $20 stock if the $20 company has far more shares outstanding.

Caps are loosely grouped as large (stable, slower), mid, and small (riskier, faster-moving). When you compare two companies, compare market caps, not sticker prices.'),

('dividends', 'Dividends', 'Some companies pay you just for holding their stock.', 'basics', 'day_1',
'A dividend is a slice of profit a company hands back to shareholders, usually quarterly. Mature, steady businesses pay them; fast-growing companies usually reinvest everything instead.

Dividends are real cash, but a high dividend yield can also be a warning — sometimes the yield is high because the price has crashed. A growing dividend backed by growing profits is the healthy kind.'),

('thesis_investing', 'Investing With a Thesis', 'Before you buy, you should be able to say why in one sentence.', 'strategy', 'day_10',
'A thesis is your reason for owning something: what you believe, and what would prove you right or wrong. "I think Nvidia keeps winning because AI demand is still accelerating" is a thesis. "It''s going up" is not.

A real thesis does two things. It keeps you from buying on hype, and it tells you when to sell — when the thesis breaks, not when the price wobbles. Write it down. Reign will pressure-test it.'),

('position_sizing', 'Position Sizing', 'How much you buy matters as much as what you buy.', 'strategy', 'day_10',
'Position sizing is deciding how big each bet is. A great idea sized too large can wreck you; a mediocre idea sized small barely matters.

A simple discipline: cap any single position so that, if it fell by half, you''d still be fine. Concentrate in your best ideas, but never so much that one mistake ends the game. Survival first, returns second.'),

('pe_ratio', 'The P/E Ratio', 'Price-to-earnings tells you how expensive a stock is relative to profit.', 'analysis', 'day_10',
'The P/E ratio is share price divided by earnings per share. A P/E of 25 means investors pay $25 for every $1 of annual profit. High P/E = the market expects fast growth; low P/E = cheap, or in trouble.

P/E is only useful in context — compare a company to its own history and its peers, not across wildly different industries. A high P/E isn''t automatically bad, and a low one isn''t automatically a bargain.'),

('volatility', 'Volatility', 'Volatility is how violently a price swings — not whether it goes up.', 'analysis', 'day_10',
'Volatility measures the size of price swings. A highly volatile stock can jump 8% one day and fall 6% the next. High volatility means bigger opportunities and bigger gut-checks.

Volatility is not the same as risk of permanent loss — a solid company can be volatile and still fine long-term. But high volatility punishes panic. If swings make you sell at the worst moment, size those positions smaller.'),

('short_selling', 'Short Selling', 'You can bet a stock will fall — but the risk is unusual.', 'strategy', 'day_10',
'Short selling means borrowing shares, selling them, and hoping to buy them back cheaper. If the price falls, you keep the difference. If it rises, you lose.

The catch: a stock can only fall to zero, but it can rise forever — so a short''s losses are theoretically unlimited. Shorting is a tool for specific situations, not a default. Respect it.'),

('loss_aversion', 'Loss Aversion', 'Losing $100 hurts about twice as much as gaining $100 feels good.', 'psychology', 'day_10',
'Humans hate losses far more than they enjoy equivalent gains. This bias makes investors sell winners too early to "lock in" a good feeling, and hold losers too long to avoid admitting a mistake.

The fix is to judge a position on its future, not on what you paid. The market doesn''t know or care about your purchase price. Ask only: would I buy this today?'),

('dca', 'Dollar-Cost Averaging', 'Buying steadily over time beats trying to time the perfect entry.', 'strategy', 'day_30',
'Dollar-cost averaging means investing a fixed amount on a schedule, regardless of price. Some buys land high, some land low, and you stop trying to guess the bottom.

It removes emotion and the impossible task of perfect timing. Its weakness is that, in a market that mostly rises, investing a lump sum sooner often wins. For most people, steady beats clever.'),

('compounding', 'The Power of Compounding', 'Returns earning returns is the closest thing investing has to magic.', 'basics', 'day_30',
'Compounding is when your gains start generating their own gains. 10% a year doesn''t add up — it multiplies. Money roughly doubles every seven years at 10%, and the back half of a long stretch dwarfs the front.

The two ingredients are rate and time, and time does the heavy lifting. This is why starting early and not interrupting the snowball matters more than picking the perfect stock.'),

('earnings_report', 'Reading an Earnings Report', 'Every quarter, companies show their report card — and the market reacts fast.', 'analysis', 'day_30',
'Four times a year, public companies report revenue, profit, and guidance for the future. Markets care less about the raw numbers and more about whether they beat or missed expectations — and what management says comes next.

A company can post record profits and still fall if it guided lower. Read past the headline to the guidance and the story behind it. Reactions are sharpest in the first hours.'),

('interest_rates', 'Interest Rates & the Market', 'When the cost of money changes, every stock feels it.', 'macro', 'day_30',
'Interest rates set by central banks ripple through everything. Higher rates make borrowing expensive and safe savings more attractive, which usually pressures stocks — especially fast-growing companies whose profits are far in the future.

Lower rates do the reverse: cheap money tends to lift risky assets. You don''t need to predict rates, but knowing this link explains why "good" companies sometimes fall on macro news.'),

('herd_mentality', 'Herd Mentality', 'The crowd is most confident at exactly the wrong moments.', 'psychology', 'day_30',
'Herd mentality is the pull to do what everyone else is doing — pile into what''s soaring, dump what''s falling. It feels safe because you''re not alone. It''s also how bubbles inflate and panics deepen.

The antidote isn''t to always do the opposite; it''s to have your own thesis so the crowd''s mood doesn''t become your decision. Notice when you''re buying because of FOMO.'),

('asset_allocation', 'Asset Allocation', 'How you split across types of investments drives most of your results.', 'strategy', 'rank_1',
'Asset allocation is the mix between stocks, bonds, cash, and other assets. Studies suggest this mix explains the large majority of a portfolio''s long-run returns and risk — more than individual stock picks.

Your right mix depends on your time horizon and how much volatility you can stomach. Longer horizon, more stocks. The point is to choose deliberately rather than ending up somewhere by accident.'),

('tax_accounts', 'Tax-Advantaged Accounts', 'Where you hold investments can matter as much as what you hold.', 'macro', 'rank_1',
'Accounts like a Roth IRA or 401(k) let investments grow with little or no tax, which compounds into a huge difference over decades. A taxable account is taxed on gains and dividends; a tax-advantaged one shelters them.

When you move from this simulator to real money, the account you choose is one of the highest-leverage decisions you''ll make. Learn the rules before you need them.')

on conflict (name) do nothing;

-- =====================================================================
--  DONE.  Verify with:  select count(*) from public.concepts;
-- =====================================================================
