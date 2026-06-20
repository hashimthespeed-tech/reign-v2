import { useRef } from 'react';
import { useHeroCanvas } from '../../hooks/useHeroCanvas';
import Navbar from './Navbar';
import DashboardMockup from './DashboardMockup';

/**
 * HeroSection — the full-viewport opening section.
 * Canvas draws the animated S-curve cream/black background + plexus.
 * A glowing horizontal rail div sits at the very bottom as the section divider.
 *
 * Props are passed through to DashboardMockup (see DashboardMockup.jsx for prop docs).
 * onJoin / onCreateClass fire the hero CTAs.
 */
export default function HeroSection({ portfolioValue, portfolioDirection, stocks, chartPoints, primaryStockId, onJoin, onCreateClass, onLogin }) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);

  useHeroCanvas(canvasRef, wrapperRef);

  const wrapperStyle = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    overflow: 'hidden',
  };

  const canvasStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    pointerEvents: 'none',
  };

  // Glowing horizontal divider rail at the bottom of the section
  const dividerStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '1.5px',
    background: 'rgba(255, 255, 255, 0.45)',
    boxShadow: '0 0 10px rgba(255,255,255,0.4), 0 0 3px rgba(255,255,255,0.2)',
    zIndex: 10,
    pointerEvents: 'none',
  };

  const containerStyle = {
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 40px',
    position: 'relative',
    zIndex: 1,
    boxSizing: 'border-box',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.85fr',
    alignItems: 'center',
    gap: '80px',
    minHeight: '100vh',
    paddingTop: '140px',
    paddingBottom: '120px',
  };

  const badgeStyle = {
    display: 'inline-flex',
    padding: '6px 12px',
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '30px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#5e5e64',
    marginBottom: '24px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const h1Style = {
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontSize: 'clamp(3.5rem, 6.5vw, 5.5rem)',
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: '-0.03em',
    marginBottom: '20px',
    color: '#0a0a0c',
  };

  const pStyle = {
    fontSize: '1.35rem',
    marginBottom: '40px',
    color: '#374151',
    lineHeight: 1.6,
    maxWidth: '520px',
  };

  const inlineStockStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(16,185,129,0.06)',
    border: '1px solid rgba(16,185,129,0.3)',
    padding: '2px 8px',
    borderRadius: '6px',
    fontWeight: 600,
    margin: '0 4px',
    color: '#047857',
  };

  const ctasStyle = { display: 'flex', gap: '16px' };

  const btnPrimaryStyle = {
    backgroundColor: '#0a0a0c',
    color: 'white',
    border: '1px solid #0a0a0c',
    padding: '14px 28px',
    fontSize: '0.95rem',
    fontWeight: 600,
    borderRadius: '100px',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  const visualStyle = {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      <Navbar onJoin={onJoin} onCreateClass={onCreateClass} onLogin={onLogin} />

      <main style={containerStyle}>
        <section style={gridStyle}>
          {/* Left: Hero copy */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={badgeStyle}>Network Collection</div>
            <h1 style={h1Style}>Trade the street.</h1>
            <p style={pStyle}>
              A classroom simulator running on real market data. Hand students{' '}
              <span style={inlineStockStyle}>$10,000</span>{' '}
              and let them compete. AI reports write the daily wrap-up.
            </p>
            <div style={ctasStyle}>
              <button style={btnPrimaryStyle} onClick={onCreateClass}>Create a Class</button>
              <button style={btnPrimaryStyle} onClick={onJoin}>Join a Class</button>
            </div>
          </div>

          {/* Right: Live mockup card */}
          <div style={visualStyle}>
            <DashboardMockup
              portfolioValue={portfolioValue}
              portfolioDirection={portfolioDirection}
              stocks={stocks}
              chartPoints={chartPoints}
              primaryStockId={primaryStockId}
            />
          </div>
        </section>
      </main>

      {/* Section divider rail */}
      <div style={dividerStyle} />
    </div>
  );
}
