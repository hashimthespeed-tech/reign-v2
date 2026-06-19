import { colors, font, radius, shadow } from '../theme'

// ---------- Brand wordmark ----------
// Matches the landing page exactly: REIGN in Cabinet Grotesk 900, tight
// tracking, followed by a small dot. `withMark` toggles the dot.
export function Logo({ size = 22, withMark = true, color = colors.text }) {
  const dot = Math.round(size * 0.3)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.4) }}>
      <span style={{
        fontFamily: font.display, fontWeight: 900, fontSize: size * 1.12,
        letterSpacing: '-0.02em', color, lineHeight: 1,
      }}>
        REIGN
      </span>
      {withMark && (
        <span style={{
          width: dot, height: dot, borderRadius: '50%',
          background: color, display: 'inline-block', flexShrink: 0,
        }} />
      )}
    </div>
  )
}

// ---------- Button ----------
export function Button({
  children, variant = 'primary', full = false, disabled = false,
  loading = false, style = {}, ...props
}) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, fontWeight: 600, fontSize: 15, padding: '13px 26px',
    fontFamily: font.sans, borderRadius: radius.pill, transition: 'all 0.16s ease',
    width: full ? '100%' : 'auto',
    opacity: disabled || loading ? 0.55 : 1,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    border: '1px solid transparent', whiteSpace: 'nowrap',
  }
  const variants = {
    primary: {
      background: '#ffffff', color: '#0a0a0c',
      border: '1px solid #ffffff',
    },
    secondary: {
      background: 'transparent', color: colors.text,
      border: `1px solid ${colors.borderStrong}`,
    },
    ghost: { background: 'transparent', color: colors.textMuted },
    danger: {
      background: 'transparent', color: colors.red,
      border: `1px solid ${colors.red}`,
    },
  }
  return (
    <button
      disabled={disabled || loading}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => e.preventDefault()}
      {...props}
    >
      {loading && <Spinner size={15} color={variant === 'primary' ? '#0a0a0c' : colors.text} />}
      {children}
    </button>
  )
}

// ---------- Text field ----------
export function Field({ label, hint, error, children, style = {} }) {
  return (
    <label style={{ display: 'block', marginBottom: 16, ...style }}>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 7 }}>
          {label}
        </div>
      )}
      {children}
      {hint && !error && (
        <div style={{ fontSize: 12.5, color: colors.textFaint, marginTop: 6 }}>{hint}</div>
      )}
      {error && (
        <div style={{ fontSize: 12.5, color: colors.red, marginTop: 6 }}>{error}</div>
      )}
    </label>
  )
}

export function Input({ style = {}, invalid = false, ...props }) {
  return (
    <input
      className="reign-dark-field"
      style={{
        width: '100%', padding: '12px 14px', fontSize: 15,
        background: colors.bgRaised, color: colors.text,
        border: `1px solid ${invalid ? colors.red : colors.border}`,
        borderRadius: radius.sm, outline: 'none', transition: 'border 0.15s',
        ...style,
      }}
      onFocus={(e) => { if (!invalid) e.target.style.borderColor = colors.gold }}
      onBlurCapture={(e) => { if (!invalid) e.target.style.borderColor = colors.border }}
      {...props}
    />
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
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{label}</div>
        {description && (
          <div style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 3, maxWidth: 340 }}>
            {description}
          </div>
        )}
      </div>
      <div style={{
        width: 46, height: 27, borderRadius: 999, flexShrink: 0,
        background: checked ? colors.gold : colors.bgRaised,
        border: `1px solid ${checked ? colors.gold : colors.borderStrong}`,
        position: 'relative', transition: 'all 0.18s ease',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 21 : 2,
          width: 21, height: 21, borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(10,10,12,0.25)',
          transition: 'all 0.18s ease',
        }} />
      </div>
    </div>
  )
}

// ---------- Tabs ----------
export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', background: colors.bgRaised, padding: 4,
      borderRadius: radius.md, marginBottom: 22, gap: 4,
    }}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          style={{
            flex: 1, padding: '10px', fontSize: 14, fontWeight: 600,
            borderRadius: radius.sm, transition: 'all 0.15s',
            background: active === t.value ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: active === t.value ? colors.text : colors.textFaint,
            border: `1px solid ${active === t.value ? 'rgba(255,255,255,0.14)' : 'transparent'}`,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Card ----------
// Default — frosted glass surface floating over the plexus background.
// variant 'ink' — solid piano-black emphasis card (matches the landing mockup).
// glow — gold ring on cards.
export function Card({ children, style = {}, glow = false, ink = false, ...props }) {
  const inkStyle = {
    background: colors.ink, border: `1.5px solid ${colors.inkBorder}`,
    borderRadius: radius.lg, boxShadow: shadow.ink, color: '#ffffff',
  }
  const frostedStyle = {
    background: colors.bgElevated, border: `1px solid ${colors.border}`,
    borderRadius: radius.lg, boxShadow: glow ? shadow.glow : shadow.card,
    backdropFilter: 'blur(12px) saturate(1.2)',
    WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
  }
  return (
    <div {...props} style={{ ...(ink ? inkStyle : frostedStyle), ...style }}>
      {children}
    </div>
  )
}

// ---------- Spinner ----------
export function Spinner({ size = 20, color = colors.gold }) {
  return (
    <span style={{
      width: size, height: size, display: 'inline-block', flexShrink: 0,
      border: `2px solid ${color}`, borderTopColor: 'transparent',
      borderRadius: '50%', animation: 'reign-spin 0.7s linear infinite',
    }} />
  )
}

// ---------- Centered auth/onboarding shell ----------
export function OnboardingShell({ children, maxWidth = 460 }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
      fontFamily: font.sans,
    }}>
      <div style={{ width: '100%', maxWidth, animation: 'reign-fade-up 0.45s ease both' }}>
        {children}
      </div>
    </div>
  )
}
