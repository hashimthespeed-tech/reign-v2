// Reign design tokens — single source of truth for the "Network Vista" theme.
// Imported anywhere we use inline styles so the whole app stays consistent.
// Light / ivory-cream mood, matching the landing page design system.

export const colors = {
  // Canvas — dark "plexus" mood, matching the landing page's dark sections.
  bg: '#050507',                       // deep base
  bgElevated: 'rgba(255, 255, 255, 0.03)', // cards (frosted over the plexus)
  bgRaised: 'rgba(255, 255, 255, 0.05)',   // raised surfaces / inputs / chips
  bgHover: 'rgba(255, 255, 255, 0.09)',

  // Lines
  border: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.20)',

  // Text
  text: '#ffffff',        // primary
  textMuted: '#a1a1aa',   // secondary
  textFaint: '#71717a',   // tertiary / disabled

  // Brand — "sovereign" gold
  gold: '#c5a059',
  goldSoft: '#d8b878',
  goldDim: 'rgba(197, 160, 89, 0.16)',

  // P&L semantics
  green: '#10b981',
  greenSoft: '#34d399',
  greenDim: 'rgba(16, 185, 129, 0.14)',
  red: '#ef4444',
  redSoft: '#f87171',
  redDim: 'rgba(239, 68, 68, 0.14)',

  // Accent (cool) — for info / links
  blue: '#5b8def',

  // Solid emphasis surface — for "hero"/mockup cards (piano-black look)
  ink: '#000000',
  inkBorder: 'rgba(255, 255, 255, 0.45)',
}

export const font = {
  // Loaded in index.html: Plus Jakarta Sans (body) + Cabinet Grotesk (display).
  sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  display: "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace",
}

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '26px',
  pill: '100px',
}

export const shadow = {
  card: '0 4px 30px rgba(0,0,0,0.40)',
  glow: '0 0 0 1px rgba(197,160,89,0.50), 0 10px 40px rgba(197,160,89,0.20)',
  // Glowing black emphasis card (matches landing's piano-black mockup/step cards)
  ink: '0 0 35px rgba(255,255,255,0.12), 0 30px 80px rgba(0,0,0,0.90)',
}

export const space = (n) => `${n * 4}px`
