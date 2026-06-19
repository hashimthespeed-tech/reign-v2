// Reign design tokens — single source of truth for the "Network Vista" theme.
// Imported anywhere we use inline styles so the whole app stays consistent.
// Light / ivory-cream mood, matching the landing page design system.

export const colors = {
  // Canvas
  bg: '#f4f3ef',          // ivory cream base
  bgElevated: '#ffffff',  // cards
  bgRaised: '#e9e7e0',    // raised surfaces / inputs / chips
  bgHover: '#e2dfd6',

  // Lines
  border: 'rgba(10, 10, 12, 0.10)',
  borderStrong: 'rgba(10, 10, 12, 0.18)',

  // Text
  text: '#0a0a0c',        // primary
  textMuted: '#52525b',   // secondary
  textFaint: '#8a8a91',   // tertiary / disabled

  // Brand — "sovereign" gold
  gold: '#c5a059',
  goldSoft: '#d8b878',
  goldDim: 'rgba(197, 160, 89, 0.14)',

  // P&L semantics
  green: '#10b981',
  greenSoft: '#34d399',
  greenDim: 'rgba(16, 185, 129, 0.10)',
  red: '#ef4444',
  redSoft: '#f87171',
  redDim: 'rgba(239, 68, 68, 0.10)',

  // Accent (cool) — for info / links
  blue: '#3b6fd6',

  // Dark surface — for "hero"/emphasis cards (piano-black mockup look)
  ink: '#0a0a0c',
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
  card: '0 1px 2px rgba(10,10,12,0.04), 0 12px 32px rgba(10,10,12,0.07)',
  glow: '0 0 0 1px rgba(197,160,89,0.45), 0 10px 40px rgba(197,160,89,0.18)',
  // Glowing black emphasis card (matches landing's piano-black mockup/step cards)
  ink: '0 0 35px rgba(255,255,255,0.10), 0 30px 80px rgba(0,0,0,0.45)',
}

export const space = (n) => `${n * 4}px`
