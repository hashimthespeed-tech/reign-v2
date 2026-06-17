import { useRef } from 'react';
import { usePlexusCanvas } from '../../hooks/usePlexusCanvas';

/**
 * StepsSection — warm ivory-cream background with gold/charcoal plexus.
 * Solid black "step" cards pop on the light background.
 * A glowing horizontal rail at the bottom divides it from the CTA section.
 */
export default function StepsSection() {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);

  usePlexusCanvas(canvasRef, wrapperRef, {
    particleCount: 45,
    colors: ['#c5a059', '#4b5563'],
    lineDist: 130,
    speedMult: 0.8,
    nodeOpacity: 0.15,
    lineOpacity: 0.09,
  });

  const wrapperStyle = {
    position: 'relative',
    width: '100%',
    backgroundColor: '#f4f3ef',
    overflow: 'hidden',
    color: '#0a0a0c',
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
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '30px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#5e5e64',
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
    color: '#0a0a0c',
    marginBottom: '18px',
  };

  const pStyle = {
    fontSize: '1.25rem',
    color: '#374151',
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

  const steps = [
    {
      num: '01',
      title: 'Deploy Classrooms',
      desc: 'Set custom cash balances, trading tickers, and game length. Share the classroom code with students to invite them instantly.',
    },
    {
      num: '02',
      title: 'Execute Trades',
      desc: 'Students monitor ticking asset tickers, analyze scrolling trendlines, and submit buy or sell orders under real market spreads.',
    },
    {
      num: '03',
      title: 'Analyze AI Reports',
      desc: 'Get daily performance audits detailing student compliance, strategy metrics, and leaderboard standing automatically.',
    },
  ];

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      <main style={containerStyle}>
        <section style={sectionStyle}>
          {/* Left: section copy */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={badgeStyle}>Classroom Flow</span>
            <h2 style={h2Style}>Three steps to mastery.</h2>
            <p style={pStyle}>
              Deploy trading simulators in minutes, track organic student progress, and analyze performance reports automatically.
            </p>
          </div>

          {/* Right: solid black step cards */}
          <div style={cardsWrapStyle}>
            {steps.map((s) => (
              <StepCard key={s.num} num={s.num} title={s.title} desc={s.desc} />
            ))}
          </div>
        </section>
      </main>

      <div style={dividerStyle} />
    </div>
  );
}

function StepCard({ num, title, desc }) {
  const cardStyle = {
    background: '#000000',
    border: '1.5px solid rgba(255,255,255,0.45)',
    borderRadius: '16px',
    padding: '28px',
    color: '#ffffff',
    boxShadow: '0 0 30px rgba(255,255,255,0.12), 0 20px 50px rgba(0,0,0,0.95)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  return (
    <div style={cardStyle}>
      <span style={{
        display: 'block',
        fontFamily: "'Cabinet Grotesk', sans-serif",
        fontSize: '2.2rem',
        fontWeight: 900,
        color: '#c5a059',
        lineHeight: 1,
        marginBottom: '10px',
      }}>
        {num}
      </span>
      <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', margin: '0 0 8px' }}>{title}</h4>
      <p style={{ fontSize: '0.95rem', color: '#a1a1aa', lineHeight: 1.5, margin: 0 }}>{desc}</p>
    </div>
  );
}
