import { useRef } from 'react';
import { usePlexusCanvas } from '../../hooks/usePlexusCanvas';

/**
 * CtaSection — deep-black CTA + footer wrapper with gold/white plexus.
 * No divider rail at the bottom (it's the last section).
 * onJoin / onCreateClass fire the CTA buttons (wired to onboarding by the page).
 */
export default function CtaSection({ onJoin, onCreateClass }) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);

  usePlexusCanvas(canvasRef, wrapperRef, {
    particleCount: 40,
    colors: ['#c5a059', '#ffffff'],
    lineDist: 140,
    speedMult: 1.2,
    nodeOpacity: 0.16,
    lineOpacity: 0.08,
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

  const actionsStyle = {
    width: '100%',
    maxWidth: '450px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    margin: '0 auto',
    justifyContent: 'center',
  };

  const btnPrimaryStyle = {
    width: '100%',
    padding: '16px',
    fontSize: '1rem',
    fontWeight: 700,
    borderRadius: '100px',
    cursor: 'pointer',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    color: '#0a0a0c',
    border: '1.5px solid #ffffff',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  const btnSecondaryStyle = {
    width: '100%',
    padding: '16px',
    fontSize: '1rem',
    fontWeight: 700,
    borderRadius: '100px',
    cursor: 'pointer',
    textAlign: 'center',
    backgroundColor: 'transparent',
    color: '#ffffff',
    border: '1.5px solid rgba(255,255,255,0.25)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  const footerStyle = {
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.85fr',
    gap: '80px',
    padding: '80px 0 60px',
    borderTop: '1.5px solid rgba(255,255,255,0.08)',
    fontSize: '0.85rem',
    position: 'relative',
    zIndex: 1,
  };

  const footerLogoStyle = {
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontWeight: 900,
    fontSize: '1.3rem',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '12px',
  };

  const logoDotStyle = {
    width: '6px',
    height: '6px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
  };

  const footerLinkStyle = {
    color: '#a1a1aa',
    textDecoration: 'none',
    fontWeight: 600,
  };

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      <main style={containerStyle}>
        {/* CTA section */}
        <section style={sectionStyle}>
          {/* Left: CTA copy */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={badgeStyle}>Get Started</span>
            <h2 style={h2Style}>Empower the next generation.</h2>
            <p style={pStyle}>
              Give your students a premium, simulated introduction to Wall Street and global financial markets.
            </p>
          </div>

          {/* Right: CTA buttons */}
          <div style={actionsStyle}>
            <button style={btnPrimaryStyle} onClick={onCreateClass}>Create Your Class</button>
            <button style={btnSecondaryStyle} onClick={onJoin}>Join a Class</button>
          </div>
        </section>

        {/* Footer */}
        <footer style={footerStyle}>
          <div style={{ color: '#71717a' }}>
            <div style={footerLogoStyle}>
              REIGN<span style={logoDotStyle} />
            </div>
            <p style={{ lineHeight: 1.5 }}>
              © 2026 Reign Technologies Inc. All equities and pricing records simulated.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginLeft: 'auto', maxWidth: '450px' }}>
            <a href="#" style={footerLinkStyle}>Privacy Agreement</a>
            <a href="#" style={footerLinkStyle}>Terms of Service</a>
            <a href="#" style={footerLinkStyle}>Help &amp; Support</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
