import { useState, useRef, useCallback, useMemo } from 'react';

/**
 * DashboardMockup — the piano-black mockup card with live stock data.
 *
 * Props:
 *  portfolioValue    {number}   e.g. 10240.50
 *  portfolioDirection {string}  'up' | 'down'
 *  stocks            {Array}    Array of stock objects:
 *    [{ id, symbol, name, iconLetter, price, changePercent, direction }]
 *    direction: 'up' | 'down'
 *  chartPoints       {number[]} Array of Y-values for the SVG line chart (20 points recommended)
 *  primaryStockId    {string}   id of stock to show in the chart price tag (default: first stock)
 */
export default function DashboardMockup({
  portfolioValue = 10240.5,
  portfolioDirection = 'up',
  stocks = [],
  chartPoints = [],
  primaryStockId,
}) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotY: -10, rotX: 5 });
  const [isHovered, setIsHovered] = useState(false);

  // 3D tilt on mouse move
  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cardCX = rect.left + rect.width / 2;
    const cardCY = rect.top + rect.height / 2;
    const mx = (e.clientX - cardCX) / (window.innerWidth / 2);
    const my = (e.clientY - cardCY) / (window.innerHeight / 2);
    setTilt({ rotY: mx * 14, rotX: -my * 12 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotY: -10, rotX: 5 });
    setIsHovered(false);
  }, []);

  // Build SVG chart path from chartPoints
  const chartSvg = useMemo(() => {
    if (!chartPoints || chartPoints.length < 2) return { pathD: 'M 0 80 L 400 80', areaD: 'M 0 80 L 400 80 L 400 120 L 0 120 Z' };
    const width = 400;
    const height = 120;
    const step = width / (chartPoints.length - 1);
    const pathD = chartPoints.reduce((acc, y, i) => acc + (i === 0 ? `M 0 ${y}` : ` L ${i * step} ${y}`), '');
    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
    const last = chartPoints[chartPoints.length - 1];
    const prev = chartPoints[chartPoints.length - 2];
    const isUp = last <= prev; // lower Y = higher on the chart
    return { pathD, areaD, isUp };
  }, [chartPoints]);

  const primaryStock = stocks.find(s => s.id === primaryStockId) || stocks[0];

  // --- Style objects ---
  const cardStyle = {
    width: '100%',
    maxWidth: '450px',
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    background: '#000000',
    border: '1.5px solid rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    color: '#ffffff',
    transform: `perspective(1000px) rotateY(${tilt.rotY}deg) rotateX(${tilt.rotX}deg)${isHovered ? ' translateY(-8px)' : ''}`,
    boxShadow: '0 0 35px rgba(255, 255, 255, 0.15), 0 30px 80px rgba(0, 0, 0, 0.95)',
    transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s, box-shadow 0.4s',
    position: 'relative',
    boxSizing: 'border-box',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  const mockHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const mockUserStyle = { display: 'flex', alignItems: 'center', gap: '12px' };

  const avatarStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a1a1a6 0%, #3f3f46 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
  };

  const badgeStyle = {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontFamily: 'monospace',
  };

  const balanceLabelStyle = { fontSize: '0.75rem', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.05em' };

  const balanceRowStyle = { display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' };

  const balanceAmountStyle = {
    fontSize: '2.3rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    fontFamily: "'Cabinet Grotesk', sans-serif",
  };

  const pulsStyle = {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: portfolioDirection === 'up' ? '#10b981' : '#ef4444',
    transform: portfolioDirection === 'up' ? 'translateY(-2px)' : 'translateY(2px) rotate(180deg)',
    display: 'inline-block',
  };

  const chartWrapStyle = {
    height: '130px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
  };

  const chartTagStyle = {
    position: 'absolute',
    right: '10px',
    bottom: '15px',
    background: chartSvg.isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
    border: chartSvg.isUp ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 700,
    fontFamily: 'monospace',
    color: chartSvg.isUp ? '#10b981' : '#ef4444',
  };

  const stocksWrapStyle = { display: 'flex', flexDirection: 'column', gap: '12px' };

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div style={mockHeaderStyle}>
        <div style={mockUserStyle}>
          <div style={avatarStyle}>L</div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Liam Carter</div>
            <div style={{ fontSize: '0.75rem', color: '#8e8e93' }}>Rank #3 in Class</div>
          </div>
        </div>
        <div style={badgeStyle}>REIGN-X92</div>
      </div>

      {/* Portfolio balance */}
      <div>
        <div style={balanceLabelStyle}>Portfolio Value</div>
        <div style={balanceRowStyle}>
          <span style={balanceAmountStyle}>
            {typeof portfolioValue === 'number'
              ? `$${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : portfolioValue}
          </span>
          <span style={pulsStyle}>{portfolioDirection === 'up' ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Chart */}
      <div style={chartWrapStyle}>
        <svg
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartSvg.isUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'} />
              <stop offset="100%" stopColor={chartSvg.isUp ? 'rgba(16,185,129,0)' : 'rgba(239,68,68,0)'} />
            </linearGradient>
          </defs>
          <path
            d={chartSvg.pathD}
            fill="none"
            stroke={chartSvg.isUp ? '#10b981' : '#ef4444'}
            strokeWidth="2.5"
          />
          <path d={chartSvg.areaD} fill="url(#chartGrad)" />
        </svg>
        {primaryStock && (
          <div style={chartTagStyle}>
            ${typeof primaryStock.price === 'number' ? primaryStock.price.toFixed(2) : primaryStock.price}
          </div>
        )}
      </div>

      {/* Stock rows */}
      <div style={stocksWrapStyle}>
        {stocks.map((stock) => (
          <StockRow key={stock.id} stock={stock} />
        ))}
      </div>
    </div>
  );
}

function StockRow({ stock }) {
  const { symbol, name, iconLetter = symbol?.[0] ?? '?', price, changePercent, direction = 'up' } = stock;
  const isUp = direction === 'up';

  const rowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '12px',
    transition: 'background 0.3s, border-color 0.3s',
  };

  const iconStyle = {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: '#18181b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.8rem',
    border: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  };

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={iconStyle}>{iconLetter}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{name}</div>
          <div style={{ fontSize: '0.7rem', color: '#8e8e93' }}>{symbol}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
          ${typeof price === 'number' ? price.toFixed(2) : price}
        </div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isUp ? '#10b981' : '#ef4444' }}>
          {isUp ? '+' : ''}{typeof changePercent === 'number' ? changePercent.toFixed(2) : changePercent}%
        </div>
      </div>
    </div>
  );
}
