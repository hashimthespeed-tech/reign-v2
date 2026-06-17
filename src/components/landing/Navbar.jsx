/**
 * Navbar — fixed pill-shaped navigation bar.
 * onJoin / onCreateClass fire the navbar CTAs (wired to onboarding by the page).
 */
export default function Navbar({ onJoin, onCreateClass }) {
  const navStyle = {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 80px)',
    maxWidth: '1320px',
    zIndex: 100,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    background: 'rgba(244, 243, 239, 0.35)',
    backdropFilter: 'blur(25px)',
    WebkitBackdropFilter: 'blur(25px)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '40px',
    boxSizing: 'border-box',
  };

  const logoStyle = {
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontWeight: 900,
    fontSize: '1.4rem',
    letterSpacing: '-0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    color: '#0a0a0c',
  };

  const logoDotStyle = {
    width: '6px',
    height: '6px',
    backgroundColor: '#0a0a0c',
    borderRadius: '50%',
  };

  const navLinksStyle = {
    display: 'flex',
    gap: '32px',
  };

  const navLinkStyle = {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#5e5e64',
    textDecoration: 'none',
  };

  const btnStyle = {
    backgroundColor: '#0a0a0c',
    color: 'white',
    border: '1px solid #0a0a0c',
    padding: '8px 18px',
    fontSize: '0.85rem',
    fontWeight: 600,
    borderRadius: '100px',
    cursor: 'pointer',
  };

  return (
    <nav style={navStyle}>
      <a href="#" style={logoStyle}>
        REIGN<span style={logoDotStyle} />
      </a>

      <div style={navLinksStyle}>
        <a href="#" style={navLinkStyle}>Simulator</a>
        <a href="#" style={navLinkStyle}>Classrooms</a>
        <a href="#" style={navLinkStyle}>AI Reports</a>
      </div>

      <button style={btnStyle} onClick={onCreateClass}>Create Class</button>
    </nav>
  );
}
