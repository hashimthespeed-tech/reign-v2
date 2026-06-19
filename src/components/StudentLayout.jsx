import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { colors, font } from '../theme'
import { Logo, Button } from './ui'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/learning', label: 'Learning' },
  { to: '/settings', label: 'Settings' },
]

export default function StudentLayout({ children, maxWidth = 1040 }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  return (
    <div style={{ minHeight: '100vh', fontFamily: font.sans }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(244,243,239,0.8)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{
          maxWidth, margin: '0 auto', padding: '12px 22px',
          display: 'flex', alignItems: 'center', gap: 24,
        }}>
          <NavLink to="/dashboard"><Logo size={16} /></NavLink>
          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} style={({ isActive }) => ({
                padding: '8px 13px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                color: isActive ? colors.text : colors.textFaint,
                background: isActive ? colors.bgRaised : 'transparent',
                transition: 'all 0.15s',
              })}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <span style={{ fontSize: 13.5, color: colors.textMuted }}>@{profile?.username}</span>
          <Button variant="ghost" style={{ padding: '7px 12px', fontSize: 13 }}
            onClick={async () => { await signOut(); navigate('/') }}>Sign out</Button>
        </div>
      </header>

      <main style={{ maxWidth, margin: '0 auto', padding: '28px 22px 80px' }}>
        {children}
      </main>
    </div>
  )
}
