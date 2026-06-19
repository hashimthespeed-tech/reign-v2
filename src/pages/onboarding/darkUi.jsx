// Dark onboarding UI kit — mirrors the shared components/ui.jsx API but styled
// to match the landing page's dark plexus sections (FeaturesSection / CtaSection /
// DashboardMockup). Scoped to onboarding so the cream app theme stays untouched.
//
// The token object below is exported as `dark` and imported `as colors` by the
// step components, so their existing inline `colors.X` usages resolve to dark
// values with zero churn to the form logic.
import { useRef } from 'react'
import { font } from '../../theme'
import { Logo as BaseLogo, Spinner as BaseSpinner } from '../../components/ui'
import { usePlexusCanvas } from '../../hooks/usePlexusCanvas'

export const dark = {
  bg: '#050507',
  text: '#ffffff',
  textMuted: '#a1a1aa',
  textFaint: '#8e8e93',
  red: '#ef4444',
  green: '#10b981',
  gold: '#c5a059',
  goldSoft: '#d8b878',
  goldDim: 'rgba(197,160,89,0.16)',
  bgRaised: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.22)',
  ink: '#000000',
}

// DashboardMockup card language
const CARD_BG = '#000000'
const CARD_BORDER = 'rgba(255,255,255,0.45)'
const CARD_SHADOW = '0 0 35px rgba(255,255,255,0.15), 0 30px 80px rgba(0,0,0,0.95)'

// ---------- Wordmark / spinner (white on dark) ----------
export function Logo(props) {
  return <BaseLogo color="#ffffff" {...props} />
}
export function Spinner(props) {
  return <BaseSpinner color={dark.gold} {...props} />
}

// ---------- Shell: plexus canvas + centered glowing black card ----------
export function OnboardingShell({ children, maxWidth = 460, card = true }) {
  const wrapperRef = useRef(null)
  const canvasRef = useRef(null)
  usePlexusCanvas(canvasRef, wrapperRef, {
    particleCount: 45,
    colors: ['#c5a059', '#ffffff'],
    lineDist: 135,
    speedMult: 1.0,
    nodeOpacity: 0.16,
    lineOpacity: 0.08,
  })

  return (
    <div ref={wrapperRef} style={{
      position: 'relative', minHeight: '100vh', width: '100%',
      background: dark.bg, color: dark.text, fontFamily: font.sans,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '64px 20px', boxSizing: 'border-box',
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }} />
      {/* ambient depth glows */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background:
          'radial-gradient(900px 520px at 50% -12%, rgba(197,160,89,0.10), transparent 60%),' +
          'radial-gradient(760px 520px at 50% 118%, rgba(255,255,255,0.045), transparent 55%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth,
        animation: 'reign-fade-up 0.5s ease both',
        ...(card ? {
          background: CARD_BG,
          border: `1.5px solid ${CARD_BORDER}`,
          borderRadius: 16,
          boxShadow: CARD_SHADOW,
          padding: '38px 36px',
          boxSizing: 'border-box',
        } : {}),
      }}>
        {children}
      </div>
    </div>
  )
}

// ---------- Button (landing CTA style) ----------
export function Button({
  children, variant = 'primary', full = false, disabled = false,
  loading = false, style = {}, ...props
}) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, fontWeight: 700, fontSize: 15, padding: '15px 26px',
    fontFamily: font.sans, borderRadius: 100, transition: 'all 0.16s ease',
    width: full ? '100%' : 'auto',
    opacity: disabled || loading ? 0.55 : 1,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    border: '1.5px solid transparent', whiteSpace: 'nowrap',
  }
  const variants = {
    primary: { background: '#ffffff', color: '#0a0a0c', border: '1.5px solid #ffffff' },
    secondary: { background: 'transparent', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.25)' },
    ghost: { background: 'transparent', color: dark.textMuted, border: '1.5px solid transparent' },
    danger: { background: 'transparent', color: dark.red, border: `1.5px solid ${dark.red}` },
  }
  return (
    <button
      disabled={disabled || loading}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => e.preventDefault()}
      {...props}
    >
      {loading && <Spinner size={15} color={variant === 'primary' ? '#0a0a0c' : '#ffffff'} />}
      {children}
    </button>
  )
}

// ---------- Field + Input ----------
export function Field({ label, hint, error, children, style = {} }) {
  return (
    <label style={{ display: 'block', marginBottom: 16, ...style }}>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginBottom: 7 }}>
          {label}
        </div>
      )}
      {children}
      {hint && !error && (
        <div style={{ fontSize: 12.5, color: dark.textFaint, marginTop: 6 }}>{hint}</div>
      )}
      {error && (
        <div style={{ fontSize: 12.5, color: dark.red, marginTop: 6 }}>{error}</div>
      )}
    </label>
  )
}

export function Input({ style = {}, invalid = false, ...props }) {
  const idle = invalid ? dark.red : 'rgba(255,255,255,0.14)'
  return (
    <input
      className="reign-dark-field"
      style={{
        width: '100%', padding: '13px 15px', fontSize: 15,
        background: 'rgba(255,255,255,0.03)', color: '#ffffff',
        border: `1px solid ${idle}`, borderRadius: 10,
        outline: 'none', transition: 'border 0.15s', ...style,
      }}
      onFocus={(e) => { if (!invalid) e.target.style.borderColor = 'rgba(255,255,255,0.45)' }}
      onBlurCapture={(e) => { if (!invalid) e.target.style.borderColor = 'rgba(255,255,255,0.14)' }}
      {...props}
    />
  )
}

// ---------- Tabs ----------
export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', background: 'rgba(255,255,255,0.04)', padding: 4,
      borderRadius: 12, marginBottom: 22, gap: 4,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {tabs.map((t) => {
        const on = active === t.value
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            style={{
              flex: 1, padding: '10px', fontSize: 14, fontWeight: 600,
              borderRadius: 8, transition: 'all 0.15s',
              background: on ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: on ? '#ffffff' : dark.textFaint,
              border: `1px solid ${on ? 'rgba(255,255,255,0.14)' : 'transparent'}`,
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Toggle ----------
export function Toggle({ checked, onChange, label, description }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, padding: '14px 0', cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: '#ffffff' }}>{label}</div>
        {description && (
          <div style={{ color: dark.textFaint, fontSize: 12.5, marginTop: 3, maxWidth: 340 }}>
            {description}
          </div>
        )}
      </div>
      <div style={{
        width: 46, height: 27, borderRadius: 999, flexShrink: 0,
        background: checked ? dark.gold : 'rgba(255,255,255,0.08)',
        border: `1px solid ${checked ? dark.gold : 'rgba(255,255,255,0.2)'}`,
        position: 'relative', transition: 'all 0.18s ease',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 21 : 2,
          width: 21, height: 21, borderRadius: '50%', background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.45)', transition: 'all 0.18s ease',
        }} />
      </div>
    </div>
  )
}

// ---------- Card (frosted panel; `ink` = darker inset) ----------
export function Card({ children, style = {}, glow = false, ink = false, ...props }) {
  const frosted = {
    background: 'rgba(255,255,255,0.03)',
    border: '1.5px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  }
  const inkStyle = {
    background: 'rgba(0,0,0,0.45)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: 14,
  }
  return (
    <div {...props} style={{ ...(ink ? inkStyle : frosted), ...style }}>
      {children}
    </div>
  )
}
