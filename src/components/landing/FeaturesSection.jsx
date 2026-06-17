import { useRef } from 'react';
import { usePlexusCanvas } from '../../hooks/usePlexusCanvas';

/**
 * FeaturesSection — deep-black background with neon-green/gold/white plexus.
 * Frosted glass feature cards float above the canvas.
 * A glowing horizontal rail at the bottom divides it from the next section.
 */
export default function FeaturesSection() {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);

  usePlexusCanvas(canvasRef, wrapperRef, {
    particleCount: 50,
    colors: ['#10b981', '#c5a059', '#ffffff'],
    lineDist: 120,
    speedMult: 0.9,
    nodeOpacity: 0.14,
    lineOpacity: 0.07,
  });

  const wrapperStyle = {
    position: 'relative',
    width: '100%',
    backgroundColor: '#050507',
    overflow: 'hidden',
    color: '#ffffff',
  };

  const canvasStyle = {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    zIndex: 0,
    pointerEvents: 'none',
  };

  const dividerStyle = {
    position: 'absolute',
    bottom: 0, left: 0,
    width: '100%',
    height: '1.5px',
    background: 'rgba(255,255,255,0.45)',
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

  const sectionStyle = {
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.85fr',
    alignItems: 'flex-start',
    gap: '80px',
    paddingTop: '140px',
    paddingBottom: '120px',
  };

  const badgeStyle = {
    display: 'inline-flex',
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '30px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#a1a1aa',
    marginBottom: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const h2Style = {
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    color: '#ffffff',
    marginBottom: '18px',
  };

  const pStyle = {
    fontSize: '1.25rem',
    color: '#a1a1aa',
    lineHeight: 1.6,
    maxWidth: '520px',
  };

  const cardsWrapStyle = {
    width: '100%',
    maxWidth: '450px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    margin: '0 auto',
  };

  const features = [
    {
      icon: '📊',
      title: 'Real-Time Exchange',
      desc: 'Trade equities and options with live price ticks directly sourced from the New York Stock Exchange. No delays, no placeholders.',
    },
    {
      icon: '🤖',
      title: 'AI Portfolio Audits',
      desc: 'Reign-AI parses student trade logs and translates portfolio swings into plain English, generating clear performance reviews for teachers.',
    },
    {
      icon: '🏆',
      title: 'Class Tournaments',
      desc: 'Host classroom challenges, coordinate budget limits, and trigger peak-volatility events like the Opening Bell.',
    },
  ];

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      <main style={containerStyle}>
        <section style={sectionStyle}>
          {/* Left: section copy */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={badgeStyle}>Platform Capabilities</span>
            <h2 style={h2Style}>Simulate. Learn. Lead.</h2>
            <p style={pStyle}>
              A professional-grade terminal built from the ground up for high school and college classrooms.
              Spark real-time engagement and track performance metrics seamlessly.
            </p>
          </div>

          {/* Right: frosted glass feature cards */}
          <div style={cardsWrapStyle}>
            {features.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} />
            ))}
          </div>
        </section>
      </main>

      <div style={dividerStyle} />
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  const cardStyle = {
    background: 'rgba(255,255,255,0.02)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: '16px',
    padding: '28px',
    color: '#ffffff',
    boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(12px) saturate(1.2)',
    WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>{title}</h3>
      </div>
      <p style={{ fontSize: '0.95rem', color: '#a1a1aa', lineHeight: 1.5, margin: 0 }}>{desc}</p>
    </div>
  );
}
