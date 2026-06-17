import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import StepsSection from './StepsSection';
import CtaSection from './CtaSection';

/**
 * NetworkVistaPage — full "Network Vista" landing page.
 *
 * ─── PROPS ────────────────────────────────────────────────────────────────────
 *
 * portfolioValue     {number}   Total portfolio dollar value.  e.g. 10240.50
 * portfolioDirection {string}   'up' | 'down'  — drives the ▲/▼ indicator color.
 *
 * stocks             {Array}    Array of live stock objects (pass as many as you like):
 *   [
 *     {
 *       id:            {string}  unique key, e.g. 'aapl'
 *       symbol:        {string}  ticker symbol, e.g. 'AAPL'
 *       name:          {string}  company name, e.g. 'Apple'
 *       iconLetter:    {string}  single letter for the icon badge (optional, defaults to symbol[0])
 *       price:         {number}  current price, e.g. 180.50
 *       changePercent: {number}  % change (positive or negative), e.g. 2.40 or -4.10
 *       direction:     {string}  'up' | 'down'
 *     },
 *     ...
 *   ]
 *
 * chartPoints        {number[]}  Array of Y-axis values for the SVG chart line.
 *                                Lower Y = higher on screen. 20 points recommended.
 *                                e.g. [90, 85, 92, 88, 95, 80, ...]
 *
 * primaryStockId     {string}   id of the stock whose price shows in the chart tag.
 *                                Defaults to the first stock.
 *
 * onJoin             {function} optional — fired by "join a class" CTAs.
 * onCreateClass      {function} optional — fired by "create a class" CTAs.
 */
export default function NetworkVistaPage({
  portfolioValue = 10240.5,
  portfolioDirection = 'up',
  stocks = [
    { id: 'aapl', symbol: 'AAPL', name: 'Apple',  iconLetter: 'A', price: 180.50, changePercent:  2.40, direction: 'up' },
    { id: 'nvda', symbol: 'NVDA', name: 'Nvidia', iconLetter: 'N', price: 485.20, changePercent: -4.10, direction: 'down' },
  ],
  chartPoints = [90, 85, 92, 88, 95, 80, 85, 75, 80, 70, 78, 65, 72, 68, 60, 65, 55, 50, 48, 45],
  primaryStockId,
  onJoin,
  onCreateClass,
}) {
  const pageStyle = {
    margin: 0,
    padding: 0,
    backgroundColor: '#0a0a0c',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    overflowX: 'hidden',
    WebkitFontSmoothing: 'antialiased',
  };

  return (
    <div style={pageStyle}>
      <HeroSection
        portfolioValue={portfolioValue}
        portfolioDirection={portfolioDirection}
        stocks={stocks}
        chartPoints={chartPoints}
        primaryStockId={primaryStockId}
        onJoin={onJoin}
        onCreateClass={onCreateClass}
      />
      <FeaturesSection />
      <StepsSection />
      <CtaSection onJoin={onJoin} onCreateClass={onCreateClass} />
    </div>
  );
}
